import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase';
import { 
  Home, 
  Trophy, 
  Flame, 
  BarChart2, 
  Grid,
  RefreshCw,
  X,
  User,
  Facebook,  // <--- Aggiunta
  Instagram, // <--- Aggiunta
  Youtube,    // <--- Aggiunta
  Share2
} from 'lucide-react';

export default function MobileApp() {
  const [activeTab, setActiveTab] = useState('home');

  // ==========================================
  // STATI PER I DATI GLOBALI
  // ==========================================
  const [activeEdition, setActiveEdition] = useState(null);
  const [calendarRaw, setCalendarRaw] = useState([]);
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeContestTab, setActiveContestTab] = useState('3pt'); // '3pt' o 'dunk'
  const [threePtTab, setThreePtTab] = useState('qualificazioni'); // 'qualificazioni' o 'playoff'
  const [threePtPlayoffTab, setThreePtPlayoffTab] = useState('batterie'); // 'batterie', 'semifinali', 'finale'
  const [dunkTab, setDunkTab] = useState('qualificazioni'); // 'qualificazioni' o 'finale'
  const [threePointData, setThreePointData] = useState([]);
  const [dunkData, setDunkData] = useState([]); // Assumendo esista una tabella per le schiacciate
  const [topScorers, setTopScorers] = useState([]);
  

  // ==========================================
  // STATI PER LA MODALE TABELLINO (BOX SCORE)
  // ==========================================
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [activeRosterTab, setActiveRosterTab] = useState('A');
  const [veroCupTab, setVeroCupTab] = useState('gironi');
  const [activeGroupTab, setActiveGroupTab] = useState(null);

  // ==========================================
  // GESTURE PER CHIUDERE IL TABELLINO COL DITO
  // ==========================================
  const touchStartY = React.useRef(0);

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    const touchEndY = e.changedTouches[0].clientY;
    // Se trascini il dito verso il basso per più di 100px, chiude il tabellino
    if (touchEndY - touchStartY.current > 100) {
      setSelectedMatch(null);
    }
  };

// ==========================================
  // FUNZIONE FETCH: Scarica il palinsesto e i Contest
  // ==========================================
  const loadData = async () => {
    setIsRefreshing(true);
    
    try {
      const { data: ed } = await supabase.from('editions').select('*').eq('is_active', true).single();
      
      if (ed) {
        setActiveEdition(ed);
        
        // --- 1. PALINSESTO ---
        const { data: cals } = await supabase
          .from('calendars')
          .select(`
            *,
            events(name),
            matches (
              *,
              match_types(name),
              team_a:team_a_id(group_name, teams(name, short_name)),
              team_b:team_b_id(group_name, teams(name, short_name))
            )
          `)
          .eq('edition_id', ed.id)
          .order('date', { ascending: true })
          .order('time', { ascending: true });
          
        if (cals) {
          setCalendarRaw(cals);
          const dates = [...new Set(cals.map(c => c.date).filter(Boolean))];
          setAvailableDates(dates);
          
          if (dates.length > 0 && !selectedDate) {
          const today = new Date();
          const offset = today.getTimezoneOffset() * 60000;
          const todayStr = (new Date(today - offset)).toISOString().split('T')[0];
          
          if (dates.includes(todayStr)) {
            // 1. OGGI È UNO DEI GIORNI DEL TORNEO -> Carica oggi
            setSelectedDate(todayStr);
          } else if (todayStr < dates[0]) {
            // 2. TORNEO DEVE ANCORA INIZIARE -> Carica il primo giorno di default
            setSelectedDate(dates[0]);
          } else if (todayStr > dates[dates.length - 1]) {
            // 3. TORNEO FINITO -> Carica l'ultimo giorno (le finali)
            setSelectedDate(dates[dates.length - 1]);
          } else {
            // Fallback di sicurezza (es. giorno di pausa in mezzo al torneo)
            setSelectedDate(dates[0]);
          }
        }
        }

        // --- 2. DATI 3-POINT CONTEST ---
        const { data: tpData, error: tpError } = await supabase.from('three_point').select('*').eq('edition_id', ed.id);
        if (tpData) setThreePointData(tpData);

        // --- 3. DATI SLAM DUNK CONTEST ---
        const { data: sdData, error: sdError } = await supabase.from('slam_dunk').select('*').eq('edition_id', ed.id);
        if (sdData) {
          setDunkData(sdData);
        } else if (sdError) {
          console.warn("Nessun dato Slam Dunk trovato o tabella non esistente:", sdError.message);
        }
        // --- 4. CLASSIFICA MARCATORI (VERO CUP) ---
        try {
          const { data: ev } = await supabase.from('events').select('id').ilike('name', '%vero cup%').single();
          if (ev) {
            const { data: tee } = await supabase.from('teams_edition_events').select('id').eq('edition_id', ed.id).eq('event_id', ev.id);
            if (tee && tee.length > 0) {
              const teeIds = tee.map(t => t.id);
              const { data: mData } = await supabase.from('matches').select('id').in('team_a_id', teeIds);
              if (mData && mData.length > 0) {
                const matchIds = mData.map(m => m.id);
                const { data: points } = await supabase.from('match_points')
                  .select('player_id, points, match_id, players(first_name, last_name)')
                  .in('match_id', matchIds);

                if (points) {
                  const playerStats = {};
                  points.forEach(p => {
                    if (!playerStats[p.player_id]) {
                      playerStats[p.player_id] = {
                        id: p.player_id,
                        first_name: p.players?.first_name || '',
                        last_name: p.players?.last_name || '',
                        totalPoints: 0,
                        matchesPlayed: new Set()
                      };
                    }
                    playerStats[p.player_id].totalPoints += p.points;
                    playerStats[p.player_id].matchesPlayed.add(p.match_id); // Set garantisce l'unicità dei match
                  });

                  const processedScorers = Object.values(playerStats).map(p => ({
                    ...p,
                    games: p.matchesPlayed.size,
                    avgPoints: (p.totalPoints / p.matchesPlayed.size).toFixed(1)
                  })).sort((a, b) => {
                    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
                    return b.avgPoints - a.avgPoints;
                  }).slice(0, 10);

                  setTopScorers(processedScorers);
                }
              }
            }
          }
        } catch (err) {
          console.error("Errore fetch marcatori:", err);
        }
      }
    } catch (error) {
      console.error("Errore generale durante il caricamento dati:", error);
    } finally {
      // Questo viene eseguito SEMPRE, sia che vada bene sia che ci sia un errore!
      setIsRefreshing(false);
    }
  };

useEffect(() => {
    loadData();
  }, []);

  // ==========================================
  // LOCK DELLO SCROLL SUL BODY QUANDO LA MODALE È APERTA
  // ==========================================
  useEffect(() => {
    if (selectedMatch) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedMatch]); // <--- Questo si attiva ogni volta che apri/chiudi un tabellino

  // ==========================================
  // FETCH DETTAGLIO MATCH (TABELLINO LIVE)
  // ==========================================
  const openMatchDetail = async (matchId) => {
    setModalLoading(true);
    setActiveRosterTab('A');
    
    // 1. Scarica i dettagli del match principale
    const { data: match } = await supabase
      .from('matches')
      .select(`
        *,
        match_types(name),
        team_a:team_a_id(team_id, event_id, coach, assistant_coach, group_name, teams(name, short_name)),
        team_b:team_b_id(team_id, coach, assistant_coach, group_name, teams(name, short_name))
      `)
      .eq('id', matchId)
      .single();

    if (match) {
      // 2. Scarica i roster completi delle due squadre
      const { data: rosterA } = await supabase
        .from('rosters')
        .select(`id, player_id, jersey_number, players(first_name, last_name)`)
        .eq('team_id', match.team_a.team_id)
        .eq('edition_id', activeEdition.id);

      const { data: rosterB } = await supabase
        .from('rosters')
        .select(`id, player_id, jersey_number, players(first_name, last_name)`)
        .eq('team_id', match.team_b.team_id)
        .eq('edition_id', activeEdition.id);

      // 3. Scarica tutti i punti segnati in questo specifico match
      const { data: points } = await supabase
        .from('match_points')
        .select('*')
        .eq('match_id', matchId);

      // Helper per mappare i punti sul rispettivo giocatore e ordinarli dal top scorer in giù
      const mapPointsToRoster = (roster) => {
        if (!roster) return [];
        return roster.map(r => {
          const totalPoints = points
            ?.filter(p => p.player_id === r.player_id)
            .reduce((sum, p) => sum + p.points, 0) || 0;
          return { ...r, match_points: totalPoints };
        }).sort((a, b) => b.match_points - a.match_points); // Ordinati per chi ha fatto più punti!
      };

      setSelectedMatch({
        ...match,
        roster_a: mapPointsToRoster(rosterA),
        roster_b: mapPointsToRoster(rosterB),
      });
    }
    setModalLoading(false);
  };

  const formatDayMonth = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).toUpperCase();
  };

  // ==========================================
  // COMPONENTE CARD PARTITA (Compatta, con Data e Ora)
  // ==========================================
  const renderMatchCard = (m, labelContext = null) => {
    const isConclusa = m.status === 'conclusa' || m.status === 'finished';
    const isLive = m.status === 'live';
    const aWon = isConclusa && m.score_a > m.score_b;
    const bWon = isConclusa && m.score_b > m.score_a;

    // Formattiamo data e ora se le abbiamo passate
    let dateTimeStr = '';
    if (m.match_date && m.match_time) {
      const d = new Date(m.match_date);
      const dayMonth = d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }).toUpperCase();
      dateTimeStr = `${dayMonth} - ${m.match_time.substring(0, 5)}`;
    }

    const isGirone = labelContext && labelContext.toLowerCase().includes('girone');
    
    // Costruiamo il testo in alto a sinistra
    const leftText = isGirone 
      ? dateTimeStr // Solo data e ora per i gironi
      : (labelContext ? `${labelContext}${dateTimeStr ? ` • ${dateTimeStr}` : ''}` : dateTimeStr);

    return (
      <div 
        key={m.id} 
        onClick={() => openMatchDetail(m.id)} 
        className="relative overflow-hidden rounded-xl bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800/80 shadow-sm p-3 transition-all active:scale-[0.98] cursor-pointer [-webkit-tap-highlight-color:transparent]"
      >
        {/* Bordino superiore rosso se è live */}
        {isLive && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-400"></div>}

        {/* HEADER CARD */}
        <div className="flex justify-between items-center mb-2 border-b border-neutral-800/60 pb-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-pink-500 drop-shadow-sm truncate pr-2">
            {leftText}
          </span>
          
          {isLive ? (
            <span className="flex items-center gap-1.5 text-[9px] font-black text-red-500 uppercase tracking-widest shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>LIVE
            </span>
          ) : isConclusa ? (
            <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest shrink-0">Finale</span>
          ) : (
            <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest shrink-0">Da Giocare</span>
          )}
        </div>

        {/* SQUADRE E PUNTEGGI RAVVICINATI */}
        <div className="flex flex-col gap-1.5">
          {/* Squadra A */}
          <div className="flex justify-between items-center">
            <span className={`text-sm font-bold uppercase truncate pr-2 ${isConclusa && bWon ? 'text-neutral-500' : 'text-white'}`}>
              {m.team_a?.teams?.name || 'TBD'}
            </span>
            <span className={`text-xl font-black tabular-nums tracking-tighter ${isLive ? 'text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]' : (isConclusa && aWon ? 'text-white' : 'text-neutral-500')}`}>
              {m.score_a ?? '-'}
            </span>
          </div>

          {/* Squadra B */}
          <div className="flex justify-between items-center">
            <span className={`text-sm font-bold uppercase truncate pr-2 ${isConclusa && aWon ? 'text-neutral-500' : 'text-white'}`}>
              {m.team_b?.teams?.name || 'TBD'}
            </span>
            <span className={`text-xl font-black tabular-nums tracking-tighter ${isLive ? 'text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]' : (isConclusa && bWon ? 'text-white' : 'text-neutral-500')}`}>
              {m.score_b ?? '-'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const getFormattedDateParts = (dateStr) => {
    if (!dateStr) return { weekday: '???', dayNum: '00' };
    const d = new Date(dateStr);
    const giorni = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'];
    return {
      weekday: giorni[d.getDay()],
      dayNum: d.getDate()
    };
  };

  // ==========================================
  // RENDER DEI CONTENUTI DEI TAB
  // ==========================================
  const renderTabContent = () => {
    switch (activeTab) {
      case 'home':
        const dayMatches = calendarRaw.filter(c => c.date === selectedDate);
        return (
          <div className="animate-in fade-in duration-300 flex flex-col h-full">
            
            <div className="flex items-center justify-between mb-4">
               <h2 className="text-2xl font-black text-pink-500 uppercase tracking-wider">Programma</h2>
               <button 
                 onClick={loadData} 
                 className={`p-2 bg-neutral-900 border border-neutral-800 rounded-full transition-all active:scale-95 ${isRefreshing ? 'animate-spin text-pink-500' : 'text-neutral-400 hover:text-white'}`}
               >
                 <RefreshCw size={16} />
               </button>
            </div>
            
            {/* NUOVO CALENDAR STRIP HUB - STILE PREMIUM NBA */}
            <div className="flex gap-3 overflow-x-auto pb-4 pt-1 px-1 scrollbar-none whitespace-nowrap w-full">
              {availableDates.map((dateStr) => {
                const isActive = selectedDate === dateStr;
                const { weekday, dayNum } = getFormattedDateParts(dateStr);

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`appearance-none outline-none focus:ring-0 flex flex-col items-center justify-center w-16 h-20 shrink-0 rounded-2xl border transition-all duration-300 ${
                      isActive
                        ? 'bg-gradient-to-b from-neutral-800 to-neutral-900 border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.25)] scale-105'
                        : 'bg-neutral-950/60 border-neutral-800/80 hover:border-neutral-700'
                    }`}
                  >
                    {/* Giorno della settimana (LUN, MAR...) */}
                    <span className={`text-[10px] font-black tracking-widest uppercase transition-colors ${
                      isActive ? 'text-pink-500' : 'text-neutral-500'
                    }`}>
                      {weekday}
                    </span>
                    
                    {/* Numero del giorno (15, 16...) */}
                    <span className={`text-2xl font-black tabular-nums tracking-tighter mt-1 transition-colors ${
                      isActive ? 'text-white' : 'text-neutral-400'
                    }`}>
                      {dayNum}
                    </span>
                    
                    {/* Indicatorino minimal a fondo card solo per l'attivo */}
                    {isActive && (
                      <div className="w-4 h-0.5 bg-pink-500 rounded-full mt-1.5 shadow-[0_0_8px_rgba(236,72,153,1)]"></div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* LISTA MATCH (ORA CLICCABILI) */}
            <div className="flex flex-col gap-3 pb-6">
              {dayMatches.length === 0 ? (
                 <div className="text-center py-10 bg-neutral-900/50 border border-neutral-800 rounded-2xl text-neutral-500 uppercase font-bold tracking-widest text-xs">
                   Nessun evento programmato
                 </div>
              ) : (
                dayMatches.map(item => {
                  const m = item.matches;
                  const isMatch = !!m;
                  const isLive = isMatch && m.status === 'live';
                  const isConclusa = isMatch && (m.status === 'conclusa' || m.status === 'finished');
                  
                  const aWon = isConclusa && m.score_a > m.score_b;
                  const bWon = isConclusa && m.score_b > m.score_a;

                  return (
                    <div 
                      key={item.id} 
                      onClick={() => isMatch && openMatchDetail(m.id)}
                      className={`bg-black/60 backdrop-blur-md border ${isLive ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]' : 'border-neutral-800'} ${isMatch ? 'cursor-pointer active:scale-[0.98]' : ''} rounded-2xl p-4 flex gap-4 items-center relative overflow-hidden transition-transform`}
                    >
                       {isLive && <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none"></div>}

                       <div className="flex flex-col items-center justify-center shrink-0 w-[50px] border-r border-neutral-800/80 pr-4">
                         <span className="text-xl font-black text-white tabular-nums">{item.time?.substring(0,5)}</span>
                         {isLive && (
                           <span className="text-[9px] text-red-500 font-black uppercase tracking-widest mt-1 flex items-center gap-1">
                             <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>LIVE
                           </span>
                         )}
                         {isConclusa && <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest mt-1">FINALE</span>}
                       </div>
                       
                       <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[9px] text-pink-500 font-bold uppercase tracking-widest truncate drop-shadow-sm">
  {item.events?.name || 'Evento Basketville'} 
  {/* Mostra il girone solo se è Vero Cup E il tipo match contiene "gironi" o ha ID 1 */}
  {isMatch && 
   item.events?.name?.toLowerCase().includes('vero cup') && 
   (m.match_type_id === 1 || m.match_types?.name?.toLowerCase().includes('giron')) && 
   m?.team_a?.group_name ? ` • Girone ${m.team_a.group_name}` : ''}
</span>
                            {isMatch && (
                              <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">
                                vedi dettagli ➔
                              </span>
                            )}
                          </div>
                          
                          {isMatch ? (
                            <div className="flex flex-col gap-1.5">
                              <div className="flex justify-between items-center">
                                <span className={`font-bold uppercase truncate text-[15px] ${isConclusa && bWon ? 'text-neutral-500' : 'text-white'}`}>
                                  {m.team_a?.teams?.name || 'TBD'}
                                </span>
                                <span className={`font-black text-xl tabular-nums ml-3 ${isLive ? 'text-red-400' : (isConclusa && aWon ? 'text-white' : 'text-neutral-400')}`}>
                                  {m.score_a ?? '-'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className={`font-bold uppercase truncate text-[15px] ${isConclusa && aWon ? 'text-neutral-500' : 'text-white'}`}>
                                  {m.team_b?.teams?.name || 'TBD'}
                                </span>
                                <span className={`font-black text-xl tabular-nums ml-3 ${isLive ? 'text-red-400' : (isConclusa && bWon ? 'text-white' : 'text-neutral-400')}`}>
                                  {m.score_b ?? '-'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="font-bold text-white uppercase truncate text-sm mt-2 leading-tight">
                              {item.description || item.events?.name}
                            </div>
                          )}
                       </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="h-6"></div>
          </div>
        );
      case 'verocup': {
        // 1. Estraiamo tutte le partite portandoci dietro il nome dell'evento dal calendario!
        const allMatches = calendarRaw.filter(c => c.matches).map(c => ({
          ...c.matches,
          match_date: c.date,
          match_time: c.time,
          event_name: c.events?.name || '' // <--- IL TRAPIANTO SALVA-VITA È QUI!
        }));

        // 2. Filtriamo solo i match dei Gironi ESCLUSIVAMENTE DELLA VERO CUP
        const groupMatches = allMatches.filter(m => 
          m.event_name.toLowerCase().includes('vero cup') && 
          (m.match_type_id === 1 || m.match_types?.name?.toLowerCase().includes('giron'))
        );
        
        // 3. Estraiamo le squadre uniche
        const teamsMap = {};
        groupMatches.forEach(m => {
          if (m.team_a && m.team_a.group_name) {
            teamsMap[m.team_a_id] = { id: m.team_a_id, name: m.team_a.teams?.name, group: m.team_a.group_name, w: 0, l: 0, pt: 0, pf: 0, ps: 0 };
          }
          if (m.team_b && m.team_b.group_name) {
            teamsMap[m.team_b_id] = { id: m.team_b_id, name: m.team_b.teams?.name, group: m.team_b.group_name, w: 0, l: 0, pt: 0, pf: 0, ps: 0 };
          }
        });

        // 4. Calcoliamo W, L, PT, PF, PS
        groupMatches.forEach(m => {
          if (m.status === 'conclusa' || m.status === 'finished') {
            const tA = teamsMap[m.team_a_id];
            const tB = teamsMap[m.team_b_id];
            if (tA && tB) {
              tA.pf += (m.score_a || 0);
              tA.ps += (m.score_b || 0);
              tB.pf += (m.score_b || 0);
              tB.ps += (m.score_a || 0);

              if (m.score_a > m.score_b) { tA.w++; tA.pt += 2; tB.l++; }
              else if (m.score_b > m.score_a) { tB.w++; tB.pt += 2; tA.l++; }
            }
          }
        });

        // 5. Raggruppiamo e ordiniamo i gironi
        const groups = {};
        Object.values(teamsMap).forEach(t => {
          if (!groups[t.group]) groups[t.group] = [];
          groups[t.group].push(t);
        });
        const groupNames = Object.keys(groups).sort();
        groupNames.forEach(g => {
          groups[g].sort((a, b) => {
            if (b.pt !== a.pt) return b.pt - a.pt;
            return (b.pf - b.ps) - (a.pf - a.ps);
          });
        });

        const displayGroup = activeGroupTab && groupNames.includes(activeGroupTab) ? activeGroupTab : groupNames[0];

        // 6. PLAYOFF MATCHES BLINDATI: Solo Vero Cup, niente imbucati!
        const playoffMatches = allMatches.filter(m => 
          m.event_name.toLowerCase().includes('vero cup') && 
          m.match_type_id > 1 && 
          !m.match_types?.name?.toLowerCase().includes('giron')
        );

        return (
          <div className="animate-in fade-in duration-300 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
               <h2 className="text-2xl font-black text-pink-500 uppercase tracking-wider">VERO Cup 2026</h2>
               <button 
                 onClick={loadData} 
                 className={`p-2 bg-neutral-900 border border-neutral-800 rounded-full transition-all active:scale-95 ${isRefreshing ? 'animate-spin text-pink-500' : 'text-neutral-400 hover:text-white'}`}
               >
                 <RefreshCw size={16} />
               </button>
            </div>
            
            {/* SWITCH GIRONI / PLAYOFF */}
            <div className="flex bg-neutral-900/80 border border-neutral-800 rounded-xl p-1 mb-2 shadow-inner">
              <button
                onClick={() => setVeroCupTab('gironi')}
                className={`appearance-none outline-none focus:outline-none focus:ring-0 active:outline-none [-webkit-tap-highlight-color:transparent] flex-1 py-2 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all border ${
                  veroCupTab === 'gironi' 
                    ? 'bg-neutral-800 text-white shadow-sm border-neutral-700' 
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Gironi
              </button>
              <button
                onClick={() => setVeroCupTab('playoff')}
                className={`appearance-none outline-none focus:outline-none focus:ring-0 active:outline-none [-webkit-tap-highlight-color:transparent] flex-1 py-2 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all border ${
                  veroCupTab === 'playoff' 
                    ? 'bg-neutral-800 text-white shadow-sm border-neutral-700' 
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Playoff
              </button>
            </div>

            {/* VISTA GIRONI */}
            {veroCupTab === 'gironi' && (
              <div className="flex flex-col pb-6">
                {groupNames.length === 0 ? (
                  <p className="text-center text-neutral-500 text-xs font-bold uppercase tracking-widest mt-4 bg-neutral-900/50 py-8 rounded-2xl border border-neutral-800">Nessun girone disponibile</p>
                ) : (
                  <>
                    {/* SELETTORE DEL GIRONE (Sub-Tabs a pillola) */}
                    {groupNames.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto pb-2 mt-6 mb-6 snap-x [&::-webkit-scrollbar]:hidden">
                        {groupNames.map(g => (
                          <button
                            key={g}
                            onClick={() => setActiveGroupTab(g)}
                            className={`outline-none focus:outline-none [-webkit-tap-highlight-color:transparent] shrink-0 px-5 py-2 rounded-full font-black uppercase tracking-widest text-[11px] border transition-all snap-start ${
                              displayGroup === g 
                                ? 'bg-pink-500 text-white border-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.4)]' 
                                : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-white'
                            }`}
                          >
                            Girone {g}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* CONTENUTO DEL GIRONE SELEZIONATO */}
                    {displayGroup && (
                      <div key={displayGroup} className="flex flex-col gap-5 animate-in fade-in slide-in-from-right-4 duration-300">
                        
                        {/* CLASSIFICA */}
                        <div className="bg-black/40 border border-neutral-800/80 rounded-2xl overflow-hidden shadow-sm">
                          <div className="bg-neutral-900 px-4 py-3 flex items-center justify-between">
                            <span className="font-black text-pink-500 uppercase tracking-widest text-sm">Classifica</span>
                          </div>
                          
                          <div className="flex text-[9px] font-bold text-neutral-500 uppercase tracking-widest px-4 py-2 bg-black/60">
                            <div className="w-5 shrink-0"></div> 
                            <div className="flex-1">Squadra</div>
                            <div className="w-8 shrink-0 text-center">W</div>
                            <div className="w-8 shrink-0 text-center">L</div>
                            <div className="w-8 shrink-0 text-center">PF</div>
                            <div className="w-8 shrink-0 text-center">PS</div>
                            <div className="w-8 shrink-0 text-center text-pink-500">PT</div>
                          </div>
                          
                          <div className="flex flex-col">
                            {groups[displayGroup].map((team, idx) => (
                              <div key={team.id} className="flex items-center px-4 py-3.5 even:bg-white/[0.02]">
                                <div className="w-5 shrink-0 text-[11px] font-black text-neutral-600">{idx + 1}</div>
                                <div className="flex-1 text-[12px] font-bold text-white uppercase truncate pr-2">{team.name}</div>
                                <div className="w-8 shrink-0 text-center text-[11px] font-bold text-neutral-400">{team.w}</div>
                                <div className="w-8 shrink-0 text-center text-[11px] font-bold text-neutral-400">{team.l}</div>
                                <div className="w-8 shrink-0 text-center text-[11px] font-bold text-neutral-400">{team.pf}</div>
                                <div className="w-8 shrink-0 text-center text-[11px] font-bold text-neutral-400">{team.ps}</div>
                                <div className="w-8 shrink-0 text-center text-base font-black text-pink-400 self-center leading-none">{team.pt}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* PARTITE DEL GIRONE */}
                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1 mb-1">Risultati Girone {displayGroup}</span>
                          {groupMatches
                            .filter(m => (m.team_a && m.team_a.group_name === displayGroup) || (m.team_b && m.team_b.group_name === displayGroup))
                            .map(m => renderMatchCard(m, `Girone ${displayGroup}`))
                          }
                        </div>

                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* VISTA PLAYOFF DIVISA PER CATEGORIA */}
            {veroCupTab === 'playoff' && (
              <div className="flex flex-col pb-6 animate-in fade-in slide-in-from-right-4 duration-300">
                 {playoffMatches.length === 0 ? (
                    <p className="text-center text-neutral-500 text-xs font-bold uppercase tracking-widest mt-4 bg-neutral-900/50 py-8 rounded-2xl border border-neutral-800">Tabellone in aggiornamento</p>
                 ) : (
                    (() => {
                      // Dividiamo i match al volo usando le stesse logiche di OBS
                      // Dividiamo i match escludendo i falsi positivi testuali!
                      const semis = playoffMatches.filter(m => 
                        m.match_type_id === 2 || 
                        m.match_types?.name?.toLowerCase().includes('semi')
                      );
                      
                      const finals = playoffMatches.filter(m => 
                        m.match_type_id === 3 || 
                        (m.match_types?.name?.toLowerCase().includes('final') && !m.match_types?.name?.toLowerCase().includes('semi')) // <--- BLINDATO QUI!
                      );
                      
                      const others = playoffMatches.filter(m => 
                        m.match_type_id !== 2 && 
                        m.match_type_id !== 3 && 
                        !m.match_types?.name?.toLowerCase().includes('semi') && 
                        !m.match_types?.name?.toLowerCase().includes('final')
                      );

                      return (
                        <div className="flex flex-col gap-5">
                          
                          {/* SEZIONE SEMIFINALI */}
                          {semis.length > 0 && (
                            <div className="flex flex-col gap-2.5">
                              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-500 ml-1">
                                ➔ Semifinali
                              </span>
                              {semis.map(m => renderMatchCard(m, m.match_types?.name))}
                            </div>
                          )}

                          {/* DIVISORE DI DESIGN TRA SEMIFINALI E FINALE */}
                          {semis.length > 0 && finals.length > 0 && (
                            <div className="flex items-center gap-4 my-2 px-1">
                              <div className="h-px flex-1 bg-neutral-800/60"></div>
                              <div className="w-2 h-2 rounded-full bg-pink-500/20 border border-pink-500/40 shadow-[0_0_8px_rgba(236,72,153,0.4)] shrink-0"></div>
                              <div className="h-px flex-1 bg-neutral-800/60"></div>
                            </div>
                          )}

                          {/* SEZIONE FINALE */}
                          {finals.length > 0 && (
                            <div className="flex flex-col gap-2.5">
                              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-pink-500 ml-1 drop-shadow-[0_0_6px_rgba(236,72,153,0.2)]">
                                👑 Finalissima Vero Cup
                              </span>
                              {finals.map(m => renderMatchCard(m, m.match_types?.name))}
                            </div>
                          )}

                          {/* Altri match di consolazione/posizionamento se presenti */}
                          {others.length > 0 && (
                            <div className="flex flex-col gap-2.5">
                              {others.map(m => renderMatchCard(m, m.match_types?.name))}
                            </div>
                          )}

                        </div>
                      );
                    })()
                 )}
              </div>
            )}
          </div>
        );
      }
      case 'contest': {
        // ==========================================
        // MOTORE DATI 3-POINT CONTEST REALE
        // ==========================================
        const real3PtQual = [...threePointData]
          .filter(p => p.round === 'Qualificazione')
          .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return (parseFloat(a.time) || 999) - (parseFloat(b.time) || 999);
          })
          .slice(0, 12); // <--- Aggiunto il taglio ai primi 12
        
        // Helper per accoppiare i giocatori nelle batterie (quarti, semi, finale)
        // Helper per accoppiare i giocatori nelle batterie (quarti, semi, finale)
        const getMatchups = (roundName) => {
          const players = threePointData.filter(p => p.round === roundName);
          const heats = {};
          players.forEach(p => {
             if(!heats[p.heat]) heats[p.heat] = [];
             heats[p.heat].push(p);
          });
          
          return Object.values(heats).map((heatPlayers, index) => {
             // Ordiniamo subito: chi ha più punti o, a parità, meno tempo, sta in cima
             const sortedPlayers = [...heatPlayers].sort((a, b) => {
                if (b.score !== a.score) return (b.score || 0) - (a.score || 0);
                return (parseFloat(a.time) || 999) - (parseFloat(b.time) || 999);
             });
             
             return {
                id: `${roundName}-${index}`,
                players: sortedPlayers
             };
          });
        };

        const real3PtPlayoff = {
          batterie: getMatchups('Quarti di finale'),
          semifinali: getMatchups('Semifinale'),
          finale: getMatchups('Finale')
        };
        
        // ==========================================
        // MOTORE DATI SLAM DUNK REALE
        // ==========================================
        const processDunks = (roundName) => {
           return dunkData
             .filter(d => d.round === roundName)
             .map(d => ({
                id: d.id || d.player_name,
                name: d.player_name,
                team: d.team || '',
                dunk_1: d.dunk_1 || 0,
                dunk_2: d.dunk_2 || 0,
                score: (d.dunk_1 || 0) + (d.dunk_2 || 0)
             }))
             .sort((a, b) => b.score - a.score);
        };

        const realDunkQual = processDunks('Qualificazione');
        const realDunkFinale = processDunks('Finale');

        return (
          <div className="animate-in fade-in duration-300 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
               <h2 className="text-2xl font-black text-pink-500 uppercase tracking-wider">All-Star Game</h2>
               <button onClick={loadData} className={`p-2 bg-neutral-900 border border-neutral-800 rounded-full transition-all active:scale-95 ${isRefreshing ? 'animate-spin text-pink-500' : 'text-neutral-400 hover:text-white'}`}>
                 <RefreshCw size={16} />
               </button>
            </div>

            {/* MAIN SWITCHER CONTEST */}
            <div className="flex bg-neutral-900/80 border border-neutral-800 rounded-xl p-1 mb-4 shadow-inner">
              <button
                onClick={() => setActiveContestTab('3pt')}
                className={`appearance-none outline-none focus:ring-0 flex-1 py-2 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all border ${
                  activeContestTab === '3pt' ? 'bg-neutral-800 text-white shadow-sm border-transparent' : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                3-Point Contest
              </button>
              <button
                onClick={() => setActiveContestTab('dunk')}
                className={`appearance-none outline-none focus:ring-0 flex-1 py-2 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all border ${
                  activeContestTab === 'dunk' ? 'bg-neutral-800 text-white shadow-sm border-transparent' : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Slam Dunk
              </button>
            </div>

            {/* =========================================
                VISTA 3-POINT CONTEST
                ========================================= */}
            {activeContestTab === '3pt' && (
              <div className="flex flex-col animate-in fade-in slide-in-from-right-4 duration-300 pb-6">
                
                <div className="flex gap-2 overflow-x-auto pb-2 mb-4 snap-x [&::-webkit-scrollbar]:hidden">
                  <button onClick={() => setThreePtTab('qualificazioni')} className={`outline-none focus:outline-none [-webkit-tap-highlight-color:transparent] shrink-0 px-5 py-2 rounded-full font-black uppercase tracking-widest text-[11px] border transition-all snap-start ${threePtTab === 'qualificazioni' ? 'bg-pink-500 text-white border-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.4)]' : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-white'}`}>
                    Qualificazioni
                  </button>
                  <button onClick={() => setThreePtTab('playoff')} className={`outline-none focus:outline-none [-webkit-tap-highlight-color:transparent] shrink-0 px-5 py-2 rounded-full font-black uppercase tracking-widest text-[11px] border transition-all snap-start ${threePtTab === 'playoff' ? 'bg-pink-500 text-white border-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.4)]' : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-white'}`}>
                    Playoff
                  </button>
                </div>

                {threePtTab === 'qualificazioni' && (
                  <div className="flex flex-col gap-3">
                    {real3PtQual.length === 0 ? (
                      <div className="p-6 text-center text-[10px] border border-dashed border-neutral-800 rounded-xl text-neutral-500 uppercase tracking-widest font-bold">
                        Nessun dato disponibile
                      </div>
                    ) : (
                      real3PtQual.map((p, idx) => (
                        <div key={p.id} className="bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800/80 rounded-2xl p-4 flex items-center justify-between relative overflow-hidden shadow-sm transition-transform active:scale-[0.98]">

                          {/* Posizione e Anagrafica */}
                          <div className="flex items-center gap-4 z-10 min-w-0">
                            <span className="text-xl font-black text-neutral-600 w-5 text-center shrink-0">{idx + 1}</span>
                            <div className="flex flex-col min-w-0 pr-2">
                              <span className="text-lg font-black text-white uppercase truncate">{p.player_name}</span>
                              {p.team && <span className="text-[10px] font-bold text-pink-500 uppercase tracking-widest truncate">{p.team}</span>}
                            </div>
                          </div>

                          {/* Dettagli Tecnici: Tempo e Punti */}
                          <div className="flex items-center gap-5 z-10 shrink-0">
                            <div className="flex flex-col items-center justify-center">
                               <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Tempo</span>
                               <span className="text-[11px] font-mono text-neutral-400 bg-black/60 px-2 py-0.5 rounded border border-neutral-800">{p.time}s</span>
                            </div>
                            <div className="flex flex-col items-end justify-center border-l border-neutral-800/80 pl-5">
                               <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-0.5">Punti</span>
                               <span className="text-3xl font-black text-pink-400 tabular-nums leading-none drop-shadow-[0_0_8px_rgba(236,72,153,0.3)]">{p.score}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {threePtTab === 'playoff' && (
                  <div className="flex flex-col mt-2">
                    
                    {/* TABS FASI PLAYOFF RITROVATI! */}
                    <div className="flex bg-neutral-900/50 border border-neutral-800 rounded-lg p-1 mb-4 shadow-inner">
                      {['batterie', 'semifinali', 'finale'].map((fase) => (
                        <button
                          key={fase}
                          onClick={() => setThreePtPlayoffTab(fase)}
                          className={`appearance-none outline-none focus:ring-0 flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${
                            threePtPlayoffTab === fase 
                              ? 'bg-neutral-800 text-white shadow-sm' 
                              : 'text-neutral-500 hover:text-neutral-300'
                          }`}
                        >
                          {fase}
                        </button>
                      ))}
                    </div>

                    {/* LISTA MATCH DELLA FASE SELEZIONATA */}
                    <div className="flex flex-col gap-3">
                      {real3PtPlayoff[threePtPlayoffTab].length === 0 ? (
                        <div className="text-center py-6 text-neutral-500 text-xs font-bold uppercase tracking-widest border border-dashed border-neutral-800 rounded-xl">
                          Nessuna sfida programmata
                        </div>
                      ) : (
                        real3PtPlayoff[threePtPlayoffTab].map(heat => {
                          const hasPlayed = heat.players.length > 0 && heat.players[0].score > 0;
                          const tieBreaker = hasPlayed && heat.players.length > 1 && heat.players[0].score === heat.players[1].score;
                          
                          // Variabile per capire se siamo nella card della Finalissima
                          const isFinaleCard = threePtPlayoffTab === 'finale';

                          return (
                            <div key={heat.id} className={`bg-gradient-to-br from-neutral-900 to-neutral-950 border rounded-2xl p-4 flex flex-col gap-3 shadow-sm transition-transform active:scale-[0.98] ${isFinaleCard && hasPlayed ? 'border-yellow-500/30' : 'border-neutral-800/80'}`}>
                              
                              <div className="flex flex-col gap-3 w-full z-10">
                                {heat.players.map((p, idx) => {
                                  const isWinner = hasPlayed && idx === 0;
                                  const isChampion = isFinaleCard && isWinner; // È il campione se vince la finale
                                  const showGreenTime = isWinner && tieBreaker;

                                  return (
                                    <React.Fragment key={p.id || idx}>
                                      {/* Separatore */}
                                      {idx > 0 && <div className="h-px w-full bg-neutral-800/60 my-0.5"></div>}
                                      
                                      {/* w-full aggiunto qui per occupare tutto lo spazio */}
                                      <div className="flex justify-between items-center w-full">
                                        
                                        {/* flex-1 spinge gli elementi successivi verso destra */}
                                        <div className="flex items-center gap-2 min-w-0 flex-1 pr-4">
                                          {isChampion && (
                                            <span className="text-xl drop-shadow-md shrink-0">👑</span>
                                          )}
                                          <span className={`text-lg font-black uppercase truncate ${isChampion ? 'text-yellow-400' : isWinner ? 'text-white' : 'text-neutral-500'}`}>
                                            {p.player_name || 'TBD'}
                                          </span>
                                        </div>

                                        {/* justify-end allinea perfettamente al margine destro */}
                                        <div className="flex items-center justify-end gap-4 shrink-0">
                                          <span className={`text-[11px] font-mono px-2 py-1 rounded border ${showGreenTime ? 'text-green-400 border-green-500/30 bg-green-500/10 shadow-[0_0_8px_rgba(34,197,94,0.3)]' : 'text-neutral-500 bg-black/60 border-neutral-800'}`}>
                                            {p.time || '0.0'}s
                                          </span>
                                          <span className={`text-3xl w-10 text-right font-black tabular-nums tracking-tighter ${isChampion ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]' : isWinner ? 'text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.3)]' : 'text-neutral-600'}`}>
                                            {p.score || 0}
                                          </span>
                                        </div>

                                      </div>
                                    </React.Fragment>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* =========================================
                VISTA SLAM DUNK
                ========================================= */}
            {activeContestTab === 'dunk' && (
              <div className="flex flex-col animate-in fade-in slide-in-from-right-4 duration-300 pb-6">
                <div className="flex gap-2 overflow-x-auto pb-2 mb-4 snap-x [&::-webkit-scrollbar]:hidden">
                  <button onClick={() => setDunkTab('qualificazioni')} className={`outline-none focus:outline-none [-webkit-tap-highlight-color:transparent] shrink-0 px-5 py-2 rounded-full font-black uppercase tracking-widest text-[11px] border transition-all snap-start ${dunkTab === 'qualificazioni' ? 'bg-pink-500 text-white border-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.4)]' : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-white'}`}>
                    Qualificazioni
                  </button>
                  <button onClick={() => setDunkTab('finale')} className={`outline-none focus:outline-none [-webkit-tap-highlight-color:transparent] shrink-0 px-5 py-2 rounded-full font-black uppercase tracking-widest text-[11px] border transition-all snap-start ${dunkTab === 'finale' ? 'bg-pink-500 text-white border-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.4)]' : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-white'}`}>
                    Finale
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  {dunkTab === 'qualificazioni' && realDunkQual.length === 0 && <div className="p-6 text-center text-[10px] border border-dashed border-neutral-800 rounded-xl text-neutral-500 uppercase tracking-widest font-bold">Nessun dato disponibile</div>}
                  {dunkTab === 'finale' && realDunkFinale.length === 0 && <div className="p-6 text-center text-[10px] border border-dashed border-neutral-800 rounded-xl text-neutral-500 uppercase tracking-widest font-bold">Nessun dato disponibile</div>}
                  
                  {(dunkTab === 'qualificazioni' ? realDunkQual : realDunkFinale).map((dunk, idx) => {
                    // È il campione se siamo in finale, è primo, e ha fatto dei punti
                    const isChampion = dunkTab === 'finale' && idx === 0 && dunk.score > 0;

                    return (
                      <div key={dunk.id} className={`bg-gradient-to-br from-neutral-900 to-neutral-950 border rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden shadow-sm transition-transform active:scale-[0.98] ${isChampion ? 'border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'border-neutral-800/80'}`}>
                        
                        {/* INTESTAZIONE: Nome, Squadra e Totale */}
                        <div className="flex justify-between items-center z-10 w-full">
                          
                          <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
                            {/* Corona per il campione */}
                            {isChampion && <span className="text-2xl drop-shadow-md">👑</span>}
                            
                            <div className="flex flex-col min-w-0">
                              <div className={`text-lg font-black uppercase truncate ${isChampion ? 'text-yellow-400' : 'text-white'}`}>{dunk.name}</div>
                              {dunk.team && <div className="text-[10px] font-bold text-pink-500 uppercase tracking-widest truncate">{dunk.team}</div>}
                            </div>
                          </div>

                          <div className="flex flex-col items-end justify-center shrink-0 border-l border-neutral-800/80 pl-4">
                             <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-0.5">Totale</span>
                             <span className={`text-3xl font-black tabular-nums leading-none ${isChampion ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 'text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.3)]'}`}>{dunk.score}</span>
                          </div>
                        </div>

                        {/* DETTAGLIO SCHIACCIATE (Dunk 1 & Dunk 2) */}
                        <div className="flex gap-2 w-full z-10 mt-1">
                          <div className={`flex-1 bg-black/60 border rounded-xl p-2.5 flex justify-between items-center ${isChampion ? 'border-yellow-500/20' : 'border-neutral-800/80'}`}>
                            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Dunk 1</span>
                            <span className={`text-lg font-black tabular-nums ${isChampion ? 'text-yellow-100' : 'text-white'}`}>{dunk.dunk_1 > 0 ? dunk.dunk_1 : '-'}</span>
                          </div>
                          <div className={`flex-1 bg-black/60 border rounded-xl p-2.5 flex justify-between items-center ${isChampion ? 'border-yellow-500/20' : 'border-neutral-800/80'}`}>
                            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Dunk 2</span>
                            <span className={`text-lg font-black tabular-nums ${isChampion ? 'text-yellow-100' : 'text-white'}`}>{dunk.dunk_2 > 0 ? dunk.dunk_2 : '-'}</span>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      }
      case 'stats': {
        const top1 = topScorers.length > 0 ? topScorers[0] : null;
        const others = topScorers.length > 1 ? topScorers.slice(1) : [];

        return (
          <div className="animate-in fade-in duration-300 flex flex-col h-full pb-6">
            <div className="flex items-center justify-between mb-4">
               <h2 className="text-2xl font-black text-pink-500 uppercase tracking-wider">Top 10 Marcatori</h2>
               <button onClick={loadData} className={`p-2 bg-neutral-900 border border-neutral-800 rounded-full transition-all active:scale-95 ${isRefreshing ? 'animate-spin text-pink-500' : 'text-neutral-400 hover:text-white'}`}>
                 <RefreshCw size={16} />
               </button>
            </div>

            {topScorers.length === 0 ? (
               <div className="text-center py-10 text-neutral-500 font-bold uppercase tracking-widest border border-dashed border-neutral-800 rounded-xl">
                 Nessun dato disponibile
               </div>
            ) : (
              <div className="flex flex-col gap-4">
                
                {/* RE DEI BOMBER (#1) */}
                <div className="bg-gradient-to-br from-yellow-500/10 via-black/80 to-yellow-900/40 border border-yellow-500/50 rounded-3xl p-5 flex flex-col items-center relative overflow-hidden shadow-[0_0_30px_rgba(234,179,8,0.15)]">
                  <div className="absolute -top-8 text-[120px] opacity-[0.05] pointer-events-none">👑</div>
                  
                  <span className="text-4xl drop-shadow-md z-10 mb-2">👑</span>
                  <span className="text-yellow-500 font-black tracking-[0.3em] uppercase text-[10px] mb-4 drop-shadow-md">
                    Capocannoniere
                  </span>
                  
                  <div className="flex flex-col items-center text-center z-10 w-full mb-6">
                    <span className="text-3xl font-black text-white uppercase tracking-wider leading-none truncate w-full px-2">
                      {top1.last_name}
                    </span>
                    <span className="text-sm font-bold text-yellow-400 uppercase tracking-widest mt-1">
                      {top1.first_name}
                    </span>
                  </div>

                  <div className="bg-black/60 w-full rounded-2xl py-6 flex flex-col items-center border border-yellow-500/20 shadow-inner">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Punti Totali</span>
                    <span className="text-7xl font-black text-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)] leading-none tabular-nums">
                      {top1.totalPoints}
                    </span>
                    
                    <div className="mt-4 flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-yellow-500/20">
                      <span className="text-neutral-400 uppercase font-bold tracking-widest text-[9px]">Media:</span>
                      <span className="text-white font-black text-sm tabular-nums">{top1.avgPoints} <span className="text-[9px] text-neutral-500">pt/gara</span></span>
                    </div>
                  </div>
                </div>

                {/* INSEGUITORI (Dal 2° al 10°) */}
                <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3 shadow-sm flex flex-col gap-2 mt-1">
                  
                  {/* Intestazione Colonne */}
                  <div className="flex text-neutral-500 font-bold uppercase text-[9px] tracking-widest px-2 pb-2 border-b border-neutral-800/80">
                    <div className="w-8">Pos</div>
                    <div className="flex-1">Giocatore</div>
                    <div className="w-8 text-center" title="Partite Giocate">G</div>
                    <div className="w-10 text-center" title="Media Punti">Med</div>
                    <div className="w-10 text-right text-pink-500">PT</div>
                  </div>
                  
                  {/* Righe Giocatori */}
                  {others.map((p, i) => (
                    <div key={p.id} className="flex items-center bg-black/40 border border-neutral-800/80 rounded-xl px-3 py-2.5 transition-transform active:scale-[0.98]">
                      <div className="w-8 text-sm font-black text-neutral-600">#{i + 2}</div>
                      <div className="flex-1 flex flex-col min-w-0 pr-2">
                        <span className="text-sm font-black text-white uppercase truncate">{p.last_name}</span>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase truncate mt-0.5">{p.first_name}</span>
                      </div>
                      <div className="w-8 text-center text-[11px] font-bold text-neutral-500 tabular-nums">{p.games}</div>
                      <div className="w-10 text-center text-[11px] font-black text-neutral-300 tabular-nums">{p.avgPoints}</div>
                      <div className="w-10 text-right text-lg font-black text-pink-500 tabular-nums">{p.totalPoints}</div>
                    </div>
                  ))}

                </div>

              </div>
            )}
          </div>
        );
      }
      case 'others': {
        const socialLinks = [
          {
            name: 'Instagram',
            handle: '@basketville_pordenone', // Modifica con il vostro account reale
            sub: 'Foto, Reel e Storie live dal playground',
            url: 'https://www.instagram.com/basketville_pordenone?igsh=MXIzeXp6ZHA1ZGxoZA%3D%3D', // Inserisci il link diretto alla pagina
            brandColor: 'from-pink-500/10 to-purple-500/10 border-pink-500/20 text-pink-400'
          },
          {
            name: 'YouTube',
            handle: 'Basketville', // Modifica con il vostro canale reale
            sub: 'Highlights, interviste e recap dei match',
            url: 'https://youtube.com/@basketville_pordenone?si=dXvIqWT1s5MrcO4V', // Inserisci il link diretto alla pagina
            brandColor: 'from-red-500/10 to-red-900/10 border-red-500/20 text-red-500'
          },
          {
            name: 'Facebook',
            handle: 'Basketville Pn', // Modifica con la vostra pagina reale
            sub: 'Comunicati, album foto ufficiali e news',
            url: 'https://www.facebook.com/share/1CpZaM8j8A/?mibextid=LQQJ4d', // Inserisci il link diretto alla pagina
            brandColor: 'from-blue-500/10 to-blue-900/10 border-blue-500/20 text-blue-400'
          }
        ];

        return (
          <div className="animate-in fade-in duration-300 flex flex-col h-full pb-6">
            
            {/* INTESTAZIONE PAGINA */}
            <div className="mb-6">
               <h2 className="text-2xl font-black text-pink-500 uppercase tracking-wider">Social Hub</h2>
               <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-1">
                 Resta connesso con il mondo Basketville dentro e fuori dal campo
               </p>
            </div>

            {/* STRUTTURA DELLE CARD SOCIAL */}
            <div className="flex flex-col gap-3.5">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800/80 rounded-2xl p-4 flex items-center justify-between transition-all active:scale-[0.98] hover:bg-neutral-900/60 cursor-pointer [-webkit-tap-highlight-color:transparent]"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    
                    {/* Box Icona con colore di Brand mascherato */}
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${social.brandColor} border flex items-center justify-center shrink-0 shadow-inner`}>
                      {social.name === 'Instagram' && <Instagram size={22} />}
                      {social.name === 'YouTube' && <Youtube size={22} />}
                      {social.name === 'Facebook' && <Facebook size={22} />}
                    </div>

                    {/* Testi e Descrizioni informativi */}
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-black text-white uppercase tracking-wide">
                        {social.name}
                      </span>
                      <span className="text-[11px] font-mono text-neutral-400 mt-0.5 truncate">
                        {social.handle}
                      </span>
                      <span className="text-[10px] font-bold text-neutral-500 mt-1 line-clamp-1">
                        {social.sub}
                      </span>
                    </div>

                  </div>

                  {/* Bottone d'azione minimal sulla destra */}
                  <div className="text-[10px] font-black text-pink-500 bg-pink-500/10 px-3 py-2 rounded-xl border border-pink-500/20 uppercase tracking-widest shrink-0 ml-3 shadow-sm">
                    Apri ➔
                  </div>
                </a>
              ))}
            </div>

            {/* INFO BANNER REGOLAMENTO / CONTATTI STATICO */}
            <div className="mt-6 p-4 bg-neutral-900/40 border border-neutral-900 rounded-2xl text-center">
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest leading-relaxed">
                Problemi con i tabellini o segnalazione errori?<br/>
                Rivolgiti direttamente al nostro Staff.
              </p>
            </div>

            {/* COLOPHON FINALE EDITORIALE */}
            <div className="mt-12 text-center text-neutral-700 text-[9px] font-black uppercase tracking-[0.3em]">
              Vero Cup 2026 • Official Tournament App
            </div>

          </div>
        );
      }
      default:
        return null;
    }
  };

  // Mini-render per la riga dei punti dei singoli giocatori nel tabellino
  const renderPlayerRow = (p) => (
    <div key={p.id} className="flex justify-between items-center bg-neutral-900 border border-neutral-800/80 px-4 py-3 rounded-xl shadow-sm">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-pink-500 font-mono font-black w-6 text-left text-sm">
          #{p.jersey_number}
        </span>
        <span className="font-bold text-white uppercase text-sm truncate">
          {p.players?.last_name} {p.players?.first_name?.charAt(0)}.
        </span>
      </div>
      <span className={`font-black text-lg ${p.match_points > 10 ? 'text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.3)]' : 'text-neutral-300'}`}>
        {p.match_points} <span className="text-[10px] text-neutral-500 font-normal">pt</span>
      </span>
    </div>
  );

  return (
    <div className="w-full min-h-screen bg-neutral-950 text-white font-sans flex flex-col relative select-none antialiased">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none mix-blend-overlay z-0"></div>

{/* HEADER SUPERIORE - ALLINEAMENTO MILLIMETRICO DEI TRE ASSI */}
      <header 
        className="w-full bg-neutral-950/80 border-b border-neutral-800/50 backdrop-blur-xl sticky top-0 z-40 px-5 pb-3.5 flex items-end justify-between shadow-md relative"
        style={{ 
          paddingTop: 'max(env(safe-area-inset-top), 16px)' 
        }}
      >
        
        {/* LOGO UFFICIALE A SINISTRA (Centrato verticalmente nei 28px di altezza) */}
        <div className="flex items-center shrink-0 z-10 h-7">
          <img 
            src="/Basketville_logo.svg" 
            alt="Basketville" 
            className="h-6 w-auto object-contain" 
          />
        </div>

        {/* TESTO AL CENTRO: Ora ha lo stesso identico box (bottom-3.5 e h-7) dei laterali */}
        <div className="absolute inset-x-0 bottom-3.5 h-7 flex items-center justify-center pointer-events-none">
          <span className="text-[8px] font-black uppercase tracking-[0.35em] text-neutral-600 bg-neutral-950 px-2 pointer-events-auto select-none leading-none">
            Official App
          </span>
        </div>

        {/* BADGE EDIZIONE A DESTRA (Centrato verticalmente nei 28px di altezza) */}
        <div className="flex items-center shrink-0 z-10 h-7">
          <span className="text-[8px] font-black bg-neutral-900 text-neutral-400 px-2.5 py-1 rounded-full uppercase tracking-widest border border-neutral-800 shadow-inner leading-none">
            Ed. {activeEdition ? activeEdition.year : '...'}
          </span>
        </div>

      </header>

      {/* CONTENUTO MAIN - ORA SI CONGELA SE LA MODALE È APERTA */}
      <main className={`flex-1 z-10 px-5 py-6 max-w-md mx-auto w-full pb-28 ${selectedMatch ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {renderTabContent()}
      </main>

{/* ========================================================
          📱 MODALE BOTTOMSHEET: IL TABELLINO DELLA PARTITA (BOX SCORE)
          ======================================================== */}
      <AnimatePresence>
        {selectedMatch && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-in lighten-in duration-200">
            {/* Area cliccabile esterna per chiudere la modale + Blocco Touch Bleeding */}
            <div 
              className="absolute inset-0" 
              onClick={() => setSelectedMatch(null)}
              onTouchMove={(e) => e.preventDefault()}
            ></div>
            
            {/* Pannello che sale dal basso con Gestures attive */}
            <div 
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="w-full max-w-md bg-neutral-950 border-t border-neutral-800 rounded-t-[2.5rem] shadow-[0_-15px_40px_rgba(0,0,0,0.6)] flex flex-col max-h-[85vh] z-10 animate-in slide-in-from-bottom duration-300 overflow-hidden pb-6"
            >
              
              {/* HEADER FISSO DELLA MODALE (Risolve il bug della X che spariva) */}
              <div className="w-full flex items-center justify-between px-5 pt-4 pb-2 shrink-0 z-20 relative">
                {/* Spaziatore sinistro finto per bilanciare la X a destra e tenere la barra al centro */}
                <div className="w-9 h-1 shrink-0"></div> 
                
                {/* Vera barra di trascinamento */}
                <div className="w-12 h-1.5 bg-neutral-800 rounded-full"></div>
                
                {/* Bottone X finalmente visibile e protetto */}
                <button 
                  onClick={() => setSelectedMatch(null)}
                  className="p-2 bg-neutral-900 border border-neutral-800 rounded-full text-neutral-400 hover:text-white active:scale-90 transition-transform shrink-0 flex items-center justify-center shadow-md"
                >
                  <X size={16} />
                </button>
              </div>

              {/* CONTENUTO DELLA MODALE SCROLLABILE INTERNAMENTE */}
              <div className="flex-1 overflow-y-auto px-5 space-y-6 [&::-webkit-scrollbar]:hidden">
                
                {/* INTESTAZIONE: SQUADRE E PUNTEGGI */}
                <div className="text-center pt-1">
                  <span className="text-[10px] bg-pink-500/10 border border-pink-500/30 text-pink-400 px-3 py-1 rounded-full uppercase tracking-widest font-black inline-block mb-4">
                    {(selectedMatch.team_a?.event_id === 1 && (selectedMatch.match_type_id === 1 || selectedMatch.match_types?.name?.toLowerCase().includes('giron')) && selectedMatch.team_a?.group_name)
                      ? `Girone ${selectedMatch.team_a.group_name}`
                      : `${selectedMatch.match_types?.name || 'Match'}${selectedMatch.team_a?.group_name ? ` • ${selectedMatch.team_a.group_name}` : ''}`
                    }
                  </span>
                  
                  <div className="flex items-center justify-between w-full px-2 gap-2">
                    <div className="flex-1 text-center min-w-0">
                      <h3 className="text-lg font-black uppercase text-white truncate break-words">{selectedMatch.team_a?.teams?.name}</h3>
                      <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mt-1 truncate">Coach: {selectedMatch.team_a?.coach || 'TBD'}</p>
                    </div>
                    
                    <div className="px-5 py-2.5 bg-neutral-900 border border-neutral-800 rounded-2xl text-3xl font-black text-white tracking-tighter shadow-inner shrink-0 tabular-nums">
                      {selectedMatch.score_a ?? 0} <span className="text-pink-500 font-normal text-2xl mx-1">-</span> {selectedMatch.score_b ?? 0}
                    </div>
                    
                    <div className="flex-1 text-center min-w-0">
                      <h3 className="text-lg font-black uppercase text-white truncate break-words">{selectedMatch.team_b?.teams?.name}</h3>
                      <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mt-1 truncate">Coach: {selectedMatch.team_b?.coach || 'TBD'}</p>
                    </div>
                  </div>

                  {/* MINI TABELLA DEI QUARTI */}
                  <div className="mt-5 flex justify-center gap-4 text-neutral-300 font-bold bg-neutral-900/40 border border-neutral-900 px-4 py-2.5 rounded-xl shadow-inner">
                    {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => (
                      <div key={q} className="flex flex-col items-center flex-1 border-r border-neutral-800/60 last:border-0 pr-1 last:pr-0">
                        <span className="text-[9px] text-neutral-500 uppercase tracking-widest font-black mb-0.5">{q}</span>
                        <span className="text-sm font-black tabular-nums">{selectedMatch[`q${i+1}_a`] ?? 0}-{selectedMatch[`q${i+1}_b`] ?? 0}</span>
                      </div>
                    ))}
                    {(selectedMatch.ot_a > 0 || selectedMatch.ot_b > 0) && (
                      <div className="flex flex-col items-center flex-1 text-pink-400 pl-1">
                        <span className="text-[9px] uppercase tracking-widest font-black mb-0.5">OT</span>
                        <span className="text-sm font-black tabular-nums">{selectedMatch.ot_a ?? 0}-{selectedMatch.ot_b ?? 0}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* SELETTORE TAB SQUADRE */}
                <div className="flex bg-neutral-900/80 border border-neutral-800 rounded-xl p-1 mt-2 shadow-inner">
                  <button
                    onClick={() => setActiveRosterTab('A')}
                    className={`appearance-none outline-none focus:outline-none focus:ring-0 active:outline-none [-webkit-tap-highlight-color:transparent] flex-1 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all truncate px-2 border ${
                      activeRosterTab === 'A' 
                        ? 'bg-neutral-800 text-white shadow-sm border-transparent' 
                        : 'border-transparent text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {selectedMatch.team_a?.teams?.name || 'Squadra A'}
                  </button>
                  <button
                    onClick={() => setActiveRosterTab('B')}
                    className={`appearance-none outline-none focus:outline-none focus:ring-0 active:outline-none [-webkit-tap-highlight-color:transparent] flex-1 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all truncate px-2 border ${
                      activeRosterTab === 'B' 
                        ? 'bg-neutral-800 text-white shadow-sm border-transparent' 
                        : 'border-transparent text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {selectedMatch.team_b?.teams?.name || 'Squadra B'}
                  </button>
                </div>

                {/* LISTA GIOCATORI DEL TAB ATTIVO */}
                <div className="grid grid-cols-1 gap-2 mt-2">
                  {activeRosterTab === 'A' ? (
                    selectedMatch.roster_a?.length > 0 ? (
                      selectedMatch.roster_a.map(renderPlayerRow)
                    ) : (
                      <p className="text-xs text-neutral-600 uppercase font-bold tracking-widest py-6 text-center bg-neutral-900/30 rounded-xl border border-dashed border-neutral-900">Nessun giocatore a referto</p>
                    )
                  ) : (
                    selectedMatch.roster_b?.length > 0 ? (
                      selectedMatch.roster_b.map(renderPlayerRow)
                    ) : (
                      <p className="text-xs text-neutral-600 uppercase font-bold tracking-widest py-6 text-center bg-neutral-900/30 rounded-xl border border-dashed border-neutral-900">Nessun giocatore a referto</p>
                    )
                  )}
                </div>

              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* INDICATORE DI CARICAMENTO SFONDATO NELLA MODALE */}
      {modalLoading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-10 h-10 border-4 border-neutral-800 border-t-pink-500 rounded-full animate-spin mb-3"></div>
          <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Caricamento Tabellino...</span>
        </div>
      )}

      {/* BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/80 border-t border-neutral-800/60 backdrop-blur-2xl pt-2.5 pb-6 px-2 shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-between w-full max-w-md mx-auto">
          
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1.5 flex-1 transition-all ${activeTab === 'home' ? 'text-pink-500 scale-105' : 'text-neutral-500 hover:text-neutral-300'}`}>
            <Home size={22} strokeWidth={activeTab === 'home' ? 3 : 2} className={activeTab === 'home' ? 'drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]' : ''} />
            <span className="text-[9px] font-black uppercase tracking-wider">Home</span>
          </button>

          <button onClick={() => setActiveTab('verocup')} className={`flex flex-col items-center gap-1.5 flex-1 transition-all ${activeTab === 'verocup' ? 'text-pink-500 scale-105' : 'text-neutral-500 hover:text-neutral-300'}`}>
            <Trophy size={22} strokeWidth={activeTab === 'verocup' ? 3 : 2} className={activeTab === 'verocup' ? 'drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]' : ''} />
            <span className="text-[9px] font-black uppercase tracking-wider">VERO CUP</span>
          </button>

          <button onClick={() => setActiveTab('contest')} className={`flex flex-col items-center gap-1.5 flex-1 transition-all ${activeTab === 'contest' ? 'text-pink-500 scale-105' : 'text-neutral-500 hover:text-neutral-300'}`}>
            <Flame size={22} strokeWidth={activeTab === 'contest' ? 3 : 2} className={activeTab === 'contest' ? 'drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]' : ''} />
            <span className="text-[9px] font-black uppercase tracking-wider">Contest</span>
          </button>

          <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center gap-1.5 flex-1 transition-all ${activeTab === 'stats' ? 'text-pink-500 scale-105' : 'text-neutral-500 hover:text-neutral-300'}`}>
            <BarChart2 size={22} strokeWidth={activeTab === 'stats' ? 3 : 2} className={activeTab === 'stats' ? 'drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]' : ''} />
            <span className="text-[9px] font-black uppercase tracking-wider">TOP SCORER</span>
          </button>

          <button onClick={() => setActiveTab('others')} className={`flex flex-col items-center gap-1.5 flex-1 transition-all ${activeTab === 'others' ? 'text-pink-500 scale-105' : 'text-neutral-500 hover:text-neutral-300'}`}>
            <Share2 size={22} strokeWidth={activeTab === 'others' ? 3 : 2} className={activeTab === 'others' ? 'drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]' : ''} />
            <span className="text-[9px] font-black uppercase tracking-wider">Social</span>
          </button>

        </div>
      </nav>
    </div>
  );
}
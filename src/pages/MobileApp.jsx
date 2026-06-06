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
  User
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

  // ==========================================
  // STATI PER LA MODALE TABELLINO (BOX SCORE)
  // ==========================================
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [activeRosterTab, setActiveRosterTab] = useState('A');
  const [veroCupTab, setVeroCupTab] = useState('gironi');
  const [activeGroupTab, setActiveGroupTab] = useState(null);

  // ==========================================
  // FUNZIONE FETCH: Scarica il palinsesto
  // ==========================================
  const loadData = async () => {
    setIsRefreshing(true);
    
    const { data: ed } = await supabase.from('editions').select('*').eq('is_active', true).single();
    
    if (ed) {
      setActiveEdition(ed);
      
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
          setSelectedDate(dates.includes(todayStr) ? todayStr : dates[0]);
        }
      }
    }
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

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
            
            {/* SELETTORE GIORNI */}
            <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-5 px-5 snap-x [&::-webkit-scrollbar]:hidden">
              {availableDates.map(date => (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`shrink-0 px-4 py-2 rounded-full font-bold uppercase tracking-widest text-[11px] border transition-all snap-start ${
                    selectedDate === date 
                      ? 'bg-pink-500 text-white border-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.4)]' 
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800'
                  }`}
                >
                  {formatDayMonth(date)}
                </button>
              ))}
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
                              {item.events?.name || 'Evento Basketville'} {m?.team_a?.group_name ? `• Girone ${m.team_a.group_name}` : ''}
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
        // 1. Estraiamo tutte le partite dal calendario già scaricato
        const allMatches = calendarRaw.filter(c => c.matches).map(c => ({
  ...c.matches,
  match_date: c.date,
  match_time: c.time
}));

        // 2. Filtriamo solo i match dei Gironi
        const groupMatches = allMatches.filter(m => m.match_type_id === 1 || m.match_types?.name?.toLowerCase().includes('giron'));
        
        // 3. Estraiamo le squadre uniche (aggiungiamo pf e ps)
        const teamsMap = {};
        groupMatches.forEach(m => {
          if (m.team_a && m.team_a.group_name) {
            teamsMap[m.team_a_id] = { id: m.team_a_id, name: m.team_a.teams?.name, group: m.team_a.group_name, w: 0, l: 0, pt: 0, pf: 0, ps: 0 };
          }
          if (m.team_b && m.team_b.group_name) {
            teamsMap[m.team_b_id] = { id: m.team_b_id, name: m.team_b.teams?.name, group: m.team_b.group_name, w: 0, l: 0, pt: 0, pf: 0, ps: 0 };
          }
        });

        // 4. Calcoliamo W, L, PT e i nuovi PF, PS
        groupMatches.forEach(m => {
          if (m.status === 'conclusa' || m.status === 'finished') {
            const tA = teamsMap[m.team_a_id];
            const tB = teamsMap[m.team_b_id];
            if (tA && tB) {
              // Sommiamo i punti fatti e subiti
              tA.pf += (m.score_a || 0);
              tA.ps += (m.score_b || 0);
              tB.pf += (m.score_b || 0);
              tB.ps += (m.score_a || 0);

              if (m.score_a > m.score_b) { tA.w++; tA.pt += 2; tB.l++; }
              else if (m.score_b > m.score_a) { tB.w++; tB.pt += 2; tA.l++; }
            }
          }
        });

        // 5. Raggruppiamo e ordiniamo (se Pari Punti -> guarda Differenza Canestri)
        const groups = {};
        Object.values(teamsMap).forEach(t => {
          if (!groups[t.group]) groups[t.group] = [];
          groups[t.group].push(t);
        });
        const groupNames = Object.keys(groups).sort();
        groupNames.forEach(g => {
          groups[g].sort((a, b) => {
            if (b.pt !== a.pt) return b.pt - a.pt; // Ordina per punti
            return (b.pf - b.ps) - (a.pf - a.ps);  // Se pari, ordina per differenza canestri!
          });
        });

        // Determiniamo il girone da mostrare (di default il primo)
        const displayGroup = activeGroupTab && groupNames.includes(activeGroupTab) ? activeGroupTab : groupNames[0];

        // 6. Playoff Matches
        const playoffMatches = allMatches.filter(m => m.match_type_id > 1 && !m.match_types?.name?.toLowerCase().includes('giron'));

        return (
          <div className="animate-in fade-in duration-300 flex flex-col h-full">
            <h2 className="text-2xl font-black text-pink-500 uppercase tracking-wider mb-4">VERO Cup 2026</h2>
            
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
                          
                          {/* Header Colonne - CENTRATO AL MILLIMETRO */}
                          <div className="flex text-[9px] font-bold text-neutral-500 uppercase tracking-widest px-4 py-2 bg-black/60">
                            <div className="w-5 shrink-0"></div> 
                            <div className="flex-1">Squadra</div>
                            <div className="w-8 shrink-0 text-center">W</div>
                            <div className="w-8 shrink-0 text-center">L</div>
                            <div className="w-8 shrink-0 text-center">PF</div>
                            <div className="w-8 shrink-0 text-center">PS</div>
                            <div className="w-8 shrink-0 text-center text-pink-500">PT</div> {/* Centrato con w-8 */}
                          </div>
                          
                          {/* Righe Squadre - CENTRATO AL MILLIMETRO */}
                          <div className="flex flex-col">
                            {groups[displayGroup].map((team, idx) => (
                              <div key={team.id} className="flex items-center px-4 py-3.5 even:bg-white/[0.02]">
                                <div className="w-5 shrink-0 text-[11px] font-black text-neutral-600">{idx + 1}</div>
                                <div className="flex-1 text-[12px] font-bold text-white uppercase truncate pr-2">{team.name}</div>
                                <div className="w-8 shrink-0 text-center text-[11px] font-bold text-neutral-400">{team.w}</div>
                                <div className="w-8 shrink-0 text-center text-[11px] font-bold text-neutral-400">{team.l}</div>
                                <div className="w-8 shrink-0 text-center text-[11px] font-bold text-neutral-400">{team.pf}</div>
                                <div className="w-8 shrink-0 text-center text-[11px] font-bold text-neutral-400">{team.ps}</div>
                                <div className="w-8 shrink-0 text-center text-base font-black text-pink-400 self-center leading-none">{team.pt}</div> {/* Centrato con w-8 */}
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

            {/* VISTA PLAYOFF */}
            {veroCupTab === 'playoff' && (
              <div className="flex flex-col gap-3 pb-6 animate-in fade-in slide-in-from-right-4 duration-300">
                 {playoffMatches.length === 0 ? (
                    <p className="text-center text-neutral-500 text-xs font-bold uppercase tracking-widest mt-4 bg-neutral-900/50 py-8 rounded-2xl border border-neutral-800">Tabellone in aggiornamento</p>
                 ) : (
                    playoffMatches.map(m => renderMatchCard(m, m.match_types?.name))
                 )}
              </div>
            )}
          </div>
        );
      }
      case 'contest':
        return (
          <div className="animate-in fade-in duration-300 flex items-center justify-center h-40">
            <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest border border-dashed border-neutral-800 rounded-2xl p-6 text-center w-full">Contest in arrivo...</p>
          </div>
        );
      case 'stats':
        return (
          <div className="animate-in fade-in duration-300 flex items-center justify-center h-40">
             <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest border border-dashed border-neutral-800 rounded-2xl p-6 text-center w-full">Classifiche marcatori in arrivo...</p>
          </div>
        );
      case 'others':
        return (
          <div className="animate-in fade-in duration-300 flex items-center justify-center h-40">
            <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest border border-dashed border-neutral-800 rounded-2xl p-6 text-center w-full">Altri tornei in arrivo...</p>
          </div>
        );
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

      {/* HEADER */}
      <header className="w-full bg-neutral-950/80 border-b border-neutral-800/50 backdrop-blur-xl sticky top-0 z-40 px-5 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-5 bg-pink-500 rounded-full shadow-[0_0_10px_rgba(236,72,153,0.5)]"></div>
          <h1 className="text-lg font-black uppercase tracking-wider text-white drop-shadow-sm">
            Basketville <span className="text-pink-500">App</span>
          </h1>
        </div>
        <span className="text-[9px] font-bold bg-neutral-900 text-neutral-400 px-2.5 py-1 rounded-full uppercase tracking-widest border border-neutral-800">
          Ed. {activeEdition ? activeEdition.year : '...'}
        </span>
      </header>

      {/* CONTENUTO MAIN */}
      <main className="flex-1 z-10 px-5 py-6 overflow-y-auto max-w-md mx-auto w-full pb-28">
        {renderTabContent()}
      </main>

      {/* ========================================================
          📱 MODALE BOTTOMSHEET: IL TABELLINO DELLA PARTITA (BOX SCORE)
          ======================================================== */}
      <AnimatePresence>
        {selectedMatch && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            {/* Area cliccabile esterna per chiudere la modale */}
            <div className="absolute inset-0" onClick={() => setSelectedMatch(null)}></div>
            
            {/* Pannello che sale dal basso */}
            <div className="w-full max-w-md bg-neutral-950 border-t border-neutral-800 rounded-t-[2.5rem] shadow-[0_-15px_40px_rgba(0,0,0,0.6)] flex flex-col max-h-[85vh] z-10 animate-in slide-in-from-bottom duration-300 overflow-hidden pb-6">
              
              {/* Barra di trascinamento estetica in alto */}
              <div className="w-12 h-1.5 bg-neutral-800 rounded-full mx-auto my-3 shrink-0"></div>
              
              {/* Bottone di chiusura X */}
              <button 
                onClick={() => setSelectedMatch(null)}
                className="absolute top-4 right-5 p-2 bg-neutral-900 border border-neutral-800 rounded-full text-neutral-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>

              {/* CONTENUTO DELLA MODALE SCROLLABILE INTERNAMENTE */}
              <div className="flex-1 overflow-y-auto px-5 space-y-6 [&::-webkit-scrollbar]:hidden">
                
                {/* INTESTAZIONE: SQUADRE E PUNTEGGI */}
                <div className="text-center pt-2">
                  <span className="text-[10px] bg-pink-500/10 border border-pink-500/30 text-pink-400 px-3 py-1 rounded-full uppercase tracking-widest font-black inline-block mb-4">
                    {selectedMatch.match_types?.name} {selectedMatch.team_a?.group_name ? `• Girone ${selectedMatch.team_a.group_name}` : ''}
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
                    className={`flex-1 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all truncate px-2 ${
                      activeRosterTab === 'A' 
                        ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700' 
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {selectedMatch.team_a?.teams?.name || 'Squadra A'}
                  </button>
                  <button
                    onClick={() => setActiveRosterTab('B')}
                    className={`flex-1 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all truncate px-2 ${
                      activeRosterTab === 'B' 
                        ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700' 
                        : 'text-neutral-500 hover:text-neutral-300'
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
            <span className="text-[9px] font-black uppercase tracking-wider">Torneo</span>
          </button>

          <button onClick={() => setActiveTab('contest')} className={`flex flex-col items-center gap-1.5 flex-1 transition-all ${activeTab === 'contest' ? 'text-pink-500 scale-105' : 'text-neutral-500 hover:text-neutral-300'}`}>
            <Flame size={22} strokeWidth={activeTab === 'contest' ? 3 : 2} className={activeTab === 'contest' ? 'drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]' : ''} />
            <span className="text-[9px] font-black uppercase tracking-wider">Contest</span>
          </button>

          <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center gap-1.5 flex-1 transition-all ${activeTab === 'stats' ? 'text-pink-500 scale-105' : 'text-neutral-500 hover:text-neutral-300'}`}>
            <BarChart2 size={22} strokeWidth={activeTab === 'stats' ? 3 : 2} className={activeTab === 'stats' ? 'drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]' : ''} />
            <span className="text-[9px] font-black uppercase tracking-wider">Stats</span>
          </button>

          <button onClick={() => setActiveTab('others')} className={`flex flex-col items-center gap-1.5 flex-1 transition-all ${activeTab === 'others' ? 'text-pink-500 scale-105' : 'text-neutral-500 hover:text-neutral-300'}`}>
            <Grid size={22} strokeWidth={activeTab === 'others' ? 3 : 2} className={activeTab === 'others' ? 'drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]' : ''} />
            <span className="text-[9px] font-black uppercase tracking-wider">Altro</span>
          </button>

        </div>
      </nav>
    </div>
  );
}
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { motion, AnimatePresence } from 'framer-motion';

// ==========================================
// HELPER GLOBALE: Colori dinamici per Eventi
// ==========================================
const getEventStyles = (tagName) => {
  const t = (tagName || '').toLowerCase();
  if (t.includes('vero cup')) return { tag: 'bg-pink-500/20 text-pink-300 border-pink-500/30', border: 'bg-pink-500' };
  if (t.includes('3-point') || t.includes('3 point')) return { tag: 'bg-purple-500/20 text-purple-300 border-purple-500/30', border: 'bg-purple-500' };
  if (t.includes('slam dunk')) return { tag: 'bg-orange-500/20 text-orange-300 border-orange-500/30', border: 'bg-orange-500' };
  if (t.includes('extra') || t.includes('master')) return { tag: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', border: 'bg-emerald-500' };
  return { tag: 'bg-blue-500/20 text-blue-300 border-blue-500/30', border: 'bg-blue-500' };
};

export default function ObsOutput() {
  const [broadcastState, setBroadcastState] = useState({ active_graphic: 'none', payload: {} });
  const [localGraphic, setLocalGraphic] = useState('none');
  const [highlightRound, setHighlightRound] = useState(null);
  
  const transitionTimer = useRef(null);

  // STATI ESISTENTI
  const [threePointData, setThreePointData] = useState([]);
  const [highlightedPlayerId, setHighlightedPlayerId] = useState(null);
  const [dailyScheduleData, setDailyScheduleData] = useState([]);
  const [dailyScheduleDate, setDailyScheduleDate] = useState('');
  const [matchData, setMatchData] = useState(null);
  const [draftPicks, setDraftPicks] = useState([]);
  const [draftTeams, setDraftTeams] = useState([]);
  const [eligiblePlayers, setEligiblePlayers] = useState([]);

  // === NUOVI STATI PER IL TORNEO ===
  const [tournamentMatches, setTournamentMatches] = useState([]);
  const [tournamentTeams, setTournamentTeams] = useState([]);
  const [tournamentCalendar, setTournamentCalendar] = useState([]);
  const [topScorers, setTopScorers] = useState([]);

  // ==========================================
  // WATCHDOG ANTI-CRASH PER OBS (COSTO ZERO)
  // ==========================================
  useEffect(() => {
    let lastTick = Date.now();
    
    const watchdog = setInterval(() => {
      const now = Date.now();
      if (now - lastTick > 30000) {
        console.warn("Rilevata ibernazione OBS. Riavvio forzato della pagina...");
        window.location.reload();
      }
      lastTick = now;
    }, 5000);

    return () => clearInterval(watchdog);
  }, []);

  const getActiveEditionId = async () => {
    const { data } = await supabase.from('editions').select('id').eq('is_active', true).single();
    return data ? data.id : null;
  };

  const fetchThreePointData = async () => {
    const editionId = await getActiveEditionId();
    if (editionId) {
      const { data } = await supabase.from('three_point').select('*').eq('edition_id', editionId);
      if (data) setThreePointData(data);
    }
  };

  const fetchDailySchedule = async (targetDate) => {
    const editionId = await getActiveEditionId();
    if (!editionId || !targetDate) return;

    const { data: cals, error } = await supabase
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
      .eq('edition_id', editionId)
      .eq('date', targetDate)
      .order('time', { ascending: true });

    if (error || !cals) return;

    const enrichedData = cals.map((item) => {
      let matchDetails = null;

      if (item.match_id && item.matches) {
        const m = item.matches;
        matchDetails = {
          home_name: m.team_a?.teams?.name || 'TBD',
          away_name: m.team_b?.teams?.name || 'TBD',
          home_group: m.team_a?.group_name || '',
          away_group: m.team_b?.group_name || '',
          match_type: m.match_types?.name || '',
          score_home: m.score_a ?? null,
          score_away: m.score_b ?? null,
          status: m.status || 'scheduled' 
        };
      }

      return {
        ...item,
        matchDetails,
        event_tag: item.events?.name || 'Evento'
      };
    });

    setDailyScheduleData(enrichedData);
    setDailyScheduleDate(targetDate);
  };

  const fetchMatchData = async (matchId) => {
    if (!matchId) return;
    const editionId = await getActiveEditionId();

    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select(`
        *,
        match_types(name),
        team_a:team_a_id(team_id, event_id, coach, assistant_coach, group_name, teams(name, short_name)),
        team_b:team_b_id(team_id, coach, assistant_coach, group_name, teams(name, short_name))
      `)
      .eq('id', matchId)
      .single();

    if (matchError || !match) return;

    const { data: calData } = await supabase
      .from('calendars')
      .select('events(name)')
      .eq('match_id', matchId)
      .maybeSingle();
    const eventName = calData?.events?.name || 'Evento';

    const { data: rosterA } = await supabase
      .from('rosters')
      .select(`id, player_id, jersey_number, players(first_name, last_name)`)
      .eq('team_id', match.team_a.team_id)
      .eq('edition_id', editionId);

    const { data: rosterB } = await supabase
      .from('rosters')
      .select(`id, player_id, jersey_number, players(first_name, last_name)`)
      .eq('team_id', match.team_b.team_id)
      .eq('edition_id', editionId);

    const { data: points } = await supabase
      .from('match_points')
      .select('*')
      .eq('match_id', matchId);

    const mapPointsToRoster = (roster) => {
      if (!roster) return [];
      return roster.map(r => {
        const totalPoints = points
          ?.filter(p => p.player_id === r.player_id)
          .reduce((sum, p) => sum + p.points, 0) || 0;
        return { ...r, match_points: totalPoints };
      }).sort((a, b) => (a.jersey_number || 99) - (b.jersey_number || 99)).slice(0, 10); 
    };

    setMatchData({
      ...match,
      event_name: eventName,
      roster_a: mapPointsToRoster(rosterA),
      roster_b: mapPointsToRoster(rosterB),
    });
  };

  const fetchDraftData = async () => {
    const editionId = await getActiveEditionId();
    if (!editionId) return;

    const { data: ev } = await supabase.from('events').select('id').ilike('name', '%vero cup%').single();
    if (!ev) return;

    const { data: teams } = await supabase
      .from('teams_edition_events')
      .select('id, team_id, coach, assistant_coach, teams(name)')
      .eq('edition_id', editionId)
      .eq('event_id', ev.id)
      .limit(6);
    
    setDraftTeams(teams || []);

    if (teams && teams.length > 0) {
      const teamIds = teams.map(t => t.id);
      const { data: picks } = await supabase
        .from('draft')
        .select('*, players(first_name, last_name), teams_edition_events(teams(name))')
        .in('team_edition_event_id', teamIds)
        .order('pick_number', { ascending: true });
      setDraftPicks(picks || []);
    }
  };

  const fetchEligiblePlayers = async () => {
    const { data } = await supabase.from('players').select('*').eq('draft', true).order('last_name', { ascending: true });
    setEligiblePlayers(data || []);
  };

  // === NUOVA FUNZIONE PER FETCHARE I DATI DEL TORNEO ===
  const fetchTournamentData = async () => {
    const editionId = await getActiveEditionId();
    if (!editionId) return;

    // Prendiamo i team (con info del girone)
    const { data: tee } = await supabase.from('teams_edition_events').select('*, teams(name)').eq('edition_id', editionId);
    setTournamentTeams(tee || []);

    // Prendiamo i match correlati a queste squadre
    if (tee && tee.length > 0) {
      const teeIds = tee.map(t => t.id);
      const { data: m } = await supabase.from('matches').select('*').in('team_a_id', teeIds);
      setTournamentMatches(m || []);
    }

    // Prendiamo il calendario (per le date dei playoff)
    const { data: cal } = await supabase.from('calendars').select('*').eq('edition_id', editionId);
    setTournamentCalendar(cal || []);
  };

  // === FUNZIONE PER LA CLASSIFICA MARCATORI (SOLO VERO CUP) ===
  const fetchTopScorers = async () => {
    const editionId = await getActiveEditionId();
    if (!editionId) return;

    // 1. Troviamo la Vero Cup
    const { data: ev } = await supabase.from('events').select('id').ilike('name', '%vero cup%').single();
    if (!ev) return;

    // 2. Troviamo le squadre iscritte
    const { data: tee } = await supabase.from('teams_edition_events').select('id').eq('edition_id', editionId).eq('event_id', ev.id);
    if (!tee || tee.length === 0) return;
    const teeIds = tee.map(t => t.id);

    // 3. Troviamo tutte le partite giocate da queste squadre
    const { data: matches } = await supabase.from('matches').select('id').in('team_a_id', teeIds);
    if (!matches || matches.length === 0) return;
    const matchIds = matches.map(m => m.id);

    // 4. Peschiamo tutti i punti segnati in queste partite e info giocatore
    const { data: points } = await supabase.from('match_points')
      .select('player_id, points, match_id, players(first_name, last_name)')
      .in('match_id', matchIds);

    if (!points) return;

    // 5. Sommiamo tutto e calcoliamo le medie
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
      playerStats[p.player_id].matchesPlayed.add(p.match_id); // Usiamo un Set per contare le partite uniche
    });

    // 6. Ordiniamo per Punti Totali (in caso di parità, per media punti) e prendiamo i Top 10
    const processedScorers = Object.values(playerStats).map(p => ({
      ...p,
      games: p.matchesPlayed.size,
      avgPoints: (p.totalPoints / p.matchesPlayed.size).toFixed(1)
    })).sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return b.avgPoints - a.avgPoints;
    }).slice(0, 10);

    setTopScorers(processedScorers);
  };

  useEffect(() => {
    fetchThreePointData(); 
    fetchEligiblePlayers();

    const tpChannel = supabase.channel('threepoint-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'three_point' }, () => { fetchThreePointData(); }).subscribe();

    const draftChannel = supabase.channel('draft-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'draft' }, () => { fetchDraftData(); }).subscribe();

    const playersChannel = supabase.channel('players-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => { fetchEligiblePlayers(); }).subscribe();

    const cmdChannel = supabase.channel('obs-director')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'broadcast_state', filter: 'id=eq.1' }, (payload) => {
        setBroadcastState(payload.new);
      }).subscribe();

    return () => {
      supabase.removeChannel(tpChannel);
      supabase.removeChannel(draftChannel);
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(cmdChannel);
    };
  }, []);

  // AGGIORNAMENTI IN REAL-TIME (Aggiunto il torneo)
  useEffect(() => {
    let liveChannel;

    if (broadcastState.active_graphic === 'daily_schedule' && broadcastState.payload.date) {
      liveChannel = supabase.channel('schedule-live')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, () => { fetchDailySchedule(broadcastState.payload.date); }).subscribe();
    } 
    else if ((broadcastState.active_graphic === 'match_full' || broadcastState.active_graphic === 'match_lite') && broadcastState.payload.match_id) {
      const currentMatchId = broadcastState.payload.match_id;
      liveChannel = supabase.channel(`match-${currentMatchId}-live`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${currentMatchId}` }, () => { fetchMatchData(currentMatchId); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'match_points', filter: `match_id=eq.${currentMatchId}` }, () => { fetchMatchData(currentMatchId); })
        .subscribe();
    }
    // NUOVO CANALE LIVE PER I GIRONI E PLAYOFF
    else if (broadcastState.active_graphic === 'recap_girone' || broadcastState.active_graphic === 'playoff_bracket') {
      liveChannel = supabase.channel('tournament-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => { fetchTournamentData(); })
        .subscribe();
    }

    return () => {
      if (liveChannel) supabase.removeChannel(liveChannel);
    };
  }, [broadcastState.active_graphic, broadcastState.payload.match_id, broadcastState.payload.date]);

  // GESTORE TRANSIZIONI
  useEffect(() => {
    const prepareTransition = async () => {
      const nextGraphic = broadcastState.active_graphic;

      if (nextGraphic !== 'draft_round_reveal' && nextGraphic !== 'draft_cronologica') setHighlightRound(null);

      if ((nextGraphic === 'match_full' || nextGraphic === 'match_lite') && broadcastState.payload.match_id) {
        await fetchMatchData(broadcastState.payload.match_id);
      } 
      else if (nextGraphic === 'daily_schedule' && broadcastState.payload.date) {
        await fetchDailySchedule(broadcastState.payload.date);
      } 
      else if (nextGraphic === 'slamdunk') {
        // Nessun fetch, il Controller ci invia già tutto nel payload!
      }
      else if (nextGraphic === '3point_leaderboard' || nextGraphic === '3point_bracket') {
        await fetchThreePointData();
        setHighlightedPlayerId(broadcastState.payload?.id || null);
      }
      else if (nextGraphic === '3point_winner') {
        await fetchThreePointData();
      }
      else if (nextGraphic.startsWith('draft_')) {
        await fetchDraftData();
        if (nextGraphic === 'draft_pool_status') await fetchEligiblePlayers();
      }
      // === NUOVA LOGICA FETCH PER TORNEO ===
      else if (nextGraphic === 'recap_girone' || nextGraphic === 'playoff_bracket') {
        await fetchTournamentData();
      }

      else if (nextGraphic === 'top_scorers') {
        await fetchTopScorers();
      }

      if (transitionTimer.current) clearTimeout(transitionTimer.current);

      if (nextGraphic === '3point_single') {
        setHighlightedPlayerId(broadcastState.payload.id);
        setLocalGraphic('3point_single'); 

        if (!broadcastState.payload.command) {
          const roundDelGiocatore = broadcastState.payload.round || 'Qualificazione';
          const isPlayoff = ['Quarti di finale', 'Semifinale', 'Finale'].includes(roundDelGiocatore);
          transitionTimer.current = setTimeout(async () => {
            await fetchThreePointData();
            setLocalGraphic(isPlayoff ? '3point_bracket' : '3point_leaderboard');
            setTimeout(() => setHighlightedPlayerId(null), 5000);
          }, 8000);
        }
        return; 
      }

      if (nextGraphic === '3point_result') {
        setLocalGraphic('3point_result');
        return;
      }

      if (nextGraphic === '3point_winner') {
        setLocalGraphic('3point_winner');
        transitionTimer.current = setTimeout(() => setLocalGraphic('3point_bracket'), 12000);
        return; 
      }

      if (nextGraphic === 'draft_annuncio') {
        await fetchDraftData(); 
        setLocalGraphic('draft_annuncio'); 
        transitionTimer.current = setTimeout(() => setLocalGraphic('draft_mista'), 8000);
        return;
      }

      if (nextGraphic === 'draft_attesa' || nextGraphic === 'draft_round_attesa') {
        setLocalGraphic(nextGraphic);
        return;
      }

      if (nextGraphic === 'draft_round_reveal') {
        await fetchDraftData();
        setLocalGraphic('draft_round_reveal');
        setHighlightRound(broadcastState.payload.round);
        transitionTimer.current = setTimeout(() => {
          setLocalGraphic('draft_cronologica');
          setTimeout(() => setHighlightRound(null), 10000);
        }, 12000);
        return;
      }

      setLocalGraphic(nextGraphic);
    };

    prepareTransition();

    return () => {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    };
  }, [broadcastState]);

  // === LOGICA LOGO DINAMICO ===
  let currentLogo = "Basketville_logo26_vero.png"; // Logo di Default
  
  if (localGraphic.includes('slamdunk')) {
    currentLogo = "Logo_SlamDunk.png";
  } else if (localGraphic.includes('3point')) {
    currentLogo = "Logo_3Point.png";
  } else if (localGraphic === 'match_full' || localGraphic === 'match_lite') {
    // Peschiamo l'event_id direttamente dalla partita caricata!
    const eventId = matchData?.team_a?.event_id;
    
    // Inserisci qui gli ID reali dei tuoi eventi e i loghi corrispondenti
    if (eventId === 1) {
      currentLogo = "Basketville_logo26_vero.png"; // VERO Cup
    } else if (eventId === 4) {
      currentLogo = "Logo_MasterCamp.png";         // OLD
    } else if (eventId === 5) {
      currentLogo = "Logo_AltroEvento.png";        // WOMEN
    } else if (eventId === 6) {
      currentLogo = "Logo_AltroEvento.png";        // DR123
    }
  }
  // ============================


  return (
    <div className="w-[1920px] h-[1080px] overflow-hidden bg-neutral-950 relative font-dimbo text-white origin-top-left">
      
      {/* ========================================= */}
      {/* OVERLAY LOGO CENTRALE UNICO (Z-50) */}
      {/* ========================================= */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-500">
        <img 
          src={currentLogo} 
          alt="Sponsor Logo" 
          className="h-[140px] w-auto drop-shadow-2xl" 
        />
      </div>

      {/* ========================================= */}
      {/* GRAFICHE ANIMATE                          */}
      {/* ========================================= */}
      <AnimatePresence mode="wait">
        
        {localGraphic === '3point_single' && <ThreePointSingle key="single" payload={broadcastState.payload} />}
        {localGraphic === '3point_result' && <ThreePointResult key="result" payload={broadcastState.payload} />}
        {localGraphic === '3point_winner' && <ThreePointWinner key="winner" payload={broadcastState.payload} />}
        {localGraphic === '3point_leaderboard' && <ThreePointLeaderboard key="leaderboard" data={threePointData} highlightedId={highlightedPlayerId} />}
        {localGraphic === '3point_bracket' && <ThreePointBracket key="bracket" data={threePointData} highlightedId={highlightedPlayerId} />}
        {localGraphic === 'slamdunk' && <SlamDunkGraphic key="slamdunk" payload={broadcastState.payload} />}
        {localGraphic === 'daily_schedule' && <DailyScheduleGraphic key="schedule" dateStr={dailyScheduleDate} data={dailyScheduleData} />}
        {localGraphic === 'match_full' && matchData && <MatchFullGraphic key="match_full" match={matchData} />}
        {localGraphic === 'match_lite' && matchData && <MatchLiteGraphic key="match_lite" match={matchData} />}
        {localGraphic === 'generic_title' && <GenericTitleGraphic key="generic_title" payload={broadcastState.payload} />}
        {localGraphic === 'slamdunk' && <SlamDunkGraphic key="slamdunk" payload={broadcastState.payload} />}
        {localGraphic === 'top_scorers' && (
          <TopScorersGraphic key="top_scorers" data={topScorers} />
        )}
        {localGraphic === 'mvp_title' && <MvpTitleGraphic key="mvp_title" payload={broadcastState.payload} />}

        {/* === NUOVE GRAFICHE AGGIUNTE ALL'ANIMATE PRESENCE === */}
        {localGraphic === 'recap_girone' && (
          <RecapGironeGraphic key="recap_girone" matches={tournamentMatches} teamsEditionEvents={tournamentTeams} calendar={tournamentCalendar} />
        )}
        {localGraphic === 'playoff_bracket' && (
          <QuadroPlayoffGraphic key="playoff_bracket" matches={tournamentMatches} teamsEditionEvents={tournamentTeams} calendar={tournamentCalendar} />
        )}

        {localGraphic === 'draft_cronologica' && (
          <DraftCronologicaGraphic key="draft_crono" picks={draftPicks} highlightRound={highlightRound} />
        )}
        {localGraphic === 'draft_rosters' && (
          <DraftRostersGraphic key="draft_rosters" picks={draftPicks} teams={draftTeams} />
        )}
        {localGraphic === 'draft_mista' && (
          <DraftMistaGraphic key="draft_mista" picks={draftPicks} teams={draftTeams} />
        )}
        {localGraphic === 'draft_attesa' && (
          <DraftAttesaGraphic key="draft_attesa" activePayload={broadcastState.payload} />
        )}
        {localGraphic === 'draft_round_attesa' && (
          <DraftRoundAttesaGraphic key="draft_round_attesa" payload={broadcastState.payload} />
        )}
        {localGraphic === 'draft_annuncio' && (
          <DraftAnnuncioGraphic key="draft_annuncio" picks={draftPicks} />
        )}
        {localGraphic === 'draft_round_reveal' && (
          <DraftRoundRevealGraphic key="draft_round_reveal" picks={draftPicks} round={broadcastState.payload.round} />
        )}
        {localGraphic === 'draft_pool_status' && (
          <DraftPoolGraphic key="draft_pool_status" players={eligiblePlayers} picks={draftPicks} />
        )}

      </AnimatePresence>
    </div>
  );
}

// ==========================================
// COMPONENTI GRAFICI PARTITA (LITE E FULL)
// ==========================================

function MatchLiteGraphic({ match }) {
  const styles = getEventStyles(match.event_name);
  
  let subtitle = match.match_types?.name || '';
  if ((subtitle.toLowerCase().includes('giron') || subtitle.toLowerCase().includes('qualificazion')) && match.team_a?.group_name) {
    subtitle = `GIRONE ${match.team_a.group_name}`;
  }

  const hasOT = match.ot_a > 0 || match.ot_b > 0 || match.ot_a !== null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-950 to-black p-12 pt-[200px]"
    >
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>
      
      {/* TITOLO SPOSTATO IN ALTO A DESTRA */}
      <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right">
        <span className={`inline-block px-4 py-1.5 rounded-xl text-sm font-bold uppercase tracking-[0.3em] mb-2 drop-shadow-md ${styles.tag}`}>
          {match.event_name}
        </span>
        <span className="text-3xl font-black text-neutral-300 uppercase tracking-[0.08em] drop-shadow-lg">
          {subtitle}
        </span>
      </div>

      <div className="z-10 w-full max-w-[1300px] bg-white/5 backdrop-blur-xl border border-white/10 rounded-[3rem] p-16 shadow-2xl flex flex-col items-center">
        
        <div className="flex items-center justify-between w-full">
          <div className="flex flex-col items-center flex-1">
            <span className="text-[40px] font-black uppercase text-white whitespace-nowrap mb-2">
              {match.team_a?.teams?.name}
            </span>
            <span className="text-[120px] leading-none font-black text-pink-500 drop-shadow-[0_0_20px_rgba(236,72,153,0.3)]">
              {match.score_a ?? 0}
            </span>
          </div>

          <div className="shrink-0 flex items-center gap-6 bg-black/40 px-10 py-6 rounded-3xl border border-white/5 mx-8">
            {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => (
              <div key={q} className="flex flex-col items-center gap-2">
                <span className="text-[11px] text-neutral-500 uppercase tracking-widest mb-1">{q}</span>
                <span className="text-2xl font-bold text-white">{match[`q${i+1}_a`] ?? 0}</span>
                <div className="w-6 h-px bg-white/10 my-1"></div>
                <span className="text-2xl font-bold text-white">{match[`q${i+1}_b`] ?? 0}</span>
              </div>
            ))}
            
            {hasOT && (
              <div className="flex flex-col items-center gap-2 border-l border-white/10 pl-6 ml-2">
                <span className="text-[11px] text-pink-500 uppercase tracking-widest mb-1">OT</span>
                <span className="text-2xl font-black text-pink-400">{match.ot_a ?? 0}</span>
                <div className="w-6 h-px bg-white/10 my-1"></div>
                <span className="text-2xl font-black text-pink-400">{match.ot_b ?? 0}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center flex-1">
            <span className="text-[40px] font-black uppercase text-white whitespace-nowrap mb-2">
              {match.team_b?.teams?.name}
            </span>
            <span className="text-[120px] leading-none font-black text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">
              {match.score_b ?? 0}
            </span>
          </div>
        </div>

        {match.status === 'live' && (
          <div className="mt-14 flex items-center gap-3 text-red-500 font-black tracking-[0.08em] uppercase animate-pulse">
            <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_15px_red]"></div>
            Match Live
          </div>
        )}

      </div>
    </motion.div>
  );
}


function MatchFullGraphic({ match }) {
  const styles = getEventStyles(match.event_name);

  let subtitle = match.match_types?.name || '';
  const typeL = subtitle.toLowerCase();
  if ((typeL.includes('giron') || typeL.includes('qualificazion')) && match.team_a?.group_name) {
    subtitle = `GIRONE ${match.team_a.group_name}`;
  }

  const renderPlayerRow = (p) => (
    <div key={p.id} className="flex justify-between items-center bg-white/5 border border-white/5 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-pink-500 font-mono font-bold w-5 text-right text-base shrink-0">
          {p.jersey_number}
        </span>
        <span className="font-bold text-white uppercase text-xs truncate">
          {p.players?.first_name?.charAt(0)}.{p.players?.last_name}
        </span>
      </div>
      <span className="font-black text-lg text-neutral-200 shrink-0 ml-2">
        {p.match_points} <span className="text-[9px] text-neutral-500 font-normal">pt</span>
      </span>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-950 to-black p-8 pt-[200px]"
    >
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>

      {/* TITOLO SPOSTATO IN ALTO A DESTRA */}
      <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right">
        <span className={`inline-block px-4 py-1.5 rounded-xl text-sm font-bold uppercase tracking-[0.3em] mb-2 drop-shadow-md ${styles.tag}`}>
          {match.event_name}
        </span>
        <span className="text-3xl font-black text-neutral-300 uppercase tracking-[0.08em] drop-shadow-lg">
          {subtitle}
        </span>
      </div>

      <div className="z-10 w-[95%] max-w-[1500px] flex flex-col items-center gap-5">
        
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 shadow-2xl flex flex-col items-center w-full shrink-0">
           <div className="flex items-center justify-between w-full gap-8">
             <div className="flex-1 text-right">
               <h2 className="text-[50px] leading-tight font-black uppercase text-white whitespace-nowrap overflow-visible">
                 {match.team_a?.teams?.name}
               </h2>
             </div>
             
             <div className="shrink-0 flex flex-col items-center">
               <div className="bg-pink-500/20 border border-pink-500/40 px-10 py-3 rounded-[1.5rem] text-[70px] leading-none font-black text-white shadow-[0_0_30px_rgba(236,72,153,0.3)]">
                 {match.score_a ?? 0} - {match.score_b ?? 0}
               </div>
             </div>

             <div className="flex-1 text-left">
               <h2 className="text-[50px] leading-tight font-black uppercase text-white whitespace-nowrap overflow-visible">
                 {match.team_b?.teams?.name}
               </h2>
             </div>
           </div>

           <div className="mt-4 flex justify-center gap-8 text-neutral-300 font-bold bg-black/40 px-8 py-2 rounded-2xl border border-white/5">
             {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => (
                <div key={q} className="flex flex-col items-center">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-widest">
                    {q}
                  </span>
                  <span className="text-lg">
                    {match[`q${i+1}_a`] ?? 0} - {match[`q${i+1}_b`] ?? 0}
                  </span>
                </div>
             ))}
             {((match.ot_a !== null && match.ot_a > 0) || match.ot_b > 0) && (
                <div className="flex flex-col items-center text-pink-400 border-l border-white/10 pl-8">
                  <span className="text-[10px] uppercase tracking-widest">
                    OT
                  </span>
                  <span className="text-lg">
                    {match.ot_a ?? 0} - {match.ot_b ?? 0}
                  </span>
                </div>
             )}
           </div>
        </div>

        <div className="flex w-full gap-5">
          <div className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-5 shadow-2xl flex flex-col min-w-0">
            <h3 className="text-center font-black uppercase text-neutral-400 tracking-[0.2em] mb-4 border-b border-white/10 pb-3 shrink-0 truncate px-2">
              ROSTER {match.team_a?.teams?.name || 'HOME'}
            </h3>
            <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2 content-start">
              {match.roster_a?.length > 0 ? (
                match.roster_a.map(renderPlayerRow)
              ) : (
                <div className="col-span-2 text-center text-neutral-500 mt-4 uppercase font-bold text-xs">
                  Nessun giocatore
                </div>
              )}
            </div>
            {(match.team_a?.coach || match.team_a?.assistant_coach) && (
              <div className="mt-4 pt-3 border-t border-white/10 flex justify-center gap-4">
                {match.team_a?.coach && (
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest bg-black/20 px-4 py-1.5 rounded-lg border border-white/5">
                    Coach: <span className="text-white ml-1">{match.team_a.coach}</span>
                  </div>
                )}
                {match.team_a?.assistant_coach && (
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest bg-black/20 px-4 py-1.5 rounded-lg border border-white/5">
                    Vice: <span className="text-neutral-300 ml-1">{match.team_a.assistant_coach}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-5 shadow-2xl flex flex-col min-w-0">
            <h3 className="text-center font-black uppercase text-neutral-400 tracking-[0.2em] mb-4 border-b border-white/10 pb-3 shrink-0 truncate px-2">
              ROSTER {match.team_b?.teams?.name || 'AWAY'}
            </h3>
            <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2 content-start">
              {match.roster_b?.length > 0 ? (
                match.roster_b.map(renderPlayerRow)
              ) : (
                <div className="col-span-2 text-center text-neutral-500 mt-4 uppercase font-bold text-xs">
                  Nessun giocatore
                </div>
              )}
            </div>
            {(match.team_b?.coach || match.team_b?.assistant_coach) && (
              <div className="mt-4 pt-3 border-t border-white/10 flex justify-center gap-4">
                {match.team_b?.coach && (
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest bg-black/20 px-4 py-1.5 rounded-lg border border-white/5">
                    Coach: <span className="text-white ml-1">{match.team_b.coach}</span>
                  </div>
                )}
                {match.team_b?.assistant_coach && (
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest bg-black/20 px-4 py-1.5 rounded-lg border border-white/5">
                    Vice: <span className="text-neutral-300 ml-1">{match.team_b.assistant_coach}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ==========================================
// COMPONENTE: DAILY SCHEDULE (PALINSESTO)
// ==========================================
function DailyScheduleGraphic({ dateStr, data }) {
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    return timeString.substring(0, 5);
  };

  const renderMatchCenter = (match) => {
    const status = match.status?.toLowerCase();
    const hasScore = match.score_home !== null && match.score_away !== null;
    const isZeroZero = match.score_home === 0 && match.score_away === 0;

    let topText = '';
    const type = match.match_type?.toLowerCase() || '';
    if ((type.includes('giron') || type.includes('qualificazion')) && match.home_group) {
      topText = `GIRONE ${match.home_group}`;
    } else {
      topText = match.match_type || '';
    }

    let boxContent = null;
    let bottomText = '';
    let boxClasses = '';
    let textClasses = '';

    if (status === 'live') {
      boxClasses = 'bg-red-500/20 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.4)]';
      boxContent = (
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-2xl font-black text-red-400">
            {match.score_home ?? 0} - {match.score_away ?? 0}
          </span>
        </div>
      );
      bottomText = 'Live';
      textClasses = 'text-red-400 animate-pulse';
    } 
    else if (status === 'finished' || status === 'completed' || (hasScore && !isZeroZero && status !== 'scheduled')) {
      boxClasses = 'bg-black/60 border border-neutral-600';
      boxContent = (
        <span className="text-2xl font-black text-neutral-300">
          {match.score_home ?? 0} - {match.score_away ?? 0}
        </span>
      );
      bottomText = 'Finale';
      textClasses = 'text-neutral-500';
    } 
    else {
      boxClasses = 'bg-white/5 border border-white/10';
      boxContent = (
        <span className="text-xl font-bold text-neutral-500 uppercase tracking-widest px-2">
          VS
        </span>
      );
      bottomText = '';
      textClasses = 'text-transparent';
    }

    return (
      <div className="w-[180px] flex flex-col items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em] mb-1.5 h-3 flex items-center justify-center">
          {topText}
        </span>
        <div className={`flex items-center justify-center px-4 py-1.5 rounded-xl ${boxClasses}`}>
          {boxContent}
        </div>
        <span className={`text-[9px] font-bold uppercase tracking-[0.2em] mt-1.5 h-3 flex items-center justify-center ${textClasses}`}>
          {bottomText || '-'}
        </span>
      </div>
    );
  };

  const containerVariants = { 
    hidden: { opacity: 0 }, 
    visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.3 } }, 
    exit: { opacity: 0, transition: { duration: 0.3 } } 
  };
  
  const itemVariants = { 
    hidden: { opacity: 0, y: 40 }, 
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 80, damping: 15 } } 
  };

  return (
    <motion.div 
      initial="hidden" 
      animate="visible" 
      exit="exit" 
      className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-950 to-black p-12 pt-[200px]" 
    >
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>
      
      {/* TITOLO SPOSTATO IN ALTO A DESTRA */}
      <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right">
        <span className="text-xl font-bold uppercase tracking-[0.5em] text-pink-500 mb-1 drop-shadow-md">
          Il Programma
        </span>
        <h1 className="text-5xl font-black uppercase tracking-tighter text-white drop-shadow-lg capitalize">
          {formatDate(dateStr)}
        </h1>
      </div>

      <div className="z-10 w-full max-w-5xl flex flex-col items-center">
        <motion.div variants={containerVariants} className="w-full flex flex-col gap-4">
          {data.length === 0 ? (
            <div className="text-center text-neutral-500 text-2xl font-bold uppercase tracking-widest mt-10">
              Nessun evento in programma
            </div>
          ) : (
            data.map((item, index) => {
              const styles = getEventStyles(item.event_tag);
              return (
                <motion.div key={item.id || index} variants={itemVariants} className="w-full">
                  <div className="w-full h-[110px] relative rounded-3xl shadow-2xl">
                    
                    <div className="absolute inset-0 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl pointer-events-none"></div>
                    <div className={`absolute left-0 top-0 bottom-0 w-2 rounded-l-3xl ${styles.border}`}></div>
                    
                    <div className="absolute inset-0 flex items-center px-6 z-10">
                      <div className="w-28 text-center shrink-0 border-r border-white/10 pr-6 mr-6">
                        <span className="text-4xl font-black text-white font-mono tracking-tight drop-shadow-md">
                          {formatTime(item.time)}
                        </span>
                      </div>
                      
                      <div className="flex-1 flex items-center justify-between min-w-0">
                        {item.matchDetails ? (
                          <>
                            <div className="flex-1 text-right truncate text-[28px] sm:text-3xl font-bold text-white px-4">
                              {item.matchDetails.home_name}
                            </div>
                            {renderMatchCenter(item.matchDetails)}
                            <div className="flex-1 text-left truncate text-[28px] sm:text-3xl font-bold text-white px-4">
                              {item.matchDetails.away_name}
                            </div>
                          </>
                        ) : (
                          <div className="flex-1 flex items-center justify-center px-4">
                            <span className="text-[28px] sm:text-3xl font-bold text-white uppercase tracking-tight truncate text-center w-full">
                              {item.description || item.event_tag}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="shrink-0 w-40 flex justify-end">
                        <span className={`inline-block border px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest whitespace-nowrap ${styles.tag}`}>
                          {item.event_tag}
                        </span>
                      </div>
                    </div>

                  </div>
                </motion.div>
              );
            })
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

// ==========================================
// COMPONENTI GRAFICI MAXISCHERMO (GIOCHI)
// ==========================================

function ThreePointSingle({ payload }) {
  const [localTime, setLocalTime] = useState(60.0);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (payload.command === 'start') {
      setIsRunning(true);
      if (payload.time) setLocalTime(parseFloat(payload.time));
    } else if (payload.command === 'pause') {
      setIsRunning(false);
      if (payload.time) setLocalTime(parseFloat(payload.time)); 
    } else if (payload.command === 'idle') {
      setIsRunning(false);
      setLocalTime(60.0);
    } else if (!payload.command) {
      setIsRunning(false);
      setLocalTime(parseFloat(payload.time) || 0.0);
    }
  }, [payload]);

  useEffect(() => {
    let interval;
    if (isRunning && localTime > 0) {
      interval = setInterval(() => {
        setLocalTime(prev => {
          const next = prev - 0.1;
          return next <= 0 ? 0 : Number(next.toFixed(1));
        });
      }, 100);
    } else if (localTime <= 0) {
      setIsRunning(false);
    }
    return () => clearInterval(interval);
  }, [isRunning, localTime]);

  const hasPrev = payload.prev_score !== null && payload.prev_score !== undefined;
  const isLive = !!payload.command; 

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      exit={{ opacity: 0, scale: 1.05 }} 
      transition={{ type: "spring", stiffness: 100, damping: 20 }} 
      className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-950 to-black"
    >
      {/* TITOLO SPOSTATO IN ALTO A DESTRA */}
      <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right">
        <div className="flex items-center gap-3">
          {isRunning && <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.8)]"></div>}
          <h2 className="text-4xl font-black uppercase tracking-[0.3em] text-pink-500 drop-shadow-md">
            {isLive ? "3-Point Contest" : "3-Point Contest"}
          </h2>
        </div>
      </div>

      <div className="flex flex-col items-center text-center w-full max-w-6xl px-12 relative pt-[200px]">
        
        <h1 className="text-[100px] leading-none font-black uppercase tracking-tighter mb-4 drop-shadow-2xl text-white">
          {payload.player_name || 'Tiratore'}
        </h1>
        
        <div className="mb-12 h-10">
          {isLive && hasPrev && (
            <div className="inline-flex items-center gap-4 px-6 py-2 rounded-full border bg-white/5 border-white/10 text-neutral-400">
              <span className="text-[10px] font-bold uppercase tracking-widest">Miglior Prestazione</span>
              <span className="text-lg font-black">{payload.prev_score} pt <span className="text-sm font-normal">in {payload.prev_time}s</span></span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-12 w-full justify-center relative">
          <div className="bg-white/5 backdrop-blur-xl px-12 py-10 rounded-[2.5rem] border border-white/10 w-[450px] relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/20 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
            <span className="text-xl font-bold text-neutral-400 uppercase tracking-[0.3em] block mb-3">Punteggio</span>
            <span className="text-[130px] leading-none font-black text-white drop-shadow-[0_0_30px_rgba(236,72,153,0.6)]">
              {payload.score || 0}
            </span>
          </div>
          
          <div className="bg-white/5 backdrop-blur-xl px-12 py-10 rounded-[2.5rem] border border-white/10 w-[450px] shadow-2xl">
            <span className="text-xl font-bold text-neutral-400 uppercase tracking-[0.3em] block mb-3">
              {isLive ? "Tempo Rimasto" : "Tempo Impiegato"}
            </span>
            <span className={`text-[130px] leading-none font-black tabular-nums ${localTime <= 10 && isRunning ? 'text-red-500' : 'text-neutral-200'}`}>
              {isLive ? localTime.toFixed(1) : `${payload.time || '0.0'}s`}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// === NUOVA SCHERMATA INTERMEDIA: RISULTATO CONFERMATO ===
function ThreePointResult({ payload }) {
  const [lockedPayload, setLockedPayload] = useState(payload);

  useEffect(() => {
    if (payload && payload.player_name) setLockedPayload(payload);
  }, [payload]);

  const isRecord = lockedPayload.status === 'record';
  const isScartato = lockedPayload.status === 'scartato';
  const hasPrev = lockedPayload.prev_score !== null && lockedPayload.prev_score !== undefined;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      exit={{ opacity: 0, scale: 1.05 }} 
      transition={{ type: "spring", stiffness: 100, damping: 20 }} 
      className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-950 to-black"
    >
      {/* TITOLO SPOSTATO IN ALTO A DESTRA */}
      <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right">
        <h2 className="text-4xl font-black uppercase tracking-[0.3em] text-neutral-500 drop-shadow-md">
          Risultato Ufficiale
        </h2>
      </div>

      <div className="flex flex-col items-center text-center w-full max-w-6xl px-12 relative pt-[200px]">
        <h1 className="text-[100px] leading-none font-black uppercase tracking-tighter mb-4 drop-shadow-2xl">
          {lockedPayload.player_name || 'Tiratore'}
        </h1>
        
        <div className="mb-4 h-10">
          {hasPrev && (
            <motion.div 
              animate={isScartato ? { scale: [1, 1.1, 1], backgroundColor: ['rgba(34,197,94,0.1)', 'rgba(34,197,94,0.4)', 'rgba(34,197,94,0.1)'], borderColor: '#22c55e' } : {}}
              transition={{ duration: 1, repeat: isScartato ? 3 : 0 }}
              className={`inline-flex items-center gap-4 px-6 py-2 rounded-full border ${isScartato ? 'border-green-500 text-green-400' : 'bg-white/5 border-white/10 text-neutral-400'}`}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest">Miglior Prestazione</span>
              <span className="text-lg font-black">{lockedPayload.prev_score} pt <span className="text-sm font-normal">in {lockedPayload.prev_time}s</span></span>
            </motion.div>
          )}
        </div>

        <div className="h-[120px] mb-8 flex justify-center items-center w-full">
          <AnimatePresence>
            {isScartato && (
              <motion.div 
                key="scartato"
                initial={{ opacity: 0, scale: 0.5, rotate: -10 }} 
                animate={{ opacity: 1, scale: 1, rotate: -5 }} 
                exit={{ opacity: 0, scale: 0.5, rotate: -10 }}
                className="text-[90px] font-black text-red-500 uppercase tracking-widest border-8 border-red-500 px-8 py-2 rounded-3xl bg-black/80 backdrop-blur-md shadow-[0_0_50px_rgba(239,68,68,0.5)]"
              >
                SCARTATO
              </motion.div>
            )}
            {isRecord && (
              <motion.div 
                key="record"
                initial={{ opacity: 0, scale: 0.5, rotate: 10 }} 
                animate={{ opacity: 1, scale: 1, rotate: 5 }} 
                exit={{ opacity: 0, scale: 0.5, rotate: 10 }}
                className="text-[90px] font-black text-green-500 uppercase tracking-widest border-8 border-green-500 px-8 py-2 rounded-3xl bg-black/80 backdrop-blur-md shadow-[0_0_50px_rgba(34,197,94,0.5)]"
              >
                VALIDO
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-12 w-full justify-center relative">
          <div className={`bg-white/5 backdrop-blur-xl px-12 py-10 rounded-[2.5rem] border border-white/10 w-[450px] relative overflow-hidden transition-all ${isScartato ? 'opacity-30 blur-sm grayscale' : 'shadow-2xl'}`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/20 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
            <span className="text-xl font-bold text-neutral-400 uppercase tracking-[0.3em] block mb-3">
              Punteggio Finale
            </span>
            <span className={`text-[130px] leading-none font-black text-white drop-shadow-[0_0_30px_rgba(236,72,153,0.6)] ${isRecord ? 'text-pink-400' : ''}`}>
              {lockedPayload.score || 0}
            </span>
          </div>
          
          <div className={`bg-white/5 backdrop-blur-xl px-12 py-10 rounded-[2.5rem] border border-white/10 w-[450px] transition-all ${isScartato ? 'opacity-30 blur-sm grayscale' : 'shadow-2xl'}`}>
            <span className="text-xl font-bold text-neutral-400 uppercase tracking-[0.3em] block mb-3">
              Tempo Impiegato
            </span>
            <span className="text-[130px] leading-none font-black tabular-nums text-neutral-200">
              {lockedPayload.time}s
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ThreePointWinner({ payload }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.8 }} 
      animate={{ opacity: 1, scale: 1 }} 
      exit={{ opacity: 0, scale: 1.1 }} 
      transition={{ type: "spring", stiffness: 70, damping: 20 }} 
      className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-900 via-neutral-950 to-black overflow-hidden"
    >
      <div className="absolute top-0 w-full h-full opacity-20 pointer-events-none mix-blend-screen bg-center bg-cover bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
      
      {/* TITOLO SPOSTATO IN ALTO A DESTRA */}
      <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right">
        <h2 className="text-4xl font-black uppercase tracking-[0.08em] text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.8)]">
          3-Point Champion
        </h2>
      </div>
      
      <div className="flex flex-col items-center text-center w-full max-w-6xl px-12 z-10 pt-[200px]">
        <h1 className="text-[140px] leading-none font-black uppercase tracking-tighter mb-16 text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-yellow-400 to-yellow-600 drop-shadow-2xl">
          {payload.player_name}
        </h1>
        
        <div className="flex items-center gap-12 w-full justify-center">
          <div className="bg-yellow-500/10 backdrop-blur-xl px-16 py-8 rounded-[3rem] border border-yellow-500/40 w-[500px] shadow-[0_0_80px_rgba(234,179,8,0.2)]">
            <span className="text-2xl font-bold text-yellow-200 uppercase tracking-[0.08em] block mb-4">
              Final Score
            </span>
            <span className="text-[140px] leading-none font-black text-white drop-shadow-[0_0_40px_rgba(234,179,8,0.8)]">
              {payload.score || 0}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ThreePointLeaderboard({ data, highlightedId }) {
  const sortedData = [...data]
    .filter(p => p.round === 'Qualificazione')
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const timeA = parseFloat(a.time) || 999;
      const timeB = parseFloat(b.time) || 999;
      return timeA - timeB;
    })
    .slice(0, 12); 
    
  const col1 = sortedData.slice(0, 6);
  const col2 = sortedData.slice(6, 12);
  
  const renderRow = (player, index, startIndex) => {
    const isHighlighted = player.id && String(player.id) === String(highlightedId);
    const position = startIndex + index + 1;
    
    return (
      <motion.div 
        key={player.id} 
        animate={{ 
          backgroundColor: isHighlighted ? ['rgba(255,255,255,0.05)', 'rgba(236,72,153,0.4)', 'rgba(255,255,255,0.05)'] : 'rgba(255, 255, 255, 0.05)', 
          borderColor: isHighlighted ? ['rgba(255,255,255,0.1)', 'rgba(236,72,153,0.8)', 'rgba(255,255,255,0.1)'] : 'rgba(255, 255, 255, 0.1)', 
          scale: isHighlighted ? [1, 1.03, 1] : 1 
        }} 
        transition={{ duration: 1, repeat: isHighlighted ? 4 : 0 }} 
        className="flex items-center justify-between px-6 py-3 rounded-2xl border backdrop-blur-sm shadow-lg mb-3"
      >
        <div className="flex items-center gap-5">
          <span className="text-2xl font-black text-pink-500 w-10 text-right">
            {position}.
          </span>
          <span className="text-2xl font-bold uppercase tracking-tight text-white">
            {player.player_name}
          </span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-center">
            <span className="text-[9px] uppercase tracking-widest text-neutral-400 block">
              Tempo
            </span>
            <span className="text-xl font-bold text-neutral-300">
              {player.time || '-'}
            </span>
          </div>
          <div className="text-center w-20 bg-white/10 py-1.5 rounded-xl">
            <span className="text-[9px] uppercase tracking-widest text-pink-400 block">
              Punti
            </span>
            <span className="text-2xl font-black text-white">
              {player.score}
            </span>
          </div>
        </div>
      </motion.div>
    );
  };
  
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      exit={{ opacity: 0, scale: 1.05 }} 
      transition={{ duration: 0.4 }} 
      className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-900 to-black p-12 pt-[200px]"
    >
      {/* TITOLO SPOSTATO IN ALTO A DESTRA */}
      <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right">
        <h2 className="text-4xl font-black uppercase tracking-tighter text-white drop-shadow-lg">
          3-Point Contest <span className="text-pink-500">Top 12</span>
        </h2>
        <p className="text-sm text-neutral-400 font-bold uppercase tracking-[0.3em] mt-1">
          Leaderboard Qualificazioni
        </p>
      </div>
      
      <div className="grid grid-cols-2 gap-x-20 w-full max-w-[1500px] mt-8">
        <div>{col1.map((player, idx) => renderRow(player, idx, 0))}</div>
        <div>{col2.map((player, idx) => renderRow(player, idx, 6))}</div>
      </div>
    </motion.div>
  );
}

function MatchupCard({ title, players, maxPlayers = 2, isFinal = false, highlightedId, championName }) {
  const slots = Array.from({ length: maxPlayers }).map((_, i) => players[i] || null);
  const cardWidth = isFinal ? 'w-[420px]' : 'w-[280px]';
  
  return (
    <div className={`backdrop-blur-xl border rounded-2xl p-4 flex flex-col gap-2 shadow-2xl bg-white/5 border-white/10 ${cardWidth}`}>
      <div className="text-center text-[11px] font-black uppercase tracking-widest mb-0.5 text-pink-500">
        {title}
      </div>
      
      {slots.map((p, i) => {
        const isHighlighted = p && String(p.id) === String(highlightedId);
        
        // LOGICA CAMPIONE ASSOLUTO
        const isChampion = championName && p && p.player_name === championName;

        // Impostiamo i colori dinamici
        const bgColors = isChampion ? ['rgba(234,179,8,0.15)', 'rgba(234,179,8,0.4)', 'rgba(234,179,8,0.15)'] :
                         isHighlighted ? ['rgba(255, 255, 255, 0.05)', 'rgba(236, 72, 153, 0.4)', 'rgba(255, 255, 255, 0.05)'] : 'rgba(255, 255, 255, 0.05)';
        const borderColors = isChampion ? ['rgba(234,179,8,0.4)', 'rgba(234,179,8,1)', 'rgba(234,179,8,0.4)'] :
                             isHighlighted ? ['rgba(255, 255, 255, 0.05)', 'rgba(236, 72, 153, 0.8)', 'rgba(255, 255, 255, 0.05)'] : 'rgba(255, 255, 255, 0.05)';
        const textColor = isChampion ? 'text-yellow-400 drop-shadow-md' : (p ? 'text-white' : 'text-neutral-500');
        const scoreColor = isChampion ? 'text-yellow-400' : (p && p.score > 0 ? 'text-pink-400' : 'text-neutral-700');

        return (
          <motion.div 
            key={p ? p.id : `empty-${i}`} 
            animate={{ 
              backgroundColor: bgColors, 
              borderColor: borderColors, 
              scale: isHighlighted || isChampion ? [1, 1.05, 1] : 1 
            }} 
            transition={{ duration: 1.2, repeat: (isHighlighted || isChampion) ? Infinity : 0 }} 
            className="flex justify-between items-center px-4 py-3 rounded-xl border relative"
          >
            {/* AGGIUNTA LA CLASSE "uppercase" QUI SOTTO */}
            <span className={`font-bold uppercase truncate pr-3 flex-1 ${isFinal ? 'text-xl' : 'text-base'} ${textColor}`}>
              {p ? p.player_name : 'TBD'}
            </span>
            
            <div className="flex items-center gap-3 shrink-0">
              {p && p.time && (
                <span className="text-[10px] text-neutral-400 bg-black/40 px-1.5 py-0.5 rounded font-mono border border-white/5">
                  {p.time}s
                </span>
              )}
              <span className={`font-black ${isFinal ? 'text-2xl' : 'text-xl'} ${scoreColor}`}>
                {p && p.score !== null ? p.score : '-'}
              </span>
            </div>

            {/* CORONCINA PER IL VINCITORE */}
            {isChampion && (
              <span className="text-2xl absolute -right-3 -top-3 drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]">👑</span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function ThreePointBracket({ data, highlightedId }) {
  const getHeatPlayers = (roundName, heatNum) => {
    return data.filter(p => p.round === roundName && p.heat === `Batteria ${heatNum}`).sort((a, b) => b.score - a.score);
  };
  const finalePlayers = data.filter(p => p.round === 'Finale').sort((a, b) => b.score - a.score);
  const winnerPlayer = data.find(p => p.round === 'Vincitore');
  
  // 1. Linea a "U" (Larghezza 296px, altezza verticale aumentata a h-8 per riempire lo schermo)
  const QuarterToSemiConnector = () => (
    <div className="flex flex-col items-center w-full">
      <div className="w-[296px] h-8 border-b-[3px] border-l-[3px] border-r-[3px] border-neutral-700/60 rounded-b-xl"></div>
      <div className="h-8 w-[3px] bg-neutral-700/60"></div>
    </div>
  );

  // 2. Linea a Tridente (Larghezza 1216px, drop verticale aumentato)
  const SemisToFinaleConnector = () => (
    <div className="flex flex-col items-center w-full">
      <div className="w-[1216px] h-10 relative">
        <div className="absolute left-0 top-0 w-[3px] h-full bg-neutral-700/60"></div>
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[3px] h-full bg-neutral-700/60"></div>
        <div className="absolute right-0 top-0 w-[3px] h-full bg-neutral-700/60"></div>
      </div>
      <div className="w-[1216px] h-[3px] bg-neutral-700/60 rounded-full"></div>
      <div className="h-10 w-[4px] bg-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.8)]"></div>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      exit={{ opacity: 0, scale: 1.05 }} 
      transition={{ duration: 0.4 }} 
      // pt-[140px] e layout fluido, nessun trucco "scale" che sfascia il bordo.
      className="absolute inset-0 w-[1920px] h-[1080px] flex flex-col items-center justify-start bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-900 to-black pt-[220px] overflow-hidden"
    >
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>

      <div className="absolute top-16 right-16 z-50 flex flex-col items-end text-right">
        <span className="text-pink-500 font-bold uppercase tracking-[0.4em] text-sm mb-1 drop-shadow-md">3-Point Contest</span>
        <h2 className="text-4xl font-black uppercase text-white tracking-widest drop-shadow-lg">Playoff Bracket</h2>
      </div>
      
      <div className="flex flex-col items-center w-full z-10 relative mt-4 max-w-[1850px] mx-auto">
        
        {/* RIGA IN ALTO: Quarti -> Semifinali */}
        <div className="flex justify-center gap-8 w-full">
          
          <div className="flex flex-col items-center">
            <div className="flex gap-4">
              <MatchupCard title="Quarto 1" players={getHeatPlayers('Quarti di finale', 1)} highlightedId={highlightedId} />
              <MatchupCard title="Quarto 2" players={getHeatPlayers('Quarti di finale', 2)} highlightedId={highlightedId} />
            </div>
            <QuarterToSemiConnector />
            <MatchupCard title="Semifinale 1" players={getHeatPlayers('Semifinale', 1)} highlightedId={highlightedId} />
          </div>

          <div className="flex flex-col items-center">
            <div className="flex gap-4">
              <MatchupCard title="Quarto 3" players={getHeatPlayers('Quarti di finale', 3)} highlightedId={highlightedId} />
              <MatchupCard title="Quarto 4" players={getHeatPlayers('Quarti di finale', 4)} highlightedId={highlightedId} />
            </div>
            <QuarterToSemiConnector />
            <MatchupCard title="Semifinale 2" players={getHeatPlayers('Semifinale', 2)} highlightedId={highlightedId} />
          </div>

          <div className="flex flex-col items-center">
            <div className="flex gap-4">
              <MatchupCard title="Quarto 5" players={getHeatPlayers('Quarti di finale', 5)} highlightedId={highlightedId} />
              <MatchupCard title="Quarto 6" players={getHeatPlayers('Quarti di finale', 6)} highlightedId={highlightedId} />
            </div>
            <QuarterToSemiConnector />
            <MatchupCard title="Semifinale 3" players={getHeatPlayers('Semifinale', 3)} highlightedId={highlightedId} />
          </div>

        </div>
        
        {/* CONNETTORE GIGANTE E FINALE */}
        <SemisToFinaleConnector />
        <MatchupCard 
          title="La Finale" 
          players={finalePlayers} 
          maxPlayers={3} 
          isFinal={true} 
          highlightedId={highlightedId} 
          championName={winnerPlayer?.player_name} 
        />
      </div>
    </motion.div>
  );
}

function DraftCronologicaGraphic({ picks, highlightRound }) {
  const containerVars = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
    exit: { opacity: 0 }
  };
  const colVars = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 80 } }
  };

  const renderPick = (pickNum) => {
    const pick = picks.find(p => p.pick_number === pickNum);
    const isFilled = pick && pick.player_id;
    const isHighlight = highlightRound && pick && pick.round_number === highlightRound;
    const teamName = pick?.teams_edition_events?.teams?.name || '';

    const defaultBorder = isFilled ? '#404040' : '#262626'; 
    const defaultBgClass = isFilled ? 'bg-neutral-900 shadow-sm' : 'bg-black';

    return (
      <motion.div 
        key={pickNum} 
        animate={isHighlight ? {
          borderColor: [defaultBorder, '#ec4899', defaultBorder],
          boxShadow: ['0px 0px 0px rgba(236,72,153,0)', '0px 0px 15px rgba(236,72,153,0.6)', '0px 0px 0px rgba(236,72,153,0)']
        } : {
          borderColor: defaultBorder,
          boxShadow: 'none'
        }}
        transition={isHighlight ? { duration: 1.5, repeat: Infinity } : { duration: 0.5 }}
        style={{ borderColor: defaultBorder }}
        className={`flex-1 flex flex-col rounded-2xl border relative p-1.5 justify-center ${defaultBgClass}`}
      >
        {/* === MODIFICA: NUMERO SCELTA === */}
        {/* Cambia "text-sm" in "text-base" (16px) o "text-[16px]". Usa "top-1.5" e "left-2" per spostarlo */}
        <span className="absolute top-1.5 left-2 text-[24px] font-black text-pink-500 opacity-100">
          #{pickNum}
        </span>
        
        {/* === MODIFICA: NOME SQUADRA E DISTANZA DALL'ALTO === */}
        {/* "mt-2.5" è la distanza dall'alto (puoi usare mt-1, mt-3 ecc). "text-[11px]" è la grandezza testo */}
        <div className="w-full text-center mt-2.5">
           <span className="text-[30px] font-black text-white uppercase tracking-wider block drop-shadow-md truncate px-1">
             {teamName}
           </span>
        </div>

        {/* === MODIFICA: ALTEZZA SPAZIO GIOCATORE E NOME GIOCATORE === */}
        {/* "h-5" (20px) è l'altezza fissa. Se aumenti il "text-[9px]" del giocatore a 11px o 12px, aumenta h-5 in h-6 o h-7! */}
        <div className="w-full text-center h-5 flex items-center justify-center">
          {isFilled ? (
             <span className="text-[20px] font-bold text-neutral-400 uppercase leading-none block truncate px-1 tracking-wider">
               {pick.players?.last_name} {pick.players?.first_name?.charAt(0)}.
             </span>
          ) : null}
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div initial="hidden" animate="visible" exit="exit" className="absolute inset-0 w-[1920px] h-[1080px] flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-950 to-black z-0 origin-top-left">
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>

      {/* TITOLO SPOSTATO IN ALTO A DESTRA */}
      <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right">
        <span className="text-pink-500 font-bold uppercase tracking-[0.08em] text-sm mb-1 drop-shadow-md">Basketville 2026</span>
        <h2 className="text-4xl font-black uppercase text-white drop-shadow-lg tracking-wider">
          Draft Board
        </h2>
      </div>

      <motion.div variants={containerVars} className="flex-1 flex gap-3 w-full max-w-[1880px] mx-auto z-10 overflow-hidden px-4 pb-4 pt-[200px]">
        {Array.from({ length: 5 }).map((_, roundIndex) => {
          const roundNum = roundIndex + 1;
          const startPickCol1 = (roundIndex * 12) + 1;
          const startPickCol2 = startPickCol1 + 6;
          
          const col1Picks = Array.from({ length: 6 }).map((_, pIdx) => startPickCol1 + pIdx);
          const col2Picks = Array.from({ length: 6 }).map((_, pIdx) => startPickCol2 + pIdx);

          return (
            <div key={roundNum} className="flex-1 flex flex-col border-r border-pink-500/20 last:border-r-0 pr-3 last:pr-0">
              
              {/* === MODIFICA: TITOLO ROUND ("ROUND 1", "ROUND 2") === */}
              {/* "text-[14px]" regola la grandezza. */}
              <div className="text-center font-black uppercase text-pink-500 tracking-[0.08em] mb-2 border-b border-pink-500/30 pb-1.5 text-[20px] drop-shadow-md">
                ROUND {roundNum}
              </div>
              
              <div className="flex-1 flex gap-1.5">
                <motion.div variants={colVars} className="flex-1 flex flex-col gap-1.5">
                  {col1Picks.map(pickNum => renderPick(pickNum))}
                </motion.div>
                <motion.div variants={colVars} className="flex-1 flex flex-col gap-1.5">
                  {col2Picks.map(pickNum => renderPick(pickNum))}
                </motion.div>
              </div>
            </div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

function DraftRostersGraphic({ picks, teams }) {
  const containerVars = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
    exit: { opacity: 0 }
  };
  const itemVars = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
  };

  return (
    <motion.div initial="hidden" animate="visible" exit="exit" className="absolute inset-0 w-[1920px] h-[1080px] flex flex-col items-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-950 to-black px-6 z-0 origin-top-left">
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>
      
      {/* TITOLO SPOSTATO IN ALTO A DESTRA */}
      <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right">
        <span className="text-pink-500 font-bold uppercase tracking-[0.08em] text-sm mb-1 drop-shadow-md">Basketville 2026</span>
        <h2 className="text-4xl font-black uppercase text-white drop-shadow-lg tracking-wider">
          Draft Rosters
        </h2>
      </div>

      {/* Aumentata l'altezza a h-[980px] per dare più respiro al fondo del box grigio */}
      <motion.div variants={containerVars} className="flex gap-5 w-full max-w-[1880px] mx-auto z-10 justify-center h-[981px] pt-[250px] pb-4 px-6">
        {teams.map(team => {
          const teamPicks = picks.filter(p => p.team_edition_event_id === team.id).sort((a,b) => a.pick_number - b.pick_number);

          return (
            <motion.div key={team.id} variants={itemVars} className="flex-1 bg-white/5 backdrop-blur-xl border border-neutral-800 rounded-3xl px-3 pb-3 pt-3 shadow-2xl flex flex-col min-w-0">
              
              <h3 className="text-center text-[28px] font-black uppercase text-white tracking-widest mb-2 border-b border-neutral-700 pb-1 truncate drop-shadow-md">
                {team.teams?.name}
              </h3>

              {/* BOX STAFF IN ALTO E OTTIMIZZATO */}
              <div className="mb-2 flex flex-col items-center justify-center min-h-[60px] bg-black/40 border border-neutral-800 rounded-xl px-2 py-1.5 shrink-0">
                 {team.coach ? (
                   <div className="text-[18px] leading-none font-bold text-neutral-400 uppercase tracking-widest text-center truncate w-full">
                     Coach: <span className="text-white">{team.coach}</span>
                   </div>
                 ) : (
                   <div className="text-[18px] leading-none font-bold text-neutral-600 uppercase tracking-widest text-center">Nessun Coach</div>
                 )}
                 {team.assistant_coach && (
                   <div className="text-[18px] leading-none font-bold text-neutral-400 uppercase tracking-widest text-center truncate w-full mt-0.5">
                     Vice: <span className="text-white">{team.assistant_coach}</span>
                   </div>
                 )}
              </div>
              
              {/* LISTA GIOCATORI COMPATTATA */}
              <div className="flex flex-col gap-1 flex-1 min-h-0">
                {Array.from({ length: 10 }).map((_, i) => {
                  const pick = teamPicks[i];
                  const isFilled = pick && pick.player_id;

                  // ==========================================
                  // LOGICA TAGLIO NOME INTELLIGENTE
                  // ==========================================
                  let displayLast = '';
                  let displayFirst = '';
                  
                  if (isFilled) {
                    displayLast = pick.players?.last_name || '';
                    const rawFirst = pick.players?.first_name || '';
                    
                    if ((displayLast.length + rawFirst.length) > 20) {
                      displayFirst = rawFirst.charAt(0) + '.';
                    } else {
                      displayFirst = rawFirst;
                    }
                  }
                  
                  return (
                    <div key={i} className={`flex items-center gap-3 px-3 py-[10.5px] rounded-xl border ${isFilled ? 'bg-neutral-900 border-neutral-700' : 'bg-black border-neutral-800'}`}>
                      <div className="w-6 shrink-0 text-left">
                        <span className="text-[18px] font-black text-neutral-500">#{pick ? pick.pick_number : '-'}</span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        {isFilled ? (
                          <span className="font-bold text-white uppercase text-[24px] truncate block leading-tight">
                            {displayLast} <span className="font-normal text-[18px] text-pink-500 ml-1">{displayFirst}</span>
                          </span>
                        ) : (
                          <span className="font-bold text-neutral-600 uppercase text-[24px] block leading-tight">-</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

function DraftMistaGraphic({ picks, teams }) {
  const nextPicks = [...picks].filter(p => !p.player_id).sort((a,b) => a.pick_number - b.pick_number);
  const onTheClock = nextPicks.length > 0 ? nextPicks[0] : null;
  const upNext = nextPicks.slice(1, 5); 

  const filledPicks = [...picks].filter(p => p.player_id).sort((a,b) => b.pick_number - a.pick_number);
  const latestPickId = filledPicks.length > 0 ? filledPicks[0].id : null;

  const containerVars = { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } };

  return (
    <motion.div initial="hidden" animate="visible" exit="exit" variants={containerVars} className="absolute inset-0 w-[1920px] h-[1080px] flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-950 to-black z-0 origin-top-left">
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>
      
      {/* TITOLO SPOSTATO IN ALTO A DESTRA */}
      <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right">
        <span className="text-pink-500 font-bold uppercase tracking-[0.08em] text-sm mb-1 drop-shadow-md">Basketville 2026</span>
        <h2 className="text-4xl font-black uppercase text-white drop-shadow-lg tracking-wider">
          Live Draft
        </h2>
      </div>

      <div className="flex-1 flex w-full gap-4 px-6 pt-[190px] pb-2 z-10 overflow-hidden items-start">
        {teams.map(team => {
          const teamPicks = picks.filter(p => p.team_edition_event_id === team.id).sort((a,b) => a.pick_number - b.pick_number);
          return (
            <div key={team.id} className="flex-1 bg-white/5 backdrop-blur-xl border border-neutral-800 rounded-3xl px-3 pb-3 pt-3 shadow-xl flex flex-col min-w-0">
              
              <h3 className="text-center text-[28px] font-black uppercase text-white tracking-widest mb-2 border-b border-neutral-700 pb-1 truncate drop-shadow-md">
                {team.teams?.name}
              </h3>
              
              {/* --- BOX STAFF --- */}
              <div className="mb-2 flex flex-col items-center justify-center min-h-[60px] bg-black/40 border border-neutral-800 rounded-xl px-2 py-1.5 shrink-0">
                 {team.coach ? (
                   <div className="text-[18px] leading-none font-bold text-neutral-400 uppercase tracking-widest text-center truncate w-full">
                     Coach: <span className="text-white">{team.coach}</span>
                   </div>
                 ) : (
                   <div className="text-[18px] leading-none font-bold text-neutral-600 uppercase tracking-widest text-center">Nessun Coach</div>
                 )}
                 {team.assistant_coach && (
                   <div className="text-[18px] leading-none font-bold text-neutral-400 uppercase tracking-widest text-center truncate w-full mt-0.5">
                     Vice: <span className="text-white">{team.assistant_coach}</span>
                   </div>
                 )}
              </div>

              {/* --- LISTA GIOCATORI --- */}
              <div className="flex flex-col gap-1 [perspective:1000px] flex-1 min-h-0">
                {Array.from({ length: 10 }).map((_, i) => {
                  const pick = teamPicks[i];
                  const isFilled = pick && pick.player_id;
                  const isLatest = isFilled && pick.id === latestPickId;

                  // ==========================================
                  // LOGICA TAGLIO NOME INTELLIGENTE
                  // ==========================================
                  let displayLast = '';
                  let displayFirst = '';
                  
                  if (isFilled) {
                    displayLast = pick.players?.last_name || '';
                    const rawFirst = pick.players?.first_name || '';
                    
                    // Se la somma dei caratteri supera 13, taglia al primo carattere + "."
                    // Puoi aumentare o diminuire il 13 a tuo piacimento!
                    if ((displayLast.length + rawFirst.length) > 20) {
                      displayFirst = rawFirst.charAt(0) + '.';
                    } else {
                      displayFirst = rawFirst;
                    }
                  }

                  return (
                    <motion.div 
                      key={i} 
                      animate={isLatest ? {
                        scale: [1.3, 1, 1.05, 1],
                        rotateX: [30, 0],
                        opacity: [0, 1],
                        boxShadow: [
                          '0 0 60px 20px rgba(235,109,165,1)',
                          '0 0 20px 5px rgba(235,109,165,0.6)',
                          '0 0 35px 10px rgba(235,109,165,0.8)',
                          '0 0 10px 0px rgba(235,109,165,0.2)'
                        ],
                        backgroundColor: ['rgba(235,109,165,0.7)', 'rgba(0,0,0,0.5)']
                      } : {}}
                      transition={isLatest ? { 
                        duration: 1.2, 
                        ease: [0.34, 1.56, 0.64, 1], 
                        times: [0, 0.3, 0.6, 1],
                        delay: 0.1 
                      } : {}}
                      className={`flex items-center gap-3 px-3 py-[10.5px] rounded-xl border relative ${isFilled && !isLatest ? 'bg-neutral-900 border-neutral-700' : !isFilled ? 'bg-black border-neutral-800' : 'border-pink-500'}`}
                      style={isLatest ? { transformOrigin: 'top center' } : {}}
                    >
                      <div className="w-6 shrink-0 text-left">
                        <span className="text-[18px] font-black text-neutral-500">#{pick ? pick.pick_number : '-'}</span>
                      </div>

                      <div className="flex flex-col justify-center min-w-0 flex-1">
                        {isFilled ? (
                          // Uso le mie variabili intelligenti "displayLast" e "displayFirst"
                          <span className="font-bold text-white uppercase text-[24px] truncate block leading-tight">
                            {displayLast} <span className="font-normal text-[18px] text-pink-500 ml-1">{displayFirst}</span>
                          </span>
                        ) : (
                          // IL TRATTINO ORA HA LE STESSE DIMENSIONI DEL NOME GIOCATORE (text-[24px] e leading-tight)
                          <span className="font-bold text-neutral-600 uppercase text-[24px] block leading-tight">-</span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

            </div>
          );
        })}
      </div>

      {/* --- BANNER INFERIORE (ON THE CLOCK E NEXT PICK) --- */}
      <div className="shrink-0 w-full px-6 pb-6 z-10 h-[140px] mb-4 mt-2">
        <div className="w-full h-full bg-black/60 backdrop-blur-2xl border border-neutral-800 rounded-3xl shadow-2xl flex overflow-hidden">
          
          {/* LATO SINISTRO: ON THE CLOCK */}
          {onTheClock ? (
            <div className="w-1/3 bg-pink-500/10 flex flex-col justify-center items-center relative shadow-[5px_0_30px_rgba(236,72,153,0.1)]">
              <div className="absolute top-0 w-full bg-pink-500 text-white text-[15px] font-black uppercase tracking-[0.08em] py-1 text-center animate-pulse">
                On The Clock
              </div>
              <div className="flex items-center gap-5 mt-8">
                <span className="text-[50px] font-black text-pink-500 drop-shadow-md">#{onTheClock.pick_number}</span>
                <div className="flex flex-col">
                  <h2 className="text-[50px] tracking-wider font-black uppercase text-white leading-none drop-shadow-md max-w-[260px] truncate">
                    {onTheClock.teams_edition_events?.teams?.name}
                  </h2>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-1/3 border-r-2 border-neutral-800 flex items-center justify-center">
               <span className="text-xl font-bold uppercase text-neutral-500 tracking-wider">Round Concluso</span>
            </div>
          )}

          {/* LATO DESTRO: NEXT PICK */}
          <div className="w-2/3 flex flex-col justify-center px-6 relative">
            
            {/* STRISCIA SUPERIORE NEXT PICK (Grigio chiaro) */}
            <div className="absolute top-0 left-0 w-full bg-neutral-900 border-b border-neutral-800 text-neutral-400 text-[15px] font-black uppercase tracking-[0.08em] py-1 pl-[42px] text-left">
              Next Pick
            </div>
            
            <div className="flex items-center justify-between w-full mt-8 gap-3">
              {upNext.length > 0 ? (
                upNext.map((p, index) => (
                  <div key={p.id} className="flex-1 flex items-center gap-2 bg-black-900 border border-neutral-700 rounded-xl px-4 py-3 min-w-0 shadow-inner">
                    <span className="text-[24px] font-black text-neutral-500">#{p.pick_number}</span>
                    <span className="text-[24px] tracking-wide font-bold text-white uppercase truncate">
                      {p.teams_edition_events?.teams?.name}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex-1 flex justify-center text-neutral-600 font-bold uppercase tracking-widest">
                  Nessuna pick successiva
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>

    </motion.div>
  );
}

function DraftAnnuncioGraphic({ picks }) {
  const latestPick = [...picks].filter(p => p.player_id).sort((a,b) => b.pick_number - a.pick_number)[0];

  const firstName = latestPick?.players?.first_name || "";
  const lastName = latestPick?.players?.last_name || "";
  const pickNum = latestPick?.pick_number;

  // 1. Uniamo il nome in un'unica stringa per l'effetto Typewriter
  const fullName = `${firstName} ${lastName}`.trim();
  // 2. Lo dividiamo in un array di singole lettere
  const letters = fullName.split("");

  // =========================================
  // REGOLE ANIMAZIONE MACCHINA DA SCRIVERE
  // =========================================
  const containerVars = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08, // Velocità di battitura (0.08s tra una lettera e l'altra)
        delayChildren: 0.8,    // Aspetta quasi un secondo prima di iniziare a scrivere
      }
    }
  };

  const letterVars = {
    hidden: { opacity: 0, scale: 0.8, filter: "blur(4px)" }, // Parte sfocato e invisibile
    visible: { 
      opacity: 1, 
      scale: 1, 
      filter: "blur(0px)",
      transition: { type: "spring", stiffness: 200, damping: 15 } 
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      exit={{ opacity: 0, scale: 0.95 }} 
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="absolute inset-0 w-[1920px] h-[1080px] flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-black overflow-hidden z-0 origin-center"
    >
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 mix-blend-screen pointer-events-none"></div>
      
      
      {latestPick ? (
        <div className="flex flex-col items-center justify-center text-center z-10 w-full h-full relative -translate-y-[40px]">
          
          {/* BADGE PICK */}
          <motion.div 
            initial={{ y: 30, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }} 
            className="mb-8"
          >
            <motion.div 
              animate={{ scale: [1, 1.02, 1] }} 
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="flex flex-col items-center justify-center"
            >
              <span className="inline-block bg-pink-600/20 border border-pink-500/50 text-pink-400 px-10 py-3 rounded-full text-4xl font-black uppercase tracking-[0.08em] shadow-[0_0_30px_rgba(235,109,165,0.4)]">
                Pick #{pickNum}
              </span>
            </motion.div>
          </motion.div>

          <div className="relative">
            {/* EFFETTO MACCHINA DA SCRIVERE SUL NOME GIOCATORE */}
            <motion.h1 
              variants={containerVars}
              initial="hidden"
              animate="visible"
              className="text-[170px] leading-none font-black text-white uppercase tracking-[0.08em] drop-shadow-2xl text-balance px-10 relative z-10 whitespace-pre-wrap"
            >
              {letters.map((char, index) => (
                <motion.span key={index} variants={letterVars} className="inline-block">
                  {/* Se è uno spazio vuoto, mettiamo il codice dello spazio per non far collassare l'HTML */}
                  {char === " " ? "\u00A0" : char}
                </motion.span>
              ))}
            </motion.h1>

            {/* TIMBRO "SCELTO" RITARDATO PER FAR FINIRE LA BATTITURA */}
            <motion.div
              initial={{ scale: 4, opacity: 0, rotate: -30 }}
              animate={{ scale: 1, opacity: 0.9, rotate: -15 }}
              transition={{ 
                type: "spring", 
                stiffness: 1000, 
                damping: 30, 
                delay: 2.8, // Ritardato per aspettare il Typewriter
                opacity: { duration: 0.1, delay: 2.8 } 
              }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
            >
              <div 
                className="font-sans border-[16px] border-pink-500 text-pink-500 px-10 py-3 rounded-[30px] font-black uppercase tracking-[0.08em] text-[110px] leading-none drop-shadow-[0_0_20px_rgba(236,72,153,0.7)]"
                style={{ 
                  textTransform: 'uppercase',
                  maskImage: 'radial-gradient(#000 60%, transparent 100%)',
                  WebkitMaskImage: 'radial-gradient(#000 60%, transparent 100%)',
                }}
              >
                Scelto
              </div>
            </motion.div>
          </div>

        </div>
      ) : (
        <div className="flex flex-col items-center justify-center w-full h-full z-10">
          <div className="text-white text-4xl font-black uppercase tracking-widest opacity-50">
            In Attesa della Prima Scelta...
          </div>
        </div>
      )}
    </motion.div>
  );
}

function DraftAttesaGraphic({ activePayload }) {
  const [lockedPayload, setLockedPayload] = useState(activePayload);
  
  // STATO DEL CRONOMETRO (Parte da 60)
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    if (activePayload && activePayload.team_name) {
      setLockedPayload(activePayload);
      // Quando arriva una nuova squadra al draft, resetto il timer a 60!
      setTimeLeft(60);
    }
  }, [activePayload]);

  // MOTORE DEL CRONOMETRO
  useEffect(() => {
    if (timeLeft <= 0) return; // Si ferma a 0
    
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    
    // Pulizia del timer per evitare accavallamenti
    return () => clearInterval(timer);
  }, [timeLeft]);

  const pickNum = lockedPayload?.pick_number || "-";
  const teamName = lockedPayload?.team_name || "SQUADRA AL DRAFT";
  const coach = lockedPayload?.coach;
  const vice = lockedPayload?.vice;

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      transition={{ duration: 0.5 }}
      className="absolute inset-0 w-[1920px] h-[1080px] flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-black overflow-hidden z-0"
    >
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 mix-blend-screen"></div>

      {/* CONTENITORE PRINCIPALE CENTRATO ASSOLUTO */}
      {/* === MODIFICA: CENTRATURA GLOBALE === */}
      {/* Usa "-mt-[30px]" (o cambialo a tuo piacimento, es: "-mt-[60px]" o "mt-[20px]") per alzare o abbassare tutto il blocco in una volta sola */}
      <div className="flex flex-col items-center justify-center text-center z-10 w-full h-full pt-[90px]">
        
        {/* BADGE PICK RIDIMENSIONATO E PULITO */}
        <motion.div 
          animate={{ scale: [1, 1.02, 1] }} 
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="mb-8"
        >
          <div className="flex flex-col items-center justify-center">
            <span className="inline-block bg-pink-600/20 border border-pink-500/50 text-pink-400 px-10 py-3 rounded-full text-4xl font-black uppercase tracking-[0.08em] shadow-[0_0_30px_rgba(235,109,165,0.4)]">
              Pick #{pickNum}
            </span>
          </div>
        </motion.div>

        {/* NOME SQUADRA (Libertà totale per voi) */}
        <h2 className="text-[170px] leading-none font-black text-white uppercase tracking-[0.08em] drop-shadow-2xl mb-10 text-balance px-10">
          {teamName}
        </h2>
        
        {/* ALLENATORI: DESIGN ELEGANTE TESTUALE (Senza Box) */}
        {(coach || vice) && (
          <div className="flex flex-col items-center justify-center gap-3 mb-12">
            {coach && (
              <div className="text-4xl font-bold uppercase tracking-[0.08em] text-white drop-shadow-lg flex items-center">
                <span className="text-neutral-500 text-2xl tracking-[0.08em] mr-4">COACH</span> 
                {coach}
              </div>
            )}
            {vice && (
              <div className="text-3xl font-bold uppercase tracking-[0.08em] text-white drop-shadow-lg flex items-center">
                <span className="text-neutral-500 text-xl tracking-[0.08em] mr-4">VICE</span> 
                {vice}
              </div>
            )}
          </div>
        )}

        {/* CRONOMETRO */}
        {/* === MODIFICA: ALZARE SOLO IL CRONOMETRO === */}
        {/* Ho inserito "-mt-4" (margin-top negativo) per tirarlo più su avvicinandolo agli allenatori. Puoi usare "-mt-8" o "-mt-[40px]" per alzarlo ancora di più! */}
        <div className="flex flex-col items-center -mt-2">
          <div 
            className={`text-[160px] font-black leading-none uppercase tracking-widest ${
              timeLeft <= 10 
                ? 'text-red-500 drop-shadow-[0_0_50px_rgba(239,68,68,0.8)] animate-pulse' 
                : 'text-pink-500 drop-shadow-[0_0_40px_rgba(236,72,153,0.6)]'
            }`}
          >
            00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
          </div>
        </div>

      </div>
    </motion.div>
  );
}

// ==========================================
// GRAFICA DI ATTESA SORTEGGIO ROUND
// ==========================================
function DraftRoundAttesaGraphic({ payload }) {
  const round = payload?.round || "-";

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      transition={{ duration: 0.5 }}
      className="absolute inset-0 w-[1920px] h-[1080px] flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-black overflow-hidden z-0"
    >
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 mix-blend-screen"></div>

      <div className="flex flex-col items-center justify-center text-center z-10 w-full h-full">
        
        <motion.div 
          animate={{ scale: [1, 1.03, 1] }} 
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          className="mb-8 flex flex-col items-center"
        >
          {/* Cerchio di caricamento figo rotante */}
          <div className="w-20 h-20 border-8 border-neutral-800 border-t-pink-500 rounded-full animate-spin mb-16 shadow-[0_0_20px_rgba(236,72,153,0.3)]"></div>
          
          <span className="inline-block bg-pink-600/20 border border-pink-500/50 text-pink-400 px-12 py-5 rounded-full text-8xl font-black uppercase tracking-[0.08em] shadow-[0_0_40px_rgba(235,109,165,0.4)]">
            Sorteggio Round {round}
          </span>
        </motion.div>

        <div className="mt-8 text-3xl font-black text-neutral-600 uppercase tracking-[0.08em] animate-pulse">
          Elaborazione Dati in Corso...
        </div>

      </div>
    </motion.div>
  );
}

// ==========================================
// GRAFICA DRAFT POOL STATUS 
// ==========================================
function DraftPoolGraphic({ players, picks }) {
  // Raggruppa i giocatori in base al ruolo
  const groupedPlayers = players.reduce((acc, p) => {
    const r = p.role ? p.role.toUpperCase() : 'ALTRO';
    if (!acc[r]) acc[r] = [];
    acc[r].push(p);
    return acc;
  }, {});

  // Ordine fisso dei ruoli nel basket
  const roleOrder = ['PLAYMAKER', 'GUARDIA', 'ALA PICCOLA', 'ALA GRANDE', 'CENTRO'];
  
  // Assicuriamoci che i 5 ruoli principali siano sempre mostrati, per mantenere le 5 colonne intatte
  const roles = roleOrder;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 w-[1920px] h-[1080px] flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-950 to-black z-0 origin-top-left">
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>

      {/* TITOLO SPOSTATO IN ALTO A DESTRA */}
      <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right">
        <span className="text-pink-500 font-bold uppercase tracking-[0.08em] text-sm mb-1 drop-shadow-md">Basketville 2026</span>
        <h2 className="text-4xl font-black uppercase text-white drop-shadow-lg tracking-wider">
          Draft Pool
        </h2>
      </div>

      <div className="flex-1 flex gap-6 w-full max-w-[1850px] mx-auto z-10 overflow-hidden px-6 pb-5 pt-[180px] justify-center">
        {roles.map((role) => {
          const playersInRole = groupedPlayers[role] || [];
          
          return (
            <div key={role} className="flex-1 bg-white/5 backdrop-blur-xl border border-neutral-800 rounded-3xl px-5 pt-4 pb-4 shadow-2xl flex flex-col min-w-0">
              
              {/* TITOLO RUOLO CON FONT INGRANDITO E PADDING AGGIUSTATI */}
              <h3 className="text-center text-[28px] font-black uppercase text-white tracking-widest mb-3 border-b border-neutral-700 pb-2.5 shrink-0 truncate drop-shadow-md">
                {role}
              </h3>
              
              {/* LISTA GIOCATORI: FISSATA A 12 ELEMENTI */}
              <div className="flex flex-col gap-1.5 flex-1 min-h-0">
                {Array.from({ length: 14 }).map((_, i) => {
                  const p = playersInRole[i];
                  const isFilled = !!p;
                  const isPicked = isFilled ? picks.some(pick => pick.player_id === p.id) : false;

                  // LOGICA TAGLIO NOME INTELLIGENTE
                  let displayLast = '';
                  let displayFirst = '';
                  
                  if (isFilled) {
                    displayLast = p.last_name || '';
                    const rawFirst = p.first_name || '';
                    
                    if ((displayLast.length + rawFirst.length) > 25) {
                      displayFirst = rawFirst.charAt(0) + '.';
                    } else {
                      displayFirst = rawFirst;
                    }
                  }

                  return (
                    <div 
                      key={isFilled ? p.id : `empty-${i}`} 
                      className={`flex items-center justify-between px-3 py-[9px] rounded-xl border ${!isFilled ? 'bg-neutral-900 border-neutral-700' : isPicked ? 'bg-neutral-900 border-neutral-700 opacity-30' : 'bg-neutral-900 border-neutral-700'}`}
                    >
                      <div className="flex-1 min-w-0">
                        {isFilled ? (
                          // === MODIFICA: TOLTO "line-through" DA QUI SOTTO ===
                          <span className={`font-bold uppercase text-[24px] block leading-tight truncate ${isPicked ? 'text-white' : 'text-white'}`}>
                            {displayLast} <span className={`font-normal text-[18px] ml-1 ${isPicked ? 'text-pink-500' : 'text-pink-500'}`}>{displayFirst}</span>
                          </span>
                        ) : (
                          <span className="font-bold text-neutral-600 uppercase text-[24px] block leading-tight">-</span>
                        )}
                      </div>
                      
                      {isPicked && (
                        <span className="shrink-0 text-[11px] bg-pink-500 text-white font-black px-2 py-1 rounded tracking-widest uppercase ml-2">
                          Scelto
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ==========================================
// COMPONENTE: TITOLO GENERICO (JOLLY) -> VERSIONE MAXI
// ==========================================
function GenericTitleGraphic({ payload }) {
  const text = payload?.text || '';

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      exit={{ opacity: 0, scale: 1.05 }} 
      transition={{ type: "spring", stiffness: 100, damping: 20 }} 
      className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-black overflow-hidden"
    >
      {/* Sfondo Texture Carbonio */}
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>
      
      {/* Bagliore Rosa Morbido al centro */}
      <div className="absolute w-[1000px] h-[1000px] bg-pink-500/10 blur-[180px] rounded-full pointer-events-none mix-blend-screen"></div>

      {/* Contenitore: rimosso pt-[40px] per un centro assoluto e perfetto */}
      <div className="flex flex-col items-center text-center w-full max-w-[1800px] px-12 z-10">

        {/* === MODIFICA KERNING (SPAZIATURA LETTERE) === */}
        {/* Sostituisci "tracking-widest" con "tracking-[0.1em]" o un'altra misura per avere il pieno controllo */}
        <h1 
          className="text-[240px] leading-none font-black uppercase tracking-wider text-white drop-shadow-[0_20px_50px_rgba(0,0,0,1)]"
          style={{ textWrap: 'balance' }} 
        >
          {text}
        </h1>

      </div>
    </motion.div>
  );
}

// ==========================================
// GRAFICA RECAP GIRONE & CLASSIFICA (LAYOUT SPLIT & 3 SLOT FISSI E BLINDATI)
// ==========================================
function RecapGironeGraphic({ matches, teamsEditionEvents, calendar }) {
  
  // 1. FILTRI DI FERRO SUI TEAM
  const validTeams = teamsEditionEvents.filter(tee => 
    tee.event_id === 1 && 
    tee.group_name && 
    tee.group_name.trim() !== ''
  );

  // 2. Raggruppiamo i team validi per girone
  const groups = validTeams.reduce((acc, tee) => {
    if (!acc[tee.group_name]) acc[tee.group_name] = [];
    acc[tee.group_name].push(tee);
    return acc;
  }, {});

  const validTeamIds = validTeams.map(t => t.id);

  // 3. FILTRO DI FERRO SUI MATCH
  const groupMatches = matches.filter(m => 
    m.match_type_id === 1 && 
    (validTeamIds.includes(m.team_a_id) || validTeamIds.includes(m.team_b_id))
  );

  // Helper PRO per data e orario (Es: "15 GIU • 20:30")
  const getMatchScheduleString = (matchId) => {
    const cal = calendar.find(c => c.match_id === matchId);
    if (!cal) return "DATA TBD";
    
    const time = cal.time ? cal.time.substring(0, 5) : "TBD";
    if (!cal.date) return time;

    const dateObj = new Date(cal.date);
    const dateStr = dateObj.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }).toUpperCase();
    return `${dateStr} • ${time}`;
  };

  // 4. Funzione per calcolare la classifica di un girone
  const calculateStandings = (teamsInGroup) => {
    let standings = teamsInGroup.map(tee => {
      return { 
        ...tee, 
        pt: 0, w: 0, l: 0, pf: 0, ps: 0, 
        teamName: tee.teams?.name || "Squadra Sconosciuta" 
      };
    });

    groupMatches.forEach(m => {
      if (m.status !== 'conclusa') return; 
      
      const teamA = standings.find(t => t.id === m.team_a_id);
      const teamB = standings.find(t => t.id === m.team_b_id);

      if (teamA && teamB) {
        teamA.pf += m.score_a;
        teamA.ps += m.score_b;
        teamB.pf += m.score_b;
        teamB.ps += m.score_a;

        if (m.score_a > m.score_b) {
          teamA.w += 1; teamA.pt += 2;
          teamB.l += 1;
        } else if (m.score_b > m.score_a) {
          teamB.w += 1; teamB.pt += 2;
          teamA.l += 1;
        }
      }
    });

    standings.sort((a, b) => {
      if (b.pt !== a.pt) return b.pt - a.pt;

      const tiedTeams = standings.filter(t => t.pt === a.pt);
      
      if (tiedTeams.length === 2) {
        const headToHead = groupMatches.find(m => 
          m.status === 'conclusa' &&
          ((m.team_a_id === a.id && m.team_b_id === b.id) || (m.team_a_id === b.id && m.team_b_id === a.id))
        );
        if (headToHead) {
          if (headToHead.team_a_id === a.id) return headToHead.score_b - headToHead.score_a;
          return headToHead.score_a - headToHead.score_b;
        }
      } else if (tiedTeams.length > 2) {
        let aDiffAvulsa = 0;
        let bDiffAvulsa = 0;
        
        groupMatches.forEach(m => {
          if (m.status === 'conclusa' && tiedTeams.find(t => t.id === m.team_a_id) && tiedTeams.find(t => t.id === m.team_b_id)) {
            if (m.team_a_id === a.id) aDiffAvulsa += (m.score_a - m.score_b);
            if (m.team_b_id === a.id) aDiffAvulsa += (m.score_b - m.score_a);
            
            if (m.team_a_id === b.id) bDiffAvulsa += (m.score_a - m.score_b);
            if (m.team_b_id === b.id) bDiffAvulsa += (m.score_b - m.score_a);
          }
        });
        return bDiffAvulsa - aDiffAvulsa;
      }
      return (b.pf - b.ps) - (a.pf - a.ps); 
    });

    return standings;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 w-[1920px] h-[1080px] flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-950 to-black z-0">
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>

      {/* TITOLO GLOBALE IN ALTO A DESTRA */}
      <div className="absolute top-16 right-16 z-50 flex flex-col items-end text-right">
        <span className="text-pink-500 font-bold uppercase tracking-[0.4em] text-sm mb-1 drop-shadow-md">VERO Cup 2026</span>
        <h2 className="text-4xl font-black uppercase text-white tracking-widest drop-shadow-lg">Classifica Gironi</h2>
      </div>

      {/* CONTENITORE SPLIT 2 COLONNE - pt aumentato per centrare in verticale */}
      <div className="flex justify-center items-start gap-16 w-full max-w-[1800px] mx-auto h-full pt-[220px] px-8 z-10">
        
        {Object.keys(groups).sort().map(groupName => {
          const teamsInThisGroup = groups[groupName];
          const standings = calculateStandings(teamsInThisGroup);
          
          const matchesInThisGroup = groupMatches.filter(m => {
            return teamsInThisGroup.some(t => t.id === m.team_a_id);
          });
          
          return (
            <div key={groupName} className="flex-1 flex flex-col gap-5 max-w-[800px]">
              
              {/* TITOLO GIRONE */}
              <h3 className="text-5xl font-black uppercase text-pink-500 tracking-widest text-center drop-shadow-lg mb-1">
                Girone {groupName}
              </h3>

              {/* LISTA MATCH CON 3 SLOT FISSI E BLINDATI NELL'ALTEZZA */}
              <div className="flex flex-col gap-3 h-full">
                {Array.from({ length: 3 }).map((_, index) => {
                  const m = matchesInThisGroup[index];

                  // BLOCCO PARTITA ESISTENTE: ALTEZZA BLOCCATA A h-[90px]
                  if (m) {
                    const tA = teamsInThisGroup.find(t => t.id === m.team_a_id)?.teams?.name || "TBD";
                    const tB = teamsInThisGroup.find(t => t.id === m.team_b_id)?.teams?.name || "TBD";
                    const isLive = m.status === 'live';
                    const isConclusa = m.status === 'conclusa';

                    const aWon = isConclusa && m.score_a > m.score_b;
                    const bWon = isConclusa && m.score_b > m.score_a;

                    return (
                      <div key={m.id} className={`relative flex items-center justify-between rounded-2xl px-6 h-[90px] shadow-lg overflow-hidden border ${isLive ? 'bg-red-950/40 border-red-500/50' : 'bg-black/50 border-neutral-800'}`}>
                        {isLive && (
                          <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-transparent to-red-500/10 animate-pulse pointer-events-none"></div>
                        )}

                        {/* NOME CASA: ALTEZZA FISSA h-full */}
                        <div className={`flex-1 text-right z-10 h-full flex items-center justify-end px-4 transition-opacity ${isConclusa && !aWon ? 'opacity-40' : 'opacity-100'}`}>
                          <span className="text-[24px] font-black text-white uppercase tracking-wider truncate drop-shadow-sm">{tA}</span>
                        </div>
                        
                        {/* CENTRO: ALTEZZA FISSA h-full */}
                        <div className="w-44 shrink-0 flex flex-col items-center justify-center h-full z-10 mx-4">
                          
                          {/* Etichetta Stato: h-4 FISSO */}
                          <div className="h-4 flex items-center justify-center mb-1">
                            {isLive && (
                              <span className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1.5 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>LIVE
                              </span>
                            )}
                            {isConclusa && <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">FINALE</span>}
                            {!isLive && !isConclusa && <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">IN PROGRAMMA</span>}
                          </div>
                          
                          {/* Punteggio/Orario: h-10 FISSO */}
                          <div className="h-10 flex items-center justify-center w-full">
                            {isConclusa || isLive ? (
                              <div className="px-4 py-1 rounded-xl font-black text-3xl tabular-nums text-white">
                                {m.score_a ?? 0} <span className="text-pink-500 mx-1">-</span> {m.score_b ?? 0}
                              </div>
                            ) : (
                              <div className="px-4 py-1.5 rounded-xl font-bold text-[14px] bg-white/10 text-neutral-300 border border-white/10 tracking-widest tabular-nums whitespace-nowrap shadow-inner">
                                {getMatchScheduleString(m.id)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* NOME TRASFERTA: ALTEZZA FISSA h-full */}
                        <div className={`flex-1 text-left z-10 h-full flex items-center justify-start px-4 transition-opacity ${isConclusa && !bWon ? 'opacity-40' : 'opacity-100'}`}>
                          <span className="text-[24px] font-black text-white uppercase tracking-wider truncate drop-shadow-sm">{tB}</span>
                        </div>
                      </div>
                    );
                  }

                  // BLOCCO PLACEHOLDER: ALTEZZA FISSA h-[90px]
                  return (
                    <div key={`empty-${index}`} className="flex items-center justify-center bg-white/5 border border-dashed border-neutral-700/50 rounded-2xl px-6 h-[90px] shadow-inner opacity-50">
                      <span className="text-neutral-500 font-bold uppercase tracking-widest text-[13px]">
                        Slot Partita {index + 1} da definire
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* TABELLA CLASSIFICA */}
              <div className="bg-neutral-900/90 border border-neutral-800 rounded-3xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col mt-2">
                <div className="flex text-neutral-400 font-bold uppercase text-[15px] tracking-widest px-4 pb-3 border-b border-neutral-800 mb-3">
                  <div className="flex-1">Squadra</div>
                  <div className="w-16 text-center">W</div>
                  <div className="w-16 text-center">L</div>
                  <div className="w-20 text-center">PF</div>
                  <div className="w-20 text-center">PS</div>
                  <div className="w-24 text-center text-pink-500">PT</div>
                </div>

                <div className="flex flex-col gap-2.5">
                  {standings.map((team, index) => (
                    <div key={team.id} className="flex items-center bg-black/50 border border-neutral-800 rounded-xl px-4 py-3.5 hover:bg-neutral-800/50 transition-colors">
                      <div className="w-8 text-xl font-black text-neutral-600">{index + 1}</div>
                      <div className="flex-1 text-2xl font-bold text-white uppercase truncate">{team.teamName}</div>
                      <div className="w-16 text-center text-xl font-bold text-neutral-300">{team.w}</div>
                      <div className="w-16 text-center text-xl font-bold text-neutral-300">{team.l}</div>
                      <div className="w-20 text-center text-xl font-bold text-neutral-400">{team.pf}</div>
                      <div className="w-20 text-center text-xl font-bold text-neutral-400">{team.ps}</div>
                      <div className="w-24 text-center text-4xl font-black text-pink-500 drop-shadow-[0_0_10px_rgba(236,72,153,0.3)]">{team.pt}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          );
        })}

      </div>
    </motion.div>
  );
}

// ==========================================
// GRAFICA QUADRO PLAYOFF (LAYOUT SIMMETRICO E BOX INGRANDITI)
// ==========================================
function QuadroPlayoffGraphic({ matches, teamsEditionEvents, calendar }) {
  
  const getTeamName = (id) => teamsEditionEvents.find(t => t.id === id)?.teams?.name || "TBD";
  
  // Data in formato elegante
  const getMatchDate = (matchId) => {
    const cal = calendar.find(c => c.match_id === matchId);
    if (!cal) return "DATA TBD";
    
    const time = cal.time ? cal.time.substring(0, 5) : "";
    if (!cal.date) return time;

    const dateObj = new Date(cal.date);
    const dateStr = dateObj.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }).toUpperCase();
    return `${dateStr} • ${time}`;
  };

  // 2 = Semifinali, 3 = Finale
  const semiFinals = matches.filter(m => m.match_type_id === 2);
  const finale = matches.find(m => m.match_type_id === 3);

  // Box Partita con dimensioni native (niente scale CSS per garantire centratura perfetta)
  const MatchBox = ({ match, title, isFinal = false }) => {
    const scoreA = match?.score_a ?? "-";
    const scoreB = match?.score_b ?? "-";
    const teamA = match ? getTeamName(match.team_a_id) : "TBD";
    const teamB = match ? getTeamName(match.team_b_id) : "TBD";
    
    const isConclusa = match?.status === 'conclusa';
    const statusText = isConclusa ? 'FINALE' : (match ? getMatchDate(match.id) : "IN PROGRAMMA");

    // Dimensioni dinamiche base vs finale
    const boxWidth = isFinal ? 'w-[600px]' : 'w-[500px]';
    const boxHeight = isFinal ? 'h-[280px]' : 'h-[240px]';
    const titleSize = isFinal ? 'text-[18px] py-3' : 'text-[16px] py-2.5';
    const teamTextSize = isFinal ? 'text-2xl' : 'text-xl';
    const scoreSize = isFinal ? 'text-4xl' : 'text-3xl';

    return (
      <div className={`${boxWidth} ${boxHeight} bg-neutral-900/95 border rounded-2xl shadow-2xl flex flex-col relative z-10 ${isFinal ? 'border-pink-500/50 shadow-[0_0_40px_rgba(236,72,153,0.2)]' : 'border-neutral-800'}`}>
        
        {/* HEADER */}
        <div className={`${isFinal ? 'bg-pink-600' : 'bg-neutral-800'} text-white text-center font-black uppercase tracking-[0.2em] ${titleSize} rounded-t-2xl shrink-0`}>
          {title}
        </div>
        
        {/* CORPO (Squadre e Punteggi) */}
        <div className={`p-5 flex flex-col gap-3 flex-1 justify-center ${isFinal ? '-mt-4' : '-mt-2'}`}>
          {/* Team A */}
          <div className={`flex justify-between items-center bg-black/50 px-5 py-4 rounded-xl border border-neutral-800/60 shadow-inner`}>
            <span className={`font-bold text-white uppercase truncate mr-4 ${teamTextSize}`}>{teamA}</span>
            <span className={`font-black text-neutral-300 shrink-0 ${scoreSize}`}>{scoreA}</span>
          </div>
          
          {/* Team B */}
          <div className={`flex justify-between items-center bg-black/50 px-5 py-4 rounded-xl border border-neutral-800/60 shadow-inner`}>
            <span className={`font-bold text-white uppercase truncate mr-4 ${teamTextSize}`}>{teamB}</span>
            <span className={`font-black text-neutral-300 shrink-0 ${scoreSize}`}>{scoreB}</span>
          </div>
        </div>

        {/* STATO PARTITA (Fisso in basso) */}
        {!isConclusa && (
          <div className={`absolute ${isFinal ? 'bottom-4' : 'bottom-3'} left-0 w-full text-center text-neutral-500 font-bold uppercase text-[12px] tracking-widest`}>
            {statusText}
          </div>
        )}
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 w-[1920px] h-[1080px] flex flex-col bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-950 to-black z-0">
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>
      
      {/* TITOLO GLOBALE UNIFORMATO */}
      <div className="absolute top-16 right-16 z-50 flex flex-col items-end text-right">
        <span className="text-pink-500 font-bold uppercase tracking-[0.4em] text-sm mb-1 drop-shadow-md">VERO Cup 2026</span>
        <h2 className="text-4xl font-black uppercase text-white tracking-widest drop-shadow-lg">Playoff Bracket</h2>
      </div>

      {/* CONTENITORE TABELLONE: Centratura assoluta tramite flexbox nativo */}
      <div className="flex items-center justify-center w-full h-full pt-[100px] z-10 relative">
        
        {/* 1. COLONNA SEMIFINALI (Box alti 240px, gap 100px = distanza centri 340px) */}
        <div className="flex flex-col gap-[100px] relative z-10">
          <MatchBox match={semiFinals[0]} title="Semifinale 1" />
          <MatchBox match={semiFinals[1]} title="Semifinale 2" />
        </div>

        {/* 2. LINEE DI CONGIUNZIONE (BRACKET) */}
        <div className="flex items-center relative z-0 -ml-2 -mr-2">
           {/* La "C" che unisce le semifinali (Altezza matematicamente perfetta di 340px) */}
           <div className="w-20 h-[340px] border-t-[4px] border-b-[4px] border-r-[4px] border-neutral-700/80 rounded-r-3xl"></div>
           {/* La linea dritta illuminata che entra nella finale */}
           <div className="w-24 h-[4px] bg-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.8)]"></div>
        </div>

        {/* 3. COLONNA FINALE */}
        <div className="relative z-10">
          <MatchBox match={finale} title="FINALE VERO CUP" isFinal={true} />
        </div>
        
      </div>
    </motion.div>
  );
}
// ==========================================
// GRAFICA CLASSIFICA MARCATORI (TOP 10)
// ==========================================
function TopScorersGraphic({ data }) {
  const top1 = data && data.length > 0 ? data[0] : null;
  const others = data ? data.slice(1, 10) : [];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      exit={{ opacity: 0, scale: 1.05 }} 
      transition={{ duration: 0.4 }} 
      className="absolute inset-0 w-[1920px] h-[1080px] flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-950 to-black z-0 overflow-hidden"
    >
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>

      {/* TITOLO GLOBALE IN ALTO A DESTRA */}
      <div className="absolute top-16 right-16 z-50 flex flex-col items-end text-right">
        <span className="text-pink-500 font-bold uppercase tracking-[0.4em] text-sm mb-1 drop-shadow-md">VERO Cup 2026</span>
        <h2 className="text-4xl font-black uppercase text-white tracking-widest drop-shadow-lg">Top 10 Marcatori</h2>
      </div>

      <div className="flex w-full h-full max-w-[1800px] mx-auto pt-[200px] pb-16 gap-16 z-10 px-8">
        
        {/* COLONNA SINISTRA: IL RE ASSOLUTO (#1) */}
        <div className="w-[600px] h-full shrink-0 flex flex-col">
          {top1 ? (
            <div className="w-full h-full bg-gradient-to-br from-yellow-500/10 via-black/80 to-yellow-900/40 border-[3px] border-yellow-500/80 rounded-[3rem] shadow-[0_0_80px_rgba(234,179,8,0.2)] flex flex-col items-center justify-center relative p-10">
              
              <motion.div 
                animate={{ y: [-10, 5, -10] }} 
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-16 text-[130px] drop-shadow-[0_0_30px_rgba(234,179,8,0.8)]"
              >
                👑
              </motion.div>
              
              <div className="text-yellow-500 font-black tracking-[0.4em] uppercase mb-8 mt-12 text-xl drop-shadow-md">
                Capocannoniere
              </div>
              
              <div className="flex flex-col items-center text-center w-full mb-10">
                <span className="text-7xl font-black text-white uppercase tracking-wider leading-none drop-shadow-lg truncate w-full px-4">
                  {top1.last_name}
                </span>
                <span className="text-4xl font-bold text-yellow-400 uppercase tracking-widest mt-4">
                  {top1.first_name}
                </span>
              </div>
              
              <div className="bg-black/60 w-full rounded-[2.5rem] py-12 flex flex-col items-center border border-yellow-500/30 shadow-inner">
                <span className="text-sm font-bold text-neutral-400 uppercase tracking-[0.3em] mb-2">Punti Totali</span>
                <span className="text-[160px] leading-none font-black text-yellow-400 drop-shadow-[0_0_30px_rgba(234,179,8,0.5)]">
                  {top1.totalPoints}
                </span>
                
                <div className="mt-10 flex items-center gap-4 bg-white/5 px-8 py-4 rounded-full border border-yellow-500/20">
                  <span className="text-neutral-400 uppercase font-bold tracking-widest text-sm">Media Punti:</span>
                  <span className="text-white font-black text-3xl tabular-nums">{top1.avgPoints} <span className="text-lg text-neutral-500 font-bold ml-1">pt/gara</span></span>
                </div>
              </div>

            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-neutral-700/50 rounded-[3rem] bg-white/5">
              <span className="text-neutral-500 uppercase font-bold tracking-widest text-xl">Nessun Dato</span>
            </div>
          )}
        </div>

        {/* COLONNA DESTRA: GLI INSEGUITORI (Dal 2° al 10°) */}
        <div className="flex-1 flex flex-col h-full bg-neutral-900/90 border border-neutral-800 rounded-[3rem] p-8 shadow-2xl">
          
          <div className="flex text-neutral-400 font-bold uppercase text-[14px] tracking-widest px-8 pb-4 border-b border-neutral-800 shrink-0">
            <div className="w-20">Pos</div>
            <div className="flex-1">Giocatore</div>
            <div className="w-32 text-center">Partite</div>
            <div className="w-32 text-center">Media</div>
            <div className="w-32 text-right text-pink-500">Punti</div>
          </div>
          
          <div className="flex flex-col gap-3 mt-4 flex-1 justify-between">
            {others.map((p, i) => (
              <div key={p.id} className="flex items-center bg-black/40 border border-neutral-800/80 rounded-2xl px-8 py-3.5 shadow-sm">
                <div className="w-20 text-3xl font-black text-neutral-600">#{i + 2}</div>
                <div className="flex-1 flex items-baseline gap-3 truncate min-w-0 pr-4">
                  <span className="text-[28px] font-black text-white uppercase truncate">{p.last_name}</span>
                  <span className="text-[18px] font-bold text-neutral-400 uppercase truncate">{p.first_name}</span>
                </div>
                <div className="w-32 text-center text-2xl font-bold text-neutral-500">{p.games}</div>
                <div className="w-32 text-center text-2xl font-black text-neutral-300">{p.avgPoints}</div>
                <div className="w-32 text-right text-4xl font-black text-pink-500 drop-shadow-md">{p.totalPoints}</div>
              </div>
            ))}
            
            {/* Slot vuoti in caso di database parziale */}
            {Array.from({ length: Math.max(0, 9 - others.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center bg-white/5 border border-dashed border-neutral-800/50 rounded-2xl px-8 py-3.5 opacity-40 flex-1 min-h-[60px]">
                <div className="text-neutral-600 font-bold uppercase tracking-widest text-sm">In Attesa...</div>
              </div>
            ))}
          </div>

        </div>

      </div>
    </motion.div>
  );
}
// ==========================================
// COMPONENTE: SLAM DUNK CONTEST
// ==========================================
function SlamDunkGraphic({ payload }) {
  const round = payload?.round || "Qualificazione";
  const players = payload?.players || [];
  const activeVote = payload?.activeVote || null;
  const winner = payload?.winner || null;
  const liveDunker = payload?.liveDunker || null;
  
  // STATI PER IL LAMPEGGIO MIRATO
  const lastUpdatedPlayer = payload?.lastUpdatedPlayer || null; 
  const lastUpdatedDunk = payload?.lastUpdatedDunk || null; 

  const isFinal = round === "Finale";

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      exit={{ opacity: 0, scale: 1.05 }} 
      transition={{ duration: 0.4 }} 
      className="absolute inset-0 w-[1920px] h-[1080px] flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-950 to-black z-0 overflow-hidden"
    >
      {/* Sfondo Carbon Fibre Fisso per tutte le schermate */}
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>

      {/* MOTORE DI TRANSIZIONE DELLE 3 SCHERMATE */}
      <AnimatePresence mode="wait">
        
        {activeVote ? (
          <motion.div 
            key="votes-screen"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md"
          >
            {/* SCHERMATA 1: ANIMAZIONE DEI VOTI - TITOLO IN ALTO A DX */}
            <div className="absolute top-16 right-16 z-50 flex flex-col items-end text-right">
              <span className="text-pink-500 font-bold uppercase tracking-[0.4em] text-sm mb-1 drop-shadow-md">Voti Giuria</span>
              <motion.h2 
                initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                className="text-4xl font-black uppercase text-white tracking-widest drop-shadow-lg"
              >
                {activeVote.playerName}
              </motion.h2>
              <motion.h3 
                initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.1 }}
                className="text-xl font-bold uppercase text-neutral-400 tracking-widest mt-1"
              >
                Dunk {activeVote.dunkNumber}
              </motion.h3>
            </div>

            {/* I 5 Cartellini (Centrati) */}
            <div className="flex gap-8 mb-10 mt-16">
              {activeVote.votes.map((vote, i) => (
                <motion.div
                  key={`vote-${i}`}
                  initial={{ rotateY: -90, opacity: 0, scale: 0.8 }}
                  animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + (i * 0.5), type: "spring", damping: 12 }}
                  className="w-36 h-48 bg-gradient-to-br from-white to-neutral-200 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-center border-4 border-neutral-300"
                >
                  <span className="text-8xl font-black text-neutral-900 drop-shadow-md">{vote}</span>
                </motion.div>
              ))}
            </div>

            {/* Totale Esplosivo */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 3.5, type: "spring", stiffness: 200, damping: 20 }}
              className="flex flex-col items-center mt-4 bg-black/60 px-24 py-10 rounded-[4rem] border border-pink-500/30 shadow-[0_0_100px_rgba(236,72,153,0.15)]"
            >
              <span className="text-xl font-bold text-neutral-400 uppercase tracking-[0.4em] mb-2">Score Totale</span>
              <div className="text-[180px] leading-none font-black text-pink-500 drop-shadow-[0_0_50px_rgba(236,72,153,0.8)]">
                {activeVote.total}
              </div>
            </motion.div>
          </motion.div>

        ) : liveDunker ? (
          
          <motion.div 
            key="live-slate-screen"
            initial={{ scale: 0.8, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            exit={{ scale: 1.1, opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm"
          >
             {/* SCHERMATA 2: IL CARTELLO GIGANTE LIVE */}
             <span className="text-pink-500 font-bold uppercase tracking-[0.5em] text-4xl mb-8 drop-shadow-lg">
               {liveDunker.round}
             </span>
             <h1 className="text-[220px] leading-[0.85] font-black uppercase text-white drop-shadow-[0_0_50px_rgba(255,255,255,0.2)] text-center mb-16 px-10 text-balance">
               {liveDunker.playerName}
             </h1>
             <div className="bg-white text-black px-24 py-8 rounded-[4rem] border-8 border-neutral-300 shadow-[0_30px_60px_rgba(0,0,0,0.5)]">
                <span className="text-8xl font-black uppercase tracking-widest">
                  Dunk {liveDunker.dunkNumber}
                </span>
             </div>
          </motion.div>

        ) : (

          <motion.div 
            key="grid-screen" 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 w-full h-full flex flex-col z-10"
          >
            {/* SCHERMATA 3: GRIGLIA CARTE STANDARD (Default) */}
            <div className="absolute top-16 right-16 z-50 flex flex-col items-end text-right">
              <span className="text-pink-500 font-bold uppercase tracking-[0.4em] text-sm mb-1 drop-shadow-md">VERO Cup 2026</span>
              <h2 className="text-4xl font-black uppercase text-white tracking-widest drop-shadow-lg">Slam Dunk Contest</h2>
              <h3 className="text-xl font-bold uppercase text-neutral-400 tracking-widest mt-1">{round}</h3>
            </div>

            <div className="flex w-full h-full max-w-[1800px] mx-auto pt-[200px] pb-16 items-center justify-center gap-12 px-8">
              {players.map((player, idx) => {
                const isWinner = winner === player.player_name;
                const totalScore = (player.dunk_1 || 0) + (player.dunk_2 || 0);
                const isPlayerUpdated = player.player_name === lastUpdatedPlayer; 
                
                const nameParts = player.player_name ? player.player_name.split(' ') : [''];
                const firstName = nameParts.slice(0, -1).join(' ');
                const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : player.player_name;

                return (
                  <motion.div
                    key={player.player_name + idx}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                    className={`relative flex flex-col items-center p-10 transition-all ${
                      isFinal ? 'w-[650px] h-[750px]' : 'w-[420px] h-[650px]'
                    } ${
                      isWinner 
                        ? 'bg-gradient-to-br from-yellow-500/10 via-black/80 to-yellow-900/40 border-[3px] border-yellow-500/80 rounded-[3rem] shadow-[0_0_80px_rgba(234,179,8,0.2)]' 
                        : 'bg-neutral-900/90 border border-neutral-800 rounded-[3rem] shadow-2xl'
                    }`}
                  >
                    {/* LAMPEGGIANTE BORDO INTERA CARD */}
                    {isPlayerUpdated && (
                      <motion.div 
                        animate={{ opacity: [0, 1, 0, 1, 0] }}
                        transition={{ duration: 3, ease: "easeInOut" }}
                        className="absolute inset-0 border-[6px] border-pink-500 rounded-[3rem] shadow-[0_0_80px_rgba(236,72,153,0.8)] z-30 pointer-events-none"
                      />
                    )}

                    {isWinner && (
                      <motion.div animate={{ y: [-10, 5, -10] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="absolute -top-16 text-[100px] drop-shadow-[0_0_30px_rgba(234,179,8,0.8)] z-20">👑</motion.div>
                    )}

                    <div className="flex flex-col items-center text-center w-full mt-2 relative z-40">
                      {firstName && <span className={`font-bold uppercase tracking-widest ${isFinal ? 'text-3xl' : 'text-xl'} ${isWinner ? 'text-yellow-400' : 'text-neutral-400'} mb-2`}>{firstName}</span>}
                      <span className={`font-black text-white uppercase tracking-wider leading-none drop-shadow-lg truncate w-full px-4 ${isFinal ? 'text-7xl' : 'text-5xl'}`}>{lastName}</span>
                    </div>

                    <div className="flex-1 flex items-center justify-center w-full my-6 relative z-40">
                      <div className={`relative flex flex-col items-center justify-center rounded-full border-4 ${
                        isWinner ? 'border-yellow-400/50 bg-yellow-900/30 shadow-[0_0_60px_rgba(234,179,8,0.3)]' : 'border-neutral-800 bg-black/60 shadow-inner'
                        } ${isFinal ? 'w-[280px] h-[280px]' : 'w-[200px] h-[200px]'} transition-all duration-500`}
                      >
                        <span className={`absolute ${isFinal ? 'top-12' : 'top-8'} text-xs font-bold ${isWinner ? 'text-yellow-500' : 'text-neutral-500'} uppercase tracking-[0.4em]`}>Score</span>
                        <span className={`font-black leading-none mt-4 ${isFinal ? 'text-[110px]' : 'text-[80px]'} ${
                          isWinner ? 'text-yellow-400 drop-shadow-[0_0_30px_rgba(234,179,8,0.6)]' : (totalScore > 0 ? 'text-white' : 'text-neutral-700')
                        }`}>
                          {totalScore > 0 ? totalScore : '-'}
                        </span>
                      </div>
                    </div>

                    {/* BOX SCHIACCIATE IN BASSO (CON LAMPEGGIO) */}
                    <div className="w-full flex gap-6 mt-auto relative z-40">
                      <ScoreBox 
                        label="DUNK 1" 
                        score={player.dunk_1} 
                        isWinner={isWinner} 
                        isJustUpdated={isPlayerUpdated && lastUpdatedDunk === 1} 
                      />
                      <ScoreBox 
                        label="DUNK 2" 
                        score={player.dunk_2} 
                        isWinner={isWinner} 
                        isJustUpdated={isPlayerUpdated && lastUpdatedDunk === 2} 
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}

function ScoreBox({ label, score, isWinner, isJustUpdated }) {
  return (
    <div className={`flex-1 flex flex-col items-center rounded-3xl p-6 relative overflow-hidden ${isWinner ? 'bg-black/40 border border-yellow-500/20' : 'bg-black/60 border border-neutral-800/80'}`}>
      
      {/* IL LAMPEGGIO PIENO DENTRO AL BOX */}
      {isJustUpdated && (
        <motion.div 
          animate={{ 
            opacity: [0, 1, 0, 1, 0],
            scale: [1, 1.05, 1, 1.05, 1]
          }}
          transition={{ duration: 3, ease: "easeInOut" }}
          className="absolute inset-0 border-4 border-pink-300 rounded-3xl bg-pink-600 shadow-[0_0_60px_rgba(236,72,153,0.8)] z-0 pointer-events-none"
        />
      )}

      <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3 relative z-10 drop-shadow-md">{label}</span>
      <span className={`text-6xl font-black relative z-10 drop-shadow-md ${isWinner ? 'text-yellow-400' : 'text-white'}`}>
        {score !== null && score !== undefined && score !== 0 ? score : '-'}
      </span>
    </div>
  );
}
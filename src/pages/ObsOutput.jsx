import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { motion, AnimatePresence } from 'framer-motion';

// ==========================================
// HELPER GLOBALE: Colori dinamici per Eventi
// ==========================================
const getEventStyles = (tagName) => {
  const t = (tagName || '').toLowerCase();
  if (t.includes('vero cup')) return { tag: 'bg-pink-500/20 text-pink-300 border-pink-500/30', border: 'bg-pink-500' };
  if (t.includes('3-point') || t.includes('3 point')) return { tag: 'bg-blue-500/20 text-blue-300 border-blue-500/30', border: 'bg-blue-500' };
  if (t.includes('slam dunk')) return { tag: 'bg-sky-300/10 text-sky-100 border-sky-300/20', border: 'bg-sky-300' };
  if (t.includes('women')) return { tag: 'bg-orange-500/20 text-orange-300 border-orange-500/30', border: 'bg-orange-500' };
  // 👇 Ho lasciato solo 'master' qui per evitare il conflitto
  if (t.includes('master')) return { tag: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', border: 'bg-emerald-500' };
  
  // 👇 Così 'extra' o 'dr1' attivano correttamente questo!
  if (t.includes('extra') || t.includes('dr1')) return { tag: 'bg-emerald-800/30 text-emerald-400 border-emerald-800/50', border: 'bg-emerald-800'};
  
  return { tag: 'bg-teal-400/20 text-teal-300 border-teal-400/30', border: 'bg-teal-400' };
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
    else if ((broadcastState.active_graphic === 'match_full' || broadcastState.active_graphic === 'match_lite' || broadcastState.active_graphic === 'match_timeout') && broadcastState.payload.match_id) {
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

      if ((nextGraphic === 'match_full' || nextGraphic === 'match_lite' || nextGraphic === 'match_timeout') && broadcastState.payload.match_id) {
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
    currentLogo = "Basketville_logo26_vero.png";
  } else if (localGraphic.includes('3point')) {
    currentLogo = "Basketville_logo26_vero.png";
  } else if (localGraphic === 'match_full' || localGraphic === 'match_lite' || localGraphic === 'match_timeout') {
    // Peschiamo l'event_id direttamente dalla partita caricata!
    const eventId = matchData?.team_a?.event_id;
    
    // Inserisci qui gli ID reali dei tuoi eventi e i loghi corrispondenti
    if (eventId === 1) {
      currentLogo = "Basketville_logo26_vero.png"; // VERO Cup
    } else if (eventId === 4) {
      currentLogo = "Basketville_logo26_vero.png";         // OLD
    } else if (eventId === 5) {
      currentLogo = "Basketville_logo26_vero.png";        // WOMEN
    } else if (eventId === 6) {
      currentLogo = "Basketville_logo26_vero.png";        // DR123
    }
  }
  // ============================


  return (
    <div className="w-[1920px] h-[1080px] overflow-hidden bg-neutral-950 relative font-dimbo text-white origin-top-left">
      
     {/* ========================================= */}
      {/* OVERLAY LOGO CENTRALE UNICO (Z-50) */}
      {/* ========================================= */}
      {localGraphic !== 'daily_schedule' && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-500">
          <img 
            src={currentLogo} 
            alt="Sponsor Logo" 
            className="h-[140px] w-auto" 
          />
        </div>
      )}

      {/* ========================================= */}
      {/* GRAFICHE ANIMATE                          */}
      {/* ========================================= */}
      <AnimatePresence mode="wait">
        
        {/* 🪄 FUSIONE PERFETTA: Single e Result condividono lo stesso componente e la stessa KEY */}
        {(localGraphic === '3point_single' || localGraphic === '3point_result') && (
          <ThreePointLiveAndResult 
            key="3point_live_or_result" // <-- La chiave fissa blocca lo smontaggio della pagina
            mode={localGraphic} 
            payload={broadcastState.payload} 
          />
        )}

        {/* 3-POINT CONTEST (Ripulito dai doppioni) */}
        {localGraphic === '3point_winner' && <ThreePointWinner key="winner" payload={broadcastState.payload} />}
        {localGraphic === '3point_leaderboard' && <ThreePointLeaderboard key="leaderboard" data={threePointData} highlightedId={highlightedPlayerId} />}
        {localGraphic === '3point_bracket' && <ThreePointBracket key="bracket" data={threePointData} highlightedId={highlightedPlayerId} />}

        {/* SLAM DUNK CONTEST (Ripulito dai doppioni) */}
        {localGraphic === 'slamdunk' && <SlamDunkGraphic key="slamdunk" payload={broadcastState.payload} />}

        {/* VERO CUP / TORNEO */}
        {localGraphic === 'daily_schedule' && <DailyScheduleGraphic key="schedule" dateStr={dailyScheduleDate} data={dailyScheduleData} />}
        {localGraphic === 'match_full' && matchData && <MatchFullGraphic key="match_full" match={matchData} />}
        {localGraphic === 'match_lite' && matchData && <MatchLiteGraphic key="match_lite" match={matchData} isTimeout={false} />}
        {localGraphic === 'match_timeout' && matchData && <MatchLiteGraphic key="match_timeout" match={matchData} isTimeout={true} />}
        {localGraphic === 'top_scorers' && <TopScorersGraphic key="top_scorers" data={topScorers} />}
        {localGraphic === 'recap_girone' && <RecapGironeGraphic key="recap_girone" matches={tournamentMatches} teamsEditionEvents={tournamentTeams} calendar={tournamentCalendar} />}
        {localGraphic === 'playoff_bracket' && <QuadroPlayoffGraphic key="playoff_bracket" matches={tournamentMatches} teamsEditionEvents={tournamentTeams} calendar={tournamentCalendar} />}

        {/* JOLLY */}
        {localGraphic === 'generic_title' && <GenericTitleGraphic key="generic_title" payload={broadcastState.payload} />}
        {localGraphic === 'mvp_title' && <MvpTitleGraphic key="mvp_title" payload={broadcastState.payload} />}

        {/* DRAFT */}
        {localGraphic === 'draft_cronologica' && <DraftCronologicaGraphic key="draft_crono" picks={draftPicks} highlightRound={highlightRound} />}
        {localGraphic === 'draft_rosters' && <DraftRostersGraphic key="draft_rosters" picks={draftPicks} teams={draftTeams} />}
        {localGraphic === 'draft_mista' && <DraftMistaGraphic key="draft_mista" picks={draftPicks} teams={draftTeams} />}
        {localGraphic === 'draft_attesa' && <DraftAttesaGraphic key="draft_attesa" activePayload={broadcastState.payload} />}
        {localGraphic === 'draft_round_attesa' && <DraftRoundAttesaGraphic key="draft_round_attesa" payload={broadcastState.payload} />}
        {localGraphic === 'draft_annuncio' && <DraftAnnuncioGraphic key="draft_annuncio" picks={draftPicks} />}
        {localGraphic === 'draft_round_reveal' && <DraftRoundRevealGraphic key="draft_round_reveal" picks={draftPicks} round={broadcastState.payload.round} />}
        {localGraphic === 'draft_pool_status' && <DraftPoolGraphic key="draft_pool_status" players={eligiblePlayers} picks={draftPicks} />}

      </AnimatePresence>
    </div>
  );
}

// ==========================================
// GRAFICA PARTITA LITE (RISULTATO + SPONSOR FIXED & DYNAMIC FADE ENGINE)
// AGGIORNATO: LINEA CENTRALE FISSA IN TIMEOUT
// ==========================================
function MatchLiteGraphic({ match, isTimeout = false }) {
  const styles = getEventStyles(match.event_name);
  
  const [sponsorLogos, setSponsorLogos] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [duration, setDuration] = useState(5);

  // FETCH INTEGRATO CON FILTRO ANTI-RESET
  useEffect(() => {
    const fetchData = async () => {
      // 1. Leggiamo la durata
      const { data: setD } = await supabase
        .from('sponsor_settings')
        .select('duration')
        .eq('id', 1)
        .single();
        
      if (setD && setD.duration) {
        setDuration(setD.duration);
      }

      // 2. Leggiamo i loghi
      const { data: slideD } = await supabase
        .from('sponsor_slides')
        .select('*')
        .order('created_at', { ascending: true });
        
      if (slideD) {
        const logos = [];
        slideD.forEach(s => {
          if (s.img1 && s.img1.trim() !== '') logos.push({ url: s.img1, height: s.height1 || 100 });
          if (s.img2 && s.img2.trim() !== '') logos.push({ url: s.img2, height: s.height2 || 100 });
        });
        
        // IL FIX DEFINITIVO
        setSponsorLogos(prev => {
          if (JSON.stringify(prev) === JSON.stringify(logos)) return prev;
          return logos;
        });
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000); 
    return () => clearInterval(interval);
  }, []);

  // MOTORE DI ROTAZIONE
  useEffect(() => {
    if (sponsorLogos.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIdx((prevIdx) => (prevIdx + 1) % sponsorLogos.length);
    }, duration * 1000);

    return () => clearInterval(timer);
  }, [sponsorLogos, duration]);

  let subtitle = match.match_types?.name || '';
  const typeL = subtitle.toLowerCase();
  if ((typeL.includes('giron') || typeL.includes('qualificazion')) && match.team_a?.group_name) {
    subtitle = `GIRONE ${match.team_a.group_name}`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-950 to-black pb-12 pt-[220px] overflow-hidden"
    >
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>

      <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right">
        <span className="text-pink-500 font-bold uppercase tracking-[0.08em] text-sm mb-1 drop-shadow-md">{match.event_name}</span>
        <h2 className="text-4xl font-black uppercase text-white drop-shadow-lg tracking-wider">
          {subtitle}
        </h2>
      </div>

      <div className="z-10 w-full max-w-[1900px] h-full flex flex-col items-center gap-4 px-6">
        
        {/* BOX TOP (SQUADRE E RISULTATO) */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-4 shadow-2xl w-full shrink-0 grid grid-cols-[1fr_auto_1fr] gap-8 items-center min-h-[250px]">
           <div className="flex justify-center items-center h-full px-2">
             <h2 className="text-[100px] leading-none font-black uppercase text-white text-center tracking-wider drop-shadow-lg text-balance translate-y-[2px]">
               {match.team_a?.teams?.name}
             </h2>
           </div>
           
           <div className="flex flex-col items-center justify-center gap-3 w-[560px]">
             <div className="bg-pink-500/20 border border-pink-500/40 w-full py-6 rounded-[1rem] flex justify-center items-center relative">
               {match.status === 'live' && (
                 <div className="absolute -top-4 bg-red-500 text-white px-4 py-1 rounded-full text-xs font-black tracking-widest uppercase flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse">
                   <div className="w-2 h-2 bg-white rounded-full"></div> LIVE
                 </div>
               )}
               <span className="text-[120px] leading-none font-black text-white tracking-wider tabular-nums drop-shadow-md translate-y-[2px]">
                 {match.score_a ?? 0} <span className="text-pink-500 mx-2">-</span> {match.score_b ?? 0}
               </span>
             </div>

             <div className="bg-black/40 border border-pink-500/40 w-full py-6 rounded-[1rem] flex justify-center gap-8 shadow-inner">
               {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => (
                  <div key={q} className="flex flex-col items-center">
                    <span className="text-sm text-neutral-500 uppercase tracking-wider mb-1">{q}</span>
                    <span className="text-[30px] tracking-wider font-black text-white tabular-nums leading-none">
                      {match[`q${i+1}_a`] ?? 0} - {match[`q${i+1}_b`] ?? 0}
                    </span>
                  </div>
               ))}
               {((match.ot_a !== null && match.ot_a > 0) || match.ot_b > 0) && (
                  <div className="flex flex-col items-center text-pink-400">
                    <span className="text-sm uppercase tracking-wider mb-1">OT</span>
                    <span className="text-[30px] tracking-wider font-black tabular-nums leading-none">
                      {match.ot_a ?? 0} - {match.ot_b ?? 0}
                    </span>
                  </div>
               )}
             </div>
           </div>

           <div className="flex justify-center items-center h-full px-2">
             <h2 className="text-[100px] leading-none font-black uppercase text-white text-center tracking-wider drop-shadow-lg text-balance translate-y-[2px]">
               {match.team_b?.teams?.name}
             </h2>
           </div>
        </div>

        {/* ================================================================= */}
        {/* BOX BOTTOM (LAYOUT GRID FISSO 50/50 CON DIVISORE IMMOBILE)        */}
        {/* ================================================================= */}
        <div className="w-full h-[440px] bg-white/5 border border-white/10 rounded-[1rem] shadow-inner overflow-hidden grid grid-cols-2 items-center min-h-0 relative">
          
          {/* 🔒 IL DIVISORE CENTRALE: Resta sempre visibile, bloccato a metà schermo */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[5px] h-[250px] bg-gradient-to-b from-transparent via-white/15 to-transparent z-10"></div>

          {/* COLONNA SINISTRA (50%): Controllata dal flag isTimeout */}
          <div className="h-full flex items-center justify-center select-none">
            {!isTimeout ? (
              // Modalità Standard LITE: Mostra la scritta dei partner
              <h3 className="text-[75px] leading-none font-black uppercase text-white tracking-wider whitespace-nowrap">
                OFFICIAL <span className="text-pink-500">PARTNERS</span>
              </h3>
            ) : (
              // Modalità TIMEOUT: La scritta scompare del tutto lasciando lo spazio vuoto e pulito
              <div className="w-full h-full"></div>
            )}
          </div>

          {/* COLONNA DESTRA (50%): Gli sponsor continuano a girare nel loro spazio dedicato */}
          <div className="h-full flex items-center justify-center relative overflow-hidden w-full px-12">
            {sponsorLogos.length > 0 ? (
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentIdx} 
                  src={sponsorLogos[currentIdx]?.url} 
                  alt="Sponsor Logo" 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.3, ease: "linear" }}
                  className="w-auto max-w-full object-contain drop-shadow-lg filter brightness-110 shrink-0" 
                  style={{ height: `${sponsorLogos[currentIdx]?.height}px` }} 
                />
              </AnimatePresence>
            ) : (
              <div className="text-neutral-500 font-bold uppercase tracking-widest text-2xl">
                Nessuno sponsor in coda
              </div>
            )}
          </div>

        </div>

      </div>
    </motion.div>
  );
}

// ==========================================
// GRAFICA PARTITA COMPLETA (ROSTER + RISULTATO)
// ==========================================
function MatchFullGraphic({ match }) {
  const styles = getEventStyles(match.event_name);

  let subtitle = match.match_types?.name || '';
  const typeL = subtitle.toLowerCase();
  if ((typeL.includes('giron') || typeL.includes('qualificazion')) && match.team_a?.group_name) {
    subtitle = `GIRONE ${match.team_a.group_name}`;
  }

  // =================================================================
  // RIGA SINGOLO GIOCATORE
  // =================================================================
  const renderPlayerRow = (p) => (
    <div key={p.id} className="flex justify-between items-center bg-white/5 border border-white/5 px-4 py-2.5 rounded-xl hover:bg-white/10 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-pink-500 font-black w-8 text-right text-[30px] tracking-wider shrink-0 drop-shadow-md translate-y-[2px]">
          {p.jersey_number}
        </span>
        <span className="font-bold text-white uppercase text-[30px] tracking-wider truncate pt-1">
          {p.players?.first_name?.charAt(0)}. {p.players?.last_name}
        </span>
      </div>
      <span className="font-black text-[30px] tracking-wider text-white shrink-0 ml-4 mr-1 tabular-nums leading-none pt-1 drop-shadow-lg">
        {p.match_points} 
        <span className="text-[16px] text-neutral-500 tracking-wider font-normal ml-1">pt</span>
      </span>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-950 to-black pb-12 pt-[180px] overflow-hidden"
    >
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>

      {/* TITOLO SPOSTATO IN ALTO A DESTRA */}
      <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right">
        <span className="text-pink-500 font-bold uppercase tracking-[0.08em] text-sm mb-1 drop-shadow-md">{match.event_name}</span>
        <h2 className="text-4xl font-black uppercase text-white drop-shadow-lg tracking-wider">
          {subtitle}
        </h2>
      </div>

      <div className="z-10 w-full max-w-[1900px] h-full flex flex-col items-center gap-4 px-6">
        
        {/* ================================================================= */}
        {/* BOX TOP (SQUADRE E RISULTATO) - COLONNA CENTRALE FISSA */}
        {/* ================================================================= */}
        {/* 🎛️ CONTENITORE: Griglia con 1fr (sinistra) - auto/fissa (centro) - 1fr (destra) */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-4 shadow-2xl w-full shrink-0 grid grid-cols-[1fr_auto_1fr] gap-8 items-center min-h-[250px]">
           
           {/* COLONNA 1: SQUADRA CASA */}
           <div className="flex justify-center items-center h-full px-2">
             <h2 className="text-[100px] leading-none font-black uppercase text-white text-center tracking-wider drop-shadow-lg text-balance translate-y-[2px]">
               {match.team_a?.teams?.name}
             </h2>
           </div>
           
           {/* COLONNA 2: BOX PUNTEGGI E QUARTI */}
           <div className="flex flex-col items-center justify-center gap-3 w-[560px]">
             
             {/* Box Punteggio */}
             <div className="bg-pink-500/20 border border-pink-500/40 w-full py-6 rounded-[1rem] flex justify-center items-center">
               <span className="text-[120px] leading-none font-black text-white tracking-wider tabular-nums drop-shadow-md translate-y-[2px]">
                 {match.score_a ?? 0} <span className="text-pink-500 mx-2">-</span> {match.score_b ?? 0}
               </span>
             </div>

             {/* Box Quarti */}
<div className="bg-black/40 border border-pink-500/40 w-full py-6 rounded-[1rem] flex justify-center gap-8 shadow-inner">
  {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => (
     <div key={q} className="flex flex-col items-center">
       <span className="text-sm text-neutral-500 uppercase tracking-wider mb-1">
         {q}
       </span>
       <span className="text-[30px] tracking-wider font-black text-white tabular-nums leading-none">
         {match[`q${i+1}_a`] ?? 0} - {match[`q${i+1}_b`] ?? 0}
       </span>
     </div>
  ))}
  {((match.ot_a !== null && match.ot_a > 0) || match.ot_b > 0) && (
     /* Rimossi border-l, border-white/10, pl-6 e ml-2. Ora l'OT aggancia il gap-8 nativo del flex */
     <div className="flex flex-col items-center text-pink-400">
       <span className="text-sm uppercase tracking-wider mb-1">
         OT
       </span>
       <span className="text-[30px] tracking-wider font-black tabular-nums leading-none">
         {match.ot_a ?? 0} - {match.ot_b ?? 0}
       </span>
     </div>
  )}
</div>

           </div>

           {/* COLONNA 3: SQUADRA TRASFERTA */}
           <div className="flex justify-center items-center h-full px-2">
             <h2 className="text-[100px] leading-none font-black uppercase text-white text-center tracking-wider drop-shadow-lg text-balance translate-y-[2px]">
               {match.team_b?.teams?.name}
             </h2>
           </div>

        </div>

        {/* ================================================================= */}
        {/* BOX BOTTOM (I DUE ROSTER) */}
        {/* ================================================================= */}
        <div className="flex w-full gap-4 flex-1 min-h-0">
          
          {/* ----- ROSTER TEAM A ----- */}
          <div className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[1.5rem] px-4 py-4 shadow-2xl flex flex-col min-w-0">
            
            <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-3 content-start overflow-hidden">
              {match.roster_a?.length > 0 ? (
                match.roster_a.map(renderPlayerRow)
              ) : (
                <div className="col-span-2 text-center text-neutral-500 mt-6 uppercase font-bold text-[29px] tracking-wider">
                  Nessun giocatore
                </div>
              )}
            </div>

            {/* STAFF TEAM A IN STILE GIOCATORE */}
            {(match.team_a?.coach || match.team_a?.assistant_coach) && (
              <div className="mt-auto -mb-1 pt-2 flex w-full gap-2 shrink-0 items-center">
                {match.team_a?.coach && (
                  <div className="flex-1 flex items-center gap-4 bg-black/40 border border-white/5 px-4 py-3 rounded-xl min-w-0">
                    <span className="text-pink-500 font-black text-[28px] tracking-wider shrink-0 uppercase drop-shadow-md">
                      COACH
                    </span>
                    <span className="font-bold text-white uppercase text-[28px] tracking-wider truncate pt-0">
                      {match.team_a.coach}
                    </span>
                  </div>
                )}
                {match.team_a?.assistant_coach && (
                  <div className="flex-1 flex items-center gap-4 bg-black/40 border border-white/5 px-4 py-3 rounded-xl min-w-0">
                    <span className="text-neutral-500 font-black text-[28px] tracking-wider shrink-0 uppercase drop-shadow-md">
                      VICE
                    </span>
                    <span className="font-bold text-white uppercase text-[28px] tracking-wider truncate pt-0">
                      {match.team_a.assistant_coach}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ----- ROSTER TEAM B ----- */}
          <div className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-4 shadow-2xl flex flex-col min-w-0">
            
            <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-3 content-start overflow-hidden">
              {match.roster_b?.length > 0 ? (
                match.roster_b.map(renderPlayerRow)
              ) : (
                <div className="col-span-2 text-center text-neutral-500 mt-6 uppercase font-bold text-[25px] tracking-wider">
                  Nessun giocatore
                </div>
              )}
            </div>
            
            {/* STAFF TEAM B IN STILE GIOCATORE */}
            {(match.team_b?.coach || match.team_b?.assistant_coach) && (
              <div className="mt-auto -mb-1 pt-2 flex w-full gap-2 shrink-0 items-center">
                {match.team_b?.coach && (
                  <div className="flex-1 flex items-center gap-4 bg-black/40 border border-white/5 px-4 py-3 rounded-xl min-w-0">
                    <span className="text-pink-500 font-black text-[28px] tracking-wider shrink-0 uppercase drop-shadow-md">
                      COACH
                    </span>
                    <span className="font-bold text-white uppercase text-[28px] tracking-wider truncate pt-0">
                      {match.team_b.coach}
                    </span>
                  </div>
                )}
                {match.team_b?.assistant_coach && (
                  <div className="flex-1 flex items-center gap-4 bg-black/40 border border-white/5 px-4 py-3 rounded-xl min-w-0">
                    <span className="text-neutral-500 font-black text-[28px] tracking-wider shrink-0 uppercase drop-shadow-md">
                      VICE
                    </span>
                    <span className="font-bold text-white uppercase text-[28px] tracking-wider truncate pt-0">
                      {match.team_b.assistant_coach}
                    </span>
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
  // --- FUNZIONI PER DIVIDERE LA DATA ---
  const formatWeekday = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleDateString('it-IT', { weekday: 'long' });
  };

  const formatDayMonth = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    return timeString.substring(0, 5);
  };

  // --- FUNZIONE: ASSOCIA IL LOGO ALL'EVENTO ---
  const getEventLogo = (tagName) => {
    const t = (tagName || '').toLowerCase();
    if (t.includes('vero cup')) return '/Basketville_logo26_vero.png'; 
    if (t.includes('3-point') || t.includes('3 point')) return '/logo_3point.png'; 
    if (t.includes('slam dunk')) return '/logo_slamdunk.png'; 
    return null; 
  };

  const renderMatchCenter = (match) => {
    const status = match.status?.toLowerCase();
    const hasScore = match.score_home !== null && match.score_away !== null;
    const isZeroZero = match.score_home === 0 && match.score_away === 0;

    let topText = '';
    const type = match.match_type?.toLowerCase() || '';
    if ((type.includes('giron') || type.includes('qualificazion')) && match.home_group) {
      topText = `GIRONE ${match.home_group}`;
    } else if (type.includes('esibizione')) {
      topText = '';
    } else {
      topText = match.match_type || '';
    }

    let boxContent = null;
    let bottomText = '';
    let boxClasses = '';
    let textClasses = '';

    if (status === 'live') {
      // 🎯 DOPO: Aggiunto h-[85px] w-full
      boxClasses = 'h-[85px] w-full relative bg-red-500/20 border-2 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.4)]';
      boxContent = (
        <>
          {/* Badge LIVE ancorato a sinistra */}
          <div className="absolute left-6 flex items-center gap-2 animate-pulse">
            <div className="w-3 h-3 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
          </div>
          
          {/* Punteggio perfettamente centrato */}
          <span className="text-[50px] leading-none font-black text-red-400 tracking-wider">
            {match.score_home ?? 0} - {match.score_away ?? 0}
          </span>
        </>
      );
      bottomText = ''; 
      textClasses = 'text-transparent';
    }
    else if (status === 'finished' || status === 'completed' || (hasScore && !isZeroZero && status !== 'scheduled')) {
      // 🎯 DOPO: Aggiunto h-[85px] w-full
      boxClasses = 'h-[85px] w-full bg-black/60 border-2 border-neutral-600';
      boxContent = (
        <span className="text-[50px] leading-none font-black text-neutral-300 tracking-wider">
          {match.score_home ?? 0} - {match.score_away ?? 0}
        </span>
      );
      bottomText = 'Finale';
      textClasses = 'text-neutral-500';
    } 
    else {
      // 🎯 DOPO: Aggiunto h-[85px] w-full
      boxClasses = 'h-[85px] w-full bg-white/5 border-2 border-white/10';
      boxContent = (
        <span className="text-[50px] font-black text-neutral-500 uppercase tracking-wider px-4">
          VS
        </span>
      );
      bottomText = '';
      textClasses = 'text-transparent';
    }

return (
  // Il contenitore esterno torna pulito, senza translate strani che sballano le squadre
  <div className="w-[280px] flex flex-col items-center justify-center shrink-0">
    
    {/* CREIAMO UN ANCORAGGIO RELATIVE PER IL MINI-BOX */}
    <div className="relative w-full flex flex-col items-center translate-y-0">
      
     {/* 🏷️ MINI-BOX ASSOLUTO (Sfondo grigio/vetro corretto, bordo e scritta approvati) */}
      {topText && (
        <div className="absolute bottom-full bg-white/5 border-t-2 border-x-2 border-neutral-600 px-4 py-0.5 rounded-t-[0.6rem] flex items-center justify-center translate-y-[2px] z-10">
          
          {/* TOCCATO SOLO IL COLORE QUI SOTTO 👇 */}
          <span className={`text-[20px] font-black uppercase tracking-wider whitespace-nowrap ${
            topText.toUpperCase().includes('GIRONE B') || (topText.toUpperCase().includes('SEMIFINALE') && (topText.toUpperCase().includes('2') || topText.toUpperCase().includes('B') || topText.toUpperCase().includes('SECONDA')))
              ? 'text-pink-500' 
              : topText.toUpperCase().includes('FINALE') 
              ? 'text-[#ffd700]' 
              : 'text-[#79bce4]'
          }`}>
            {topText}
          </span>

        </div>
      )}

      {/* 🎯 IL TUO BOX ORIGINALE: Invariato, stabile e perfettamente allineato ai nomi delle squadre */}
      <div className={`flex items-center justify-center px-6 py-3 rounded-[1rem] w-full ${boxClasses}`}>
        {boxContent}
      </div>
    </div>
  </div>
);
};

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-950 to-black pt-[240px] pb-12 font-sans tracking-wider" 
    >
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>
      
      {/* NUOVO TITOLO: GIORNO DELLA SETTIMANA ROSA + DATA BIANCA */}
      <div className="absolute top-12 w-full z-50 flex flex-col items-center text-center">
        
{/* NUOVO TITOLO: BOX IDENTICO ALLE CARD SOTTO */}
      <div className="absolute top-[6px] w-full max-w-[1850px] z-50">
        
        {/* BOX IN STILE CARD: Stesso bordo, stesso vetro, stesse ombre, ma alto 190px */}
        <div className="w-full h-[190px] relative rounded-[1.5rem] shadow-2xl bg-white/5 backdrop-blur-xl border-2 border-white/10 overflow-hidden flex items-center justify-center">
          
          <motion.div 
            key={`date-${dateStr}`}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex items-baseline gap-6 translate-y-2" // translate-y-2 bilancia otticamente i font giganti
          >
            {/* Es: VENERDÌ (Bianco ed enorme) */}
            <h2 className="text-[95px] leading-none font-black uppercase text-white tracking-wider">
              {formatWeekday(dateStr)}
            </h2>

            {/* Es: 19 GIUGNO (Rosa brillante) */}
            <h3 className="text-[95px] leading-none font-black uppercase text-pink-500 tracking-wider">
              {formatDayMonth(dateStr)}
            </h3>
          </motion.div>

        </div>
      </div>
      </div>

      <div className="z-10 w-full max-w-[1850px] flex flex-col items-center flex-1 min-h-0 mt-4">
        
        {/* CONTENITORE PADRE STATICO */}
        <div className="w-full flex flex-col gap-3 h-full justify-center max-h-[750px]">
          {data.length === 0 ? (
            <motion.div 
              key={`empty-${dateStr}`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center text-neutral-500 text-4xl font-bold uppercase tracking-wider mt-10"
            >
              Nessun evento in programma
            </motion.div>
          ) : (
            data.map((item, index) => {
              const styles = typeof getEventStyles !== 'undefined' ? getEventStyles(item.event_tag) : { tag: 'bg-neutral-500/20 text-neutral-300 border-neutral-500/30', border: 'bg-neutral-500' };
              const eventLogo = getEventLogo(item.event_tag); 

              return (
                <motion.div 
                  key={`${dateStr}-${item.id || index}`} 
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 80, damping: 15, delay: 0.3 + (index * 0.15) }}
                  className="w-full flex-1 max-h-[180px] min-h-[100px]"
                >
                  
                  <div className="w-full h-full relative rounded-[1.5rem] shadow-2xl">
                    
                    <div className="absolute inset-0 bg-white/5 backdrop-blur-xl border-2 border-white/10 rounded-[1.5rem] pointer-events-none"></div>
                    <div className={`absolute left-0 top-0 bottom-0 w-6 rounded-l-[1.5rem] ${styles.border}`}></div>
                    
                    <div className="absolute inset-0 flex items-center px-6 z-10">
                      
                      {/* BLOCCO SINISTRO (ORARIO) */}
                      <div className="w-[280px] h-full flex items-center justify-center shrink-0">
                        <span className="text-[65px] font-black text-white tracking-wider drop-shadow-md leading-none translate-y-1">
                          {formatTime(item.time)}
                        </span>
                      </div>
                      
                      {/* SEPARATORE SINISTRO SFUMATO */}
                      <div className="w-[4px] h-2/3 bg-gradient-to-b from-transparent via-white/10 to-transparent"></div>
                      
                      {/* BLOCCO CENTRALE (MATCH/EVENTO) */}
                      <div className="flex-1 flex items-center justify-between min-w-0 px-8">
                        {item.matchDetails ? (
                          <>
                            <div className="flex-1 text-right truncate text-[65px] font-black text-white px-8 tracking-wider">
                              {item.matchDetails.home_name}
                            </div>
                            {renderMatchCenter(item.matchDetails)}
                            <div className="flex-1 text-left truncate text-[65px] font-black text-white px-8 tracking-wider">
                              {item.matchDetails.away_name}
                            </div>
                          </>
                        ) : (
                          <div className="flex-1 flex items-center justify-center px-8">
                            <span className="text-[65px] font-black text-white uppercase tracking-wider truncate text-center w-full">
                              {item.description || item.event_tag}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* SEPARATORE DESTRO SFUMATO */}
                      <div className="w-[4px] h-2/3 bg-gradient-to-b from-transparent via-white/10 to-transparent"></div>
                      
                      {/* BLOCCO DESTRO (LOGO/TAG) */}
<div className="w-[280px] h-full flex items-center justify-center shrink-0">
  {eventLogo ? (
    <img 
      src={eventLogo} 
      alt={item.event_tag} 
      className="max-h-[85px] max-w-[220px] object-contain drop-shadow-lg" 
    />
  ) : (
    <span className={`flex items-center justify-center w-[200px] h-[85px] border-2 rounded-2xl text-[22px] font-bold uppercase tracking-wider whitespace-nowrap ${styles.tag}`}>
      {item.event_tag}
    </span>
  )}
</div>

                    </div>

                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ========================================================
// COMPONENTE UNIFICATO: LIVE TRACKER & RISULTATO UFFICIALE
// ========================================================
function ThreePointLiveAndResult({ mode, payload }) {
  const [localTime, setLocalTime] = useState(60.0);
  const [isRunning, setIsRunning] = useState(false);
  const [showStamp, setShowStamp] = useState(false);
  
  // 🔒 CASSAFORTE DI SICUREZZA: Blocca i dati del giocatore per evitare il flash a "TIRATORE"
  const [lockedPayload, setLockedPayload] = useState(payload);

  useEffect(() => {
    if (payload && payload.player_name) {
      setLockedPayload(payload);
    }
  }, [payload]);

  const isResultMode = mode === '3point_result';

  useEffect(() => {
    if (mode === '3point_single') {
      setShowStamp(false); 
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
    } else if (mode === '3point_result') {
      setIsRunning(false); 
      setShowStamp(false);  
      
      const timer = setTimeout(() => {
        setShowStamp(true);
      }, 2500);
      
      return () => clearTimeout(timer);
    }
  }, [payload, mode]);

  useEffect(() => {
    let interval;
    if (isRunning && localTime > 0 && mode === '3point_single') {
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
  }, [isRunning, localTime, mode]);

  // Usiamo sempre lockedPayload per garantire stabilità visiva assoluta
  const hasPrev = lockedPayload.prev_score !== null && lockedPayload.prev_score !== undefined;
  const isLive = mode === '3point_single' ? !!payload.command : false; 

  const isRecord = lockedPayload.status === 'record';
  const isScartato = lockedPayload.status === 'scartato';

  // Filtro di ferro della miglior prestazione legato a lockedPayload
  const showMigliorPrestazione = hasPrev && lockedPayload.round === 'Qualificazione';

  // Logica taglio nome intelligente (> 15 caratteri) ancorata a lockedPayload
  let displayName = lockedPayload.player_name || 'Tiratore';
  if (lockedPayload.player_name && lockedPayload.player_name.length > 14) {
    const parts = lockedPayload.player_name.trim().split(/\s+/);
    if (parts.length > 1) {
      displayName = `${parts[0].charAt(0).toUpperCase()}. ${parts.slice(1).join(' ')}`;
    }
  }

  const blurClass = (isResultMode && showStamp) ? "blur-md filter transition-all duration-700" : "transition-all duration-700";

  return (
    <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-950 to-black overflow-hidden">
      
      {/* TITOLO SPOSTATO IN ALTO A DESTRA */}
      <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right">
        <span className="text-pink-500 font-bold uppercase tracking-[0.08em] text-sm mb-1 drop-shadow-md">
          {isResultMode ? "Contest Concluso" : (isLive ? "Live in corso" : "Attesa tiratore")}
        </span>
        <div className="flex items-center gap-3">
          {isRunning && mode === '3point_single' && (
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.8)] mb-1"></div>
          )}
          <h2 className="text-4xl font-black uppercase text-white drop-shadow-lg tracking-wider">
            {isResultMode ? "Risultato Ufficiale" : "3-Point Contest"}
          </h2>
        </div>
      </div>

      {/* CONTENUTO CENTRALE (Nomi e Punteggi) */}
      <div className="flex flex-col items-center text-center w-full max-w-6xl px-12 relative pt-[320px]">
        
        {/* Nome stabile e bloccato */}
        <h1 className={`text-[160px] leading-none font-black uppercase tracking-wider mb-4 drop-shadow-2xl text-white ${blurClass}`}>
          {displayName}
        </h1>

        <div className="flex items-center gap-6 w-full justify-center relative pt-[10px]">
          
          {/* BOX TEMPO */}
          <div className={`bg-white/5 backdrop-blur-xl w-[450px] h-[300px] rounded-[1.5rem] border border-white/10 flex flex-col overflow-hidden transition-all ${isResultMode && isScartato && showStamp ? 'opacity-30 grayscale' : 'shadow-2xl'} ${blurClass}`}>
            <div className="w-full bg-black/40 py-4 border-b border-black/50 flex items-center justify-center shrink-0">
              <span className="text-[40px] font-bold text-neutral-400 uppercase tracking-wider translate-y-[1px]">
                Tempo
              </span>
            </div>
            <div className="flex-1 flex items-center justify-center pb-4">
              <span className="text-[160px] tracking-wider leading-none font-black tabular-nums text-neutral-200 translate-y-[4px]">
                {isResultMode ? (lockedPayload.time ? `${lockedPayload.time}s` : '0.0s') : (isLive ? localTime.toFixed(1) : `${lockedPayload.time || '0.0'}s`)}
              </span>
            </div>
          </div>

          {/* BOX PUNTEGGIO */}
          <div className={`bg-white/5 backdrop-blur-xl w-[450px] h-[300px] rounded-[1.5rem] border border-white/10 flex flex-col overflow-hidden transition-all relative ${isResultMode && isScartato && showStamp ? 'opacity-30 grayscale' : 'shadow-2xl'} ${blurClass}`}>
            <div className="w-full bg-black/40 py-4 border-b border-black/50 flex items-center justify-center shrink-0">
              <span className="text-[40px] font-bold text-pink-400 uppercase tracking-wider translate-y-[1px]">
                Punti
              </span>
            </div>
            <div className="flex-1 flex items-center justify-center pb-4 relative">
              <div className="absolute top-0 right-0 w-32 h-32 translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
              <span className="text-[160px] tracking-wider leading-none font-black z-10 text-white translate-y-[4px]">
                {lockedPayload.score || 0}
              </span>
            </div>
          </div>

          {/* OVERLAY TIMBRO */}
          <div className="absolute inset-0 flex justify-center items-center pointer-events-none z-50 -translate-y-14">
            <AnimatePresence>
              {isResultMode && showStamp && isScartato && (
                <motion.div 
                  key="scartato"
                  initial={{ opacity: 0, scale: 0.3, y: 30 }} 
                  animate={{ opacity: 1, scale: 1, y: 0 }} 
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ type: "spring", stiffness: 120, damping: 15 }}
                  className="text-[160px] font-black text-red-400 uppercase tracking-wider border border-red-500/30 px-20 py-10 rounded-full bg-red-950/50 backdrop-blur-md shadow-[0_0_60px_rgba(239,68,68,0.4)] flex items-center justify-center leading-none"
                >
                  SCARTATO
                </motion.div>
              )}
              {isResultMode && showStamp && isRecord && (
                <motion.div 
                  key="record"
                  initial={{ opacity: 0, scale: 0.3, y: 30 }} 
                  animate={{ opacity: 1, scale: 1, y: 0 }} 
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ type: "spring", stiffness: 120, damping: 15 }}
                  className="text-[160px] font-black text-green-400 uppercase tracking-wider border border-green-500/30 px-20 py-10 rounded-full bg-green-950/50 backdrop-blur-md shadow-[0_0_60px_rgba(34,197,94,0.4)] flex items-center justify-center leading-none"
                >
                  VALIDO
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>

      {/* SPAZIO CONGELATO IN ALTEZZA PER EVITARE SBALZI */}
      <div className="mt-32 mb-16 w-full flex justify-center h-[112px] items-center">
        {showMigliorPrestazione && (
          <motion.div 
            layoutId="shared-miglior-prestazione"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-10 px-12 py-6 rounded-full bg-pink-950/40 border border-pink-500/20 backdrop-blur-md shadow-2xl ${blurClass}`}
          >
            <span className="text-[40px] font-bold uppercase tracking-wider text-pink-400/90 leading-none">
              Miglior Prestazione
            </span>
            <div className="w-px h-8 bg-pink-500/30"></div>
            <div className="flex items-baseline gap-2">
              <span className="text-[40px] font-black text-white middle leading-none drop-shadow-md">
                {lockedPayload.prev_score} pt
              </span>
              <span className="text-[40px] font-medium text-pink-200/70 leading-none">
                in {lockedPayload.prev_time}s
              </span>
            </div>
          </motion.div>
        )}
      </div>

    </div>
  );
}

function ThreePointWinner({ payload }) {
  const hasPrev = payload.prev_score !== null && payload.prev_score !== undefined;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      exit={{ opacity: 0, scale: 1.05 }} 
      transition={{ type: "spring", stiffness: 100, damping: 20 }} 
      className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-950 via-neutral-950 to-black overflow-hidden"
    >
      {/* Texture stellata celebrativa in overlay */}
      <div className="absolute top-0 w-full h-full opacity-20 pointer-events-none mix-blend-screen bg-center bg-cover bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
      
      {/* TITOLO SPOSTATO IN ALTO A DESTRA */}
      <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right">
        <span className="text-pink-500 font-bold uppercase tracking-[0.08em] text-sm mb-1 drop-shadow-md">Campione Assoluto</span>
        <div className="flex items-center gap-3">
          <span className="text-3xl drop-shadow-[0_0_10px_rgba(234,179,8,0.6)] animate-bounce mb-1">👑</span>
          <h2 className="text-4xl font-black uppercase text-white drop-shadow-lg tracking-wider">
            3-Point <span className="text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.6)]">Champion</span>
          </h2>
        </div>
      </div>

      {/* CONTENUTO CENTRALE */}
      <div className="flex flex-col items-center text-center w-full max-w-6xl px-12 relative pt-[320px]">
        
        {/* Nome del Campione */}
        <h1 className="text-[160px] leading-none font-black uppercase tracking-wider mb-4 text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-yellow-400 to-yellow-600 drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
          {payload.player_name || 'Campione'}
        </h1>

        <div className="flex items-center gap-6 w-full justify-center relative pt-[10px]">
          
          {/* BOX TEMPO FINALE */}
          <div className="bg-yellow-500/5 backdrop-blur-xl w-[450px] h-[300px] rounded-[1.5rem] border border-yellow-500/20 flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            {/* Banda scura superiore */}
            <div className="w-full bg-black/40 py-4 border-b border-black/50 flex items-center justify-center shrink-0">
              <span className="text-[40px] font-bold text-neutral-400 uppercase tracking-wider translate-y-[1px]">
                Tempo Finale
              </span>
            </div>
            {/* Numero centrato */}
            <div className="flex-1 flex items-center justify-center pb-4">
              <span className="text-[160px] tracking-wider leading-none translate-y-[4px] font-black tabular-nums text-yellow-100/90 drop-shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                {payload.time ? `${payload.time}s` : '0.0s'}
              </span>
            </div>
          </div>

          {/* BOX PUNTEGGIO RECORD */}
          <div className="bg-yellow-500/5 backdrop-blur-xl w-[450px] h-[300px] rounded-[1.5rem] border border-yellow-500/30 flex flex-col overflow-hidden relative shadow-[0_0_60px_rgba(234,179,8,0.15)]">
            {/* Banda scura superiore */}
            <div className="w-full bg-black/40 py-4 border-b border-black/50 flex items-center justify-center shrink-0">
              <span className="text-[40px] font-bold text-yellow-400 uppercase tracking-wider translate-y-[1px] drop-shadow-[0_0_10px_rgba(234,179,8,0.4)]">
                Punti
              </span>
            </div>
            {/* Numero centrato */}
            <div className="flex-1 flex items-center justify-center pb-4 relative">
              <span className="text-[160px] tracking-wider translate-y-[4px] leading-none font-black text-yellow-400 z-10 drop-shadow-[0_0_40px_rgba(234,179,8,0.6)]">
                {payload.score || 0}
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* SPAZIO CONGELATO IN ALTEZZA PER EVITARE SBALZI */}
      <div className="mt-32 mb-16 w-full flex justify-center h-[112px] items-center">
        {hasPrev && (
          <motion.div 
            layoutId="shared-miglior-prestazione"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-10 px-12 py-6 rounded-full bg-yellow-950/40 border border-yellow-500/20 backdrop-blur-md shadow-2xl"
          >
            <span className="text-[40px] font-bold uppercase tracking-wider text-yellow-500/90 leading-none">
              Record Precedente
            </span>
            <div className="w-px h-8 bg-yellow-500/30"></div>
            <div className="flex items-baseline gap-2">
              <span className="text-[40px] font-black text-white middle leading-none drop-shadow-md">
                {payload.prev_score} pt
              </span>
              <span className="text-[40px] font-medium text-yellow-200/70 leading-none">
                in {payload.prev_time}s
              </span>
            </div>
          </motion.div>
        )}
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
        className="flex items-center justify-between px-2 py-2 rounded-[1.5rem] border backdrop-blur-md shadow-2xl mb-4"
      >
        <div className="flex items-center gap-6">
          <span className="text-[40px] tracking-wider font-black text-pink-500 w-14 text-right leading-none shrink-0 drop-shadow-md translate-y-[2px]">
            {position}.
          </span>
          <span className="text-[40px] tracking-wider font-black uppercase tracking-tight text-white leading-none translate-y-[2px]">
            {player.player_name}
          </span>
        </div>
        
<div className="flex items-center gap-2 shrink-0">
          
          {/* BOX TEMPO AGGIORNATO CON FASCIA ANCORATA IN ALTO */}
          <div className="w-32 h-[96px] bg-white/10 rounded-2xl border border-white/5 flex flex-col overflow-hidden shadow-inner shrink-0">
            {/* Fascia scura superiore */}
            <div className="w-full bg-black/40 py-1.5 border-b border-black/50 flex items-center justify-center shrink-0">
              <span className="text-[18px] tracking-wider font-black uppercase text-neutral-400 leading-none translate-y-[1px]">
                Tempo
              </span>
            </div>
            {/* Numero perfettamente centrato nello spazio rimanente */}
            <div className="flex-1 flex items-center justify-center pb-1">
              <span className="text-[40px] tracking-wider font-black text-neutral-300 leading-none translate-y-[2px]">
                {player.time || '-'}
              </span>
            </div>
          </div>
          
          {/* BOX PUNTI AGGIORNATO CON FASCIA ANCORATA IN ALTO */}
          <div className="w-28 h-[96px] bg-white/10 rounded-2xl border border-white/5 flex flex-col overflow-hidden shadow-inner shrink-0">
            {/* Fascia scura superiore */}
            <div className="w-full bg-black/40 py-1.5 border-b border-black/50 flex items-center justify-center shrink-0">
              <span className="text-[18px] tracking-wider font-black uppercase text-pink-400 leading-none translate-y-[1px]">
                Punti
              </span>
            </div>
            {/* Numero perfettamente centrato nello spazio rimanente */}
            <div className="flex-1 flex items-center justify-center pb-1">
              <span className="text-[40px] tracking-wider font-black uppercase tracking-tight text-white leading-none translate-x-[2px] translate-y-[2px]">
                {player.score}
              </span>
            </div>
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
      className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-900 to-black p-12 pt-[270px]"
    >
      {/* TITOLO SPOSTATO IN ALTO A DESTRA */}
      <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right">
        <span className="text-pink-500 font-bold uppercase tracking-[0.08em] text-sm mb-1 drop-shadow-md">Leaderboard Qualificazioni</span>
        <h2 className="text-4xl font-black uppercase text-white drop-shadow-lg tracking-wider">
          3-Point Contest <span className="text-pink-500">Top 12</span>
        </h2>
      </div>
      
      <div className="grid grid-cols-2 gap-x-6 w-full max-w-[2000px] mt-4">
        <div className="flex flex-col">{col1.map((player, idx) => renderRow(player, idx, 0))}</div>
        <div className="flex flex-col">{col2.map((player, idx) => renderRow(player, idx, 6))}</div>
      </div>
    </motion.div>
  );
}

function MatchupCard({ title, players, maxPlayers = 2, isFinal = false, highlightedId, championName }) {
  const slots = Array.from({ length: maxPlayers }).map((_, i) => players[i] || null);
  const cardWidth = isFinal ? 'w-[420px]' : 'w-[280px]';
  
  // Match concluso se tutti i giocatori hanno un punteggio
  const isMatchupCompleted = slots.every(s => s !== null && s.score !== null && s.score !== undefined);

  // Calcolo ID del vincitore del round
  let winnerId = null;
  if (isMatchupCompleted && !isFinal) {
    const sortedByScore = [...slots].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const timeA = parseFloat(a.time) || 999;
      const timeB = parseFloat(b.time) || 999;
      return timeA - timeB;
    });
    winnerId = sortedByScore[0].id;
  }

  return (
    <div className={`backdrop-blur-xl border rounded-2xl p-4 flex flex-col gap-2 shadow-2xl bg-white/5 border-white/10 ${cardWidth}`}>
      <div className="text-center text-[20px] font-black uppercase tracking-wider mb-0.5 text-pink-500">
        {title}
      </div>
      
      {slots.map((p, i) => {
        const isHighlighted = p && String(p.id) === String(highlightedId);
        const isChampion = championName && p && p.player_name === championName;
        const isMatchupWinner = !isFinal && isMatchupCompleted && p && p.id === winnerId;

        // 🧠 DEFINIZIONE PRIORITÀ ANIMAZIONI
        let animateObj = {};
        let transitionObj = { duration: 0.5 };

        if (isChampion) {
          // LAMPEGGIO ORO
          animateObj = { 
            backgroundColor: ["rgba(234,179,8,0.1)", "rgba(234,179,8,0.4)", "rgba(234,179,8,0.1)"],
            borderColor: ["rgba(234,179,8,0.4)", "rgba(234,179,8,1)", "rgba(234,179,8,0.4)"],
            scale: [1, 1.03, 1]
          };
          transitionObj = { duration: 1.5, repeat: Infinity };
        } else if (isHighlighted) {
          // LAMPEGGIO ROSA (Regia Live)
          animateObj = { 
            backgroundColor: ["rgba(236,72,153,0.05)", "rgba(236,72,153,0.4)", "rgba(236,72,153,0.05)"],
            borderColor: ["rgba(236,72,153,0.3)", "rgba(236,72,153,1)", "rgba(236,72,153,0.3)"],
            scale: [1, 1.03, 1]
          };
          transitionObj = { duration: 1.5, repeat: Infinity };
        } else if (isMatchupWinner) {
          // AZZURRO VERO CUP FISSO (#92C2E0)
          animateObj = { 
            backgroundColor: "rgba(146, 194, 224, 0.2)", 
            borderColor: "rgba(146, 194, 224, 0.8)",
            boxShadow: "0px 0px 20px rgba(146, 194, 224, 0.3)",
            scale: 1
          };
        } else {
          // STATO DEFAULT
          animateObj = { 
            backgroundColor: "rgba(255, 255, 255, 0.05)", 
            borderColor: "rgba(255, 255, 255, 0.1)",
            boxShadow: "0px 0px 0px rgba(0,0,0,0)",
            scale: 1
          };
        }

        const textColor = isChampion ? 'text-yellow-400 drop-shadow-md' : (p ? 'text-white' : 'text-neutral-500');
        const scoreColor = isChampion ? 'text-yellow-400' : (p && p.score > 0 ? 'text-pink-400' : 'text-neutral-700');
        
        let displayName = 'TBD';
        if (p && p.player_name) {
          displayName = p.player_name;
          if (p.player_name.length > 12) {
            const parts = p.player_name.trim().split(/\s+/);
            if (parts.length > 1) {
              displayName = `${parts[0].charAt(0).toUpperCase()}. ${parts.slice(1).join(' ')}`;
            }
          }
        }

        return (
          <motion.div 
            key={p ? p.id : `empty-${i}`} 
            animate={animateObj} 
            transition={transitionObj} 
            className="flex justify-between items-center px-4 py-3 rounded-xl border relative overflow-hidden"
          >
            <span className={`font-bold uppercase truncate pr-3 flex-1 ${isFinal ? 'text-[30px] tracking-wider' : 'text-[21px] tracking-wider'} ${textColor}`}>
              {displayName}
            </span>
            
          <div className={`flex items-center shrink-0 ${isFinal ? 'gap-3' : 'gap-1.5'}`}>
  
  {/* Box Tempo con larghezza e font dinamici per la finale */}
  <span className={`text-center py-0.5 rounded tracking-wider block tabular-nums border ${isFinal ? 'w-[70px] text-[25px]' : 'w-[55px] text-[20px]'} ${
    p && p.time ? 'text-neutral-400 bg-black/40 border-white/5' : 'text-neutral-800 border-transparent'
  }`}>
    {p && p.time ? `${p.time}s` : '-'}
  </span>
  
  <span className={`text-right font-black tabular-nums block ${isFinal ? 'w-[30px] text-[30px] tracking-wider' : 'w-[21px] text-[21px] tracking-wider'} ${scoreColor}`}>
    {p && p.score !== null ? p.score : '-'}
  </span>
</div>

            {isChampion && (
              <span className="text-[18px] absolute right-[5px] -top-1 drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]">👑</span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function ThreePointBracket({ data, highlightedId }) {
  const getHeatPlayers = (roundName, heatNum) => {
    // Ordine per ID per mantenere le posizioni fisse nelle card
    return data.filter(p => p.round === roundName && p.heat === `Batteria ${heatNum}`).sort((a, b) => a.id - b.id);
  };
  
  const finalePlayers = data.filter(p => p.round === 'Finale').sort((a, b) => a.id - b.id);
  const winnerPlayer = data.find(p => p.round === 'Vincitore');
  
  const QuarterToSemiConnector = () => (
    <div className="flex flex-col items-center w-full pointer-events-none">
      <div className="w-[296px] h-6 border-b-[3px] border-l-[3px] border-r-[3px] border-neutral-700/60 rounded-b-xl"></div>
      <div className="h-6 w-[3px] bg-neutral-700/60"></div>
    </div>
  );

  const SemisToFinaleConnector = () => (
    <div className="flex flex-col items-center w-full pointer-events-none">
      <div className="w-[1216px] h-6 relative">
        <div className="absolute left-0 top-0 w-[3px] h-full bg-neutral-700/60"></div>
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[3px] h-full bg-neutral-700/60"></div>
        <div className="absolute right-0 top-0 w-[3px] h-full bg-neutral-700/60"></div>
      </div>
      <div className="w-[1216px] h-[3px] bg-neutral-700/60 rounded-full"></div>
      <div className="h-6 w-[4px] bg-neutral-700/60"></div>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      exit={{ opacity: 0, scale: 1.05 }} 
      className="absolute inset-0 w-[1920px] h-[1080px] flex flex-col items-center justify-start bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-900 to-black pt-[180px] overflow-hidden"
    >
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>

      {/* TITOLO SPOSTATO IN ALTO A DESTRA */}
      <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right">
        <span className="text-pink-500 font-bold uppercase tracking-[0.08em] text-sm mb-1 drop-shadow-md">3-Point Contest</span>
        <h2 className="text-4xl font-black uppercase text-white drop-shadow-lg tracking-wider">
          Playoff Bracket
        </h2>
      </div>
      
      <div className="flex flex-col items-center w-full z-10 relative mt-4 max-w-[1850px] mx-auto">
        <div className="flex gap-8">
          <div className="flex flex-col items-center shrink-0">
            <div className="flex gap-4">
              <MatchupCard title="Quarto 1" players={getHeatPlayers('Quarti di finale', 1)} highlightedId={highlightedId} />
              <MatchupCard title="Quarto 2" players={getHeatPlayers('Quarti di finale', 2)} highlightedId={highlightedId} />
            </div>
            <QuarterToSemiConnector />
            <MatchupCard title="Semifinale 1" players={getHeatPlayers('Semifinale', 1)} highlightedId={highlightedId} />
          </div>

          <div className="flex flex-col items-center shrink-0">
            <div className="flex gap-4">
              <MatchupCard title="Quarto 3" players={getHeatPlayers('Quarti di finale', 3)} highlightedId={highlightedId} />
              <MatchupCard title="Quarto 4" players={getHeatPlayers('Quarti di finale', 4)} highlightedId={highlightedId} />
            </div>
            <QuarterToSemiConnector />
            <MatchupCard title="Semifinale 2" players={getHeatPlayers('Semifinale', 2)} highlightedId={highlightedId} />
          </div>

          <div className="flex flex-col items-center shrink-0">
            <div className="flex gap-4">
              <MatchupCard title="Quarto 5" players={getHeatPlayers('Quarti di finale', 5)} highlightedId={highlightedId} />
              <MatchupCard title="Quarto 6" players={getHeatPlayers('Quarti di finale', 6)} highlightedId={highlightedId} />
            </div>
            <QuarterToSemiConnector />
            <MatchupCard title="Semifinale 3" players={getHeatPlayers('Semifinale', 3)} highlightedId={highlightedId} />
          </div>
        </div>
        
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
        <span className="absolute top-1.5 left-2 text-[24px] font-black text-pink-500 opacity-100">
          #{pickNum}
        </span>
        
        <div className="w-full text-center mt-2.5">
           <span className="text-[30px] font-black text-white uppercase tracking-wider block drop-shadow-md truncate px-1">
             {teamName}
           </span>
        </div>

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

      <motion.div variants={containerVars} className="flex gap-5 w-full max-w-[1880px] mx-auto z-10 justify-center h-[981px] pt-[250px] pb-4 px-6">
        {teams.map(team => {
          const teamPicks = picks.filter(p => p.team_edition_event_id === team.id).sort((a,b) => a.pick_number - b.pick_number);

          return (
            <motion.div key={team.id} variants={itemVars} className="flex-1 bg-white/5 backdrop-blur-xl border border-neutral-800 rounded-3xl px-3 pb-3 pt-3 shadow-2xl flex flex-col min-w-0">
              
              <h3 className="text-center text-[28px] font-black uppercase text-white tracking-widest mb-2 border-b border-neutral-700 pb-1 truncate drop-shadow-md">
                {team.teams?.name}
              </h3>

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
              
              <div className="flex flex-col gap-1 flex-1 min-h-0">
                {Array.from({ length: 10 }).map((_, i) => {
                  const pick = teamPicks[i];
                  const isFilled = pick && pick.player_id;

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

              <div className="flex flex-col gap-1 [perspective:1000px] flex-1 min-h-0">
                {Array.from({ length: 10 }).map((_, i) => {
                  const pick = teamPicks[i];
                  const isFilled = pick && pick.player_id;
                  const isLatest = isFilled && pick.id === latestPickId;

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
                          <span className="font-bold text-white uppercase text-[24px] truncate block leading-tight">
                            {displayLast} <span className="font-normal text-[18px] text-pink-500 ml-1">{displayFirst}</span>
                          </span>
                        ) : (
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

      <div className="shrink-0 w-full px-6 pb-6 z-10 h-[140px] mb-4 mt-2">
        <div className="w-full h-full bg-black/60 backdrop-blur-2xl border border-neutral-800 rounded-3xl shadow-2xl flex overflow-hidden">
          
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

          <div className="w-2/3 flex flex-col justify-center px-6 relative">
            
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

  const fullName = `${firstName} ${lastName}`.trim();
  const letters = fullName.split("");

  const containerVars = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08, 
        delayChildren: 0.8,    
      }
    }
  };

  const letterVars = {
    hidden: { opacity: 0, scale: 0.8, filter: "blur(4px)" }, 
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
            <motion.h1 
              variants={containerVars}
              initial="hidden"
              animate="visible"
              className="text-[170px] leading-none font-black text-white uppercase tracking-[0.08em] drop-shadow-2xl text-balance px-10 relative z-10 whitespace-pre-wrap"
            >
              {letters.map((char, index) => (
                <motion.span key={index} variants={letterVars} className="inline-block">
                  {char === " " ? "\u00A0" : char}
                </motion.span>
              ))}
            </motion.h1>

            <motion.div
              initial={{ scale: 4, opacity: 0, rotate: -30 }}
              animate={{ scale: 1, opacity: 0.9, rotate: -15 }}
              transition={{ 
                type: "spring", 
                stiffness: 1000, 
                damping: 30, 
                delay: 2.8, 
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
  
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    if (activePayload && activePayload.team_name) {
      setLockedPayload(activePayload);
      setTimeLeft(60);
    }
  }, [activePayload]);

  useEffect(() => {
    if (timeLeft <= 0) return; 
    
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    
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

      <div className="flex flex-col items-center justify-center text-center z-10 w-full h-full pt-[90px]">
        
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

        <h2 className="text-[170px] leading-none font-black text-white uppercase tracking-[0.08em] drop-shadow-2xl mb-10 text-balance px-10">
          {teamName}
        </h2>
        
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
  const groupedPlayers = players.reduce((acc, p) => {
    const r = p.role ? p.role.toUpperCase() : 'ALTRO';
    if (!acc[r]) acc[r] = [];
    acc[r].push(p);
    return acc;
  }, {});

  const roleOrder = ['PLAYMAKER', 'GUARDIA', 'ALA PICCOLA', 'ALA GRANDE', 'CENTRO'];
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
              
              <h3 className="text-center text-[28px] font-black uppercase text-white tracking-widest mb-3 border-b border-neutral-700 pb-2.5 shrink-0 truncate drop-shadow-md">
                {role}
              </h3>
              
              <div className="flex flex-col gap-1.5 flex-1 min-h-0">
                {Array.from({ length: 14 }).map((_, i) => {
                  const p = playersInRole[i];
                  const isFilled = !!p;
                  const isPicked = isFilled ? picks.some(pick => pick.player_id === p.id) : false;

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
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>
      
      <div className="absolute w-[1000px] h-[1000px] bg-pink-500/10 blur-[180px] rounded-full pointer-events-none mix-blend-screen"></div>

      <div className="flex flex-col items-center text-center w-full max-w-[1800px] px-12 z-10">

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
// GRAFICA RECAP GIRONE & CLASSIFICA
// ==========================================
function RecapGironeGraphic({ matches, teamsEditionEvents, calendar }) {
  
  const validTeams = teamsEditionEvents.filter(tee => 
    tee.event_id === 1 && 
    tee.group_name && 
    tee.group_name.trim() !== ''
  );

  const groups = validTeams.reduce((acc, tee) => {
    if (!acc[tee.group_name]) acc[tee.group_name] = [];
    acc[tee.group_name].push(tee);
    return acc;
  }, {});

  const validTeamIds = validTeams.map(t => t.id);

  const groupMatches = matches.filter(m => 
    m.match_type_id === 1 && 
    (validTeamIds.includes(m.team_a_id) || validTeamIds.includes(m.team_b_id))
  );

  const getMatchScheduleString = (matchId) => {
    const cal = calendar.find(c => c.match_id === matchId);
    if (!cal) return "DATA TBD";
    
    const time = cal.time ? cal.time.substring(0, 5) : "TBD";
    if (!cal.date) return time;

    const dateObj = new Date(cal.date);
    const dateStr = dateObj.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }).toUpperCase();
    return `${dateStr} • ${time}`;
  };

  const calculateStandings = (teamsInGroup) => {
    let standings = teamsInGroup.map(tee => {
      return { 
        ...tee, 
        pt: 0, w: 0, l: 0, pf: 0, ps: 0, 
        teamName: tee.teams?.name || "Squadra Sconosciuta" 
      };
    });

    groupMatches.forEach(m => {
      if (m.status !== 'finished') return; 
      
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
          m.status === 'finished' &&
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
          if (m.status === 'finished' && tiedTeams.find(t => t.id === m.team_a_id) && tiedTeams.find(t => t.id === m.team_b_id)) {
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

      {/* TITOLO SPOSTATO IN ALTO A DESTRA */}
      <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right">
        <span className="text-pink-500 font-bold uppercase tracking-[0.08em] text-sm mb-1 drop-shadow-md">VERO Cup 2026</span>
        <h2 className="text-4xl font-black uppercase text-white drop-shadow-lg tracking-wider">
          Classifica Gironi
        </h2>
      </div>

      <div className="flex justify-center items-start gap-16 w-full max-w-[1800px] mx-auto h-full pt-[220px] px-8 z-10">
        
        {Object.keys(groups).sort().map(groupName => {
          const teamsInThisGroup = groups[groupName];
          const standings = calculateStandings(teamsInThisGroup);
          
          const matchesInThisGroup = groupMatches.filter(m => {
            return teamsInThisGroup.some(t => t.id === m.team_a_id);
          });
          
          return (
            <div key={groupName} className="flex-1 flex flex-col gap-5 max-w-[800px]">
              
              <h3 className="text-5xl font-black uppercase text-pink-500 tracking-widest text-center drop-shadow-lg mb-1">
                Girone {groupName}
              </h3>

              <div className="flex flex-col gap-3 h-full">
                {Array.from({ length: 3 }).map((_, index) => {
                  const m = matchesInThisGroup[index];

                  if (m) {
                    const tA = teamsInThisGroup.find(t => t.id === m.team_a_id)?.teams?.name || "TBD";
                    const tB = teamsInThisGroup.find(t => t.id === m.team_b_id)?.teams?.name || "TBD";
                    const isLive = m.status === 'live';
                    const isConclusa = m.status === 'finished';

                    const aWon = isConclusa && m.score_a > m.score_b;
                    const bWon = isConclusa && m.score_b > m.score_a;

                    return (
                      <div key={m.id} className={`relative flex items-center justify-between rounded-2xl px-6 h-[90px] shadow-lg overflow-hidden border ${isLive ? 'bg-red-950/40 border-red-500/50' : 'bg-black/50 border-neutral-800'}`}>
                        {isLive && (
                          <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-transparent to-red-500/10 animate-pulse pointer-events-none"></div>
                        )}

                        <div className={`flex-1 text-right z-10 h-full flex items-center justify-end px-4 transition-opacity ${isConclusa && !aWon ? 'opacity-40' : 'opacity-100'}`}>
                          <span className="text-[24px] font-black text-white uppercase tracking-wider truncate drop-shadow-sm">{tA}</span>
                        </div>
                        
                        <div className="w-44 shrink-0 flex flex-col items-center justify-center h-full z-10 mx-4">
                          
                          <div className="h-4 flex items-center justify-center mb-1">
                            {isLive && (
                              <span className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1.5 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>LIVE
                              </span>
                            )}
                            {isConclusa && <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">FINALE</span>}
                            {!isLive && !isConclusa && <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">IN PROGRAMMA</span>}
                          </div>
                          
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

                        <div className={`flex-1 text-left z-10 h-full flex items-center justify-start px-4 transition-opacity ${isConclusa && !bWon ? 'opacity-40' : 'opacity-100'}`}>
                          <span className="text-[24px] font-black text-white uppercase tracking-wider truncate drop-shadow-sm">{tB}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={`empty-${index}`} className="flex items-center justify-center bg-white/5 border border-dashed border-neutral-700/50 rounded-2xl px-6 h-[90px] shadow-inner opacity-50">
                      <span className="text-neutral-500 font-bold uppercase tracking-widest text-[13px]">
                        Slot Partita {index + 1} da definire
                      </span>
                    </div>
                  );
                })}
              </div>

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
// GRAFICA QUADRO PLAYOFF
// ==========================================
function QuadroPlayoffGraphic({ matches, teamsEditionEvents, calendar }) {
  
  const getTeamName = (id) => teamsEditionEvents.find(t => t.id === id)?.teams?.name || "TBD";
  
  const getMatchDate = (matchId) => {
    const cal = calendar.find(c => c.match_id === matchId);
    if (!cal) return "DATA TBD";
    
    const time = cal.time ? cal.time.substring(0, 5) : "";
    if (!cal.date) return time;

    const dateObj = new Date(cal.date);
    const dateStr = dateObj.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }).toUpperCase();
    return `${dateStr} • ${time}`;
  };

  const semiFinals = matches.filter(m => m.match_type_id === 2);
  const finale = matches.find(m => m.match_type_id === 3);

  const MatchBox = ({ match, title, isFinal = false }) => {
    const scoreA = match?.score_a ?? "-";
    const scoreB = match?.score_b ?? "-";
    const teamA = match ? getTeamName(match.team_a_id) : "TBD";
    const teamB = match ? getTeamName(match.team_b_id) : "TBD";
    
    const isConclusa = match?.status === 'conclusa';
    const statusText = isConclusa ? 'FINALE' : (match ? getMatchDate(match.id) : "IN PROGRAMMA");

    const boxWidth = isFinal ? 'w-[600px]' : 'w-[500px]';
    const boxHeight = isFinal ? 'h-[280px]' : 'h-[240px]';
    const titleSize = isFinal ? 'text-[18px] py-3' : 'text-[16px] py-2.5';
    const teamTextSize = isFinal ? 'text-2xl' : 'text-xl';
    const scoreSize = isFinal ? 'text-4xl' : 'text-3xl';

    return (
      <div className={`${boxWidth} ${boxHeight} bg-neutral-900/95 border rounded-2xl shadow-2xl flex flex-col relative z-10 ${isFinal ? 'border-pink-500/50 shadow-[0_0_40px_rgba(236,72,153,0.2)]' : 'border-neutral-800'}`}>
        
        <div className={`${isFinal ? 'bg-pink-600' : 'bg-neutral-800'} text-white text-center font-black uppercase tracking-[0.2em] ${titleSize} rounded-t-2xl shrink-0`}>
          {title}
        </div>
        
        <div className={`p-5 flex flex-col gap-3 flex-1 justify-center ${isFinal ? '-mt-4' : '-mt-2'}`}>
          <div className={`flex justify-between items-center bg-black/50 px-5 py-4 rounded-xl border border-neutral-800/60 shadow-inner`}>
            <span className={`font-bold text-white uppercase truncate mr-4 ${teamTextSize}`}>{teamA}</span>
            <span className={`font-black text-neutral-300 shrink-0 ${scoreSize}`}>{scoreA}</span>
          </div>
          
          <div className={`flex justify-between items-center bg-black/50 px-5 py-4 rounded-xl border border-neutral-800/60 shadow-inner`}>
            <span className={`font-bold text-white uppercase truncate mr-4 ${teamTextSize}`}>{teamB}</span>
            <span className={`font-black text-neutral-300 shrink-0 ${scoreSize}`}>{scoreB}</span>
          </div>
        </div>

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
      
      {/* TITOLO SPOSTATO IN ALTO A DESTRA */}
      <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right">
        <span className="text-pink-500 font-bold uppercase tracking-[0.08em] text-sm mb-1 drop-shadow-md">VERO Cup 2026</span>
        <h2 className="text-4xl font-black uppercase text-white drop-shadow-lg tracking-wider">
          Playoff Bracket
        </h2>
      </div>

      <div className="flex items-center justify-center w-full h-full pt-[100px] z-10 relative">
        
        <div className="flex flex-col gap-[100px] relative z-10">
          <MatchBox match={semiFinals[0]} title="Semifinale 1" />
          <MatchBox match={semiFinals[1]} title="Semifinale 2" />
        </div>

        <div className="flex items-center relative z-0 -ml-2 -mr-2">
           <div className="w-20 h-[340px] border-t-[4px] border-b-[4px] border-r-[4px] border-neutral-700/80 rounded-r-3xl"></div>
           <div className="w-24 h-[4px] bg-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.8)]"></div>
        </div>

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

      {/* TITOLO SPOSTATO IN ALTO A DESTRA CON STILE LIVE DRAFT */}
      <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right">
        <span className="text-pink-500 font-bold uppercase tracking-[0.08em] text-sm mb-1 drop-shadow-md">VERO Cup 2026</span>
        <h2 className="text-4xl font-black uppercase text-white drop-shadow-lg tracking-wider">
          Top 10 Marcatori
        </h2>
      </div>

      <div className="flex w-full h-full max-w-[1800px] mx-auto pt-[200px] pb-12 gap-16 z-10 px-8">
        
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

        {/* BOX DESTRA: Padding verticale compattato (py-6 invece di p-8) per recuperare spazio */}
        <div className="flex-1 flex flex-col h-full bg-neutral-900/90 border border-neutral-800 rounded-[3rem] px-8 py-6 shadow-2xl">
          
          {/* Header colonna allargato con w originali */}
          <div className="flex text-neutral-400 font-bold uppercase text-[14px] tracking-widest px-6 pb-3 border-b border-neutral-800 shrink-0">
            <div className="w-20">Pos</div>
            <div className="flex-1">Giocatore</div>
            <div className="w-32 text-center">Partite</div>
            <div className="w-32 text-center">Media</div>
            <div className="w-32 text-right text-pink-500">Punti</div>
          </div>
          
          {/* gap molto ridotto (6px) per incollare le box */}
          <div className="flex flex-col gap-[6px] mt-3 flex-1">
            {others.map((p, i) => (
              <div key={p.id} className="flex items-center bg-black/40 border border-neutral-800/80 rounded-2xl px-6 py-3.5 shadow-sm">
                
                {/* 🚀 FONT GIGANTI RIPRISTINATI */}
                <div className="w-20 text-4xl font-black text-neutral-600 leading-none">#{i + 2}</div>
                <div className="flex-1 flex items-baseline gap-3 truncate min-w-0 pr-4">
                  <span className="text-[40px] tracking-wider font-black text-white uppercase truncate leading-none">{p.last_name}</span>
                  <span className="text-[32px] tracking-wider font-bold text-neutral-400 uppercase truncate leading-none">{p.first_name}</span>
                </div>
                <div className="w-32 text-center tracking-wider text-2xl font-bold text-neutral-500 leading-none">{p.games}</div>
                <div className="w-32 text-center tracking-wider text-2xl font-black text-neutral-300 leading-none">{p.avgPoints}</div>
                <div className="w-32 text-right tracking-wider text-[47px] font-black text-pink-500 drop-shadow-md leading-none">{p.totalPoints}</div>
              </div>
            ))}
            
            {Array.from({ length: Math.max(0, 9 - others.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center bg-white/5 border border-dashed border-neutral-800/50 rounded-2xl px-6 py-3.5 opacity-40 flex-1 min-h-[60px]">
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
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>

      <AnimatePresence mode="wait">
        
        {activeVote ? (
          <motion.div 
            key="votes-screen"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md"
          >
            {/* TITOLO SPOSTATO IN ALTO A DESTRA */}
            <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right">
              <span className="text-pink-500 font-bold uppercase tracking-[0.08em] text-sm mb-1 drop-shadow-md">Voti Giuria</span>
              <motion.h2 
                initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                className="text-4xl font-black uppercase text-white drop-shadow-lg tracking-wider"
              >
                {activeVote.playerName}
              </motion.h2>
              <motion.h3 
                initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.1 }}
                className="text-xl font-bold uppercase text-neutral-400 tracking-wider mt-1"
              >
                Dunk {activeVote.dunkNumber}
              </motion.h3>
            </div>

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
            {/* TITOLO SPOSTATO IN ALTO A DESTRA */}
            <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right">
              <span className="text-pink-500 font-bold uppercase tracking-[0.08em] text-sm mb-1 drop-shadow-md">VERO Cup 2026</span>
              <h2 className="text-4xl font-black uppercase text-white drop-shadow-lg tracking-wider">
                Slam Dunk Contest
              </h2>
              <h3 className="text-xl font-bold uppercase text-neutral-400 tracking-wider mt-1">{round}</h3>
            </div>

            {/* CONTENITORE GRIGLIA: Allargato il max-w, ridotto il gap a 6 (gap-6 invece di gap-12) */}
            <div className="flex w-full h-full max-w-[1850px] mx-auto pt-[200px] pb-16 items-center justify-center gap-6 px-8">
              {players.map((player, idx) => {
                const isWinner = winner === player.player_name;
                const totalScore = (player.dunk_1 || 0) + (player.dunk_2 || 0);
                const isPlayerUpdated = player.player_name === lastUpdatedPlayer; 
                
                const nameParts = player.player_name ? player.player_name.split(' ') : [''];
                const firstName = nameParts.slice(0, -1).join(' ');
                const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : player.player_name;

                return (
                  <React.Fragment key={player.player_name + idx}>
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.5, delay: idx * 0.1 }}
                      // CARD: Aggiunto flex-1 e h-full per occupare tutto lo spazio. Bordo grigio visibile (border-neutral-500)
                      className={`relative flex flex-col items-center p-8 transition-all ${
                        isFinal ? 'w-[700px] h-full max-h-[850px]' : 'flex-1 max-w-[450px] h-full max-h-[850px]'
                      } ${
                        isWinner 
                          ? 'bg-gradient-to-br from-yellow-500/10 via-black/80 to-yellow-900/40 border-[3px] border-yellow-500/80 rounded-[3rem] shadow-[0_0_80px_rgba(234,179,8,0.2)]' 
                          : 'bg-neutral-900/90 border-2 border-neutral-700 rounded-[1.5rem] shadow-2xl'
                      }`}
                    >
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
                        {firstName && <span className={`font-bold uppercase tracking-wider ${isFinal ? 'text-3xl' : 'text-[40px]'} ${isWinner ? 'text-yellow-400' : 'text-neutral-400'} mb-2`}>{firstName}</span>}
                        <span className={`font-black text-white uppercase tracking-wider leading-none drop-shadow-lg truncate w-full px-4 ${isFinal ? 'text-7xl' : 'text-[70px]'}`}>{lastName}</span>
                      </div>

                      <div className="flex-1 flex items-center justify-center w-full my-6 relative z-40">
                        {/* CERCHIO PUNTEGGIO: Ingrandito leggermente, bordo più chiaro (border-neutral-600) */}
                        <div className={`relative flex flex-col items-center justify-center rounded-full border-4 ${
                          isWinner ? 'border-yellow-400/50 bg-yellow-900/30 shadow-[0_0_60px_rgba(234,179,8,0.3)]' : 'border-neutral-700 bg-black/80 shadow-inner'
                          } ${isFinal ? 'w-[280px] h-[280px]' : 'w-[300px] h-[300px]'} transition-all duration-500`}
                        >
                          {/* LABEL E PUNTEGGIO IN ROSA */}
                          <span className={`absolute ${isFinal ? 'top-12' : 'top-10'} text-[25px] font-bold ${isWinner ? 'text-yellow-500' : 'text-neutral-400'} uppercase tracking-wider`}>Score</span>
                          <span className={`font-black leading-none mt-4 ${isFinal ? 'text-[110px]' : 'text-[130px]'} ${
                            isWinner ? 'text-yellow-400 drop-shadow-[0_0_30px_rgba(234,179,8,0.6)]' : (totalScore > 0 ? 'text-pink-500' : 'text-neutral-700')
                          }`}>
                            {totalScore > 0 ? totalScore : '-'}
                          </span>
                        </div>
                      </div>

                      <div className="w-full flex gap-4 mt-auto relative z-40">
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

                    {/* ⚔️ IL VS GIGANTE IN FINALE */}
                    {isFinal && idx === 0 && (
                      <motion.div 
                        initial={{ scale: 0, opacity: 0 }} 
                        animate={{ scale: 1, opacity: 1 }} 
                        transition={{ delay: 0.6, type: "spring", stiffness: 200, damping: 15 }}
                        className="flex items-center justify-center shrink-0 z-0 px-12"
                      >
                        <span className="text-[180px] translate-x-[8px] font-black text-white uppercase tracking-wider">
                          VS
                        </span>
                      </motion.div>
                    )}

                  </React.Fragment>
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
    <div className={`flex-1 flex flex-col items-center rounded-3xl px-6 pt-6 pb-2 relative overflow-hidden ${isWinner ? 'bg-black/40 border border-yellow-500/20' : 'bg-black/60 border border-neutral-700'}`}>
      
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

      <span className="text-[20px] font-bold text-neutral-400 uppercase tracking-wider mb-0 relative z-10 drop-shadow-md">{label}</span>
      <span className={`text-[70px] font-black translate-y-[-4px] relative z-10 drop-shadow-md ${isWinner ? 'text-yellow-400' : 'text-white'}`}>
        {score !== null && score !== undefined && score !== 0 ? score : '-'}
      </span>
    </div>
  );
}

// ==========================================
// COMPONENTE: MVP TITLE (ESPLOSIVO E VIBRANTE)
// ==========================================
function MvpTitleGraphic({ payload }) {
  // Legge correttamente payload.name inviato dal tuo ObsController
  const playerName = payload?.name || payload?.player_name || payload?.text || '';
  
  // Stato per gestire la sequenza: prima vibra MVP (false), poi esplode il nome (true)
  const [showName, setShowName] = useState(false);

  useEffect(() => {
    // 3.5 secondi di suspense con vibrazione, poi scatta l'esplosione
    const timer = setTimeout(() => {
      setShowName(true);
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      transition={{ duration: 0.5 }} 
      className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-pink-950 via-neutral-950 to-black overflow-hidden"
    >
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-screen pointer-events-none"></div>

      {/* Bagliore Rosa di sfondo */}
      <div className="absolute w-[1200px] h-[1200px] bg-pink-500/20 blur-[200px] rounded-full pointer-events-none mix-blend-screen z-0"></div>

      <AnimatePresence>
        {!showName && (
          <motion.div 
            key="mvp-text"
            // Animazione di uscita: l'MVP schizza in avanti e sparisce sfocato
            exit={{ scale: 4, opacity: 0, filter: "blur(20px)" }}
            transition={{ duration: 0.6, ease: "easeIn" }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none"
          >
            <motion.div 
              // Effetto terremoto ignorante
              animate={{ 
                x: [-10, 10, -10, 10, -5, 5, 0], 
                y: [-5, 5, -5, 5, -2, 2, 0] 
              }} 
              transition={{ duration: 0.1, repeat: Infinity, ease: "linear" }}
              className="text-[500px] leading-none font-black text-pink-500 drop-shadow-[0_0_80px_rgba(236,72,153,0.8)] tracking-[0.05em]"
            >
              MVP
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showName && (
          <motion.div
            key="player-name"
            className="absolute inset-0 flex flex-col items-center justify-center z-20 px-12"
          >
            {/* NOME DEL GIOCATORE CHE ESPLODE */}
            <motion.h1 
              initial={{ scale: 0, opacity: 0, rotateZ: -15, filter: "blur(20px)" }}
              animate={{ scale: 1, opacity: 1, rotateZ: 0, filter: "blur(0px)" }}
              transition={{ type: "spring", stiffness: 100, damping: 12 }}
              className="text-[250px] leading-[0.85] font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-b from-white via-neutral-200 to-neutral-500 drop-shadow-[0_20px_50px_rgba(0,0,0,1)] text-center w-full"
              style={{ textWrap: 'balance' }} 
            >
              {playerName}
            </motion.h1>

            {/* TARGHETTA FINALE CHE POPPA SUBITO DOPO */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.5 }}
              className="mt-14 bg-pink-500 text-white font-black uppercase tracking-[0.4em] px-12 py-4 rounded-[2rem] text-4xl shadow-[0_0_40px_rgba(236,72,153,0.6)] border-4 border-pink-300"
            >
              Most Valuable Player
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
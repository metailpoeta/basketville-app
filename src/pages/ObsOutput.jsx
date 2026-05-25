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

  const [threePointData, setThreePointData] = useState([]);
  const [highlightedPlayerId, setHighlightedPlayerId] = useState(null);
  const [dailyScheduleData, setDailyScheduleData] = useState([]);
  const [dailyScheduleDate, setDailyScheduleDate] = useState('');
  const [matchData, setMatchData] = useState(null);
  const [draftPicks, setDraftPicks] = useState([]);
  const [draftTeams, setDraftTeams] = useState([]);
  const [eligiblePlayers, setEligiblePlayers] = useState([]);

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
        team_a:team_a_id(team_id, coach, assistant_coach, group_name, teams(name, short_name)),
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

    return () => {
      if (liveChannel) supabase.removeChannel(liveChannel);
    };
  }, [broadcastState.active_graphic, broadcastState.payload.match_id, broadcastState.payload.date]);

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


  return (
    <div className="w-[1920px] h-[1080px] overflow-hidden bg-neutral-950 relative font-dimbo text-white origin-top-left">
      
      {/* ========================================= */}
      {/* OVERLAY LOGO CENTRALE UNICO (Z-50) */}
      {/* ========================================= */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50">
        <img 
          src="Basketville_logo26_vero.png" 
          alt="Basketville 2026" 
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
        <span className="text-3xl font-black text-neutral-300 uppercase tracking-[0.4em] drop-shadow-lg">
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
          <div className="mt-14 flex items-center gap-3 text-red-500 font-black tracking-[0.4em] uppercase animate-pulse">
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
        <span className="text-3xl font-black text-neutral-300 uppercase tracking-[0.4em] drop-shadow-lg">
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
        <h2 className="text-4xl font-black uppercase tracking-[0.4em] text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.8)]">
          3-Point Champion
        </h2>
      </div>
      
      <div className="flex flex-col items-center text-center w-full max-w-6xl px-12 z-10 pt-[200px]">
        <h1 className="text-[140px] leading-none font-black uppercase tracking-tighter mb-16 text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-yellow-400 to-yellow-600 drop-shadow-2xl">
          {payload.player_name}
        </h1>
        
        <div className="flex items-center gap-12 w-full justify-center">
          <div className="bg-yellow-500/10 backdrop-blur-xl px-16 py-8 rounded-[3rem] border border-yellow-500/40 w-[500px] shadow-[0_0_80px_rgba(234,179,8,0.2)]">
            <span className="text-2xl font-bold text-yellow-200 uppercase tracking-[0.4em] block mb-4">
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

function MatchupCard({ title, players, maxPlayers = 2, isFinal = false, highlightedId }) {
  const slots = Array.from({ length: maxPlayers }).map((_, i) => players[i] || null);
  const cardWidth = isFinal ? 'w-[420px]' : 'w-[280px]';
  
  return (
    <div className={`backdrop-blur-xl border rounded-2xl p-4 flex flex-col gap-2 shadow-2xl bg-white/5 border-white/10 ${cardWidth}`}>
      <div className="text-center text-[11px] font-black uppercase tracking-widest mb-0.5 text-pink-500">
        {title}
      </div>
      
      {slots.map((p, i) => {
        const isHighlighted = p && String(p.id) === String(highlightedId);
        return (
          <motion.div 
            key={p ? p.id : `empty-${i}`} 
            animate={{ 
              backgroundColor: isHighlighted ? ['rgba(255, 255, 255, 0.05)', 'rgba(236, 72, 153, 0.4)', 'rgba(255, 255, 255, 0.05)'] : 'rgba(255, 255, 255, 0.05)', 
              borderColor: isHighlighted ? ['rgba(255, 255, 255, 0.05)', 'rgba(236, 72, 153, 0.8)', 'rgba(255, 255, 255, 0.05)'] : 'rgba(255, 255, 255, 0.05)', 
              scale: isHighlighted ? [1, 1.05, 1] : 1 
            }} 
            transition={{ duration: 1.2, repeat: isHighlighted ? 4 : 0 }} 
            className="flex justify-between items-center px-4 py-3 rounded-xl border"
          >
            <span className={`font-bold truncate pr-3 flex-1 ${isFinal ? 'text-xl' : 'text-base'} ${p ? 'text-white' : 'text-neutral-500'}`}>
              {p ? p.player_name : 'TBD'}
            </span>
            
            <div className="flex items-center gap-3 shrink-0">
              {p && p.time && (
                <span className="text-[10px] text-neutral-400 bg-black/40 px-1.5 py-0.5 rounded font-mono border border-white/5">
                  {p.time}s
                </span>
              )}
              <span className={`font-black ${isFinal ? 'text-2xl' : 'text-xl'} ${p && p.score > 0 ? 'text-pink-400' : 'text-neutral-700'}`}>
                {p && p.score !== null ? p.score : '-'}
              </span>
            </div>
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
          3-Point Contest <span className="text-pink-500">Playoff</span>
        </h2>
        <p className="text-sm text-neutral-400 font-bold uppercase tracking-[0.3em] mt-1">
          Tabellone Finale
        </p>
      </div>
      
      <div className="flex flex-col items-center gap-6 w-full mt-4">
        <div className="flex justify-center gap-4 w-full">
          {[1, 2, 3, 4, 5, 6].map(num => (
            <MatchupCard key={`q${num}`} title={`Quarto ${num}`} players={getHeatPlayers('Quarti di finale', num)} highlightedId={highlightedId} />
          ))}
        </div>
        
        <div className="flex justify-center gap-12 w-full mt-2">
          {[1, 2, 3].map(num => (
            <MatchupCard key={`s${num}`} title={`Semifinale ${num}`} players={getHeatPlayers('Semifinale', num)} highlightedId={highlightedId} />
          ))}
        </div>
        
        <div className="flex justify-center w-full mt-2">
          <MatchupCard title="La Finale" players={finalePlayers} maxPlayers={3} isFinal={true} highlightedId={highlightedId} />
        </div>
      </div>
      
      {winnerPlayer && (
        <motion.div 
          initial={{ opacity: 0, x: 50, scale: 0.9 }} 
          animate={{ opacity: 1, x: 0, scale: 1 }} 
          transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.3 }} 
          className="absolute bottom-16 right-16 w-[420px] bg-gradient-to-b from-yellow-500/20 to-yellow-900/40 border border-yellow-500/50 rounded-3xl p-6 shadow-[0_0_50px_rgba(234,179,8,0.2)] backdrop-blur-xl flex flex-col items-center border-b-4 border-b-yellow-500"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-3xl drop-shadow-[0_0_15px_rgba(234,179,8,0.8)]">👑</span>
            <span className="text-[13px] font-black uppercase tracking-widest text-yellow-400 drop-shadow-md">Campione Assoluto</span>
          </div>
          <h3 className="text-[34px] font-black text-white text-center leading-tight mb-6 drop-shadow-lg uppercase">
            {winnerPlayer.player_name}
          </h3>
          <div className="flex items-center justify-center gap-4 w-full">
             <div className="flex flex-col items-center bg-black/50 px-6 py-4 rounded-2xl border border-yellow-500/30 flex-1 shadow-inner">
               <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Final Score</span>
               <span className="text-5xl font-black text-yellow-400 drop-shadow-[0_0_10px_rgba(234,179,8,0.6)]">{winnerPlayer.score || 0}</span>
             </div>
             <div className="flex flex-col items-center bg-black/50 px-6 py-4 rounded-2xl border border-white/10 flex-1 shadow-inner">
               <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Final Time</span>
               <span className="text-3xl font-bold text-neutral-200 mt-2">{winnerPlayer.time || '0.0'}s</span>
             </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function SlamDunkGraphic({ payload }) {
  const dunk1 = parseInt(payload.dunk_1) || 0;
  const dunk2 = parseInt(payload.dunk_2) || 0;
  const total = dunk1 + dunk2;
  
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
        <h2 className="text-4xl font-black uppercase tracking-[0.3em] text-pink-500 drop-shadow-md">
          Slam Dunk Contest
        </h2>
      </div>

      <div className="flex flex-col items-center text-center w-full max-w-6xl px-12 pt-[200px]">
        <h1 className="text-[100px] leading-none font-black uppercase tracking-tighter mb-14 drop-shadow-2xl">
          {payload.player_name}
        </h1>
        
        <div className="flex items-center gap-8 w-full justify-center">
          <div className="bg-white/5 backdrop-blur-xl px-10 py-8 rounded-[2.5rem] border border-white/10 w-[340px] shadow-2xl">
            <span className="text-lg font-bold text-neutral-400 uppercase tracking-[0.3em] block mb-2">Dunk 1</span>
            <span className="text-[110px] leading-none font-black text-neutral-200">{dunk1}</span>
          </div>
          <div className="bg-white/5 backdrop-blur-xl px-10 py-8 rounded-[2.5rem] border border-white/10 w-[340px] shadow-2xl">
            <span className="text-lg font-bold text-neutral-400 uppercase tracking-[0.3em] block mb-2">Dunk 2</span>
            <span className="text-[110px] leading-none font-black text-neutral-200">{dunk2}</span>
          </div>
          <div className="bg-pink-500/10 backdrop-blur-xl px-10 py-8 rounded-[2.5rem] border border-pink-500/30 w-[340px] relative overflow-hidden shadow-[0_0_50px_rgba(236,72,153,0.15)]">
            <span className="text-lg font-bold text-pink-300 uppercase tracking-[0.3em] block mb-2">Totale</span>
            <span className="text-[110px] leading-none font-black text-white drop-shadow-[0_0_25px_rgba(236,72,153,0.8)]">{total}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ==========================================
// COMPONENTI GRAFICI DRAFT E SVELAMENTO
// ==========================================

function DraftRoundRevealGraphic({ picks, round }) {
  const roundPicks = picks.filter(p => p.round_number === round).sort((a, b) => a.pick_number - b.pick_number);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 w-[1920px] h-[1080px] flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-950 to-black z-0">
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>
      
      {/* TITOLO SPOSTATO IN ALTO A DESTRA */}
      <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right">
        <span className="text-pink-500 font-bold uppercase tracking-[0.08em] text-sm mb-1 drop-shadow-md">Basketville 2026</span>
        <h2 className="text-4xl font-black uppercase text-white drop-shadow-lg tracking-wider">
          Draft Board
        </h2>
      </div>

      <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="z-10 mb-12 text-center mt-[100px]">
        <h2 className="text-2xl font-black uppercase text-pink-500 tracking-[0.08em] mb-2 animate-pulse">SORTEGGIO COMPLETATO</h2>
        <h1 className="text-[80px] font-black uppercase tracking-[0.08em] text-white drop-shadow-2xl leading-none">
          DRAFT ROUND <span className="text-pink-500">{round}</span>
        </h1>
      </motion.div>

      <div className="grid grid-rows-6 grid-flow-col gap-x-20 gap-y-6 w-full max-w-[1200px] z-10 px-12 h-[600px]">
        {roundPicks.map((pick, i) => (
          <motion.div 
            key={pick.id || i} 
            initial={{ opacity: 0, x: i < 6 ? -50 : 50 }} 
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 100, delay: 0.5 + (i * 0.4) }} 
            className="bg-white/5 border border-pink-500/30 rounded-2xl px-6 py-4 flex items-center justify-start shadow-lg relative overflow-hidden"
          >
            <div className="absolute left-0 top-0 w-2 h-full bg-pink-500"></div>
            <span className="text-4xl font-black text-pink-500 ml-4 w-28 text-left">#{pick.pick_number}</span>
            <span className="text-3xl font-bold text-white uppercase tracking-wide truncate">
              {pick.teams_edition_events?.teams?.name || 'TBD'}
            </span>
          </motion.div>
        ))}
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
    const teamName = pick?.teams_edition_events?.teams?.name || 'TBD';

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
        <span className="text-pink-500 font-bold uppercase tracking-[0.4em] text-sm mb-1 drop-shadow-md">Basketville 2026</span>
        <h2 className="text-4xl font-black uppercase text-white drop-shadow-lg tracking-widest">
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
                   <div className="text-[18px] leading-none font-bold text-neutral-500 uppercase tracking-widest text-center truncate w-full mt-0.5">
                     Vice: <span className="text-neutral-300">{team.assistant_coach}</span>
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

      <div className="flex-1 flex w-full gap-4 px-6 pt-[200px] pb-2 z-10 overflow-hidden items-start">
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
                   <div className="text-[18px] leading-none font-bold text-neutral-500 uppercase tracking-widest text-center truncate w-full mt-0.5">
                     Vice: <span className="text-neutral-300">{team.assistant_coach}</span>
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
                  <h2 className="text-[50px] font-black uppercase text-white leading-none drop-shadow-md max-w-[260px] truncate">
                    {onTheClock.teams_edition_events?.teams?.name}
                  </h2>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-1/3 border-r-2 border-neutral-800 flex items-center justify-center">
               <span className="text-xl font-bold uppercase text-neutral-500 tracking-widest">Draft Concluso</span>
            </div>
          )}

          {/* LATO DESTRO: NEXT PICK */}
          <div className="w-2/3 flex flex-col justify-center px-6 relative">
            
            {/* STRISCIA SUPERIORE NEXT PICK (Grigio chiaro) */}
            <div className="absolute top-0 left-0 w-full bg-black-900 border-b border-neutral-800 text-neutral-400 text-[15px] font-black uppercase tracking-[0.08em] py-1 pl-[42px] text-left">
              Next Pick
            </div>
            
            <div className="flex items-center justify-between w-full mt-8 gap-3">
              {upNext.length > 0 ? (
                upNext.map((p, index) => (
                  <div key={p.id} className="flex-1 flex items-center gap-2 bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 min-w-0 shadow-inner">
                    <span className="text-[24px] font-black text-neutral-500">#{p.pick_number}</span>
                    <span className="text-[24px] font-bold text-white uppercase truncate">
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
        <span className="text-pink-500 font-bold uppercase tracking-[0.4em] text-sm mb-1 drop-shadow-md">Basketville 2026</span>
        <h2 className="text-4xl font-black uppercase text-white drop-shadow-lg tracking-widest">
          Draft Pool
        </h2>
      </div>

      <div className="flex-1 flex gap-6 w-full max-w-[1850px] mx-auto z-10 overflow-hidden px-6 pb-16 pt-[250px] justify-center">
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
                {Array.from({ length: 12 }).map((_, i) => {
                  const p = playersInRole[i];
                  const isFilled = !!p;
                  const isPicked = isFilled ? picks.some(pick => pick.player_id === p.id) : false;

                  // LOGICA TAGLIO NOME INTELLIGENTE
                  let displayLast = '';
                  let displayFirst = '';
                  
                  if (isFilled) {
                    displayLast = p.last_name || '';
                    const rawFirst = p.first_name || '';
                    
                    if ((displayLast.length + rawFirst.length) > 13) {
                      displayFirst = rawFirst.charAt(0) + '.';
                    } else {
                      displayFirst = rawFirst;
                    }
                  }

                  return (
                    <div 
                      key={isFilled ? p.id : `empty-${i}`} 
                      className={`flex items-center justify-between px-3 py-[9px] rounded-xl border ${!isFilled ? 'bg-black border-neutral-800' : isPicked ? 'bg-neutral-900 border-neutral-700 opacity-30' : 'bg-neutral-900 border-neutral-700'}`}
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
  const text = payload?.text || 'BASKETVILLE 2026';

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
          className="text-[240px] leading-none font-black uppercase tracking-[0.08em] text-white drop-shadow-[0_20px_50px_rgba(0,0,0,1)]"
          style={{ textWrap: 'balance' }} 
        >
          {text}
        </h1>

      </div>
    </motion.div>
  );
}
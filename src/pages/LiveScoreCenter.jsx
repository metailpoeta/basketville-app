import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Play, ChevronRight, User, Users, Activity, CheckCircle, Calendar, ArrowLeft, Clock, Settings, RotateCcw, ChevronDown, Tv } from 'lucide-react';

export default function LiveScoreCenter() {
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [matches, setMatches] = useState([]);
  const [rosterA, setRosterA] = useState([]);
  const [rosterB, setRosterB] = useState([]);
  const [matchPoints, setMatchPoints] = useState([]);
  const [currentQuarter, setCurrentQuarter] = useState(1);
  const [activeEdition, setActiveEdition] = useState(null);
  
  // NUOVO STATO: Gestione della tab della data selezionata
  const [selectedDateTab, setSelectedDateTab] = useState(null);

  useEffect(() => {
    async function init() {
      const { data: ed } = await supabase.from('editions').select('*').eq('is_active', true).single();
      if (ed) setActiveEdition(ed);
    }
    init();

    loadMatches();
    const interval = setInterval(loadMatches, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadMatches() {
    const { data } = await supabase
      .from('matches')
      .select(`
        *,
        team_a:team_a_id(id, team_id, teams(name)),
        team_b:team_b_id(id, team_id, teams(name)),
        match_types(name),
        calendars(date, time)
      `)
      .order('status', { ascending: false });
    if (data) setMatches(data);
  }

  async function selectMatch(match) {
    setRosterA([]);
    setRosterB([]);
    setMatchPoints([]);
    
    const actualTeamAId = match.team_a?.team_id;
    const actualTeamBId = match.team_b?.team_id;

    let queryA = supabase.from('rosters').select('*, players(*)').eq('team_id', actualTeamAId).order('jersey_number', { ascending: true, nullsFirst: false });
    let queryB = supabase.from('rosters').select('*, players(*)').eq('team_id', actualTeamBId).order('jersey_number', { ascending: true, nullsFirst: false });
    
    if (activeEdition) {
      queryA = queryA.eq('edition_id', activeEdition.id);
      queryB = queryB.eq('edition_id', activeEdition.id);
    }

    const { data: pA } = await queryA;
    const { data: pB } = await queryB;
    
    const { data: mPoints } = await supabase.from('match_points').select('*').eq('match_id', match.id);
    
    setRosterA(pA || []);
    setRosterB(pB || []);
    setMatchPoints(mPoints || []);
    setSelectedMatch(match);
  }

  const getStatusInfo = (status, hasCalendar) => {
    if (status === 'upcoming' || status === 'scheduled') {
      if (!hasCalendar) {
        return { icon: <Clock size={12}/>, label: 'Da Schedulare', color: 'text-neutral-500 bg-neutral-100 border-neutral-200' };
      }
      return { icon: <Calendar size={12}/>, label: 'Programmata', color: 'text-neutral-500 bg-neutral-100 border-neutral-200' };
    }
    switch (status) {
      case 'live': return { icon: <Play size={12} className="fill-current"/>, label: 'Live', color: 'text-pink-600 bg-pink-50 border-pink-200 animate-pulse' };
      case 'finished': return { icon: <CheckCircle size={12}/>, label: 'Terminata', color: 'text-green-600 bg-green-50 border-green-200' };
      default: return { icon: <Clock size={12}/>, label: status, color: 'text-neutral-500 bg-neutral-100 border-neutral-200' };
    }
  };

  function getDisplayName(first, last) { 
    if (!first || !last) return ""; 
    return `${last.toUpperCase()} ${first.charAt(0).toUpperCase()}.`; 
  }

  async function updateScore(team, points, playerId = null) {
    const isTeamA = team === 'a';
    const fieldTotal = isTeamA ? 'score_a' : 'score_b';
    
    const qPrefix = currentQuarter === 5 ? 'ot' : `q${currentQuarter}`;
    const fieldQuarter = `${qPrefix}_${isTeamA ? 'a' : 'b'}`;
    
    const newTotal = Math.max(0, (selectedMatch[fieldTotal] || 0) + points);
    const newQuarterScore = Math.max(0, (selectedMatch[fieldQuarter] || 0) + points);

    const { error: matchErr } = await supabase
      .from('matches')
      .update({ [fieldTotal]: newTotal, [fieldQuarter]: newQuarterScore, status: 'live' })
      .eq('id', selectedMatch.id);

    if (matchErr) return alert("Errore aggiornamento punteggio partita");

    if (playerId) {
      await supabase.from('match_points').insert([{ 
        match_id: selectedMatch.id, 
        player_id: playerId, 
        points: points, 
        quarter: currentQuarter 
      }]);
      
      const { data: newPts } = await supabase.from('match_points').select('*').eq('match_id', selectedMatch.id);
      setMatchPoints(newPts || []);
    }
    
    setSelectedMatch({ ...selectedMatch, [fieldTotal]: newTotal, [fieldQuarter]: newQuarterScore, status: 'live' });
  }

  async function setMatchStatus(newStatus) {
    const { error } = await supabase.from('matches').update({ status: newStatus }).eq('id', selectedMatch.id);
    if (!error) {
      setSelectedMatch({ ...selectedMatch, status: newStatus });
      loadMatches(); 
    }
  }

  async function resetMatch() {
    if (window.confirm("Sei SICURO di voler resettare questa partita? Verranno azzerati tutti i punteggi e cancellate tutte le statistiche dei giocatori. Questa operazione NON è reversibile!")) {
      const { error: ptsError } = await supabase.from('match_points').delete().eq('match_id', selectedMatch.id);
      if (ptsError) return alert("Errore durante la cancellazione dei punti individuali.");

      const resetData = {
        score_a: 0, score_b: 0,
        q1_a: 0, q1_b: 0, q2_a: 0, q2_b: 0,
        q3_a: 0, q3_b: 0, q4_a: 0, q4_b: 0,
        ot_a: 0, ot_b: 0, status: 'upcoming'
      };

      const { error: matchErr } = await supabase.from('matches').update(resetData).eq('id', selectedMatch.id);
      if (matchErr) return alert("Errore durante il reset della partita.");

      setSelectedMatch({ ...selectedMatch, ...resetData });
      setMatchPoints([]);
      setCurrentQuarter(1);
      loadMatches();
    }
  }

  async function triggerOBSMatch(matchId, graphicType, e = null) {
    if (e) e.stopPropagation();
    const { error } = await supabase.from('broadcast_state').update({
      active_graphic: graphicType,
      payload: { match_id: matchId }
    }).eq('id', 1);

    if (error) alert("Errore connessione Regia: " + error.message);
  }

  const renderControls = (team, roster, teamName) => {
    if (roster && roster.length > 0) {
      return (
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 h-[450px] overflow-y-auto shadow-sm">
          <div className="flex justify-between items-center mb-4 px-2 border-b border-neutral-100 pb-3">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Roster {teamName}</p>
            <Users size={16} className="text-neutral-400" />
          </div>
          <div className="space-y-1">
            {roster.map(item => {
              const playerPts = matchPoints.filter(p => p.player_id === item.player_id).reduce((sum, p) => sum + p.points, 0);

              return (
                <div key={item.id} className="flex items-center justify-between p-3 hover:bg-neutral-50 rounded-xl transition-colors group border border-transparent hover:border-neutral-100">
                  <span className="text-sm font-semibold text-neutral-800 truncate pr-2 flex items-center gap-3">
                    <span className="text-neutral-400 w-5 text-center">{item.jersey_number ?? '-'}</span> 
                    {getDisplayName(item.players?.first_name, item.players?.last_name)}
                    {playerPts !== 0 && (
                      <span className="text-[10px] bg-pink-50 text-pink-600 px-2 py-0.5 rounded-md font-bold">{playerPts} pt</span>
                    )}
                  </span>
                  <div className="flex gap-1.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => updateScore(team, -1, item.player_id)} className="w-10 h-8 rounded-lg bg-white border border-neutral-200 text-neutral-600 font-semibold text-xs hover:border-red-500 hover:text-red-600 transition-all shadow-sm">-1</button>
                    <button onClick={() => updateScore(team, 1, item.player_id)} className="w-10 h-8 rounded-lg bg-white border border-neutral-200 text-neutral-600 font-semibold text-xs hover:border-pink-500 hover:text-pink-600 transition-all shadow-sm">+1</button>
                    <button onClick={() => updateScore(team, 2, item.player_id)} className="w-10 h-8 rounded-lg bg-white border border-neutral-200 text-neutral-600 font-semibold text-xs hover:border-pink-500 hover:text-pink-600 transition-all shadow-sm">+2</button>
                    <button onClick={() => updateScore(team, 3, item.player_id)} className="w-10 h-8 rounded-lg bg-white border border-neutral-200 text-neutral-600 font-semibold text-xs hover:border-pink-500 hover:text-pink-600 transition-all shadow-sm">+3</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    
    return (
      <div className="bg-white p-12 rounded-2xl border border-dashed border-neutral-300 flex flex-col items-center justify-center text-center space-y-6 h-[450px]">
        <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center">
          <User size={24} className="text-neutral-400" />
        </div>
        <div>
          <p className="text-sm text-neutral-700 font-semibold">Roster non inserito</p>
          <p className="text-xs text-neutral-500 mt-1">Usa i tasti rapidi squadra</p>
        </div>
        <div className="flex gap-2">
           <button onClick={() => updateScore(team, -1)} className="w-14 h-14 rounded-xl bg-white border border-neutral-200 text-neutral-700 font-bold text-lg hover:border-red-500 hover:text-red-600 transition-all shadow-sm">-1</button>
           <button onClick={() => updateScore(team, 1)} className="w-14 h-14 rounded-xl bg-white border border-neutral-200 text-neutral-700 font-bold text-lg hover:border-pink-500 hover:text-pink-600 transition-all shadow-sm">+1</button>
           <button onClick={() => updateScore(team, 2)} className="w-14 h-14 rounded-xl bg-white border border-neutral-200 text-neutral-700 font-bold text-lg hover:border-pink-500 hover:text-pink-600 transition-all shadow-sm">+2</button>
           <button onClick={() => updateScore(team, 3)} className="w-14 h-14 rounded-xl bg-white border border-neutral-200 text-neutral-700 font-bold text-lg hover:border-pink-500 hover:text-pink-600 transition-all shadow-sm">+3</button>
        </div>
      </div>
    );
  };

  // =========================================
  // LOGICA RAGGRUPPAMENTO DATE PER I TAB
  // =========================================
  const getMatchDateStr = (m) => m.calendars?.[0]?.date || 'TBD';
  
  // Estrai tutte le date uniche, mettile in ordine cronologico e piazza 'TBD' alla fine
  const uniqueDates = [...new Set(matches.map(getMatchDateStr))].sort((a, b) => {
    if (a === 'TBD') return 1;
    if (b === 'TBD') return -1;
    return new Date(a) - new Date(b);
  });

  // Determina quale tab è attivo (di default il primo se non l'hai cliccato)
  const activeTab = selectedDateTab && uniqueDates.includes(selectedDateTab) ? selectedDateTab : uniqueDates[0];
  
// Filtra e ordina le partite SOLO per orario cronologico
  const filteredMatches = matches
    .filter(m => getMatchDateStr(m) === activeTab)
    .sort((a, b) => {
      // Ordina per orario (le partite senza orario vanno in fondo, assegnandogli un orario fittizio '23:59')
      const timeA = a.calendars?.[0]?.time || '23:59';
      const timeB = b.calendars?.[0]?.time || '23:59';
      
      return timeA.localeCompare(timeB);
    });

  // Formattatore per mostrare il Tab a due righe (Stile Calendario)
  const formatTabDateInfo = (dateStr) => {
    if (dateStr === 'TBD') return { dayName: 'DATA', dayMonth: 'DA DEF.' };
    const d = new Date(dateStr);
    return {
      dayName: d.toLocaleDateString('it-IT', { weekday: 'short' }).replace(/\./g, '').toUpperCase(),
      dayMonth: d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }).replace(/\./g, '').toUpperCase()
    };
  };
  // =========================================

  if (!selectedMatch) {
    return (
      <div className="max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in">
        <div className="flex items-center gap-4 mb-6 border-b border-neutral-100 pb-6">
          <div className="p-3 bg-pink-50 text-pink-600 rounded-xl"><Activity size={24}/></div>
          <div>
            <h2 className="text-2xl font-semibold text-neutral-800">Regia Live Score</h2>
            <p className="text-sm text-neutral-500 mt-1">Gestione gare in corso</p>
          </div>
        </div>

        {/* TABS DATE MIGLIORATI (STILE CALENDARIO SPORTIVO) */}
        {uniqueDates.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-6 mb-2 pt-2 px-1 no-scrollbar">
            {uniqueDates.map(dateStr => {
              const isActive = activeTab === dateStr;
              const dateInfo = formatTabDateInfo(dateStr);
              
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDateTab(dateStr)}
                  className={`relative flex flex-col items-center justify-center min-w-[100px] h-[72px] rounded-2xl transition-all shrink-0 ${
                    isActive 
                      ? 'bg-neutral-900 text-white shadow-[0_8px_16px_-6px_rgba(0,0,0,0.4)] border border-neutral-800' 
                      : 'bg-white text-neutral-500 border border-neutral-200 hover:border-pink-300 hover:bg-pink-50/50 hover:shadow-md'
                  }`}
                >
                  {/* Pallino indicatore sulla data attiva */}
                  {isActive && (
                    <div className="absolute -top-1.5 w-1.5 h-1.5 rounded-full bg-pink-500"></div>
                  )}
                  
                  <span className={`text-[11px] font-bold uppercase tracking-widest ${isActive ? 'text-pink-400' : 'text-neutral-400'}`}>
                    {dateInfo.dayName}
                  </span>
                  <span className={`text-[19px] font-black tracking-tight mt-0.5 ${isActive ? 'text-white' : 'text-neutral-800'}`}>
                    {dateInfo.dayMonth}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* LISTA PARTITE FILTRATE */}
        <div className="grid gap-4">
          {filteredMatches.length === 0 ? (
            <div className="text-center p-8 bg-white border border-neutral-200 rounded-2xl text-neutral-500">
              Nessuna partita in questa data
            </div>
          ) : (
            filteredMatches.map(m => {
              const hasCalendar = m.calendars && m.calendars.length > 0;
              const status = getStatusInfo(m.status, hasCalendar);
              const scheduled = m.calendars?.[0];

              return (
                <div key={m.id} onClick={() => selectMatch(m)} className="bg-white p-5 rounded-2xl border border-neutral-200 flex flex-col md:flex-row items-start md:items-center hover:border-pink-300 hover:shadow-md transition-all group shadow-sm gap-6 w-full text-left cursor-pointer">
                  
                  <div className="flex flex-col items-start gap-2 md:w-48 shrink-0 md:border-r border-neutral-100 md:pr-4">
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${status.color}`}>
                      {status.icon} {status.label}
                    </div>
                    {scheduled ? (
                      <div className="flex items-center gap-1.5 text-neutral-500">
                        <Clock size={14}/>
                        <span className="text-xs font-medium">
                          {scheduled.time.substring(0, 5)}
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-400 font-medium italic mt-1">Orario da assegnare</p>
                    )}
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">{m.match_types?.name}</p>
                  </div>

                  <div className="flex-1 flex items-center gap-4 min-w-0 w-full">
                    <span className="text-lg font-semibold text-neutral-800 truncate text-right flex-1">{m.team_a?.teams?.name}</span>
                    <span className="text-neutral-300 font-bold text-sm shrink-0">VS</span>
                    <span className="text-lg font-semibold text-neutral-800 truncate flex-1">{m.team_b?.teams?.name}</span>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-end mt-4 md:mt-0 border-t border-neutral-100 md:border-t-0 pt-4 md:pt-0">
                    <div className="flex items-center gap-3 bg-neutral-50 px-5 py-2.5 rounded-xl border border-neutral-200">
                      <span className="text-2xl font-bold text-neutral-900 w-8 text-center">{m.score_a}</span>
                      <span className="text-neutral-400 font-medium text-sm">-</span>
                      <span className="text-2xl font-bold text-neutral-900 w-8 text-center">{m.score_b}</span>
                    </div>

                    {/* Sostituisci il vecchio blocco dei pulsanti con questo aggiornato: */}
<div className="flex flex-col gap-1.5">
  <button onClick={(e) => triggerOBSMatch(m.id, 'match_lite', e)} className="flex items-center justify-center gap-1 px-3 py-1 bg-neutral-900 text-white text-[10px] font-bold uppercase tracking-wider rounded border border-transparent hover:bg-neutral-800 transition-all shadow-sm" title="Mostra punteggio e parziali">
    <Tv size={12}/> Lite
  </button>
  {/* ⏱️ NUOVO TASTO TIMEOUT */}
  <button onClick={(e) => triggerOBSMatch(m.id, 'match_timeout', e)} className="flex items-center justify-center gap-1 px-3 py-1 bg-amber-500 text-black text-[10px] font-bold uppercase tracking-wider rounded border border-transparent hover:bg-amber-600 transition-all shadow-sm" title="Attiva Schermata Timeout">
    <Clock size={12}/> Timeout
  </button>
  <button onClick={(e) => triggerOBSMatch(m.id, 'match_full', e)} className="flex items-center justify-center gap-1 px-3 py-1 bg-pink-500 text-white text-[10px] font-bold uppercase tracking-wider rounded border border-transparent hover:bg-pink-600 transition-all shadow-sm" title="Mostra punteggio, parziali e roster">
    <Tv size={12}/> Full
  </button>
</div>

                    <div className="p-3 rounded-full bg-neutral-50 text-neutral-400 group-hover:bg-pink-50 group-hover:text-pink-600 transition-colors hidden md:block">
                      <ChevronRight size={20} />
                    </div>
                  </div>

                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  const quarterNames = ['q1', 'q2', 'q3', 'q4', 'ot'];

  return (
    <div className="max-w-6xl mx-auto p-4 animate-in fade-in zoom-in-95 pb-20">
      
      {/* HEADER PANNELLO PARTITA (Stile Light) */}
      <div className="bg-white border border-neutral-200 p-4 rounded-2xl mb-8 flex flex-col xl:flex-row justify-between items-center gap-4 shadow-sm">
        
        <button onClick={() => setSelectedMatch(null)} className="flex items-center gap-2 px-4 py-2.5 bg-neutral-50 hover:bg-neutral-100 rounded-xl text-sm font-medium text-neutral-600 transition-colors border border-neutral-200 shrink-0 w-full xl:w-auto justify-center">
          <ArrowLeft size={16}/> Torna alle partite
        </button>
        
        <div className="flex bg-neutral-100/50 p-1 rounded-xl border border-neutral-200/50 w-full xl:w-auto overflow-x-auto">
          {[1, 2, 3, 4, 'OT'].map((q, i) => (
            <button key={q} onClick={() => setCurrentQuarter(i + 1)} className={`flex-1 xl:flex-none px-6 py-2 rounded-lg text-sm font-semibold transition-all ${currentQuarter === i + 1 ? 'bg-white shadow-sm text-pink-600' : 'text-neutral-500 hover:text-neutral-700'}`}>
              {typeof q === 'number' ? `Q${q}` : q}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 shrink-0 w-full xl:w-auto justify-between xl:justify-end flex-wrap">
          <div className="flex items-center gap-2 bg-neutral-50 px-4 py-2.5 rounded-xl border border-neutral-200 relative flex-1 xl:flex-none min-w-[140px]">
            <Settings size={16} className="text-neutral-400" />
            <select 
              className="bg-transparent text-sm font-semibold text-neutral-700 outline-none cursor-pointer w-full appearance-none pr-6"
              value={selectedMatch.status}
              onChange={(e) => setMatchStatus(e.target.value)}
            >
              <option value="upcoming">Da Iniziare</option>
              <option value="live">Live (In corso)</option>
              <option value="finished">Terminata</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 text-neutral-400 pointer-events-none"/>
          </div>
          
          <button onClick={resetMatch} className="flex items-center justify-center gap-2 bg-white text-red-600 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-50 transition-all border border-neutral-200 shadow-sm shrink-0">
            <RotateCcw size={16} /> Reset
          </button>

          {/* TASTI OBS NEL DETTAGLIO PARTITA (Aggiornato con Timeout) */}
<div className="flex items-center gap-2 border-l border-neutral-200 pl-3 ml-1">
   <button onClick={() => triggerOBSMatch(selectedMatch.id, 'match_lite')} className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-neutral-800 transition-colors shadow-sm" title="Mostra su OBS (Solo Punteggio)">
     <Tv size={14}/> Lite
   </button>
   {/* ⏱️ NUOVO TASTO TIMEOUT */}
   <button onClick={() => triggerOBSMatch(selectedMatch.id, 'match_timeout')} className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-black text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-amber-600 transition-colors shadow-sm" title="Mostra su OBS in Modalità Timeout">
     <Clock size={14}/> Timeout
   </button>
   <button onClick={() => triggerOBSMatch(selectedMatch.id, 'match_full')} className="flex items-center gap-1.5 px-3 py-2 bg-pink-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-pink-600 transition-colors shadow-sm" title="Mostra su OBS (Punteggio + Roster)">
     <Tv size={14}/> Full
   </button>
</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* TEAM A */}
        <div className="space-y-6">
          <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-neutral-200 relative overflow-hidden">
            <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-widest mb-2">{selectedMatch.team_a?.teams?.name}</h3>
            <div className="text-[96px] leading-none font-semibold text-neutral-900 tracking-tight">{selectedMatch.score_a}</div>
            
            <div className="mt-8 flex justify-center gap-2">
              {quarterNames.map((qLabel, idx) => (
                <div key={qLabel} className={`px-4 py-2 rounded-xl border transition-all ${currentQuarter === idx + 1 ? 'border-pink-300 bg-pink-50' : 'border-neutral-100 bg-neutral-50'}`}>
                  <span className={`text-[10px] font-semibold uppercase block mb-1 ${currentQuarter === idx + 1 ? 'text-pink-600' : 'text-neutral-400'}`}>
                    {qLabel}
                  </span>
                  <span className="text-base font-bold text-neutral-800">{selectedMatch[`${qLabel}_a`] || 0}</span>
                </div>
              ))}
            </div>
          </div>
          {renderControls('a', rosterA, selectedMatch.team_a?.teams?.name)}
        </div>

        {/* TEAM B */}
        <div className="space-y-6">
          <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-neutral-200 relative overflow-hidden">
            <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-widest mb-2">{selectedMatch.team_b?.teams?.name}</h3>
            <div className="text-[96px] leading-none font-semibold text-neutral-900 tracking-tight">{selectedMatch.score_b}</div>
            
            <div className="mt-8 flex justify-center gap-2">
              {quarterNames.map((qLabel, idx) => (
                <div key={qLabel} className={`px-4 py-2 rounded-xl border transition-all ${currentQuarter === idx + 1 ? 'border-pink-300 bg-pink-50' : 'border-neutral-100 bg-neutral-50'}`}>
                  <span className={`text-[10px] font-semibold uppercase block mb-1 ${currentQuarter === idx + 1 ? 'text-pink-600' : 'text-neutral-400'}`}>
                    {qLabel}
                  </span>
                  <span className="text-base font-bold text-neutral-800">{selectedMatch[`${qLabel}_b`] || 0}</span>
                </div>
              ))}
            </div>
          </div>
          {renderControls('b', rosterB, selectedMatch.team_b?.teams?.name)}
        </div>
      </div>
    </div>
  );
}
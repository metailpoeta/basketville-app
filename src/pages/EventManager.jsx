import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Trophy, Users, Star, Tv, Plus, AlertCircle, Trash2, Lock, Settings, CalendarClock, ChevronDown } from 'lucide-react';

export default function EventManager() {
  const [activeEdition, setActiveEdition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('verocup');
  
  // Dati Globali
  const [createdMatches, setCreatedMatches] = useState([]);
  const [enrolledTeams, setEnrolledTeams] = useState([]); 
  const [drEnrolledTeams, setDrEnrolledTeams] = useState([]); 
  const [allTeams, setAllTeams] = useState([]); 
  const [matchTypes, setMatchTypes] = useState([]);
  
  // Form Partita Vero Cup
  const [vType, setVType] = useState(''); 
  const [vTeamA, setVTeamA] = useState('');
  const [vTeamB, setVTeamB] = useState('');

  // Form Partita ASG Women
  const [wTeamA, setWTeamA] = useState('');
  const [wTeamB, setWTeamB] = useState('');

  // Form Partita Old Star Game
  const [oTeamA, setOTeamA] = useState('');
  const [oTeamB, setOTeamB] = useState('');

  // Form Partita ASG DR1/2/3
  const [drTeamA, setDrTeamA] = useState('');
  const [drTeamB, setDrTeamB] = useState('');
  const [isInitializingDR, setIsInitializingDR] = useState(false);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const { data: ed } = await supabase.from('editions').select('*').eq('is_active', true).single();
      if (ed) setActiveEdition(ed);

      const { data: mt } = await supabase.from('match_types').select('*').in('id', [1, 2, 3, 4]);
      if (mt) setMatchTypes(mt);

      const { data: teams } = await supabase.from('teams').select('*').order('name');
      if (teams) setAllTeams(teams);
      
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (activeEdition) {
      loadVeroCupTeams();
      loadDRTeams();
      loadMatches();
    }
  }, [activeEdition]);

  async function loadVeroCupTeams() {
    const { data } = await supabase
      .from('teams_edition_events')
      .select('*, teams(name, short_name)')
      .eq('edition_id', activeEdition.id)
      .eq('event_id', 1);
    if (data) setEnrolledTeams(data);
  }

  async function loadDRTeams() {
    const { data } = await supabase
      .from('teams_edition_events')
      .select('*, teams(name, short_name)')
      .eq('edition_id', activeEdition.id)
      .eq('event_id', 6);
    if (data) setDrEnrolledTeams(data);
  }

  async function loadMatches() {
    if (!activeEdition) return;
    const { data } = await supabase
      .from('matches')
      .select(`
        *,
        match_types(name),
        team_a:team_a_id(id, group_name, event_id, teams(name, short_name)),
        team_b:team_b_id(id, group_name, event_id, teams(name, short_name))
      `)
      .order('id', { ascending: false });
    if (data) setCreatedMatches(data);
  }

  const getAvailableTeamsB = () => {
    if (!vTeamA) return enrolledTeams;
    const teamAData = enrolledTeams.find(t => t.id === vTeamA);
    if (vType === "1" && teamAData) {
      return enrolledTeams.filter(t => t.group_name === teamAData.group_name && t.id !== vTeamA);
    }
    return enrolledTeams.filter(t => t.id !== vTeamA);
  };

  const getAvailableExhibitionTeams = () => {
    const veroCupTeamIds = enrolledTeams.map(et => et.team_id);
    return allTeams.filter(t => !veroCupTeamIds.includes(t.id));
  };

  const hasWomenMatch = createdMatches.some(m => m.team_a?.event_id === 5);
  const hasOldStarMatch = createdMatches.some(m => m.team_a?.event_id === 4);
  const drMatchesCount = createdMatches.filter(m => m.team_a?.event_id === 6).length;
  const hasMaxDrMatches = drMatchesCount >= 3;

  async function handleCreateVeroMatch(e) {
    e.preventDefault();
    if (!vType || !vTeamA || !vTeamB) return alert("Compila tutti i campi!");

    const { error } = await supabase.from('matches').insert([{
      match_type_id: parseInt(vType),
      team_a_id: vTeamA, 
      team_b_id: vTeamB, 
      status: 'scheduled', 
      score_a: 0, 
      score_b: 0
    }]);

    if (!error) {
      setVTeamA(''); setVTeamB(''); loadMatches(); 
    } else alert("Errore: " + error.message);
  }

  async function handleCreateExhibitionMatch(e, eventId, eventName, teamA, teamB, hasMatch, resetFunc) {
    e.preventDefault();
    if (hasMatch) return alert(`Partita ${eventName} già creata!`);
    if (!teamA || !teamB) return alert("Compila tutti i campi!");
    if (teamA === teamB) return alert("Le squadre devono essere diverse!");

    try {
      const ensureEnrollment = async (baseTeamId) => {
        const { data: existing } = await supabase.from('teams_edition_events').select('id')
          .eq('edition_id', activeEdition.id).eq('event_id', eventId).eq('team_id', baseTeamId).single();
        if (existing) return existing.id;

        const { data: newEnroll, error } = await supabase.from('teams_edition_events').insert([{
            edition_id: activeEdition.id, event_id: eventId, team_id: baseTeamId, group_name: eventName.toUpperCase()
          }]).select().single();
        if (error) throw error;
        return newEnroll.id;
      };

      const enrollIdA = await ensureEnrollment(teamA);
      const enrollIdB = await ensureEnrollment(teamB);

      const { error: matchError } = await supabase.from('matches').insert([{
        match_type_id: 4, team_a_id: enrollIdA, team_b_id: enrollIdB, status: 'scheduled', score_a: 0, score_b: 0
      }]);
      if (matchError) throw matchError;

      resetFunc(); loadMatches();
    } catch (err) {
      alert("Errore: " + err.message);
    }
  }

  async function handleSetupDRTeams() {
    setIsInitializingDR(true);
    try {
      const drNames = ['DR1', 'DR2', 'DR3'];
      for (const name of drNames) {
        let { data: team } = await supabase.from('teams').select('id').eq('name', name).single();
        if (!team) {
          const { data: newTeam, error: tErr } = await supabase.from('teams').insert([{ name, short_name: name }]).select().single();
          if (tErr) throw tErr;
          team = newTeam;
        }
        const { data: enrollment } = await supabase.from('teams_edition_events').select('id')
          .eq('edition_id', activeEdition.id).eq('event_id', 6).eq('team_id', team.id).single();
        if (!enrollment) {
          await supabase.from('teams_edition_events').insert([{
            edition_id: activeEdition.id, event_id: 6, team_id: team.id, group_name: 'ASG DR1/2/3'
          }]);
        }
      }
      await loadDRTeams();
    } catch (err) {
      alert("Errore in fase di setup: " + err.message);
    } finally {
      setIsInitializingDR(false);
    }
  }

  async function handleCreateDRMatch(e) {
    e.preventDefault();
    if (hasMaxDrMatches) return alert("Torneo DR completo!");
    if (!drTeamA || !drTeamB) return alert("Compila tutti i campi!");
    if (drTeamA === drTeamB) return alert("Seleziona due squadre diverse!");

    const { error } = await supabase.from('matches').insert([{
      match_type_id: 4, team_a_id: drTeamA, team_b_id: drTeamB, status: 'scheduled', score_a: 0, score_b: 0
    }]);

    if (!error) {
      setDrTeamA(''); setDrTeamB(''); loadMatches();
    } else {
      alert("Errore: " + error.message);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto mt-20 flex flex-col items-center text-neutral-400">
        <div className="w-8 h-8 border-4 border-neutral-200 border-t-pink-500 rounded-full animate-spin mb-4"></div>
        <p className="text-sm">Caricamento eventi...</p>
      </div>
    );
  }

  if (!activeEdition) {
    return (
      <div className="max-w-4xl mx-auto mt-20 animate-in fade-in duration-300">
        <div className="bg-white rounded-2xl border border-dashed border-neutral-300 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-neutral-400" />
          </div>
          <h2 className="text-xl font-semibold text-neutral-800 mb-2">Nessuna Edizione Attiva</h2>
          <p className="text-neutral-500 text-sm max-w-sm mx-auto">
            Per generare le partite, devi prima impostare un'edizione come "Attiva" dal pannello di controllo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in pb-20 space-y-8">
      
      {/* HEADER E TABS (Stile Roster/Calendar Manager) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-neutral-100 pb-6">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-800">Generatore Partite</h2>
          <p className="text-sm text-neutral-500 mt-1">Edizione {activeEdition?.year}</p>
        </div>
        
        <div className="flex flex-wrap bg-neutral-100/50 p-1 rounded-xl w-fit border border-neutral-200/50 gap-1">
          <button onClick={() => setActiveSection('verocup')} className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeSection === 'verocup' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}>
            <Trophy size={16} className="mr-2 hidden sm:block" /> Vero Cup
          </button>
          <button onClick={() => setActiveSection('asg-women')} className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeSection === 'asg-women' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}>
            <Star size={16} className="mr-2 hidden sm:block" /> Women
          </button>
          <button onClick={() => setActiveSection('oldstar')} className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeSection === 'oldstar' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}>
            <Users size={16} className="mr-2 hidden sm:block" /> Old Star
          </button>
          <button onClick={() => setActiveSection('dr')} className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeSection === 'dr' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}>
            <Tv size={16} className="mr-2 hidden sm:block" /> DR 1/2/3
          </button>
        </div>
      </div>

      <main>
        {/* === SEZIONE VERO Cup === */}
        {activeSection === 'verocup' && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-neutral-200">
              <h3 className="text-sm font-semibold text-neutral-800 mb-6 flex items-center gap-2">
                <Trophy size={18} className="text-pink-500" /> Genera Match Vero Cup
              </h3>
              <form onSubmit={handleCreateVeroMatch} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Fase del Torneo</label>
                  <div className="relative">
                    <select className="w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 appearance-none outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all" value={vType} onChange={e => {setVType(e.target.value); setVTeamB('');}}>
                      <option value="">Seleziona...</option>
                      {matchTypes.filter(t => t.id <= 3).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Squadra Home</label>
                  <div className="relative">
                    <select className="w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 appearance-none outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all" value={vTeamA} onChange={e => {setVTeamA(e.target.value); setVTeamB('');}}>
                      <option value="">Scegli...</option>
                      {enrolledTeams.map(t => <option key={t.id} value={t.id}>{t.teams.name} ({t.group_name})</option>)}
                    </select>
                    <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Squadra Away</label>
                  <div className="relative">
                    <select className="w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 appearance-none outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all" value={vTeamB} onChange={e => setVTeamB(e.target.value)} disabled={!vTeamA}>
                      <option value="">Scegli...</option>
                      {getAvailableTeamsB().map(t => <option key={t.id} value={t.id}>{t.teams.name} ({t.group_name})</option>)}
                    </select>
                    <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                  </div>
                </div>
                <div className="md:col-span-2 mt-2">
                  <button type="submit" className="w-full md:w-auto px-6 py-3 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors shadow-sm flex justify-center items-center gap-2">
                    <Plus size={18} /> Genera Partita
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* === SEZIONE ASG WOMEN === */}
        {activeSection === 'asg-women' && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-neutral-200">
              <h3 className="text-sm font-semibold text-neutral-800 mb-6 flex items-center gap-2">
                <Star size={18} className="text-pink-500" /> Genera Match ASG Women
              </h3>
              {hasWomenMatch ? (
                <div className="p-8 border border-neutral-200 bg-neutral-50 rounded-xl text-center">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 text-neutral-400 shadow-sm border border-neutral-100"><Lock size={20} /></div>
                  <h4 className="font-semibold text-neutral-700 mb-1">Partita Già Generata</h4>
                  <p className="text-xs text-neutral-500">È consentita una sola partita ASG Women per edizione.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-neutral-500 mb-6 border-l-2 border-pink-500 pl-3">Le squadre verranno iscritte all'evento automaticamente e la partita verrà generata in attesa di essere programmata nel calendario.</p>
                  <form onSubmit={(e) => handleCreateExhibitionMatch(e, 5, 'ASG Women', wTeamA, wTeamB, hasWomenMatch, () => {setWTeamA(''); setWTeamB('');})} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Squadra A</label>
                      <div className="relative">
                        <select className="w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 appearance-none outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all" value={wTeamA} onChange={e => setWTeamA(e.target.value)}>
                          <option value="">Scegli dall'anagrafica...</option>
                          {getAvailableExhibitionTeams().map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Squadra B</label>
                      <div className="relative">
                        <select className="w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 appearance-none outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all" value={wTeamB} onChange={e => setWTeamB(e.target.value)} disabled={!wTeamA}>
                          <option value="">Scegli dall'anagrafica...</option>
                          {getAvailableExhibitionTeams().filter(t => t.id !== wTeamA).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="md:col-span-2 mt-2">
                      <button type="submit" className="w-full md:w-auto px-6 py-3 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors shadow-sm flex justify-center items-center gap-2">
                         <Plus size={18} /> Genera Partita
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

        {/* === SEZIONE OLD STAR GAME === */}
        {activeSection === 'oldstar' && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-neutral-200">
              <h3 className="text-sm font-semibold text-neutral-800 mb-6 flex items-center gap-2">
                <Users size={18} className="text-pink-500" /> Genera Match Old Star
              </h3>
              {hasOldStarMatch ? (
                <div className="p-8 border border-neutral-200 bg-neutral-50 rounded-xl text-center">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 text-neutral-400 shadow-sm border border-neutral-100"><Lock size={20} /></div>
                  <h4 className="font-semibold text-neutral-700 mb-1">Partita Già Generata</h4>
                  <p className="text-xs text-neutral-500">È consentita una sola partita Old Star per edizione.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-neutral-500 mb-6 border-l-2 border-pink-500 pl-3">Le squadre verranno iscritte all'evento automaticamente e la partita verrà generata in attesa di essere programmata nel calendario.</p>
                  <form onSubmit={(e) => handleCreateExhibitionMatch(e, 4, 'Old Star Game', oTeamA, oTeamB, hasOldStarMatch, () => {setOTeamA(''); setOTeamB('');})} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Squadra A</label>
                      <div className="relative">
                        <select className="w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 appearance-none outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all" value={oTeamA} onChange={e => setOTeamA(e.target.value)}>
                          <option value="">Scegli dall'anagrafica...</option>
                          {getAvailableExhibitionTeams().map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Squadra B</label>
                      <div className="relative">
                        <select className="w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 appearance-none outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all" value={oTeamB} onChange={e => setOTeamB(e.target.value)} disabled={!oTeamA}>
                          <option value="">Scegli dall'anagrafica...</option>
                          {getAvailableExhibitionTeams().filter(t => t.id !== oTeamA).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="md:col-span-2 mt-2">
                      <button type="submit" className="w-full md:w-auto px-6 py-3 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors shadow-sm flex justify-center items-center gap-2">
                        <Plus size={18} /> Genera Partita
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

        {/* === SEZIONE ASG DR1/2/3 === */}
        {activeSection === 'dr' && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-neutral-200">
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                <h3 className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
                  <Tv size={18} className="text-pink-500" /> Genera Match ASG DR1/2/3
                </h3>
                <div className="bg-neutral-100 text-neutral-600 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap text-center">
                  {drMatchesCount} / 3 Partite Generate
                </div>
              </div>

              {drEnrolledTeams.length < 3 ? (
                <div className="p-8 border border-neutral-200 bg-neutral-50 rounded-xl text-center">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-neutral-400 shadow-sm border border-neutral-100"><Settings size={20} /></div>
                  <h4 className="font-semibold text-neutral-800 mb-2">Squadre DR Non Configurate</h4>
                  <p className="text-xs text-neutral-500 mb-4 max-w-sm mx-auto">Il sistema deve creare e iscrivere automaticamente le 3 squadre fittizie (DR1, DR2, DR3) prima di poter generare gli scontri del triangolare.</p>
                  <button onClick={handleSetupDRTeams} disabled={isInitializingDR} className="px-6 py-2.5 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors shadow-sm">
                    {isInitializingDR ? 'Inizializzazione...' : 'Inizializza Squadre DR'}
                  </button>
                </div>
              ) : hasMaxDrMatches ? (
                <div className="p-8 border border-neutral-200 bg-neutral-50 rounded-xl text-center">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 text-neutral-400 shadow-sm border border-neutral-100"><Lock size={20} /></div>
                  <h4 className="font-semibold text-neutral-700 mb-1">Torneo DR Completo</h4>
                  <p className="text-xs text-neutral-500">Hai già generato tutte e 3 le partite necessarie per il triangolare.</p>
                </div>
              ) : (
                <form onSubmit={handleCreateDRMatch} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Squadra A</label>
                    <div className="relative">
                      <select className="w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 appearance-none outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all" value={drTeamA} onChange={e => setDrTeamA(e.target.value)}>
                        <option value="">Seleziona...</option>
                        {drEnrolledTeams.map(t => <option key={t.id} value={t.id}>{t.teams.name}</option>)}
                      </select>
                      <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Squadra B</label>
                    <div className="relative">
                      <select className="w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 appearance-none outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all" value={drTeamB} onChange={e => setDrTeamB(e.target.value)} disabled={!drTeamA}>
                        <option value="">Seleziona...</option>
                        {drEnrolledTeams.filter(t => t.id !== drTeamA).map(t => <option key={t.id} value={t.id}>{t.teams.name}</option>)}
                      </select>
                      <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="md:col-span-2 mt-2">
                    <button type="submit" className="w-full md:w-auto px-6 py-3 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors shadow-sm flex justify-center items-center gap-2">
                      <Plus size={18} /> Genera Partita DR
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* === LISTA PARTITE DA PROGRAMMARE GLOBALE === */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-neutral-200 mt-8">
          <h3 className="text-sm font-semibold text-neutral-800 mb-6">Elenco Partite Generate</h3>
          
          <div className="space-y-3">
            {createdMatches.length === 0 ? (
               <div className="p-8 border border-dashed border-neutral-200 bg-neutral-50 rounded-xl text-center">
                 <p className="text-sm text-neutral-500">Non hai ancora generato nessuna partita per questa edizione.</p>
               </div>
            ) : createdMatches.map((match) => (
              <div key={match.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white border border-neutral-200 rounded-xl group hover:border-pink-300 hover:shadow-sm transition-all gap-4">
                
                <div className="flex items-center gap-3 md:w-1/3 shrink-0 border-b md:border-b-0 border-neutral-100 pb-3 md:pb-0">
                  <div className="bg-neutral-100 px-2.5 py-1 rounded text-center flex items-center justify-center gap-1.5 shrink-0">
                    <CalendarClock size={12} className="text-neutral-500" />
                    <p className="text-[10px] font-bold text-neutral-600 uppercase">TBA</p>
                  </div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider truncate">
                    {match.match_type_id === 1 ? (
                      <span className="text-neutral-500">{match.team_a?.group_name || 'GIRONE'}</span>
                    ) : (
                      <span className="text-pink-500">
                        {match.team_a?.event_id === 5 ? 'ASG WOMEN' : 
                         match.team_a?.event_id === 4 ? 'OLD STAR GAME' : 
                         match.team_a?.event_id === 6 ? 'ASG DR1/2/3' : 
                         match.match_types?.name}
                      </span>
                    )}
                  </p>
                </div>
                
                <div className="flex-1 flex items-center justify-center gap-4 py-2 md:py-0">
                  <p className="text-sm font-semibold text-neutral-900 text-right flex-1 truncate">{match.team_a?.teams?.name}</p>
                  <span className="text-xs font-medium text-neutral-400">vs</span>
                  <p className="text-sm font-semibold text-neutral-900 text-left flex-1 truncate">{match.team_b?.teams?.name}</p>
                </div>
                
                <div className="md:w-1/6 flex justify-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-neutral-100">
                   <button onClick={async () => { if(window.confirm("Eliminare definitivamente la partita? Verrà rimossa anche dal calendario se già programmata.")) { await supabase.from('matches').delete().eq('id', match.id); loadMatches(); } }} className="text-neutral-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium">
                     <Trash2 size={16} /> <span className="md:hidden">Rimuovi</span>
                   </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
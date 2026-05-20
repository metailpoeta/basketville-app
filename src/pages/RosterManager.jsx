import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, Trash2, UserPlus, AlertCircle, AlertTriangle, ClipboardList, Users, Edit2, Check, X, ChevronDown, UserSquare2 } from 'lucide-react';

export default function RosterManager() {
  const [activeEdition, setActiveEdition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('enrollments');

  // --- STATI ISCRIZIONI ---
  const [allTeams, setAllTeams] = useState([]);
  const [enrolledTeams, setEnrolledTeams] = useState([]);
  const [teamToEnroll, setTeamToEnroll] = useState('');
  const [groupName, setGroupName] = useState('');
  // Nuovi stati per l'iscrizione dello staff
  const [coachName, setCoachName] = useState('');
  const [assistantCoachName, setAssistantCoachName] = useState('');

  // --- STATI ROSTER ---
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [roster, setRoster] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jersey, setJersey] = useState('');
  
  // --- STATI OMONIMI ---
  const [conflictMatches, setConflictMatches] = useState([]);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [newBirthDate, setNewBirthDate] = useState('');

  // --- STATI MODIFICA INLINE (Roster) ---
  const [editingId, setEditingId] = useState(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editJersey, setEditJersey] = useState('');

  // --- STATI MODIFICA INLINE (Iscrizioni - Staff) ---
  const [editingEnrollId, setEditingEnrollId] = useState(null);
  const [editCoach, setEditCoach] = useState('');
  const [editAssistantCoach, setEditAssistantCoach] = useState('');

  useEffect(() => {
    async function loadInitialData() {
      setLoading(true);
      const { data: edData } = await supabase.from('editions').select('*').eq('is_active', true).single();
      if (edData) {
        setActiveEdition(edData);
        const { data: teamsData } = await supabase.from('teams').select('*').order('name');
        if (teamsData) setAllTeams(teamsData);
        const { data: playersData } = await supabase.from('players').select('id, first_name, last_name, birth_date');
        if (playersData) setAllPlayers(playersData);
      }
      setLoading(false);
    }
    loadInitialData();
  }, []);

  async function fetchEnrolledTeams() {
    if (!activeEdition) return;
    const { data } = await supabase
      .from('teams_edition_events')
      // Aggiunti coach e assistant_coach alla select
      .select(`id, team_id, group_name, coach, assistant_coach, teams ( id, name, short_name )`)
      .eq('edition_id', activeEdition.id)
      .eq('event_id', 1)
      .order('group_name');
    if (data) setEnrolledTeams(data);
  }

  useEffect(() => { fetchEnrolledTeams(); }, [activeEdition]);

  async function fetchRoster() {
    if (!selectedTeamId || !activeEdition) { setRoster([]); return; }
    const { data } = await supabase
      .from('rosters')
      .select(`id, jersey_number, player_id, players (id, first_name, last_name, birth_date)`)
      .eq('team_id', selectedTeamId)
      .eq('edition_id', activeEdition.id)
      .order('jersey_number');
    if (data) setRoster(data);
  }

  useEffect(() => { fetchRoster(); }, [selectedTeamId, activeEdition]);

  function getDisplayName(first, last) { 
    return (!first || !last) ? "" : `${last.toUpperCase()} ${first.charAt(0).toUpperCase()}.`; 
  }
  
  function formatDate(ds) { 
    if (!ds) return "N/D"; 
    const [y, m, d] = ds.split('-'); 
    return `${d}/${m}/${y}`; 
  }

  // --- FUNZIONI ISCRIZIONI ---
  async function handleEnrollTeam(e) {
    e.preventDefault();
    if (!teamToEnroll || !activeEdition) return;
    const { error } = await supabase.from('teams_edition_events').insert([{
      edition_id: activeEdition.id, 
      event_id: 1, 
      team_id: teamToEnroll, 
      group_name: groupName.toUpperCase(),
      coach: coachName.trim(),
      assistant_coach: assistantCoachName.trim()
    }]);
    if (!error) { 
      setTeamToEnroll(''); 
      setGroupName(''); 
      setCoachName('');
      setAssistantCoachName('');
      fetchEnrolledTeams(); 
    }
  }

  async function handleRemoveEnrollment(enrollmentId) {
    if (window.confirm("Annullare l'iscrizione? Eliminerà anche il roster collegato per questa edizione.")) {
      const { error } = await supabase.from('teams_edition_events').delete().eq('id', enrollmentId);
      if (!error) fetchEnrolledTeams();
    }
  }

  function startEditingEnrollment(enroll) {
    setEditingEnrollId(enroll.id);
    setEditCoach(enroll.coach || '');
    setEditAssistantCoach(enroll.assistant_coach || '');
  }

  async function saveEditEnrollment(id) {
    const { error } = await supabase.from('teams_edition_events').update({
      coach: editCoach.trim(),
      assistant_coach: editAssistantCoach.trim()
    }).eq('id', id);

    if (!error) {
      setEditingEnrollId(null);
      fetchEnrolledTeams();
    } else {
      alert("Errore salvataggio staff: " + error.message);
    }
  }

  // --- FUNZIONI ROSTER ---
  function handleInitialSubmit(e) {
    e.preventDefault();
    if (!firstName || !lastName || !selectedTeamId) return;
    const matches = allPlayers.filter(p => p.first_name.toLowerCase() === firstName.trim().toLowerCase() && p.last_name.toLowerCase() === lastName.trim().toLowerCase());
    if (matches.length > 0) { 
      setConflictMatches(matches); 
      setShowConflictModal(true); 
    } else { 
      createNewPlayerAndRoster(firstName.trim(), lastName.trim(), null); 
    }
  }

  async function createNewPlayerAndRoster(fName, lName, birthDate) {
    const { data: newP, error } = await supabase.from('players').insert([{ first_name: fName, last_name: lName, birth_date: birthDate }]).select().single();
    if (!error) {
      setAllPlayers([...allPlayers, newP]);
      insertIntoRoster(newP.id);
    }
  }

  async function insertIntoRoster(playerId) {
    const { error } = await supabase.from('rosters').insert([{ 
      edition_id: activeEdition.id, team_id: selectedTeamId, player_id: playerId, jersey_number: jersey ? parseInt(jersey, 10) : null 
    }]);

    if (error) {
      if (error.code === '23505') {
        alert("ATTENZIONE: Questo giocatore è già presente nel roster di questa squadra per questa edizione!");
      } else {
        alert("Errore durante l'inserimento: " + error.message);
      }
      return;
    }

    setFirstName(''); setLastName(''); setJersey(''); fetchRoster();
  }

  function startEditingRoster(item) {
    setEditingId(item.id);
    setEditFirstName(item.players.first_name);
    setEditLastName(item.players.last_name);
    setEditJersey(item.jersey_number || '');
  }

  async function saveEditRoster(item) {
    const { error: pErr } = await supabase.from('players').update({
      first_name: editFirstName,
      last_name: editLastName
    }).eq('id', item.player_id);

    const { error: rErr } = await supabase.from('rosters').update({
      jersey_number: editJersey ? parseInt(editJersey, 10) : null
    }).eq('id', item.id);

    if (!pErr && !rErr) {
      setEditingId(null);
      fetchRoster();
      const updatedPlayers = allPlayers.map(p => p.id === item.player_id ? {...p, first_name: editFirstName, last_name: editLastName} : p);
      setAllPlayers(updatedPlayers);
    }
  }

  async function handleDeleteRosterItem(id) {
    if (window.confirm("Rimuovere definitivamente dal roster?")) {
      await supabase.from('rosters').delete().eq('id', id);
      fetchRoster();
    }
  }

  async function handleCreateHomonym() {
    if (!newBirthDate) return alert("Inserisci la data di nascita per distinguere l'omonimo!");
    const tFirst = firstName.trim(), tLast = lastName.trim();
    setShowConflictModal(false);
    await createNewPlayerAndRoster(tFirst, tLast, newBirthDate);
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto mt-20 flex flex-col items-center text-neutral-400">
        <div className="w-8 h-8 border-4 border-neutral-200 border-t-pink-500 rounded-full animate-spin mb-4"></div>
        <p className="text-sm">Caricamento dati...</p>
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
            Per gestire le iscrizioni e i roster, devi prima impostare un'edizione come "Attiva" dal pannello di controllo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in pb-20">
      
      {/* HEADER E TABS */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-neutral-100 pb-6">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-800">Gestione Squadre</h2>
          <p className="text-sm text-neutral-500 mt-1">Edizione {activeEdition?.year}</p>
        </div>
        
        <div className="flex bg-neutral-100/50 p-1 rounded-xl w-fit border border-neutral-200/50">
          <button onClick={() => setActiveTab('enrollments')} className={`flex items-center px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'enrollments' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}>
            <ClipboardList size={16} className="mr-2" /> Iscrizioni
          </button>
          <button onClick={() => setActiveTab('rosters')} className={`flex items-center px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'rosters' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}>
            <Users size={16} className="mr-2" /> Roster
          </button>
        </div>
      </div>

      {/* --- TAB 1: ISCRIZIONI --- */}
      {activeTab === 'enrollments' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
            <h3 className="text-sm font-semibold text-neutral-800 mb-4">Iscrivi Nuova Squadra</h3>
            <form onSubmit={handleEnrollTeam} className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <select className="w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 appearance-none outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all" value={teamToEnroll} onChange={e => setTeamToEnroll(e.target.value)} required>
                    <option value="">Seleziona dall'anagrafica...</option>
                    {allTeams
                      .filter(t => !enrolledTeams.find(et => et.team_id === t.id))
                      .map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                    }
                  </select>
                  <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                </div>
                <input type="text" placeholder="Girone (es. A)" className="md:w-32 p-3 bg-white border border-neutral-200 rounded-lg text-sm text-center uppercase outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all" value={groupName} onChange={e => setGroupName(e.target.value)} />
              </div>
              
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <input type="text" placeholder="Nome Allenatore (Opzionale)" className="flex-1 w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all" value={coachName} onChange={e => setCoachName(e.target.value)} />
                <input type="text" placeholder="Nome Vice Allenatore (Opzionale)" className="flex-1 w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all" value={assistantCoachName} onChange={e => setAssistantCoachName(e.target.value)} />
                <button type="submit" className="w-full md:w-auto px-6 py-3 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors">Iscrivi Squadra</button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs text-neutral-500 border-b border-neutral-200 uppercase tracking-wider">
                <tr>
                  <th className="p-4 font-medium">Squadra</th>
                  <th className="p-4 text-center font-medium">Girone</th>
                  <th className="p-4 font-medium text-neutral-400">Staff Tecnico</th>
                  <th className="p-4 text-right font-medium">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {enrolledTeams.length === 0 ? (
                  <tr><td colSpan="4" className="p-8 text-center text-neutral-400">Nessuna squadra iscritta.</td></tr>
                ) : enrolledTeams.map(enroll => (
                  <tr key={enroll.id} className="hover:bg-neutral-50/50 transition-colors group">
                    <td className="p-4">
                      <span className="font-semibold text-neutral-900">{enroll.teams?.name}</span>
                      <span className="ml-2 text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">{enroll.teams?.short_name}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="font-medium text-neutral-700">{enroll.group_name || '-'}</span>
                    </td>
                    
                    {/* COLONNA STAFF CON EDIT INLINE */}
                    <td className="p-4">
                      {editingEnrollId === enroll.id ? (
                        <div className="flex flex-col gap-2">
                          <input type="text" className="w-full p-2 bg-white border border-neutral-300 rounded text-sm outline-none focus:border-pink-500 focus:ring-1" placeholder="Allenatore" value={editCoach} onChange={e => setEditCoach(e.target.value)} />
                          <input type="text" className="w-full p-2 bg-white border border-neutral-300 rounded text-sm outline-none focus:border-pink-500 focus:ring-1" placeholder="Vice" value={editAssistantCoach} onChange={e => setEditAssistantCoach(e.target.value)} />
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 text-xs text-neutral-600">
                          {enroll.coach ? <div><span className="font-medium text-neutral-800">C:</span> {enroll.coach}</div> : null}
                          {enroll.assistant_coach ? <div><span className="font-medium text-neutral-800">AC:</span> {enroll.assistant_coach}</div> : null}
                          {!enroll.coach && !enroll.assistant_coach ? <span className="text-neutral-400 italic">Nessuno staff</span> : null}
                        </div>
                      )}
                    </td>

                    <td className="p-4 text-right">
                      {editingEnrollId === enroll.id ? (
                         <div className="flex justify-end gap-1">
                           <button onClick={() => saveEditEnrollment(enroll.id)} className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"><Check size={16}/></button>
                           <button onClick={() => setEditingEnrollId(null)} className="p-2 text-neutral-400 hover:bg-neutral-100 rounded transition-colors"><X size={16}/></button>
                         </div>
                      ) : (
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEditingEnrollment(enroll)} className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"><Edit2 size={16} /></button>
                          <button onClick={() => handleRemoveEnrollment(enroll.id)} className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB 2: ROSTER --- */}
      {activeTab === 'rosters' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          
          <div className="relative">
            <select className="w-full p-4 bg-white border border-neutral-200 rounded-2xl text-base font-semibold text-neutral-800 appearance-none outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-sm" value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}>
              <option value="">Seleziona una squadra per gestire il roster...</option>
              {enrolledTeams.map(enroll => <option key={enroll.team_id} value={enroll.team_id}>{enroll.teams?.name}</option>)}
            </select>
            <ChevronDown size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          </div>

          {selectedTeamId ? (
            <>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
                <h3 className="text-sm font-semibold text-neutral-800 mb-4 flex items-center gap-2">
                  <UserPlus size={16} className="text-neutral-400"/> Aggiungi giocatore
                </h3>
                <form onSubmit={handleInitialSubmit} className="flex flex-col md:flex-row gap-3">
                  <input type="text" placeholder="Nome" className="flex-1 p-3 bg-white border border-neutral-200 rounded-lg text-sm outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all" value={firstName} onChange={e => setFirstName(e.target.value)} required />
                  <input type="text" placeholder="Cognome" className="flex-1 p-3 bg-white border border-neutral-200 rounded-lg text-sm outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all" value={lastName} onChange={e => setLastName(e.target.value)} required />
                  <input type="number" placeholder="Maglia #" className="md:w-28 p-3 bg-white border border-neutral-200 rounded-lg text-sm text-center outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all" value={jersey} onChange={e => setJersey(e.target.value)} />
                  <button type="submit" className="px-6 py-3 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors">Aggiungi</button>
                </form>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-50 text-xs text-neutral-500 border-b border-neutral-200 uppercase tracking-wider">
                    <tr>
                      <th className="p-4 text-center w-16 font-medium">#</th>
                      <th className="p-4 font-medium">Giocatore</th>
                      <th className="p-4 font-medium text-neutral-400">Anagrafica</th>
                      <th className="p-4 text-right font-medium">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {roster.length === 0 ? (
                        <tr><td colSpan="4" className="p-12 text-center text-neutral-400">Nessun giocatore in questo roster.</td></tr>
                    ) : roster.map(item => (
                      <tr key={item.id} className="hover:bg-neutral-50/50 transition-colors group h-14">
                        {editingId === item.id ? (
                          // EDIT MODE ROSTER
                          <>
                            <td className="p-3">
                              <input type="number" className="w-full p-2 bg-white border border-neutral-300 rounded text-center text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500" value={editJersey} onChange={e => setEditJersey(e.target.value)} />
                            </td>
                            <td colSpan="2" className="p-3">
                              <div className="flex gap-2">
                                <input type="text" className="w-1/2 p-2 bg-white border border-neutral-300 rounded text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500" placeholder="Nome" value={editFirstName} onChange={e => setEditFirstName(e.target.value)} />
                                <input type="text" className="w-1/2 p-2 bg-white border border-neutral-300 rounded text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500" placeholder="Cognome" value={editLastName} onChange={e => setLastName(e.target.value)} />
                              </div>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-1">
                                <button onClick={() => saveEditRoster(item)} className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"><Check size={16}/></button>
                                <button onClick={() => setEditingId(null)} className="p-2 text-neutral-400 hover:bg-neutral-100 rounded transition-colors"><X size={16}/></button>
                              </div>
                            </td>
                          </>
                        ) : (
                          // VIEW MODE ROSTER
                          <>
                            <td className="p-4 text-center font-medium text-neutral-500">{item.jersey_number ?? '-'}</td>
                            <td className="p-4 font-semibold text-neutral-900">{getDisplayName(item.players?.first_name, item.players?.last_name)}</td>
                            <td className="p-4 text-xs text-neutral-500">
                              {item.players?.first_name} {item.players?.last_name}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => startEditingRoster(item)} className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"><Edit2 size={16} /></button>
                                <button onClick={() => handleDeleteRosterItem(item.id)} className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            // EMPTY STATE ROSTER
            <div className="bg-white p-12 rounded-2xl shadow-sm border border-dashed border-neutral-200 text-center mt-6">
              <div className="w-12 h-12 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users size={24} className="text-neutral-400" />
              </div>
              <p className="text-sm text-neutral-500">Seleziona una squadra per visualizzare o modificare il suo roster.</p>
            </div>
          )}
        </div>
      )}

      {/* --- MODALE CONFLITTO OMONIMI --- */}
      {showConflictModal && (
        <div className="fixed inset-0 bg-neutral-900/40 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="p-6 border-b border-neutral-100 flex items-start gap-4">
              <div className="p-2 bg-amber-50 text-amber-500 rounded-full shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900">Omonimia Rilevata</h3>
                <p className="text-sm text-neutral-500 mt-1">Esiste già un giocatore con il nome "{firstName} {lastName}".</p>
              </div>
            </div>

            <div className="p-6">
              <p className="text-xs font-semibold text-neutral-700 mb-3">Usa un profilo esistente:</p>
              <div className="space-y-2 mb-6 max-h-40 overflow-y-auto">
                {conflictMatches.map(match => (
                  <button key={match.id} onClick={() => { insertIntoRoster(match.id); setShowConflictModal(false); }} className="w-full text-left p-3 rounded-xl border border-neutral-200 hover:border-pink-500 hover:bg-pink-50 flex justify-between items-center transition-all">
                    <span className="font-medium text-sm text-neutral-800">{match.first_name} {match.last_name}</span>
                    <span className="text-xs text-neutral-500">Nato: {formatDate(match.birth_date)}</span>
                  </button>
                ))}
              </div>

              <div className="border-t border-neutral-100 pt-6">
                <p className="text-xs font-semibold text-neutral-700 mb-3">Oppure crea un nuovo profilo distinto:</p>
                <div className="flex gap-2">
                  <input type="date" className="flex-1 p-2 bg-white border border-neutral-300 rounded-lg text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500" value={newBirthDate} onChange={e => setNewBirthDate(e.target.value)} />
                  <button onClick={handleCreateHomonym} className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors">Crea Nuovo</button>
                </div>
              </div>
            </div>

            <div className="p-4 bg-neutral-50 border-t border-neutral-100 text-right">
              <button onClick={() => setShowConflictModal(false)} className="text-sm font-medium text-neutral-500 hover:text-neutral-800 transition-colors">Annulla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
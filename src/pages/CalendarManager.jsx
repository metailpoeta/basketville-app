import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Calendar as Tv, CalendarIcon, Clock, Plus, Trash2, AlignLeft, Trophy, Edit2, Check, X, AlertCircle, ChevronDown } from 'lucide-react';

export default function CalendarManager() {
  const [activeEdition, setActiveEdition] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Dati
  const [calendars, setCalendars] = useState([]);
  const [availableMatches, setAvailableMatches] = useState([]);
  const [eventsList, setEventsList] = useState([]); 
  
  // Form Stati (Inserimento)
  const [cDate, setCDate] = useState('');
  const [cTime, setCTime] = useState('');
  const [eventType, setEventType] = useState('match'); // 'match' o 'custom'
  const [selectedMatch, setSelectedMatch] = useState('');
  const [customEventId, setCustomEventId] = useState(''); 
  const [description, setDescription] = useState('');

  // --- STATI PER MODIFICA INLINE ---
  const [editingId, setEditingId] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editEventId, setEditEventId] = useState('');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    async function init() {
      setLoading(true);
      const { data: ed } = await supabase.from('editions').select('*').eq('is_active', true).single();
      if (ed) setActiveEdition(ed);

      const { data: evs } = await supabase.from('events').select('*').order('id');
      if (evs) setEventsList(evs);
      
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (activeEdition) {
      loadData();
    }
  }, [activeEdition]);

  async function loadData() {
    const { data: calData } = await supabase
      .from('calendars')
      .select(`
        *,
        events(name),
        matches (
          id,
          match_types(name),
          team_a:team_a_id(teams(name, short_name)),
          team_b:team_b_id(teams(name, short_name))
        )
      `)
      .eq('edition_id', activeEdition.id)
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (calData) setCalendars(calData);

    const { data: matchData } = await supabase
      .from('matches')
      .select(`
        id,
        match_types(name),
        team_a:team_a_id(teams(name, short_name), group_name, event_id),
        team_b:team_b_id(teams(name, short_name))
      `);

    if (matchData && calData) {
      const scheduledMatchIds = calData.filter(c => c.match_id).map(c => c.match_id);
      const unscheduled = matchData.filter(m => !scheduledMatchIds.includes(m.id));
      setAvailableMatches(unscheduled);
    }
  }

  async function handleAddEvent(e) {
    e.preventDefault();
    if (!cDate || !cTime) return alert("Inserisci Data e Ora!");
    
    let finalEventId = null;

    if (eventType === 'match') {
      if (!selectedMatch) return alert("Seleziona una partita!");
      const matchObj = availableMatches.find(m => m.id === selectedMatch);
      finalEventId = matchObj?.team_a?.event_id || 1; 
    } else {
      if (!customEventId) return alert("Seleziona la tipologia di Evento!");
      if (!description.trim()) return alert("Inserisci una descrizione!");
      finalEventId = parseInt(customEventId);
    }

    const { error } = await supabase.from('calendars').insert([{
      edition_id: activeEdition.id,
      event_id: finalEventId,
      date: cDate,
      time: cTime,
      match_id: eventType === 'match' ? selectedMatch : null,
      description: eventType === 'custom' ? description.trim() : null
    }]);

    if (!error) {
      setSelectedMatch('');
      setCustomEventId('');
      setDescription('');
      setCTime('');
      loadData();
    } else {
      alert("Errore: " + error.message);
    }
  }

  const startEditing = (event) => {
    setEditingId(event.id);
    setEditDate(event.date);
    setEditTime(event.time.substring(0, 5)); 
    setEditEventId(event.event_id || '');
    setEditDescription(event.description || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const saveEditing = async (id, isMatch) => {
    let payload = {
      date: editDate,
      time: editTime
    };

    if (!isMatch) {
      payload.event_id = parseInt(editEventId);
      payload.description = editDescription.trim();
    }

    const { error } = await supabase.from('calendars').update(payload).eq('id', id);

    if (!error) {
      setEditingId(null);
      loadData();
    } else {
      alert("Errore salvataggio: " + error.message);
    }
  };

  async function handleDelete(id) {
    if (window.confirm("Vuoi rimuovere questo slot dal calendario? La partita tornerà tra quelle da programmare.")) {
      await supabase.from('calendars').delete().eq('id', id);
      loadData();
    }
  }

  const groupedCalendars = calendars.reduce((acc, curr) => {
    if (!acc[curr.date]) acc[curr.date] = [];
    acc[curr.date].push(curr);
    return acc;
  }, {});

  // --- RENDER STATI INIZIALI ---
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto mt-20 flex flex-col items-center text-neutral-400">
        <div className="w-8 h-8 border-4 border-neutral-200 border-t-pink-500 rounded-full animate-spin mb-4"></div>
        <p className="text-sm">Caricamento calendario...</p>
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
            Per gestire il calendario, devi prima impostare un'edizione come "Attiva" dal pannello di controllo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in pb-20 space-y-8">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-neutral-100 pb-6">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-800">Gestione Palinsesto</h2>
          <p className="text-sm text-neutral-500 mt-1">Edizione {activeEdition?.year}</p>
        </div>
      </div>

      {/* ================= FORM INSERIMENTO ================= */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-neutral-200">
        <h3 className="text-sm font-semibold text-neutral-800 mb-6 flex items-center gap-2">
          <CalendarIcon size={18} className="text-pink-500" /> Aggiungi Nuovo Slot
        </h3>
        
        <form onSubmit={handleAddEvent} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Data Evento</label>
            <input type="date" className="w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-sm" value={cDate} onChange={e => setCDate(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Ora Inizio</label>
            <input type="time" className="w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-sm" value={cTime} onChange={e => setCTime(e.target.value)} required />
          </div>

          <div className="md:col-span-2">
            <div className="flex bg-neutral-100/50 p-1 rounded-xl w-fit border border-neutral-200/50 mb-4">
              <button type="button" onClick={() => setEventType('match')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${eventType === 'match' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}>
                <Trophy size={16} /> Partita Ufficiale
              </button>
              <button type="button" onClick={() => setEventType('custom')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${eventType === 'custom' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}>
                <AlignLeft size={16} /> Evento Custom
              </button>
            </div>

            {eventType === 'match' ? (
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Partita da Programmare</label>
                <div className="relative">
                  <select className="w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 appearance-none outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-sm" value={selectedMatch} onChange={e => setSelectedMatch(e.target.value)}>
                    <option value="">-- Scegli una partita --</option>
                    {availableMatches.length === 0 && <option value="" disabled>Nessuna partita da programmare</option>}
                    {availableMatches.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.match_types?.name || 'Match'} - {m.team_a?.teams?.name} vs {m.team_b?.teams?.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                </div>
                <p className="text-[10px] text-neutral-400 mt-1.5 italic">L'evento corretto (Vero Cup, Old Star, ecc.) verrà assegnato automaticamente.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Categoria Evento</label>
                  <div className="relative">
                    <select className="w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 appearance-none outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-sm" value={customEventId} onChange={e => setCustomEventId(e.target.value)}>
                      <option value="">-- Seleziona --</option>
                      {eventsList.map(ev => (
                        <option key={ev.id} value={ev.id}>{ev.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Descrizione Libera</label>
                  <input type="text" placeholder="Es. Gara da 3 Punti / Premiazioni" className="w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-sm" value={description} onChange={e => setDescription(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="md:col-span-2 mt-2">
            <button type="submit" className="w-full md:w-auto px-6 py-3 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors shadow-sm flex justify-center items-center gap-2">
              <Plus size={18} /> Aggiungi a Calendario
            </button>
          </div>
        </form>
      </div>

      {/* ================= TIMELINE EVENTI ================= */}
      <div className="space-y-6">
        {Object.keys(groupedCalendars).length === 0 ? (
           <div className="bg-white p-12 rounded-2xl shadow-sm border border-dashed border-neutral-300 text-center mt-6">
             <div className="w-12 h-12 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-3">
               <Clock size={24} className="text-neutral-400" />
             </div>
             <p className="text-sm text-neutral-500">Il calendario è vuoto. Inizia a programmare eventi e partite!</p>
           </div>
        ) : (
          Object.keys(groupedCalendars).map(date => (
            <div key={date} className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
              
              {/* Intestazione Giorno CON TASTO OBS */}
              <div className="bg-neutral-50/80 px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CalendarIcon size={18} className="text-neutral-400" />
                  <h3 className="font-semibold text-neutral-800 capitalize">
                    {new Date(date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </h3>
                </div>
                
                {/* Tasto In Onda - Regia OBS */}
                <button 
                  onClick={async () => {
                    const { error } = await supabase.from('broadcast_state').update({
                      active_graphic: 'daily_schedule',
                      payload: { date: date } // Passiamo la stringa della data (es. '2026-07-15')
                    }).eq('id', 1);
                    if (error) alert("Errore Regia: " + error.message);
                  }}
                  className="flex items-center gap-2 px-4 py-1.5 bg-pink-500 text-white font-bold uppercase tracking-widest text-[10px] rounded-lg hover:bg-pink-600 transition-colors shadow-sm"
                  title="Manda in onda la programmazione su OBS"
                >
                  <Tv size={14} /> In Onda
                </button>
              </div>

              {/* Lista Eventi del Giorno */}
              <div className="divide-y divide-neutral-100">
                {groupedCalendars[date].map(event => (
                  <div key={event.id} className="p-4 sm:p-6 flex items-center hover:bg-neutral-50/50 transition-colors group gap-4 min-h-[80px]">
                    
                    {editingId === event.id ? (
                      /* --- MODALITÀ MODIFICA --- */
                      <div className="flex-1 flex flex-col md:flex-row gap-4 items-start md:items-center bg-pink-50/50 p-4 rounded-xl border border-pink-100/50 w-full animate-in fade-in">
                        <div className="flex gap-3 shrink-0">
                          <input type="date" className="p-2 border border-neutral-300 rounded-lg text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 bg-white" value={editDate} onChange={e => setEditDate(e.target.value)} />
                          <input type="time" className="p-2 border border-neutral-300 rounded-lg text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 bg-white" value={editTime} onChange={e => setEditTime(e.target.value)} />
                        </div>

                        <div className="flex-1 flex flex-col sm:flex-row gap-2 w-full">
                          {event.match_id ? (
                            <div className="px-2 self-center">
                              <p className="text-[10px] font-bold text-pink-600 uppercase tracking-widest mb-0.5">{event.events?.name}</p>
                              <p className="text-sm font-semibold text-neutral-800">
                                {event.matches?.team_a?.teams?.name} <span className="text-neutral-400 font-normal px-1">vs</span> {event.matches?.team_b?.teams?.name}
                              </p>
                            </div>
                          ) : (
                            <div className="flex gap-3 w-full">
                              <select className="p-2 border border-neutral-300 rounded-lg text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 bg-white sm:w-1/3" value={editEventId} onChange={e => setEditEventId(e.target.value)}>
                                {eventsList.filter(ev => ev.id !== 1).map(ev => (
                                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                                ))}
                              </select>
                              <input type="text" className="p-2 border border-neutral-300 rounded-lg text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 bg-white flex-1" value={editDescription} onChange={e => setEditDescription(e.target.value)} />
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 shrink-0 md:ml-auto self-end md:self-center w-full md:w-auto justify-end mt-2 md:mt-0">
                          <button onClick={() => saveEditing(event.id, !!event.match_id)} className="bg-green-50 text-green-600 p-2 rounded-lg hover:bg-green-500 hover:text-white transition-colors"><Check size={18}/></button>
                          <button onClick={cancelEditing} className="bg-neutral-100 text-neutral-500 p-2 rounded-lg hover:bg-neutral-200 transition-colors"><X size={18}/></button>
                        </div>
                      </div>
                    ) : (
                      /* --- MODALITÀ VISUALIZZAZIONE --- */
                      <>
                        <div className="w-20 sm:w-24 text-center shrink-0">
                          <p className="text-xl sm:text-2xl font-bold text-neutral-800 tracking-tight">
                            {event.time.substring(0, 5)}
                          </p>
                        </div>

                        <div className="flex-1 sm:border-l border-neutral-100 sm:pl-6">
                          {event.match_id ? (
                            <div>
                              <p className="text-[10px] font-bold text-pink-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                                <span>{event.events?.name}</span>
                                <span className="text-neutral-300">•</span>
                                <span className="text-neutral-500">{event.matches?.match_types?.name}</span>
                              </p>
                              <p className="text-base sm:text-lg font-semibold text-neutral-900">
                                {event.matches?.team_a?.teams?.name} <span className="text-neutral-400 font-normal mx-1 sm:mx-2">vs</span> {event.matches?.team_b?.teams?.name}
                              </p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-[10px] font-bold text-pink-500 uppercase tracking-widest mb-1">
                                {event.events?.name}
                              </p>
                              <p className="text-base sm:text-lg font-semibold text-neutral-700">
                                {event.description}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Azioni */}
                        <div className="flex items-center gap-1 sm:gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => startEditing(event)} className="p-2 sm:p-3 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 rounded-xl transition-colors" title="Modifica">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDelete(event.id)} className="p-2 sm:p-3 text-neutral-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors" title="Rimuovi">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </>
                    )}

                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
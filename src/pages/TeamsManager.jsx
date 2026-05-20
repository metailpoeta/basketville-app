import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, Trash2, Pencil, X, Check } from 'lucide-react';

export default function TeamsManager() {
  const [teams, setTeams] = useState([]);
  
  // Stati per l'inserimento
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamShort, setNewTeamShort] = useState('');

  // Stati per la modifica al volo (Inline Editing)
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editShort, setEditShort] = useState('');

  // 1. CARICA SQUADRE (Read)
  async function fetchTeams() {
    const { data } = await supabase.from('teams').select('*').order('name');
    if (data) setTeams(data);
  }

  useEffect(() => { fetchTeams(); }, []);

  // 2. INSERISCI SQUADRA (Create)
  async function handleAddTeam(e) {
    e.preventDefault();
    if (!newTeamName || !newTeamShort) return;
    const { error } = await supabase.from('teams').insert([
      { name: newTeamName, short_name: newTeamShort.toUpperCase(), primary_color: 'neutral' }
    ]);
    if (!error) {
      setNewTeamName(''); setNewTeamShort(''); fetchTeams();
    } else {
      alert("Errore di salvataggio sul DB!");
    }
  }

  // 3. ELIMINA SQUADRA (Delete)
  async function handleDelete(id) {
    if (window.confirm("Sei sicuro di voler eliminare questa squadra dal palinsesto?")) {
      const { error } = await supabase.from('teams').delete().eq('id', id);
      if (!error) fetchTeams();
      else alert("Errore durante l'eliminazione!");
    }
  }

  // 4. MODIFICA SQUADRA (Update)
  function startEditing(team) {
    setEditingId(team.id);
    setEditName(team.name);
    setEditShort(team.short_name);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditName('');
    setEditShort('');
  }

  async function handleUpdate(id) {
    if (!editName || !editShort) return;
    const { error } = await supabase.from('teams').update({
      name: editName,
      short_name: editShort.toUpperCase()
    }).eq('id', id);

    if (!error) {
      setEditingId(null); // Chiude la modalità di modifica
      fetchTeams();       // Ricarica i dati aggiornati
    } else {
      alert("Errore durante l'aggiornamento!");
    }
  }

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in pb-20 space-y-8">
      
      {/* HEADER UNIFICATO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-neutral-100 pb-6">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-800">Anagrafica Squadre</h2>
          <p className="text-sm text-neutral-500 mt-1">Gestione database globale delle formazioni</p>
        </div>
      </div>

      {/* SEZIONE AGGIUNGI */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-neutral-200">
        <h3 className="text-sm font-semibold text-neutral-800 mb-6">Aggiungi Nuova Squadra</h3>
        <form onSubmit={handleAddTeam} className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <input 
            type="text" 
            placeholder="Nome Squadra (es. Street Dogs)" 
            className="flex-1 w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-sm" 
            value={newTeamName} 
            onChange={e => setNewTeamName(e.target.value)} 
          />
          <input 
            type="text" 
            placeholder="Sigla (es. STR)" 
            maxLength={3} 
            className="w-full md:w-32 p-3 bg-white border border-neutral-200 rounded-lg text-sm text-center font-bold text-neutral-800 uppercase outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-sm" 
            value={newTeamShort} 
            onChange={e => setNewTeamShort(e.target.value)} 
          />
          <button type="submit" className="w-full md:w-auto px-6 py-3 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 flex items-center justify-center transition-colors shadow-sm">
            <Plus size={18} className="mr-2" /> Salva
          </button>
        </form>
      </div>

      {/* SEZIONE TABELLA */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs text-neutral-500 border-b border-neutral-200 uppercase tracking-wider">
            <tr>
              <th className="p-4 font-medium pl-6">Nome Squadra</th>
              <th className="p-4 font-medium w-32">Sigla</th>
              <th className="p-4 font-medium text-right pr-6">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {teams.length === 0 ? (
              <tr><td colSpan="3" className="p-12 text-center text-neutral-400">Nessuna squadra in archivio. Aggiungine una!</td></tr>
            ) : (
              teams.map(team => (
                <tr key={team.id} className="hover:bg-neutral-50/50 transition-colors group h-16">
                  
                  {/* SE LA RIGA È IN MODALITÀ MODIFICA */}
                  {editingId === team.id ? (
                    <>
                      <td className="p-3 pl-6">
                        <input 
                          type="text" 
                          className="w-full p-2 bg-white border border-neutral-300 rounded-lg text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 font-semibold" 
                          value={editName} 
                          onChange={(e) => setEditName(e.target.value)} 
                          autoFocus 
                        />
                      </td>
                      <td className="p-3">
                        <input 
                          type="text" 
                          maxLength={3} 
                          className="w-20 p-2 bg-white border border-neutral-300 rounded-lg text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 uppercase font-bold text-center" 
                          value={editShort} 
                          onChange={(e) => setEditShort(e.target.value)} 
                        />
                      </td>
                      <td className="p-3 pr-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleUpdate(team.id)} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-500 hover:text-white transition-colors" title="Salva">
                            <Check size={18} />
                          </button>
                          <button onClick={cancelEditing} className="p-2 bg-neutral-100 text-neutral-500 rounded-lg hover:bg-neutral-200 transition-colors" title="Annulla">
                            <X size={18} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    /* SE LA RIGA È IN MODALITÀ NORMALE (VISUALIZZAZIONE) */
                    <>
                      <td className="p-4 pl-6 font-semibold text-neutral-900">{team.name}</td>
                      <td className="p-4">
                        <span className="px-3 py-1 bg-white border border-neutral-200 shadow-sm rounded-lg text-xs font-bold tracking-widest text-neutral-600">
                          {team.short_name}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEditing(team)} className="p-2 text-neutral-400 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors" title="Modifica">
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => handleDelete(team.id)} className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Elimina">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
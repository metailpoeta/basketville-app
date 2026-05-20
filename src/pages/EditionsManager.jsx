import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, Pencil, X, Check, Star } from 'lucide-react';

export default function EditionsManager() {
  const [editions, setEditions] = useState([]);
  
  // Stati per nuovo inserimento
  const [newName, setNewName] = useState('');
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [newIsActive, setNewIsActive] = useState(false);

  // Stati per la modifica inline
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editIsActive, setEditIsActive] = useState(false);

  async function fetchEditions() {
    const { data } = await supabase.from('editions').select('*').order('year', { ascending: false });
    if (data) setEditions(data);
  }

  useEffect(() => { fetchEditions(); }, []);

  // FUNZIONE MAGICA: Spegne tutte le edizioni attive
  async function turnOffOtherEditions() {
    await supabase.from('editions').update({ is_active: false }).eq('is_active', true);
  }

  async function handleAddEdition(e) {
    e.preventDefault();
    if (!newName || !newYear) return;

    // Se l'utente vuole che questa sia l'attiva, spegniamo le altre prima di inserirla!
    if (newIsActive) await turnOffOtherEditions();

    const { error } = await supabase.from('editions').insert([
      { name: newName, year: parseInt(newYear), is_active: newIsActive }
    ]);

    if (!error) {
      setNewName(''); setNewYear(new Date().getFullYear()); setNewIsActive(false); fetchEditions();
    } else {
      alert("Errore nell'inserimento");
    }
  }

  function startEditing(ed) {
    setEditingId(ed.id);
    setEditName(ed.name);
    setEditYear(ed.year);
    setEditIsActive(ed.is_active);
  }

  async function handleUpdate(id) {
    if (!editName || !editYear) return;

    // Anche qui: se stiamo attivando questa edizione, spegniamo le altre!
    if (editIsActive) await turnOffOtherEditions();

    const { error } = await supabase.from('editions').update({
      name: editName,
      year: parseInt(editYear),
      is_active: editIsActive
    }).eq('id', id);

    if (!error) {
      setEditingId(null); fetchEditions();
    } else {
      alert("Errore nell'aggiornamento");
    }
  }

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in pb-20 space-y-8">
      
      {/* HEADER UNIFICATO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-neutral-100 pb-6">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-800">Gestione Edizioni</h2>
          <p className="text-sm text-neutral-500 mt-1">Configurazione anni e stagioni del torneo</p>
        </div>
      </div>

      {/* AGGIUNGI EDIZIONE */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-neutral-200">
        <h3 className="text-sm font-semibold text-neutral-800 mb-6">Nuova Edizione</h3>
        <form onSubmit={handleAddEdition} className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <input 
            type="text" 
            placeholder="Nome (es. Basketville 2026)" 
            className="flex-1 w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-sm" 
            value={newName} 
            onChange={e => setNewName(e.target.value)} 
          />
          <input 
            type="number" 
            placeholder="Anno" 
            className="w-full md:w-32 p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-sm text-center" 
            value={newYear} 
            onChange={e => setNewYear(e.target.value)} 
          />
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-600 cursor-pointer px-2 py-3">
            <input 
              type="checkbox" 
              checked={newIsActive} 
              onChange={e => setNewIsActive(e.target.checked)} 
              className="w-4 h-4 accent-pink-500 rounded cursor-pointer" 
            />
            Edizione Attiva
          </label>
          <button type="submit" className="w-full md:w-auto px-6 py-3 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 flex items-center justify-center transition-colors shadow-sm">
            <Plus size={18} className="mr-2" /> Salva
          </button>
        </form>
      </div>

      {/* TABELLA EDIZIONI */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs text-neutral-500 border-b border-neutral-200 uppercase tracking-wider">
            <tr>
              <th className="p-4 font-medium">Nome Edizione</th>
              <th className="p-4 font-medium text-center">Anno</th>
              <th className="p-4 font-medium text-center">Stato</th>
              <th className="p-4 font-medium text-right">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {editions.map(ed => (
              <tr key={ed.id} className="hover:bg-neutral-50/50 transition-colors group h-16">
                
                {editingId === ed.id ? (
                  // MODALITÀ MODIFICA (Inline Edit)
                  <>
                    <td className="p-3">
                      <input type="text" className="w-full p-2 bg-white border border-neutral-300 rounded-lg text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500" value={editName} onChange={e => setEditName(e.target.value)} autoFocus />
                    </td>
                    <td className="p-3">
                      <input type="number" className="w-24 p-2 bg-white border border-neutral-300 rounded-lg text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 mx-auto block text-center" value={editYear} onChange={e => setEditYear(e.target.value)} />
                    </td>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={editIsActive} onChange={e => setEditIsActive(e.target.checked)} className="w-4 h-4 accent-pink-500 rounded cursor-pointer" />
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => handleUpdate(ed.id)} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-500 hover:text-white transition-colors"><Check size={16} /></button>
                        <button onClick={() => setEditingId(null)} className="p-2 bg-neutral-100 text-neutral-500 rounded-lg hover:bg-neutral-200 transition-colors"><X size={16} /></button>
                      </div>
                    </td>
                  </>
                ) : (
                  // MODALITÀ VISUALIZZAZIONE
                  <>
                    <td className="p-4 font-semibold text-neutral-900">{ed.name}</td>
                    <td className="p-4 text-center text-neutral-600 font-medium">{ed.year}</td>
                    <td className="p-4 text-center">
                      {ed.is_active ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs font-semibold">
                          <Star size={12} className="fill-green-700" /> Attiva
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 bg-neutral-100 border border-neutral-200 text-neutral-500 rounded-lg text-xs font-medium">
                          Archiviata
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => startEditing(ed)} className="p-2 text-neutral-400 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="Modifica">
                        <Pencil size={16} />
                      </button>
                      {/* NESSUN TASTO ELIMINA per evitare disastri relazionali */}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
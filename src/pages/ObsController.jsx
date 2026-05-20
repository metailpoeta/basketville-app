import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Target, XCircle, ListOrdered, Flame, Trophy, CalendarDays } from 'lucide-react';

export default function ObsController() {
  const [currentGraphic, setCurrentGraphic] = useState('none');

  // Ascoltiamo in tempo reale cosa c'è in onda, così la plancia si illumina!
  useEffect(() => {
    async function fetchState() {
      const { data } = await supabase.from('broadcast_state').select('*').eq('id', 1).single();
      if (data) setCurrentGraphic(data.active_graphic);
    }
    fetchState();

    const channel = supabase.channel('obs-admin-sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'broadcast_state', filter: 'id=eq.1' }, (payload) => {
        setCurrentGraphic(payload.new.active_graphic);
      }).subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // La funzione magica per mandare il comando
  async function triggerOBS(type, payloadData = {}) {
    const { error } = await supabase.from('broadcast_state').update({
      active_graphic: type,
      payload: payloadData
    }).eq('id', 1);

    if (error) alert("Errore di connessione con OBS: " + error.message);
  }

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in pb-20 space-y-8">
      
      {/* HEADER E TASTO KILL-SWITCH */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-neutral-100 pb-6">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-800">Controller OBS</h2>
          <p className="text-sm text-neutral-500 mt-1">Plancia di comando per le grafiche a tutto schermo</p>
        </div>
        
        <button 
          onClick={() => triggerOBS('none')} 
          className={`flex items-center px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all shadow-sm ${currentGraphic === 'none' ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed' : 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/30'}`}
          disabled={currentGraphic === 'none'}
        >
          <XCircle size={18} className="mr-2" /> Pulisci Schermo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* CARD: 3-POINT CONTEST */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-200">
          <div className="flex items-center gap-4 mb-6 pb-4 border-b border-neutral-100">
            <div className="p-3 bg-pink-50 text-pink-500 rounded-xl"><Target size={24}/></div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-800">3-Point Contest</h3>
              <p className="text-xs text-neutral-500">Grafiche globali</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <button 
              onClick={() => triggerOBS('3point_leaderboard')}
              className={`w-full flex items-center justify-center gap-2 p-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all ${currentGraphic === '3point_leaderboard' ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/30' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
            >
              <ListOrdered size={16} /> Mostra Classifica Top 12
            </button>
            
            {/* TASTO TABELLONE PLAYOFF */}
            <button 
              onClick={() => triggerOBS('3point_bracket')}
              className={`w-full flex items-center justify-center gap-2 p-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all ${currentGraphic === '3point_bracket' ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/30' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
            >
              <Trophy size={16} /> Tabellone Playoff
            </button>
          </div>
        </div>

        {/* Esempio inattivo (Placeholder) */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-200 opacity-60">
          <div className="flex items-center gap-4 mb-6 pb-4 border-b border-neutral-100">
            <div className="p-3 bg-neutral-100 text-neutral-500 rounded-xl"><Trophy size={24}/></div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-800">Torneo Vero Cup</h3>
              <p className="text-xs text-neutral-500">Grafiche in arrivo...</p>
            </div>
          </div>
          <div className="space-y-3">
             <button className="w-full flex items-center justify-center gap-2 p-4 rounded-xl font-bold uppercase tracking-widest text-xs bg-neutral-100 text-neutral-400 cursor-not-allowed">
               Mostra Classifica Gironi
             </button>
          </div>
        </div>

      </div>
    </div>
  );
}
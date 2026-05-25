import React from 'react';
import { Users, Calendar, Trophy, MonitorPlay, Radio, Star, Clock, Tv, ListOrdered, Image as ImageIcon } from 'lucide-react';

export default function AdminLayout({ children, activeView, setActiveView }) {
  // Stile dei bottoni unificato
  const btnClass = "w-full flex items-center px-4 py-3 rounded-xl text-xs font-medium tracking-widest uppercase transition-all text-neutral-400 hover:bg-white/5 hover:text-white";

  return (
    <div className="flex h-screen bg-neutral-100 font-sans text-neutral-900">
      
      <aside className="w-64 bg-neutral-950 text-white flex flex-col shadow-2xl z-20">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-sm font-medium tracking-[0.3em] uppercase text-pink-500 mb-1">Basketville</h1>
          <div className="text-[10px] font-medium tracking-widest text-neutral-500 uppercase">Admin Panel</div>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {/* Disegniamo le icone "fisicamente" senza array dinamici per evitare ogni rischio */}
          <button 
            onClick={() => setActiveView('editions')}
            className={`w-full flex items-center px-4 py-3 rounded-xl text-xs font-medium tracking-widest uppercase transition-all ${activeView === 'editions' ? 'bg-pink-500 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white mb-2'}`}
          >
            <Star size={16} className="mr-4" /> Gestione Edizioni
          </button>

          <button 
            onClick={() => setActiveView('teams')}
            className={`w-full flex items-center px-4 py-3 rounded-xl text-xs font-medium tracking-widest uppercase transition-all ${activeView === 'teams' ? 'bg-pink-500 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white mb-2'}`}
          >
            <Users size={16} className="mr-4" /> Squadre
          </button>
          
          <button 
            onClick={() => setActiveView('enrollments')}
            className={`w-full flex items-center px-4 py-3 rounded-xl text-xs font-medium tracking-widest uppercase transition-all ${activeView === 'enrollments' ? 'bg-pink-500 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white mb-2'}`}
          >
            <Trophy size={16} className="mr-4" /> Iscrizioni & Roster
          </button>
          
          <button 
            onClick={() => setActiveView('schedule')}
            className={`w-full flex items-center px-4 py-3 rounded-xl text-xs font-medium tracking-widest uppercase transition-all ${activeView === 'schedule' ? 'bg-pink-500 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white mb-2'}`}
          >
            <Calendar size={16} className="mr-4" /> Configura Partite
          </button>

          <button 
            onClick={() => setActiveView('contests')}
            className={`w-full flex items-center px-4 py-3 rounded-xl text-xs font-medium tracking-widest uppercase transition-all ${activeView === 'contests' ? 'bg-pink-500 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white mb-2'}`}
          >
            <Star size={16} className="mr-4" /> Gestione Contest
          </button>

          <button 
            onClick={() => setActiveView('calendar')}
            className={`w-full flex items-center px-4 py-3 rounded-xl text-xs font-medium tracking-widest uppercase transition-all ${activeView === 'calendar' ? 'bg-pink-500 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white mb-2'}`}
          >
            <Clock size={16} className="mr-4" /> Palinsesto Eventi
          </button>

          <button 
            onClick={() => setActiveView('draft')}
            className={`w-full flex items-center px-4 py-3 rounded-xl text-xs font-medium tracking-widest uppercase transition-all ${activeView === 'draft' ? 'bg-pink-500 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white mb-2'}`}
          >
            <ListOrdered size={16} className="mr-4" /> Gestione Draft
          </button>
          
          <button 
            onClick={() => setActiveView('live-score')}
            className={`w-full flex items-center px-4 py-3 rounded-xl text-xs font-medium tracking-widest uppercase transition-all ${activeView === 'live-score' ? 'bg-pink-500 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white mb-2'}`}
          >
            <Tv size={16} className="mr-4" /> Regia Partita
          </button>

          {/* NUOVO BOTTONE SPONSOR */}
          <button 
            onClick={() => setActiveView('sponsor-manager')} 
            className={`w-full flex items-center px-4 py-3 rounded-xl text-xs font-medium tracking-widest uppercase transition-all ${activeView === 'sponsor-manager' ? 'bg-pink-500 text-white shadow-lg' : 'text-neutral-400 hover:bg-white/5 hover:text-white mb-2'}`}
          >
            <ImageIcon size={16} className="mr-4" /> Gestione Sponsor
          </button>
          
          <button 
            onClick={() => setActiveView('controller-obs')} 
            className={`w-full flex items-center px-4 py-3 rounded-xl text-xs font-medium tracking-widest uppercase transition-all ${activeView === 'controller-obs' ? 'bg-pink-500 text-white shadow-lg' : 'text-neutral-400 hover:bg-white/5 hover:text-white mb-2'}`}
          >
            <MonitorPlay size={16} className="mr-4" /> Controller OBS
          </button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-neutral-200 p-4 flex justify-between items-center z-10 shadow-sm">
          <h2 className="text-lg font-light text-neutral-800 tracking-wide">Pannello di Controllo</h2>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
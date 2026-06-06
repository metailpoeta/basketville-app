import React, { useState } from 'react';
import { 
  Home, 
  Trophy, 
  Flame, 
  BarChart2, 
  Grid 
} from 'lucide-react';

export default function MobileApp() {
  // Stato per gestire il tab attivo della Bottom Navigation
  const [activeTab, setActiveTab] = useState('home');

  // Funzione che renderizza il contenuto corretto in base al tab selezionato
  const renderTabContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div className="animate-in fade-in duration-300">
            <h2 className="text-2xl font-black text-pink-500 uppercase tracking-wider mb-2">Programma del Giorno</h2>
            <p className="text-neutral-400 text-sm">Qui inseriremo la timeline dei match di oggi con lo swipe per aggiornare.</p>
          </div>
        );
      case 'verocup':
        return (
          <div className="animate-in fade-in duration-300">
            <h2 className="text-2xl font-black text-pink-500 uppercase tracking-wider mb-2">VERO Cup 2026</h2>
            <p className="text-neutral-400 text-sm">Qui inseriremo le classifiche dei gironi e il tabellone dei playoff.</p>
          </div>
        );
      case 'contest':
        return (
          <div className="animate-in fade-in duration-300">
            <h2 className="text-2xl font-black text-pink-500 uppercase tracking-wider mb-2">All-Star Contests</h2>
            <p className="text-neutral-400 text-sm">Qui ci saranno i tabelloni del 3-Point Contest e dello Slam Dunk.</p>
          </div>
        );
      case 'stats':
        return (
          <div className="animate-in fade-in duration-300">
            <h2 className="text-2xl font-black text-pink-500 uppercase tracking-wider mb-2">Classifica Marcatori</h2>
            <p className="text-neutral-400 text-sm">Qui inseriremo la Top 20 dei bomber del torneo.</p>
          </div>
        );
      case 'others':
        return (
          <div className="animate-in fade-in duration-300">
            <h2 className="text-2xl font-black text-pink-500 uppercase tracking-wider mb-2">Altri Tornei</h2>
            <p className="text-neutral-400 text-sm">Qui ci saranno Women, Old, DR1, DR2 e DR3.</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full min-h-screen bg-neutral-950 text-white font-sans flex flex-col pb-24 relative select-none antialiased">
      {/* Sfondo Carbon Fibre leggero per riprendere lo stile OBS */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 pointer-events-none mix-blend-overlay z-0"></div>

      {/* HEADER FISSO IN ALTO */}
      <header className="w-full bg-neutral-900/90 border-b border-neutral-800/60 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-2 h-6 bg-pink-500 rounded-full shadow-[0_0_10px_rgba(236,72,153,0.5)]"></div>
          <h1 className="text-xl font-black uppercase tracking-wider text-white">
            Basketville <span className="text-pink-500">App</span>
          </h1>
        </div>
        <span className="text-[10px] font-bold bg-neutral-800 text-neutral-400 px-2.5 py-1 rounded-full uppercase tracking-widest border border-neutral-700/50">
          Vero Cup '26
        </span>
      </header>

      {/* CONTENUTO PRINCIPALE (Scrollabile verticalmente se i dati superano lo schermo) */}
      <main className="flex-1 z-10 px-5 py-6 overflow-y-auto max-w-md mx-auto w-full">
        {renderTabContent()}
      </main>

      {/* BOTTOM NAVIGATION BAR (Fissa in basso, Mobile-First) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-neutral-900/95 border-t border-neutral-800/80 backdrop-blur-lg pt-2 pb-5 px-4 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] max-w-md mx-auto rounded-t-3xl">
        <div className="flex items-center justify-between w-full">
          
          <button 
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 flex-1 transition-all ${activeTab === 'home' ? 'text-pink-500 scale-105' : 'text-neutral-500 hover:text-neutral-400'}`}
          >
            <Home size={20} className={activeTab === 'home' ? 'drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]' : ''} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
          </button>

          <button 
            onClick={() => setActiveTab('verocup')}
            className={`flex flex-col items-center gap-1 flex-1 transition-all ${activeTab === 'verocup' ? 'text-pink-500 scale-105' : 'text-neutral-500 hover:text-neutral-400'}`}
          >
            <Trophy size={20} className={activeTab === 'verocup' ? 'drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]' : ''} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Torneo</span>
          </button>

          <button 
            onClick={() => setActiveTab('contest')}
            className={`flex flex-col items-center gap-1 flex-1 transition-all ${activeTab === 'contest' ? 'text-pink-500 scale-105' : 'text-neutral-500 hover:text-neutral-400'}`}
          >
            <Flame size={20} className={activeTab === 'contest' ? 'drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]' : ''} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Contest</span>
          </button>

          <button 
            onClick={() => setActiveTab('stats')}
            className={`flex flex-col items-center gap-1 flex-1 transition-all ${activeTab === 'stats' ? 'text-pink-500 scale-105' : 'text-neutral-500 hover:text-neutral-400'}`}
          >
            <BarChart2 size={20} className={activeTab === 'stats' ? 'drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]' : ''} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Stats</span>
          </button>

          <button 
            onClick={() => setActiveTab('others')}
            className={`flex flex-col items-center gap-1 flex-1 transition-all ${activeTab === 'others' ? 'text-pink-500 scale-105' : 'text-neutral-500 hover:text-neutral-400'}`}
          >
            <Grid size={20} className={activeTab === 'others' ? 'drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]' : ''} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Altro</span>
          </button>

        </div>
      </nav>
    </div>
  );
}
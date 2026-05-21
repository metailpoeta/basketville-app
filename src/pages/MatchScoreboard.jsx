import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Clock, Flag, Hand, Volume2 } from 'lucide-react';

export default function MatchScoreboard() {
  // ==========================================
  // STATI LOCALI (COMPLETAMENTE OFFLINE)
  // ==========================================
  const [time, setTime] = useState(600.0); // 10 Minuti = 600s
  const [isRunning, setIsRunning] = useState(false);
  const [period, setPeriod] = useState(1);

  const [teamA, setTeamA] = useState({ name: 'HOME', score: 0, fouls: 0, timeouts: 2 });
  const [teamB, setTeamB] = useState({ name: 'AWAY', score: 0, fouls: 0, timeouts: 2 });

  // Input manuali temporanei (Min, Sec, Decimi)
  const [inputMin, setInputMin] = useState('10');
  const [inputSec, setInputSec] = useState('00');
  const [inputTenths, setInputTenths] = useState('0');

  // Riferimento all'elemento audio della sirena
  const buzzerRef = useRef(null);

  // ==========================================
  // FUNZIONE SIRENA MANUALE
  // ==========================================
  const playBuzzer = () => {
    if (buzzerRef.current) {
      buzzerRef.current.currentTime = 0; // Se già in riproduzione, resetta e riparte istantaneamente
      buzzerRef.current.play().catch(err => console.log("Errore audio:", err));
    }
  };

  // ==========================================
  // MOTORE CRONOMETRO
  // ==========================================
  useEffect(() => {
    let interval = null;
    if (isRunning && time > 0) {
      interval = setInterval(() => {
        setTime(prev => {
          const next = prev - 0.1;
          
          // Se il tempo scade
          if (next <= 0) {
            if (buzzerRef.current) {
              buzzerRef.current.currentTime = 0;
              buzzerRef.current.play().catch(e => console.log(e));
            }
            setIsRunning(false);
            return 0;
          }
          return Number(next.toFixed(1));
        });
      }, 100);
    } else if (time <= 0 && isRunning) {
      setIsRunning(false);
    }
    return () => clearInterval(interval);
  }, [isRunning, time]);

  // ==========================================
  // HELPER FORMATTAZIONE TEMPO
  // ==========================================
  const formatTime = (t) => {
    if (t < 60 && t > 0) {
      // Sotto il minuto: mostra i decimi (es. 59.9)
      return t.toFixed(1);
    }
    // Sopra il minuto: mostra MM:SS
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSetTime = () => {
    setIsRunning(false);
    const m = parseInt(inputMin) || 0;
    const s = parseInt(inputSec) || 0;
    const dec = parseInt(inputTenths) || 0;
    setTime(m * 60 + s + dec / 10);
  };

  // ==========================================
  // AGGIORNAMENTO SQUADRE
  // ==========================================
  const updateTeam = (team, field, value) => {
    if (team === 'A') setTeamA(prev => ({ ...prev, [field]: value }));
    else setTeamB(prev => ({ ...prev, [field]: value }));
  };

  const adjustScore = (team, amount) => {
    if (team === 'A') setTeamA(prev => ({ ...prev, score: Math.max(0, prev.score + amount) }));
    else setTeamB(prev => ({ ...prev, score: Math.max(0, prev.score + amount) }));
  };

  const adjustFouls = (team, amount) => {
    if (team === 'A') setTeamA(prev => ({ ...prev, fouls: Math.max(0, prev.fouls + amount) }));
    else setTeamB(prev => ({ ...prev, fouls: Math.max(0, prev.fouls + amount) }));
  };

  const adjustTimeouts = (team, amount) => {
    if (team === 'A') setTeamA(prev => ({ ...prev, timeouts: Math.max(0, prev.timeouts + amount) }));
    else setTeamB(prev => ({ ...prev, timeouts: Math.max(0, prev.timeouts + amount) }));
  };

  return (
    <div className="h-screen w-full bg-neutral-950 flex font-dimbo overflow-hidden text-white">
      
      {/* TRACCIA AUDIO INVISIBILE CARICATA DALLA CARTELLA LOCAL PUBLIC */}
      <audio ref={buzzerRef} src="/buzzer-nba.mp3" preload="auto" />

      {/* ========================================== */}
      {/* AREA BROADCAST (Cattura questa con OBS) */}
      {/* ========================================== */}
      <div 
        className="flex-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900 to-black relative flex flex-col justify-between" 
        style={{ width: '1280px', height: '720px' }}
      >
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>

        {/* HEADER: LOGO BASKETVILLE OFFLINE */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-0 pointer-events-none">
          <img 
            src="/Basketville_logo.svg" 
            alt="Basketville" 
            className="h-24 w-auto drop-shadow-2xl" 
          />
        </div>

        {/* CORPO CENTRALE */}
        <div className="flex-1 flex items-center justify-center w-full px-12 z-10 gap-8 mt-12">
          
          {/* COLONNA TEAM A */}
          <div className="flex flex-col items-center w-[340px]">
            <h2 className="text-[60px] leading-tight font-black uppercase text-center text-white drop-shadow-lg truncate w-full mb-3 tracking-[4px]">
            {teamA.name}
            </h2>
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl w-full h-[260px] flex items-center justify-center shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 blur-3xl rounded-full"></div>
              <span className="text-[180px] font-black text-white leading-none drop-shadow-[0_0_30px_rgba(236,72,153,0.3)]">
                {teamA.score}
              </span>
            </div>
          </div>

          {/* CRONOMETRO CENTRALE */}
          <div className="w-[420px] flex justify-center items-center mt-16">
            <span className={`text-[160px] font-black tabular-nums leading-none tracking-[4px] ${time <= 60 ? (time <= 10 && isRunning ? 'text-red-500 drop-shadow-[0_0_40px_rgba(239,68,68,0.6)]' : 'text-yellow-400 drop-shadow-[0_0_30px_rgba(250,204,21,0.3)]') : 'text-white drop-shadow-2xl'}`}>
              {formatTime(time)}
            </span>
          </div>

          {/* COLONNA TEAM B */}
          <div className="flex flex-col items-center w-[340px]">
            <h2 className="text-[60px] leading-tight font-black uppercase text-center text-white drop-shadow-lg truncate w-full mb-3 tracking-[4px]">
                {teamB.name}
            </h2>
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl w-full h-[260px] flex items-center justify-center shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full"></div>
              <span className="text-[180px] font-black text-white leading-none drop-shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                {teamB.score}
              </span>
            </div>
          </div>

        </div>

        {/* BOTTOM BAR (FALLI, PERIODO, TIMEOUT) */}
        <div className="h-[200px] w-full flex items-end justify-center pb-12 px-20 z-10">
          <div className="w-full flex justify-between items-end">
            
            {/* STATS TEAM A */}
            <div className="flex gap-8">
              <div className="flex flex-col items-center">
                <span className="text-xl font-bold text-neutral-500 uppercase tracking-widest mb-2">Fouls</span>
                <div className="bg-black/60 border border-neutral-800 rounded-2xl w-24 h-24 flex items-center justify-center">
                  <span className={`text-6xl font-black ${teamA.fouls >= 5 ? 'text-red-500' : 'text-yellow-500'}`}>{teamA.fouls}</span>
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xl font-bold text-neutral-500 uppercase tracking-widest mb-2">Timeouts</span>
                <div className="flex gap-2 mt-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className={`w-6 h-6 rounded-full border-2 ${i < teamA.timeouts ? 'bg-pink-500 border-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.8)]' : 'border-neutral-700 bg-transparent'}`}></div>
                  ))}
                </div>
              </div>
            </div>

            {/* PERIODO CENTRALE */}
            <div className="flex flex-col items-center px-12 mb-4">
              <span className="text-2xl font-bold text-neutral-400 uppercase tracking-[0.4em] mb-2">Period</span>
              <span className="text-8xl font-black text-white drop-shadow-md">
                {period}
              </span>
            </div>

            {/* STATS TEAM B */}
            <div className="flex gap-8">
              <div className="flex flex-col items-center">
                <span className="text-xl font-bold text-neutral-500 uppercase tracking-widest mb-2">Timeouts</span>
                <div className="flex gap-2 mt-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className={`w-6 h-6 rounded-full border-2 ${i < teamB.timeouts ? 'bg-blue-500 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]' : 'border-neutral-700 bg-transparent'}`}></div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xl font-bold text-neutral-500 uppercase tracking-widest mb-2">Fouls</span>
                <div className="bg-black/60 border border-neutral-800 rounded-2xl w-24 h-24 flex items-center justify-center">
                  <span className={`text-6xl font-black ${teamB.fouls >= 5 ? 'text-red-500' : 'text-yellow-500'}`}>{teamB.fouls}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* AREA PLANCIA DI COMANDO (Non vista su OBS) */}
      {/* ========================================== */}
      <div className="flex-1 bg-neutral-900 border-l border-neutral-800 p-8 overflow-y-auto custom-scrollbar">
        
        <div className="mb-6 border-b border-neutral-800 pb-4">
          <h2 className="text-2xl font-black text-white uppercase tracking-widest flex items-center gap-2">
            🎛️ Regia Match
          </h2>
          <p className="text-neutral-500 text-xs mt-1">Modalità Offline - Zero Latenza</p>
        </div>

        {/* REGIA CRONOMETRO & PERIODO */}
        <div className="bg-black/50 border border-neutral-800 p-5 rounded-2xl mb-6 shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 blur-3xl rounded-full"></div>
          
          <h3 className="text-neutral-400 font-bold uppercase tracking-widest text-[10px] mb-4 flex items-center gap-2">
            <Clock size={14}/> Cronometro & Periodo
          </h3>
          
          <div className="grid grid-cols-3 gap-4 mb-2">
            
            {/* AVVIA / PAUSA (Prende tutta la riga) */}
            <button 
              onClick={() => setIsRunning(!isRunning)} 
              className={`col-span-3 py-4 rounded-xl font-black uppercase tracking-widest text-xl flex items-center justify-center gap-3 transition-transform active:scale-95 shadow-lg ${
                isRunning 
                ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-[0_0_15px_rgba(234,179,8,0.3)]' 
                : 'bg-green-500 hover:bg-green-400 text-black shadow-[0_0_15px_rgba(34,197,94,0.3)]'
              }`}
            >
              {isRunning ? <><Pause fill="currentColor" size={20}/> Pausa</> : <><Play fill="currentColor" size={20}/> Avvia</>}
            </button>

            {/* INPUT MANUALE TEMPO (Prende 2/3 dello spazio, input più grandi) */}
            <div className="col-span-2 flex flex-col justify-center bg-neutral-900 p-3 rounded-xl border border-neutral-700">
              <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-2 text-center block w-full">
                Imposta Tempo
              </span>
              <div className="flex items-center gap-2">
                <input type="number" value={inputMin} onChange={e => setInputMin(e.target.value)} className="w-16 bg-black text-white text-center py-2 text-xl rounded-lg font-black outline-none focus:ring-1 focus:ring-pink-500" placeholder="Min" />
                <span className="text-neutral-500 font-bold text-xl">:</span>
                <input type="number" value={inputSec} onChange={e => setInputSec(e.target.value)} className="w-16 bg-black text-white text-center py-2 text-xl rounded-lg font-black outline-none focus:ring-1 focus:ring-pink-500" placeholder="Sec" />
                <span className="text-neutral-500 font-bold text-xl">.</span>
                <input type="number" value={inputTenths} onChange={e => setInputTenths(e.target.value)} className="w-14 bg-black text-white text-center py-2 text-xl rounded-lg font-black outline-none focus:ring-1 focus:ring-pink-500" placeholder="Dec" />
                <button onClick={handleSetTime} className="flex-1 ml-2 bg-neutral-700 hover:bg-pink-600 text-white text-sm font-black uppercase py-3 rounded-lg transition-colors shadow-md">
                  SET
                </button>
              </div>
            </div>

            {/* PERIODO (Prende 1/3 dello spazio, super compatto) */}
            <div className="col-span-1 flex flex-col justify-center bg-neutral-900 p-3 rounded-xl border border-neutral-700">
              <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-2 text-center block w-full">
                Periodo
              </span>
              <div className="flex items-center justify-between bg-black rounded-lg p-1 border border-neutral-800">
                <button onClick={() => setPeriod(p => Math.max(1, p - 1))} className="w-10 h-10 bg-neutral-800 hover:bg-neutral-700 text-white font-black text-2xl rounded flex items-center justify-center transition-colors active:scale-95">-</button>
                <span className="text-3xl font-black text-white">{period}</span>
                <button onClick={() => setPeriod(p => p + 1)} className="w-10 h-10 bg-neutral-800 hover:bg-neutral-700 text-white font-black text-2xl rounded flex items-center justify-center transition-colors active:scale-95">+</button>
              </div>
            </div>

            {/* PULSANTE GIGANTE PER LA SIRENA MANUALE */}
            <button 
              onClick={playBuzzer}
              className="col-span-3 mt-2 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black uppercase tracking-widest text-lg flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(220,38,38,0.4)] transition-all active:scale-95 border border-red-400/50"
            >
              <Volume2 size={24} /> Suona Sirena
            </button>
            
          </div>
        </div>
        
        {/* REGIA SQUADRE */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          
          {/* TEAM A */}
          <div className="bg-black/50 border border-neutral-800 p-5 rounded-2xl shadow-md border-t-4 border-t-pink-500">
            <input 
              type="text" 
              value={teamA.name}
              onChange={(e) => updateTeam('A', 'name', e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 text-white rounded-lg px-4 py-2 font-black uppercase text-xl mb-4 text-center focus:border-pink-500 outline-none"
            />
            
            <div className="flex flex-col items-center bg-neutral-900 rounded-xl p-4 mb-4">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">Punteggio ({teamA.score})</span>
              <div className="flex gap-2 w-full justify-center mb-3">
                <button onClick={() => adjustScore('A', 1)} className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg font-black text-lg">+1</button>
                <button onClick={() => adjustScore('A', 2)} className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg font-black text-lg">+2</button>
                <button onClick={() => adjustScore('A', 3)} className="flex-1 py-3 bg-pink-600 hover:bg-pink-500 rounded-lg font-black text-lg shadow-lg">+3</button>
              </div>
              <div className="flex w-full gap-2">
                <button onClick={() => adjustScore('A', -1)} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg font-bold text-sm">-1 pt</button>
                <input type="number" value={teamA.score} onChange={e => updateTeam('A', 'score', parseInt(e.target.value) || 0)} className="flex-1 bg-black text-center rounded-lg border border-neutral-700 font-bold outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-neutral-900 p-3 rounded-xl flex flex-col items-center">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2"><Flag size={12} className="inline mr-1"/>Falli ({teamA.fouls})</span>
                <div className="flex gap-2 w-full">
                  <button onClick={() => adjustFouls('A', -1)} className="flex-1 bg-neutral-800 rounded py-1 font-bold">-</button>
                  <button onClick={() => adjustFouls('A', 1)} className="flex-1 bg-neutral-700 hover:bg-neutral-600 rounded py-1 font-bold">+</button>
                </div>
              </div>
              <div className="bg-neutral-900 p-3 rounded-xl flex flex-col items-center">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2"><Hand size={12} className="inline mr-1"/>Time ({teamA.timeouts})</span>
                <div className="flex gap-2 w-full">
                  <button onClick={() => adjustTimeouts('A', -1)} className="flex-1 bg-neutral-800 rounded py-1 font-bold">-</button>
                  <button onClick={() => adjustTimeouts('A', 1)} className="flex-1 bg-neutral-700 hover:bg-neutral-600 rounded py-1 font-bold">+</button>
                </div>
              </div>
            </div>
          </div>

          {/* TEAM B */}
          <div className="bg-black/50 border border-neutral-800 p-5 rounded-2xl shadow-md border-t-4 border-t-blue-500">
            <input 
              type="text" 
              value={teamB.name}
              onChange={(e) => updateTeam('B', 'name', e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 text-white rounded-lg px-4 py-2 font-black uppercase text-xl mb-4 text-center focus:border-blue-500 outline-none"
            />
            
            <div className="flex flex-col items-center bg-neutral-900 rounded-xl p-4 mb-4">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">Punteggio ({teamB.score})</span>
              <div className="flex gap-2 w-full justify-center mb-3">
                <button onClick={() => adjustScore('B', 1)} className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg font-black text-lg">+1</button>
                <button onClick={() => adjustScore('B', 2)} className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg font-black text-lg">+2</button>
                <button onClick={() => adjustScore('B', 3)} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-black text-lg shadow-lg">+3</button>
              </div>
              <div className="flex w-full gap-2">
                <button onClick={() => adjustScore('B', -1)} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg font-bold text-sm">-1 pt</button>
                <input type="number" value={teamB.score} onChange={e => updateTeam('B', 'score', parseInt(e.target.value) || 0)} className="flex-1 bg-black text-center rounded-lg border border-neutral-700 font-bold outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-neutral-900 p-3 rounded-xl flex flex-col items-center">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2"><Flag size={12} className="inline mr-1"/>Falli ({teamB.fouls})</span>
                <div className="flex gap-2 w-full">
                  <button onClick={() => adjustFouls('B', -1)} className="flex-1 bg-neutral-800 rounded py-1 font-bold">-</button>
                  <button onClick={() => adjustFouls('B', 1)} className="flex-1 bg-neutral-700 hover:bg-neutral-600 rounded py-1 font-bold">+</button>
                </div>
              </div>
              <div className="bg-neutral-900 p-3 rounded-xl flex flex-col items-center">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2"><Hand size={12} className="inline mr-1"/>Time ({teamB.timeouts})</span>
                <div className="flex gap-2 w-full">
                  <button onClick={() => adjustTimeouts('B', -1)} className="flex-1 bg-neutral-800 rounded py-1 font-bold">-</button>
                  <button onClick={() => adjustTimeouts('B', 1)} className="flex-1 bg-neutral-700 hover:bg-neutral-600 rounded py-1 font-bold">+</button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
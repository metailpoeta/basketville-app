import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Clock, Flag, Hand, Volume2, Check, X } from 'lucide-react';

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

  // NUOVI RIFERIMENTI PER PRESTAZIONI MASSIME
  const timeRef = useRef(600.0);
  const timerDisplayRef = useRef(null);
  // STATO PER LA CONFERMA DEL TEMPO
  const [isConfirmingTime, setIsConfirmingTime] = useState(false);
  // 🎯 NUOVO: STATO PER IL RITARDO DELLA SIRENA IN SECONDI
  const [buzzerDelay, setBuzzerDelay] = useState(0);

  // ==========================================
  // LOGICA DOPPIO-STEP TEMPO (AGGIORNATA PER LED WALL)
  // ==========================================
  const handleSetTimeConfirm = () => {
    const m = parseInt(inputMin) || 0;
    const s = parseInt(inputSec) || 0;
    const dec = parseInt(inputTenths) || 0;
    const newTime = m * 60 + s + dec / 10;
    
    setIsRunning(false);
    setTime(newTime);
    timeRef.current = newTime; 
    
    if (timerDisplayRef.current) {
      timerDisplayRef.current.innerText = formatTime(newTime);
      if (newTime > 60) {
        timerDisplayRef.current.className = "text-[200px] drop-shadow-xl font-black tabular-nums leading-none tracking-[4px] text-white";
      }
    }
    // Resetta lo stato di conferma
    setIsConfirmingTime(false);
  };

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
  // MOTORE CRONOMETRO (AGGIORNATO PER LED WALL)
  // ==========================================
  useEffect(() => {
    let animationFrameId;

    if (isRunning && time > 0) {
      timeRef.current = time;
      const endTime = Date.now() + timeRef.current * 1000;

      const updateTimer = () => {
        const remainingMs = endTime - Date.now();

        if (remainingMs <= 0) {
          setTime(0);
          timeRef.current = 0;
          setIsRunning(false);
          if (timerDisplayRef.current) timerDisplayRef.current.innerText = "0.0";

          // Esegue la sirena tenendo conto del ritardo (convertito in millisecondi)
          if (buzzerDelay > 0) {
            setTimeout(() => {
              if (buzzerRef.current) {
                buzzerRef.current.currentTime = 0;
                buzzerRef.current.play().catch(e => console.log(e));
              }
            }, buzzerDelay); // <-- LEGGE DIRETTAMENTE I MS (es. 800)
          } else {
            if (buzzerRef.current) {
              buzzerRef.current.currentTime = 0;
              buzzerRef.current.play().catch(e => console.log(e));
            }
          }
        } else {
          timeRef.current = remainingMs / 1000;
          
          if (timerDisplayRef.current) {
            timerDisplayRef.current.innerText = formatTime(timeRef.current);
            
            if (timeRef.current <= 10) {
              timerDisplayRef.current.className = "text-[200px] drop-shadow-xl font-black tabular-nums leading-none tracking-[4px] text-red-500";
            } else if (timeRef.current <= 60) {
              timerDisplayRef.current.className = "text-[200px] drop-shadow-xl font-black tabular-nums leading-none tracking-[4px] text-yellow-400";
            } else {
              timerDisplayRef.current.className = "text-[200px] drop-shadow-xl font-black tabular-nums leading-none tracking-[4px] text-white";
            }
          }
          animationFrameId = requestAnimationFrame(updateTimer);
        }
      };

      animationFrameId = requestAnimationFrame(updateTimer);
    }

    return () => {
      // Ferma l'animazione, ma NON gestiamo qui il salvataggio
      cancelAnimationFrame(animationFrameId);
    };
  }, [isRunning]);

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
    const m = parseInt(inputMin) || 0;
    const s = parseInt(inputSec) || 0;
    const dec = parseInt(inputTenths) || 0;
    const newTime = m * 60 + s + dec / 10;
    
    setIsRunning(false);
    setTime(newTime);
    timeRef.current = newTime; // Sincronizza subito il motore offline
    
    // Aggiorna istantaneamente il testo a schermo a bocce ferme
    if (timerDisplayRef.current) {
      timerDisplayRef.current.innerText = formatTime(newTime);
      // Ripristina il colore bianco se imposti un tempo > 60s
      if (newTime > 60) {
        timerDisplayRef.current.className = "text-[200px] drop-shadow-xl font-black tabular-nums leading-none tracking-[4px] text-white";
      }
    }
  };

  // ==========================================
  // GESTIONE PLAY / PAUSA SICURA
  // ==========================================
  const handleToggleTimer = () => {
    if (isRunning) {
      // Stiamo mettendo in PAUSA: salviamo il tempo preciso al millesimo
      setIsRunning(false);
      setTime(timeRef.current); 
    } else {
      // Stiamo avviando
      setIsRunning(true);
    }
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
        className="flex-none bg-neutral-900 relative flex flex-col justify-between" 
        style={{ width: '1280px', height: '720px' }}
      >
        {/* Aumentata leggermente l'opacità del pattern per non farlo sparire sui LED Wall */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-15 pointer-events-none mix-blend-overlay"></div>

        {/* HEADER: LOGO BASKETVILLE OFFLINE (Scalato h-24 -> h-32) */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-0 pointer-events-none drop-shadow-lg">
          <img 
            src="/Basketville_logo.svg" 
            alt="Basketville" 
            className="h-32 w-auto" 
          />
        </div>

        {/* CORPO CENTRALE */}
        <div className="flex-1 flex items-center justify-center w-full px-10 z-10 gap-12 mt-16">
          
          {/* COLONNA TEAM A */}
          <div className="flex flex-col items-center w-[400px]">
            <h2 className="text-[75px] drop-shadow-md leading-tight font-black uppercase text-center text-white truncate w-full mb-4 tracking-wider">
            {teamA.name}
            </h2>
            <div className="bg-neutral-900 border-4 border-neutral-600 rounded-[2rem] w-full h-[300px] flex items-center justify-center relative overflow-hidden shadow-2xl">
              <span className="text-[220px] font-black tracking-wider text-white leading-none drop-shadow-lg translate-x-1 translate-y-1">
                {teamA.score}
              </span>
            </div>
          </div>

          {/* CRONOMETRO CENTRALE SUPER-LEGGERO */}
          <div className="w-[480px] flex justify-center items-center mt-20">
            <span 
              ref={timerDisplayRef}
              className={`text-[200px] drop-shadow-xl font-black tabular-nums leading-none tracking-wider ${time <= 60 ? (time <= 10 ? 'text-red-500' : 'text-yellow-400') : 'text-white'}`}
            >
              {formatTime(time)}
            </span>
          </div>

          {/* COLONNA TEAM B */}
          <div className="flex flex-col items-center w-[400px]">
            <h2 className="text-[75px] drop-shadow-md leading-tight font-black uppercase text-center text-white truncate w-full mb-4 tracking-wider">
                {teamB.name}
            </h2>
            <div className="bg-neutral-900 border-4 border-neutral-600 rounded-[2rem] w-full h-[300px] flex items-center justify-center relative overflow-hidden shadow-2xl">
              <span className="text-[220px] font-black tracking-wider text-white leading-none drop-shadow-lg translate-x-1 translate-y-1">
                {teamB.score}
              </span>
            </div>
          </div>

        </div>

        {/* BOTTOM BAR (FALLI, PERIODO, TIMEOUT) */}
        <div className="h-[240px] w-full flex items-end justify-center pb-10 px-12 z-10">
          <div className="w-full flex justify-between items-end">
            
            {/* STATS TEAM A */}
            <div className="flex gap-10">
              <div className="flex flex-col items-center">
                <span className="text-3xl font-black text-white drop-shadow-md uppercase tracking-wider mb-3">Fouls</span>
                <div className="bg-black border-4 border-neutral-600 shadow-xl rounded-2xl w-32 h-32 flex items-center justify-center">
                  <span className={`text-[80px] translate-y-1 font-black ${teamA.fouls >= 5 ? 'text-red-500' : 'text-yellow-500'}`}>{teamA.fouls}</span>
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-3xl font-black text-white drop-shadow-md uppercase tracking-wider mb-3">Timeouts</span>
                <div className="flex gap-3 mt-6">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className={`w-10 h-10 rounded-full border-4 shadow-sm ${i < teamA.timeouts ? 'bg-pink-500 border-pink-500' : 'border-white/30 bg-black/50'}`}></div>
                  ))}
                </div>
              </div>
            </div>

            {/* PERIODO CENTRALE */}
            <div className="flex flex-col items-center px-12 mb-4">
              <span className="text-4xl font-black text-white drop-shadow-md uppercase tracking-wider mb-1 translate-y-[1px]">Period</span>
              <span className="text-[120px] font-black text-white drop-shadow-xl leading-none translate-y-[14px]">
                {period}
              </span>
            </div>

            {/* STATS TEAM B */}
            <div className="flex gap-10">
              <div className="flex flex-col items-center">
                <span className="text-3xl font-black text-white drop-shadow-md uppercase tracking-wider mb-3">Timeouts</span>
                <div className="flex gap-3 mt-6">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className={`w-10 h-10 rounded-full border-4 shadow-sm ${i < teamB.timeouts ? 'bg-blue-500 border-blue-500' : 'border-white/30 bg-black/50'}`}></div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-3xl font-black text-white drop-shadow-md uppercase tracking-wider mb-3">Fouls</span>
                <div className="bg-black border-4 border-neutral-600 shadow-xl rounded-2xl w-32 h-32 flex items-center justify-center">
                  <span className={`text-[80px] translate-y-1 font-black ${teamB.fouls >= 5 ? 'text-red-500' : 'text-yellow-500'}`}>{teamB.fouls}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* AREA PLANCIA DI COMANDO (Touch-Friendly) */}
      {/* ========================================== */}
      <div className="flex-1 bg-neutral-900 border-l border-neutral-800 p-8 overflow-y-auto custom-scrollbar">
        
        <div className="mb-6 border-b border-neutral-800 pb-4">
          <h2 className="text-3xl font-black text-white uppercase tracking-wider flex items-center gap-3">
            🎛️ Regia Match
          </h2>
          <p className="text-neutral-500 text-sm mt-1">Interfaccia Touch Ottimizzata</p>
        </div>

        {/* REGIA CRONOMETRO & PERIODO */}
        <div className="bg-black/50 border border-neutral-800 p-6 rounded-3xl mb-8 relative overflow-hidden">
          
          <h3 className="text-neutral-400 font-bold uppercase tracking-wider text-[12px] mb-6 flex items-center gap-2">
            <Clock size={16}/> Cronometro & Periodo
          </h3>
          
          <div className="grid grid-cols-3 gap-6 mb-2">
            
            {/* AVVIA / PAUSA (Gigante) */}
            <button 
              onClick={handleToggleTimer} 
              className={`col-span-3 h-24 rounded-2xl font-black uppercase tracking-wider text-4xl flex items-center justify-center gap-4 transition-transform active:scale-95 ${
                isRunning 
                ? 'bg-yellow-500 hover:bg-yellow-400 text-black' 
                : 'bg-green-500 hover:bg-green-400 text-black'
              }`}
            >
              {isRunning ? <><Pause fill="currentColor" size={36}/> Pausa</> : <><Play fill="currentColor" size={36}/> Avvia</>}
            </button>

            {/* INPUT MANUALE TEMPO + CONFERMA */}
            <div className="col-span-2 flex flex-col justify-center bg-neutral-900 p-4 rounded-2xl border border-neutral-700">
              <span className="text-xs text-neutral-500 uppercase font-bold tracking-wider mb-3 text-center block w-full">
                Imposta Tempo
              </span>
              <div className="flex items-center gap-2">
                <input type="number" value={inputMin} onChange={e => setInputMin(e.target.value)} className="w-20 bg-black text-white text-center h-[72px] text-3xl rounded-xl font-black outline-none focus:ring-2 focus:ring-pink-500" placeholder="Min" />
                <span className="text-neutral-500 font-bold text-3xl">:</span>
                <input type="number" value={inputSec} onChange={e => setInputSec(e.target.value)} className="w-20 bg-black text-white text-center h-[72px] text-3xl rounded-xl font-black outline-none focus:ring-2 focus:ring-pink-500" placeholder="Sec" />
                <span className="text-neutral-500 font-bold text-3xl">.</span>
                <input type="number" value={inputTenths} onChange={e => setInputTenths(e.target.value)} className="w-16 bg-black text-white text-center h-[72px] text-3xl rounded-xl font-black outline-none focus:ring-2 focus:ring-pink-500" placeholder="Dec" />
                
                {/* LOGICA DOPPIO STEP CONFERMA */}
                {isConfirmingTime ? (
                  <div className="flex flex-1 gap-2 ml-2 h-[72px]">
                    <button onClick={handleSetTimeConfirm} className="flex-1 bg-green-500 text-black font-black rounded-xl flex items-center justify-center transition-colors active:scale-95">
                      <Check size={36} />
                    </button>
                    <button onClick={() => setIsConfirmingTime(false)} className="w-[72px] bg-neutral-700 text-neutral-400 hover:text-white hover:bg-red-500 font-black rounded-xl flex items-center justify-center transition-colors active:scale-95">
                      <X size={36} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setIsConfirmingTime(true)} className="flex-1 ml-2 bg-neutral-700 hover:bg-pink-600 text-white text-2xl font-black uppercase h-[72px] rounded-xl transition-colors active:scale-95">
                    SET
                  </button>
                )}
              </div>
            </div>

            {/* PERIODO (Gigante) */}
            <div className="col-span-1 flex flex-col justify-center bg-neutral-900 p-4 rounded-2xl border border-neutral-700">
              <span className="text-xs text-neutral-500 uppercase font-bold tracking-wider mb-3 text-center block w-full">
                Periodo
              </span>
              <div className="flex items-center justify-between bg-black rounded-xl p-1.5 border border-neutral-800 h-[72px]">
                <button onClick={() => setPeriod(p => Math.max(1, p - 1))} className="w-16 h-full bg-neutral-800 hover:bg-neutral-700 text-white font-black text-4xl rounded-lg flex items-center justify-center transition-colors active:scale-95">-</button>
                <span className="text-4xl font-black text-white">{period}</span>
                <button onClick={() => setPeriod(p => p + 1)} className="w-16 h-full bg-neutral-800 hover:bg-neutral-700 text-white font-black text-4xl rounded-lg flex items-center justify-center transition-colors active:scale-95">+</button>
              </div>
            </div>

            {/* PULSANTE GIGANTE PER LA SIRENA MANUALE + RITARDO */}
            <div className="col-span-3 mt-4 flex gap-4">
              <button 
                onClick={playBuzzer}
                className="flex-1 h-24 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black uppercase tracking-wider text-2xl flex items-center justify-center gap-3 transition-all active:scale-95 border border-red-400/50"
              >
                <Volume2 size={32} /> Suona Sirena
              </button>
              
              <div className="w-[180px] bg-neutral-900 border border-neutral-700 rounded-2xl flex flex-col items-center justify-center">
                <span className="text-[11px] text-white uppercase font-bold tracking-wider mb-2">Ritardo Zero (ms)</span>
                <input 
                  type="number" 
                  step="100"
                  min="0"
                  value={buzzerDelay} 
                  onChange={e => setBuzzerDelay(parseInt(e.target.value) || 0)} 
                  className="w-28 bg-black text-white text-center h-12 text-2xl rounded-xl font-black outline-none focus:ring-2 focus:ring-red-500" 
                />
              </div>
            </div>
            
          </div>
        </div>
        
        {/* REGIA SQUADRE */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* TEAM A */}
          <div className="bg-black/50 border border-neutral-800 p-6 rounded-3xl border-t-8 border-t-pink-500">
            <input 
              type="text" 
              value={teamA.name}
              onChange={(e) => updateTeam('A', 'name', e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 text-white rounded-2xl px-6 h-20 font-black uppercase text-4xl mb-6 text-center focus:border-pink-500 outline-none"
            />
            
            <div className="flex flex-col items-center bg-neutral-900 rounded-2xl p-5 mb-6">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4">Punteggio ({teamA.score})</span>
              <div className="flex gap-4 w-full justify-center mb-4">
                <button onClick={() => adjustScore('A', 1)} className="flex-1 h-20 bg-neutral-800 rounded-xl font-black text-3xl active:scale-95 transition-transform">+1</button>
                <button onClick={() => adjustScore('A', 2)} className="flex-1 h-20 bg-neutral-800 rounded-xl font-black text-3xl active:scale-95 transition-transform">+2</button>
                <button onClick={() => adjustScore('A', 3)} className="flex-1 h-20 bg-pink-600 rounded-xl font-black text-3xl active:scale-95 transition-transform">+3</button>
              </div>
              <div className="flex w-full gap-4">
                <button onClick={() => adjustScore('A', -1)} className="px-6 h-16 bg-neutral-800 rounded-xl font-bold text-xl active:scale-95 transition-transform">-1 pt</button>
                <input type="number" value={teamA.score} onChange={e => updateTeam('A', 'score', parseInt(e.target.value) || 0)} className="flex-1 bg-black text-center rounded-xl border border-neutral-700 font-black text-3xl outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-neutral-900 p-4 rounded-2xl flex flex-col items-center">
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3"><Flag size={14} className="inline mr-1"/>Falli ({teamA.fouls})</span>
                <div className="flex gap-3 w-full">
                  <button onClick={() => adjustFouls('A', -1)} className="flex-1 bg-neutral-800 h-16 rounded-xl font-black text-3xl active:scale-95 transition-transform">-</button>
                  <button onClick={() => adjustFouls('A', 1)} className="flex-1 bg-neutral-700 h-16 rounded-xl font-black text-3xl active:scale-95 transition-transform">+</button>
                </div>
              </div>
              <div className="bg-neutral-900 p-4 rounded-2xl flex flex-col items-center">
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3"><Hand size={14} className="inline mr-1"/>Time ({teamA.timeouts})</span>
                <div className="flex gap-3 w-full">
                  <button onClick={() => adjustTimeouts('A', -1)} className="flex-1 bg-neutral-800 h-16 rounded-xl font-black text-3xl active:scale-95 transition-transform">-</button>
                  <button onClick={() => adjustTimeouts('A', 1)} className="flex-1 bg-neutral-700 h-16 rounded-xl font-black text-3xl active:scale-95 transition-transform">+</button>
                </div>
              </div>
            </div>
          </div>

          {/* TEAM B */}
          <div className="bg-black/50 border border-neutral-800 p-6 rounded-3xl border-t-8 border-t-blue-500">
            <input 
              type="text" 
              value={teamB.name}
              onChange={(e) => updateTeam('B', 'name', e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 text-white rounded-2xl px-6 h-20 font-black uppercase text-4xl mb-6 text-center focus:border-blue-500 outline-none"
            />
            
            <div className="flex flex-col items-center bg-neutral-900 rounded-2xl p-5 mb-6">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4">Punteggio ({teamB.score})</span>
              <div className="flex gap-4 w-full justify-center mb-4">
                <button onClick={() => adjustScore('B', 1)} className="flex-1 h-20 bg-neutral-800 rounded-xl font-black text-3xl active:scale-95 transition-transform">+1</button>
                <button onClick={() => adjustScore('B', 2)} className="flex-1 h-20 bg-neutral-800 rounded-xl font-black text-3xl active:scale-95 transition-transform">+2</button>
                <button onClick={() => adjustScore('B', 3)} className="flex-1 h-20 bg-blue-600 rounded-xl font-black text-3xl active:scale-95 transition-transform">+3</button>
              </div>
              <div className="flex w-full gap-4">
                <button onClick={() => adjustScore('B', -1)} className="px-6 h-16 bg-neutral-800 rounded-xl font-bold text-xl active:scale-95 transition-transform">-1 pt</button>
                <input type="number" value={teamB.score} onChange={e => updateTeam('B', 'score', parseInt(e.target.value) || 0)} className="flex-1 bg-black text-center rounded-xl border border-neutral-700 font-black text-3xl outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-neutral-900 p-4 rounded-2xl flex flex-col items-center">
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3"><Flag size={14} className="inline mr-1"/>Falli ({teamB.fouls})</span>
                <div className="flex gap-3 w-full">
                  <button onClick={() => adjustFouls('B', -1)} className="flex-1 bg-neutral-800 h-16 rounded-xl font-black text-3xl active:scale-95 transition-transform">-</button>
                  <button onClick={() => adjustFouls('B', 1)} className="flex-1 bg-neutral-700 h-16 rounded-xl font-black text-3xl active:scale-95 transition-transform">+</button>
                </div>
              </div>
              <div className="bg-neutral-900 p-4 rounded-2xl flex flex-col items-center">
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3"><Hand size={14} className="inline mr-1"/>Time ({teamB.timeouts})</span>
                <div className="flex gap-3 w-full">
                  <button onClick={() => adjustTimeouts('B', -1)} className="flex-1 bg-neutral-800 h-16 rounded-xl font-black text-3xl active:scale-95 transition-transform">-</button>
                  <button onClick={() => adjustTimeouts('B', 1)} className="flex-1 bg-neutral-700 h-16 rounded-xl font-black text-3xl active:scale-95 transition-transform">+</button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
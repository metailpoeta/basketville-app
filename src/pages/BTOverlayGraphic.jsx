import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

// Posizioni di partenza (se non c'è nulla salvato in memoria)
const DEFAULT_LAYOUT = {
  teamA: { x: 100, y: 150, w: 600, h: 200 },
  teamB: { x: 1220, y: 150, w: 600, h: 200 },
  badge: { x: 760, y: 50, w: 400, h: 120 },
  foulsA: { x: 500, y: 650, w: 200, h: 70 },
  foulsB: { x: 1220, y: 650, w: 200, h: 70 },
  period: { x: 860, y: 680, w: 200, h: 70 },
  timeoutA: { x: 450, y: 850, w: 300, h: 70 },
  timeoutB: { x: 1170, y: 850, w: 300, h: 70 },
};

export default function BTOverlayGraphic() {
  const [broadcastState, setBroadcastState] = useState({ active_graphic: 'none', payload: {} });
  const [matchData, setMatchData] = useState(null);

  // STATI PER L'EDITOR INTERATTIVO
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [elements, setElements] = useState(() => {
    const saved = localStorage.getItem('bt_overlay_layout');
    try { return saved ? JSON.parse(saved) : DEFAULT_LAYOUT; } 
    catch { return DEFAULT_LAYOUT; }
  });

  // Supabase Fetching (Partita)
  useEffect(() => {
    const cmdChannel = supabase.channel('obs-director')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'broadcast_state', filter: 'id=eq.1' }, (payload) => {
        setBroadcastState(payload.new);
      }).subscribe();
    return () => supabase.removeChannel(cmdChannel);
  }, []);

  useEffect(() => {
    const fetchMatch = async (matchId) => {
      if (!matchId) return;
      const { data: match } = await supabase.from('matches').select('*, team_a:team_a_id(teams(name)), team_b:team_b_id(teams(name)), match_types(name)').eq('id', matchId).single();
      const { data: calData } = await supabase.from('calendars').select('events(name)').eq('match_id', matchId).maybeSingle();
      if (match) setMatchData({ ...match, event_name: calData?.events?.name || 'TORNEO' });
    };
    if (broadcastState.payload?.match_id) fetchMatch(broadcastState.payload.match_id);
  }, [broadcastState]);

  // Motore Tastiera (Spostamento e Ridimensionamento millimetrico)
  useEffect(() => {
    if (!isEditMode || !selectedId) return;

    const handleKeyDown = (e) => {
      const el = elements[selectedId];
      if (!el) return;

      let { x, y, w, h } = el;
      const step = e.altKey ? 10 : 1; // Tieni premuto ALT per muoverti di 10px alla volta

      if (e.shiftKey) {
        // MAIUSC + Frecce = Ridimensiona
        if (e.key === 'ArrowRight') w += step;
        if (e.key === 'ArrowLeft') w -= step;
        if (e.key === 'ArrowDown') h += step;
        if (e.key === 'ArrowUp') h -= step;
      } else {
        // Solo Frecce = Sposta
        if (e.key === 'ArrowRight') x += step;
        if (e.key === 'ArrowLeft') x -= step;
        if (e.key === 'ArrowDown') y += step;
        if (e.key === 'ArrowUp') y -= step;
      }

      if (x !== el.x || y !== el.y || w !== el.w || h !== el.h) {
        e.preventDefault();
        setElements(prev => ({ ...prev, [selectedId]: { x, y, w, h } }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditMode, selectedId, elements]);

  // Salvataggio
  const saveLayout = () => {
    localStorage.setItem('bt_overlay_layout', JSON.stringify(elements));
    setIsEditMode(false);
    setSelectedId(null);
  };

  const resetLayout = () => {
    if (window.confirm("Sicuro di voler resettare alle posizioni di base?")) {
      setElements(DEFAULT_LAYOUT);
      localStorage.removeItem('bt_overlay_layout');
    }
  };

  const updateEl = (id, newPos) => setElements(prev => ({ ...prev, [id]: newPos }));

  // Dati
  const teamA = matchData?.team_a?.teams?.name || 'SQUADRA IN CASA';
  const teamB = matchData?.team_b?.teams?.name || 'SQUADRA OSPITE';
  const eventName = matchData?.event_name || 'VERO CUP';
  const subtitle = matchData?.match_types?.name || 'GIRONE A';

  return (
    <>
      <style>{`
        body, html, #root { background-color: transparent !important; margin: 0; padding: 0; overflow: hidden; }
      `}</style>

      <div className="w-[1920px] h-[1080px] relative font-sans text-white select-none">
        
        {/* COMPONENTI TRASCINABILI */}
        
        <EditableBox id="teamA" el={elements.teamA} isEditMode={isEditMode} isSelected={selectedId === 'teamA'} onSelect={setSelectedId} updateEl={updateEl}>
          <div className="w-full h-full bg-black rounded-[2.5rem] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex items-center justify-center border-2 border-neutral-800 overflow-hidden">
            <span className="text-[65px] leading-none font-black uppercase tracking-tight text-white drop-shadow-xl text-center truncate">{teamA}</span>
          </div>
        </EditableBox>

        <EditableBox id="teamB" el={elements.teamB} isEditMode={isEditMode} isSelected={selectedId === 'teamB'} onSelect={setSelectedId} updateEl={updateEl}>
          <div className="w-full h-full bg-black rounded-[2.5rem] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex items-center justify-center border-2 border-neutral-800 overflow-hidden">
            <span className="text-[65px] leading-none font-black uppercase tracking-tight text-white drop-shadow-xl text-center truncate">{teamB}</span>
          </div>
        </EditableBox>

        <EditableBox id="badge" el={elements.badge} isEditMode={isEditMode} isSelected={selectedId === 'badge'} onSelect={setSelectedId} updateEl={updateEl}>
          <div className="w-full h-full bg-black flex flex-col items-center justify-center rounded-2xl p-4 border border-neutral-800 shadow-2xl">
            <div className="bg-pink-600/20 border border-pink-500/30 px-6 py-1 rounded-xl mb-1 shadow-[0_0_15px_rgba(236,72,153,0.3)]">
              <span className="text-pink-500 text-lg font-black uppercase tracking-[0.2em]">{eventName}</span>
            </div>
            <span className="text-lg font-bold text-neutral-400 uppercase tracking-[0.3em]">{subtitle}</span>
          </div>
        </EditableBox>

        <EditableBox id="foulsA" el={elements.foulsA} isEditMode={isEditMode} isSelected={selectedId === 'foulsA'} onSelect={setSelectedId} updateEl={updateEl}>
          <div className="w-full h-full bg-black flex items-center justify-center rounded-xl border border-neutral-800 shadow-inner">
            <span className="text-neutral-500 font-bold text-2xl tracking-[0.4em] uppercase">Falli</span>
          </div>
        </EditableBox>

        <EditableBox id="foulsB" el={elements.foulsB} isEditMode={isEditMode} isSelected={selectedId === 'foulsB'} onSelect={setSelectedId} updateEl={updateEl}>
          <div className="w-full h-full bg-black flex items-center justify-center rounded-xl border border-neutral-800 shadow-inner">
            <span className="text-neutral-500 font-bold text-2xl tracking-[0.4em] uppercase">Falli</span>
          </div>
        </EditableBox>

        <EditableBox id="period" el={elements.period} isEditMode={isEditMode} isSelected={selectedId === 'period'} onSelect={setSelectedId} updateEl={updateEl}>
          <div className="w-full h-full bg-black flex items-center justify-center rounded-xl border border-neutral-800 shadow-inner">
            <span className="text-neutral-500 font-bold text-3xl tracking-[0.4em] uppercase">Quarto</span>
          </div>
        </EditableBox>

        <EditableBox id="timeoutA" el={elements.timeoutA} isEditMode={isEditMode} isSelected={selectedId === 'timeoutA'} onSelect={setSelectedId} updateEl={updateEl}>
          <div className="w-full h-full bg-black flex items-center justify-center rounded-xl border border-neutral-800 shadow-inner">
            <span className="text-neutral-500 font-bold text-2xl tracking-[0.4em] uppercase">Timeout</span>
          </div>
        </EditableBox>

        <EditableBox id="timeoutB" el={elements.timeoutB} isEditMode={isEditMode} isSelected={selectedId === 'timeoutB'} onSelect={setSelectedId} updateEl={updateEl}>
          <div className="w-full h-full bg-black flex items-center justify-center rounded-xl border border-neutral-800 shadow-inner">
            <span className="text-neutral-500 font-bold text-2xl tracking-[0.4em] uppercase">Timeout</span>
          </div>
        </EditableBox>


        {/* ====================================================
            PANNELLO DI CONTROLLO (Visibile solo se fai hover in alto a sx o in Edit Mode)
            ==================================================== */}
        <div className={`absolute top-4 left-4 z-50 ${isEditMode ? 'opacity-100' : 'opacity-0 hover:opacity-100'} transition-opacity`}>
          {!isEditMode ? (
            <button onClick={() => setIsEditMode(true)} className="bg-pink-600 hover:bg-pink-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg border border-pink-400">
              ⚙️ SBLOCCA LAYOUT
            </button>
          ) : (
            <div className="bg-neutral-900 border-2 border-pink-500 rounded-2xl p-6 shadow-2xl w-[400px]">
              <h3 className="text-pink-500 font-black text-xl mb-4">MODALITÀ DESIGN ATTIVA</h3>
              <ul className="text-sm text-neutral-300 space-y-2 mb-6">
                <li>👆 <strong>Trascina</strong> i riquadri col mouse.</li>
                <li>🎯 Clicca un riquadro e usa le <strong>FRECCE</strong> per spostarlo di 1px.</li>
                <li>📏 Tieni premuto <strong>MAIUSC + FRECCE</strong> per allargarlo/stringerlo.</li>
              </ul>
              <div className="flex gap-4">
                <button onClick={saveLayout} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl">💾 SALVA</button>
                <button onClick={resetLayout} className="px-4 bg-red-900 hover:bg-red-700 text-white font-bold rounded-xl text-xs">RESET</button>
              </div>
            </div>
          )}
        </div>

      </div>
    </>
  );
}

// COMPONENTE HELPER PER IL DRAG & DROP
function EditableBox({ id, el, isEditMode, isSelected, onSelect, updateEl, children }) {
  const handlePointerDown = (e) => {
    if (!isEditMode) return;
    e.stopPropagation();
    onSelect(id);

    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = el.x;
    const initialY = el.y;

    const onMove = (me) => {
      updateEl(id, { ...el, x: initialX + (me.clientX - startX), y: initialY + (me.clientY - startY) });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      className={`absolute ${isEditMode ? 'cursor-move' : ''} ${
        isSelected ? 'border-4 border-dashed border-pink-500 z-40 bg-pink-500/20' : 
        isEditMode ? 'border-2 border-dashed border-neutral-500 hover:border-pink-300 z-30' : 'pointer-events-none'
      }`}
      style={{ left: el.x, top: el.y, width: el.w, height: el.h }}
      onPointerDown={handlePointerDown}
    >
      {children}
    </div>
  );
}
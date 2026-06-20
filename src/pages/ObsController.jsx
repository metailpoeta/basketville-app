import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Target, XCircle, ListOrdered, Trophy, Type, Tv } from 'lucide-react';

export default function ObsController() {
  const [currentGraphic, setCurrentGraphic] = useState('none');
  const [genericTitleText, setGenericTitleText] = useState(''); // STATO PER IL TESTO JOLLY
  const [mvpNameText, setMvpNameText] = useState(''); // STATO PER IL TESTO MVP
  const [championsNameText, setChampionsNameText] = useState(''); // STATO PER IL TESTO CHAMPIONS

  // =================================================================
  // LA MAGIA DI VITE: Scansiona la cartella public/videos in automatico!
  // =================================================================
  const videoFilesGlob = import.meta.glob('/public/videos/**/*.{mp4,webm,mov,mov}');
  const knownVideos = Object.keys(videoFilesGlob).map(path => path.replace('/public/videos/', ''));

  const [selectedVideo, setSelectedVideo] = useState(knownVideos[0] || '');
  const [videoQueue, setVideoQueue] = useState([]); // 🎯 Stato per gestire la sequenza di video
  const [isLooping, setIsLooping] = useState(false); // 🎯 Stato per il loop all'infinito

  // Ascoltiamo in tempo reale cosa c'è in onda
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

  // Funzione dedicata per il Titolo Generico
  const sendGenericTitle = () => {
    if (!genericTitleText.trim()) return alert('Inserisci un testo prima di mandarlo in onda!');
    triggerOBS('generic_title', { text: genericTitleText.trim() });
  };

  // Funzione dedicata per l'MVP
  const sendMvpTitle = () => {
    if (!mvpNameText.trim()) return alert('Inserisci il nome del giocatore!');
    triggerOBS('mvp_title', { name: mvpNameText.trim() });
  };

  // Funzione dedicata per CHAMPIONS
  const sendChampionsTitle = () => {
    if (!championsNameText.trim()) return alert('Inserisci il nome della squadra!');
    triggerOBS('champions_title', { name: championsNameText.trim() });
  };

  // 🎬 Funzione per lanciare la sequenza video o il video singolo
  const sendVideoClip = () => {
    // Se la coda è vuota, prende come sequenza il singolo video selezionato nella tendina
    const finalQueue = videoQueue.length > 0 ? videoQueue : [selectedVideo];
    
    if (finalQueue.length === 0 || !finalQueue[0]) {
      return alert('Nessun video trovato nella cartella public/videos!');
    }
    
    triggerOBS('video_player', { 
      video_list: finalQueue, 
      loop: isLooping 
    });
  };

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

      {/* GRIGLIA CONTROLLER */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* ========================================== */}
        {/* CARD: 3-POINT CONTEST (ROSA)               */}
        {/* ========================================== */}
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
            
            <button 
              onClick={() => triggerOBS('3point_bracket')}
              className={`w-full flex items-center justify-center gap-2 p-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all ${currentGraphic === '3point_bracket' ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/30' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
            >
              <Trophy size={16} /> Tabellone Playoff
            </button>
          </div>
        </div>

        {/* ========================================== */}
        {/* CARD: TORNEO E PLAYOFF (VIOLA)             */}
        {/* ========================================== */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-200">
          <div className="flex items-center gap-4 mb-6 pb-4 border-b border-neutral-100">
            <div className="p-3 bg-purple-50 text-purple-500 rounded-xl"><Trophy size={24}/></div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-800">Torneo & Playoff</h3>
              <p className="text-xs text-neutral-500">Classifiche gironi, tabellone e marcatori</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <button 
              onClick={() => triggerOBS('recap_girone')}
              className={`w-full flex items-center justify-center gap-2 p-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all ${currentGraphic === 'recap_girone' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
            >
              <ListOrdered size={16} /> Classifica Gironi
            </button>
            
            <button 
              onClick={() => triggerOBS('playoff_bracket')}
              className={`w-full flex items-center justify-center gap-2 p-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all ${currentGraphic === 'playoff_bracket' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
            >
              <Trophy size={16} /> Tabellone Playoff
            </button>

            <button 
              onClick={() => triggerOBS('top_scorers')}
              className={`w-full flex items-center justify-center gap-2 p-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all ${currentGraphic === 'top_scorers' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
            >
              <Target size={16} /> Classifica Marcatori
            </button>
          </div>
        </div>

        {/* ========================================== */}
        {/* CARD: REGIA VIDEO CLIP MULTI-STREAM (SKY)  */}
        {/* ========================================== */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-200 col-span-1 md:col-span-2">
          <div className="flex items-center gap-4 mb-6 pb-4 border-b border-neutral-100">
            <div className="p-3 bg-sky-50 text-sky-500 rounded-xl"><Tv size={24}/></div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-800">Regia Video Clip & Playlist</h3>
              <p className="text-xs text-neutral-500">Crea sequenze di video e gestisci il loop continuo</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sotto-colonna SX: Controlli e selezione */}
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Seleziona Video</label>
                <div className="flex gap-2">
                  <select 
                    value={selectedVideo} 
                    onChange={(e) => setSelectedVideo(e.target.value)}
                    className="flex-1 p-4 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-800 outline-none focus:border-sky-500 uppercase tracking-wider"
                  >
                    {knownVideos.length === 0 ? (
                      <option value="">Nessun file .mp4 in public/videos/</option>
                    ) : (
                      knownVideos.map((file) => (
                        <option key={file} value={file}>{file.replace(/_/g, ' ').replace('.mp4', '')}</option>
                      ))
                    )}
                  </select>
                  <button
                    onClick={() => selectedVideo && setVideoQueue([...videoQueue, selectedVideo])}
                    disabled={knownVideos.length === 0}
                    className="px-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
                  >
                    + Coda
                  </button>
                </div>
              </div>

              {/* Toggle Loop Infinito */}
              <label className="flex items-center gap-3 bg-neutral-50 p-4 rounded-xl border border-neutral-200 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={isLooping}
                  onChange={(e) => setIsLooping(e.target.checked)}
                  className="w-5 h-5 rounded text-sky-500 focus:ring-sky-500 border-neutral-300"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-neutral-800 uppercase tracking-wide">Ripeti all'infinito</span>
                  <span className="text-xs text-neutral-500">Ricomincia la lista da capo quando finisce</span>
                </div>
              </label>

              {/* Pulsante di Invio in Onda */}
              <button 
                onClick={sendVideoClip}
                disabled={knownVideos.length === 0}
                className={`w-full flex items-center justify-center gap-2 p-5 rounded-xl font-black uppercase tracking-widest text-sm transition-all ${currentGraphic === 'video_player' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30 animate-pulse' : 'bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40'}`}
              >
                <Tv size={18} /> {videoQueue.length > 0 ? `Lancia Sequenza (${videoQueue.length} Video)` : 'Lancia Video Singolo'}
              </button>
            </div>

            {/* Sotto-colonna DX: Visualizzatore Coda corrente */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 flex flex-col h-full min-h-[220px]">
              <div className="flex justify-between items-center border-b border-neutral-200 pb-2 mb-3">
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">In Coda di Riproduzione</span>
                {videoQueue.length > 0 && (
                  <button onClick={() => setVideoQueue([])} className="text-xs font-bold text-red-500 uppercase hover:underline">Svuota</button>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[160px] pr-1">
                {videoQueue.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center text-xs font-bold text-neutral-400 uppercase tracking-wider">
                    Nessuna sequenza creata.<br/>Verrà lanciato solo il video singolo.
                  </div>
                ) : (
                  videoQueue.map((file, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white border border-neutral-200 px-3 py-2 rounded-lg shadow-sm">
                      <span className="text-xs font-black text-sky-500">#{idx + 1}</span>
                      <span className="text-xs font-bold text-neutral-700 uppercase truncate flex-1 mx-3">{file.replace(/_/g, ' ')}</span>
                      <button onClick={() => setVideoQueue(videoQueue.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 text-xs font-black">X</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* CARD: MVP DEL MATCH (GIALLO)               */}
        {/* ========================================== */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-200">
          <div className="flex items-center gap-4 mb-6 pb-4 border-b border-neutral-100">
            <div className="p-3 bg-yellow-50 text-yellow-500 rounded-xl"><Trophy size={24}/></div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-800">MVP del Match</h3>
              <p className="text-xs text-neutral-500">Incorona il migliore in campo</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Es: MARIO ROSSI"
              value={mvpNameText}
              onChange={(e) => setMvpNameText(e.target.value)}
              className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-800 outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all uppercase tracking-wider"
            />
            <button 
              onClick={sendMvpTitle}
              className={`w-full flex items-center justify-center gap-2 p-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all ${currentGraphic === 'mvp_title' ? 'bg-yellow-500 text-white shadow-lg shadow-yellow-500/30' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
            >
              <Tv size={16} /> Lancia Grafica MVP
            </button>
          </div>
        </div>

        {/* ========================================== */}
        {/* CARD: CHAMPIONS VERO CUP (ORO / AMBER)     */}
        {/* ========================================== */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-200">
          <div className="flex items-center gap-4 mb-6 pb-4 border-b border-neutral-100">
            <div className="p-3 bg-amber-50 text-amber-500 rounded-xl"><Trophy size={24}/></div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-800">Campioni del Torneo</h3>
              <p className="text-xs text-neutral-500">Incorona la squadra vincitrice</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Es: TEAM BASKETVILLE"
              value={championsNameText}
              onChange={(e) => setChampionsNameText(e.target.value)}
              className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all uppercase tracking-wider"
            />
            <button 
              onClick={sendChampionsTitle}
              className={`w-full flex items-center justify-center gap-2 p-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all ${currentGraphic === 'champions_title' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
            >
              <Tv size={16} /> Lancia Grafica Champions
            </button>
          </div>
        </div>

        {/* ========================================== */}
        {/* CARD: TITOLO GENERICO JOLLY (BLU)          */}
        {/* ========================================== */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-200">
          <div className="flex items-center gap-4 mb-6 pb-4 border-b border-neutral-100">
            <div className="p-3 bg-blue-50 text-blue-500 rounded-xl"><Type size={24}/></div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-800">Messaggio Jolly</h3>
              <p className="text-xs text-neutral-500">Testo personalizzato a tutto schermo</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Es: PAUSA PRANZO"
              value={genericTitleText}
              onChange={(e) => setGenericTitleText(e.target.value)}
              className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all uppercase tracking-wider"
            />
            <button 
              onClick={sendGenericTitle}
              className={`w-full flex items-center justify-center gap-2 p-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all ${currentGraphic === 'generic_title' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
            >
              <Tv size={16} /> Manda In Onda Testo
            </button>
          </div>
        </div>

        {/* ========================================== */}
        {/* CARD: PROMO APP (VERDE SMERALDO)           */}
        {/* ========================================== */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-200">
          <div className="flex items-center gap-4 mb-6 pb-4 border-b border-neutral-100">
            <div className="p-3 bg-emerald-50 text-emerald-500 rounded-xl"><Tv size={24}/></div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-800">Promo App Ufficiale</h3>
              <p className="text-xs text-neutral-500">Mostra il QR Code per scaricare l'app</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <button 
              onClick={() => triggerOBS('download_app')}
              className={`w-full flex items-center justify-center gap-2 p-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all ${currentGraphic === 'download_app' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
            >
              <Tv size={16} /> Lancia Promo App
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
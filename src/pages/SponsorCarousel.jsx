import React, { useState, useEffect } from 'react';
import { Play, Pause, Clock, Trash2, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../supabase'; 

export default function SponsorCarousel() {
  // ==========================================
  // STATI DELLA REGIA
  // ==========================================
  const [isRunning, setIsRunning] = useState(true);
  const [duration, setDuration] = useState(5); 
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slides, setSlides] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // ==========================================
  // SINCRONIZZAZIONE DATABASE (Solo la scaletta, niente Storage)
  // ==========================================
  useEffect(() => {
    fetchSlides();
  }, []);

  const fetchSlides = async () => {
    const { data, error } = await supabase
      .from('sponsor_slides')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (!error && data) {
      setSlides(data);
    }
    setIsLoading(false);
  };

  // ==========================================
  // MOTORE DEL CAROSELLO
  // ==========================================
  useEffect(() => {
    let interval = null;
    if (isRunning && slides.length > 0) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % slides.length);
      }, duration * 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, slides.length, duration]);


  // ==========================================
  // GESTIONE SLIDE SUL DATABASE
  // ==========================================
  const addSlide = async (type) => {
    const { data, error } = await supabase
      .from('sponsor_slides')
      .insert([{ type, img1: '', img2: type === 'double' ? '' : null }])
      .select();

    if (!error && data) {
      setSlides([...slides, data[0]]);
    }
  };

  const removeSlide = async (id) => {
    await supabase.from('sponsor_slides').delete().eq('id', id);
    setSlides(slides.filter(slide => slide.id !== id));
    setCurrentIndex(0); // Torna alla prima slide per sicurezza
  };

  const updateSlideDB = async (id, field, value) => {
    // Aggiorna lo stato locale per far vedere subito il cambiamento
    setSlides(slides.map(slide => slide.id === id ? { ...slide, [field]: value } : slide));
    
    // Salva il testo (il percorso del file) nel database in background
    await supabase.from('sponsor_slides').update({ [field]: value }).eq('id', id);
  };

  // Funzione temporanea per testare immagini al volo dal Mac (Non si salva sul DB in modo permanente)
  const handleLocalTest = (id, field, e) => {
     const file = e.target.files[0];
     if (!file) return;
     const localUrl = URL.createObjectURL(file);
     updateSlideDB(id, field, localUrl);
  };

  if (isLoading) {
    return <div className="h-screen w-full bg-neutral-950 flex items-center justify-center text-white font-bold">Caricamento Sponsor...</div>;
  }

  return (
    <div className="h-screen w-full bg-neutral-950 flex font-dimbo overflow-hidden text-white">
      
      {/* ========================================== */}
      {/* AREA BROADCAST (Cattura questa con OBS) */}
      {/* ========================================== */}
      <div 
        className="flex-none relative flex flex-col justify-center items-center bg-white" 
        style={{ width: '1280px', height: '720px' }}
      >
        {/* 👑 IL SOLITO TITOLO IN ALTO A DESTRA */}
        <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right select-none">
          <span className="text-pink-500 font-bold uppercase tracking-[0.08em] text-sm mb-1 drop-shadow-sm">BASKETVILLE 2026</span>
          <h2 className="text-4xl font-black uppercase text-neutral-950 tracking-wider">
            OFFICIAL PARTNERS
          </h2>
        </div>

        {/* CORNICE BASKETVILLE */}
        <div className="absolute inset-0 pointer-events-none z-20 border-[24px] border-neutral-950">
          <div className="w-full h-full border-[8px] border-pink-500"></div>
        </div>

        {/* LOGO IN BASSO AL CENTRO */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-neutral-950 px-8 py-2 rounded-t-2xl border-t-[6px] border-x-[6px] border-pink-500">
          <span className="text-white text-3xl tracking-widest uppercase font-black">Basketville</span>
        </div>

        {/* CONTAINER SLIDE */}
        <div className="relative w-full h-full flex items-center justify-center p-16 z-10">
          {slides.map((slide, index) => {
            const isActive = index === currentIndex;
            
            return (
              <div 
                key={slide.id} 
                className={`absolute inset-0 p-20 flex items-center justify-center gap-16 transition-opacity duration-700 ease-in-out ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
              >
                {slide.type === 'single' ? (
                  <div className="w-full h-full flex items-center justify-center">
                    {slide.img1 ? (
                      <img src={slide.img1} alt="Sponsor" className="max-w-full max-h-full object-contain drop-shadow-xl" />
                    ) : (
                      <div className="text-neutral-300 text-4xl">Scrivi /nome-file.jpg nel pannello</div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center gap-20">
                    <div className="flex-1 h-full flex items-center justify-center">
                      {slide.img1 ? (
                        <img src={slide.img1} alt="Sponsor 1" className="max-w-full max-h-full object-contain drop-shadow-xl" />
                      ) : (
                        <div className="text-neutral-300 text-3xl">Immagine Sinistra</div>
                      )}
                    </div>
                    <div className="w-2 h-3/4 bg-neutral-200 rounded-full opacity-50"></div>
                    <div className="flex-1 h-full flex items-center justify-center">
                      {slide.img2 ? (
                        <img src={slide.img2} alt="Sponsor 2" className="max-w-full max-h-full object-contain drop-shadow-xl" />
                      ) : (
                        <div className="text-neutral-300 text-3xl">Immagine Destra</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          
          {slides.length === 0 && (
            <div className="text-black text-6xl opacity-20 uppercase font-black">Nessuno Sponsor (Aggiungi slide)</div>
          )}
        </div>
      </div>

      {/* ========================================== */}
      {/* AREA PLANCIA DI COMANDO (Non vista su OBS) */}
      {/* ========================================== */}
      <div className="flex-1 bg-neutral-900 border-l border-neutral-800 p-8 overflow-y-auto custom-scrollbar">
        
        <div className="mb-6 border-b border-neutral-800 pb-4">
          <h2 className="text-2xl font-black text-white uppercase tracking-widest flex items-center gap-2">
            📺 Regia Sponsor
          </h2>
          <p className="text-neutral-500 text-xs mt-1">Immagini in locale (cartella public), Ordine salvato su DB</p>
        </div>

        {/* REGIA CAROSELLO */}
        <div className="bg-black/50 border border-neutral-800 p-5 rounded-2xl mb-6 shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 blur-3xl rounded-full"></div>
          
          <h3 className="text-neutral-400 font-bold uppercase tracking-widest text-[10px] mb-4 flex items-center gap-2">
            <Clock size={14}/> Riproduzione
          </h3>
          
          <div className="flex gap-4">
            <button 
              onClick={() => setIsRunning(!isRunning)} 
              className={`flex-1 py-4 rounded-xl font-black uppercase tracking-widest text-xl flex items-center justify-center gap-3 transition-transform active:scale-95 shadow-lg ${
                isRunning 
                ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-[0_0_15px_rgba(234,179,8,0.3)]' 
                : 'bg-green-500 hover:bg-green-400 text-black shadow-[0_0_15px_rgba(34,197,94,0.3)]'
              }`}
            >
              {isRunning ? <><Pause fill="currentColor" size={20}/> In Pausa</> : <><Play fill="currentColor" size={20}/> In Riproduzione</>}
            </button>

            <div className="flex flex-col justify-center bg-neutral-900 p-3 rounded-xl border border-neutral-700 min-w-[150px]">
              <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-2 text-center block">
                Secondi per Slide
              </span>
              <div className="flex items-center gap-2 justify-center">
                <input 
                  type="number" 
                  value={duration} 
                  onChange={e => setDuration(Math.max(1, parseInt(e.target.value) || 1))} 
                  className="w-16 bg-black text-white text-center py-2 text-xl rounded-lg font-black outline-none focus:ring-1 focus:ring-pink-500" 
                />
                <span className="text-neutral-500 font-bold text-lg">sec</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* LISTA SPONSOR */}
        <div className="bg-black/50 border border-neutral-800 p-5 rounded-2xl shadow-md border-t-4 border-t-blue-500">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-neutral-400 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
              <ImageIcon size={14}/> Sequenza Slide ({slides.length})
            </h3>
            <div className="flex gap-2">
              <button onClick={() => addSlide('single')} className="bg-neutral-800 hover:bg-neutral-700 text-xs px-3 py-1 rounded font-bold">+ Singolo</button>
              <button onClick={() => addSlide('double')} className="bg-neutral-800 hover:bg-neutral-700 text-xs px-3 py-1 rounded font-bold">+ Doppio</button>
            </div>
          </div>

          <div className="space-y-4">
            {slides.map((slide, index) => (
              <div key={slide.id} className={`bg-neutral-900 border ${index === currentIndex ? 'border-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.2)]' : 'border-neutral-700'} p-4 rounded-xl relative`}>
                
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-bold text-neutral-400 uppercase tracking-widest">
                    Slide {index + 1} - {slide.type === 'single' ? 'Singola' : 'Doppia'} {index === currentIndex && <span className="text-pink-500 ml-2 animate-pulse">● In Onda</span>}
                  </span>
                  <button onClick={() => removeSlide(slide.id)} className="text-neutral-500 hover:text-red-500 transition-colors">
                    <Trash2 size={16}/>
                  </button>
                </div>

                <div className="flex gap-3 w-full">
                  
                  {/* BLOCCO SPONSOR 1 */}
                  <div className="flex-1 flex flex-col gap-1">
                    <input 
                      type="text" 
                      placeholder="es. /sponsor-nike.png"
                      value={slide.img1}
                      onChange={(e) => updateSlideDB(slide.id, 'img1', e.target.value)}
                      className="w-full bg-black text-white text-xs px-3 py-2 rounded border border-neutral-800 focus:border-pink-500 outline-none"
                    />
                     <label className="text-neutral-600 hover:text-pink-500 text-[10px] cursor-pointer text-center">
                        oppure sfoglia per test locale
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLocalTest(slide.id, 'img1', e)} />
                     </label>
                  </div>

                  {/* BLOCCO SPONSOR 2 (Solo se doppia) */}
                  {slide.type === 'double' && (
                    <div className="flex-1 flex flex-col gap-1">
                      <input 
                        type="text" 
                        placeholder="es. /sponsor-adidas.jpg"
                        value={slide.img2}
                        onChange={(e) => updateSlideDB(slide.id, 'img2', e.target.value)}
                        className="w-full bg-black text-white text-xs px-3 py-2 rounded border border-neutral-800 focus:border-blue-500 outline-none"
                      />
                      <label className="text-neutral-600 hover:text-blue-500 text-[10px] cursor-pointer text-center">
                        oppure sfoglia per test locale
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLocalTest(slide.id, 'img2', e)} />
                     </label>
                    </div>
                  )}

                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
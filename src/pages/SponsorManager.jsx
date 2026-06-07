import React, { useState, useEffect } from 'react';
import { Play, Pause, Trash2, Image as ImageIcon, Plus, Tv, AlertCircle, Clock, Save } from 'lucide-react';
import { supabase } from '../supabase'; 

export default function SponsorManager() {
  const [settings, setSettings] = useState({ is_running: true, duration: 5 });
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);

  // ==========================================
  // MAGIA DI VITE: Scansiona la cartella public in automatico!
  // ==========================================
  const imageFiles = import.meta.glob('/public/**/*.{png,jpg,jpeg,svg,webp,gif}');
  const knownSponsors = Object.keys(imageFiles).map(path => path.replace('/public', ''));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: setD } = await supabase.from('sponsor_settings').select('*').eq('id', 1).single();
    if (setD) setSettings(setD);

    const { data: slideD } = await supabase.from('sponsor_slides').select('*').order('created_at', { ascending: true });
    // Aggiungo un flag "_unsaved: false" a tutte le slide caricate dal DB
    if (slideD) setSlides(slideD.map(s => ({ ...s, _unsaved: false })));
    setLoading(false);
  };

  const updateSettings = async (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    await supabase.from('sponsor_settings').update({ [field]: value }).eq('id', 1);
  };

  const addSlide = async (type) => {
    const { data, error } = await supabase
      .from('sponsor_slides')
      .insert([{ 
        type, 
        img1: '', 
        height1: 100, 
        img2: type === 'double' ? '' : null,
        height2: type === 'double' ? 100 : null 
      }])
      .select();
    if (!error && data) {
      setSlides([...slides, { ...data[0], _unsaved: false }]);
    }
  };

  const removeSlide = async (id) => {
    if (window.confirm("Vuoi eliminare questa slide degli sponsor?")) {
      await supabase.from('sponsor_slides').delete().eq('id', id);
      setSlides(slides.filter(slide => slide.id !== id));
    }
  };

  // MODIFICA LOCALE: Non tocca il Database, accende solo il pulsante Salva
  const handleLocalChange = (id, field, value) => {
    setSlides(slides.map(slide => 
      slide.id === id ? { ...slide, [field]: value, _unsaved: true } : slide
    ));
  };

  // SALVATAGGIO DEFINITIVO NEL DB
  const saveSlide = async (slide) => {
    // Se salvi lasciando il campo vuoto, ci sbatte un 100 di default
    const finalHeight1 = slide.height1 === '' || isNaN(slide.height1) ? 100 : slide.height1;
    const finalHeight2 = slide.height2 === '' || isNaN(slide.height2) ? 100 : slide.height2;

    const updateData = {
      img1: slide.img1,
      height1: finalHeight1,
      img2: slide.img2,
      height2: finalHeight2
    };

    await supabase.from('sponsor_slides').update(updateData).eq('id', slide.id);
    
    // Aggiorniamo lo stato locale spegnendo il pulsante e impostando l'altezza definitiva
    setSlides(slides.map(s => s.id === slide.id ? { ...s, height1: finalHeight1, height2: finalHeight2, _unsaved: false } : s));
  };

  // --- RENDER STATO CARICAMENTO ---
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto mt-20 flex flex-col items-center text-neutral-400">
        <div className="w-8 h-8 border-4 border-neutral-200 border-t-pink-500 rounded-full animate-spin mb-4"></div>
        <p className="text-sm">Caricamento regia sponsor...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in pb-20 space-y-8">
      
      <datalist id="sponsors-list">
        {knownSponsors.map(sponsor => (
          <option key={sponsor} value={sponsor} />
        ))}
      </datalist>

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-neutral-100 pb-6">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-800">Gestione Sponsor</h2>
          <p className="text-sm text-neutral-500 mt-1">Controlla l'output della banda a scorrimento su OBS</p>
        </div>
      </div>

      {/* ================= PANNELLO CONTROLLI DI REGIA ================= */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-neutral-200">
        <h3 className="text-sm font-semibold text-neutral-800 mb-6 flex items-center gap-2">
          <Tv size={18} className="text-pink-500" /> Controlli Banda Scorrimento
        </h3>
        
        <div className="flex flex-col sm:flex-row gap-4 items-stretch h-full">
          <button 
            onClick={() => updateSettings('is_running', !settings.is_running)} 
            className={`flex-1 w-full py-4 rounded-xl font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-3 transition-all border ${
              settings.is_running 
              ? 'bg-amber-50 hover:bg-amber-100 text-amber-600 border-amber-200 shadow-sm' 
              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-200 shadow-sm'
            }`}
          >
            {settings.is_running ? <><Pause fill="currentColor" size={18}/> Nascondi Banda</> : <><Play fill="currentColor" size={18}/> Mostra Banda</>}
          </button>
        </div>
      </div>

      {/* ================= LISTA SLIDE ================= */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-neutral-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h3 className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
            <ImageIcon size={18} className="text-pink-500" /> Sequenza Loghi ({slides.length})
          </h3>
          <div className="flex gap-3 w-full sm:w-auto">
            <button onClick={() => addSlide('single')} className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-sm font-medium transition-colors border border-neutral-200">
              <Plus size={16} /> Logo Singolo
            </button>
            <button onClick={() => addSlide('double')} className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
              <Plus size={16} /> Logo Doppio
            </button>
          </div>
        </div>

        {slides.length === 0 ? (
           <div className="bg-neutral-50 p-12 rounded-2xl border border-dashed border-neutral-300 text-center">
             <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-neutral-100">
               <AlertCircle size={24} className="text-neutral-400" />
             </div>
             <h4 className="text-neutral-800 font-medium mb-1">Nessuno Sponsor</h4>
             <p className="text-sm text-neutral-500">Aggiungi un logo per iniziare la sequenza.</p>
           </div>
        ) : (
          <div className="space-y-4">
            {slides.map((slide, index) => (
              <div key={slide.id} className="bg-neutral-50/50 border border-neutral-200 p-5 rounded-xl flex flex-col gap-4 transition-all hover:border-pink-200 hover:shadow-sm">
                
                <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
                  <span className="text-[10px] font-bold text-pink-500 uppercase tracking-widest flex items-center gap-2">
                    <span className="bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full">{index + 1}</span> 
                    Layout {slide.type === 'single' ? 'Singolo' : 'Doppio'}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    {/* IL PULSANTE SALVA! */}
                    <button 
                      onClick={() => saveSlide(slide)}
                      disabled={!slide._unsaved}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                        slide._unsaved 
                        ? 'bg-pink-500 hover:bg-pink-600 text-white shadow-md cursor-pointer' 
                        : 'bg-neutral-100 text-neutral-400 cursor-not-allowed border border-neutral-200'
                      }`}
                    >
                      <Save size={14} />
                      {slide._unsaved ? 'Salva Modifiche' : 'Salvato'}
                    </button>

                    <button onClick={() => removeSlide(slide.id)} className="text-neutral-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Rimuovi Slide">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-6">
                  
                  {/* SLIDE 1 */}
                  <div className="flex-1 space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                      Sponsor {slide.type === 'double' && '1'} (File & Altezza)
                    </label>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="text" 
                        list="sponsors-list"
                        placeholder="es. /sponsor-nike.png"
                        value={slide.img1 || ''}
                        onChange={(e) => handleLocalChange(slide.id, 'img1', e.target.value)}
                        className="flex-1 w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-sm"
                      />
                      <div className="relative w-24 shrink-0">
  <input 
    type="number" 
    value={slide.height1 ?? ''}
    onChange={(e) => handleLocalChange(slide.id, 'height1', e.target.value === '' ? '' : parseInt(e.target.value))}
    className="w-full p-3 pr-7 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-sm"
    title="Altezza logo in pixel"
  />
  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 pointer-events-none">px</span>
</div>
                    </div>
                  </div>
                  
                  {/* SLIDE 2 */}
                  {slide.type === 'double' && (
                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                        Sponsor 2 (File & Altezza)
                      </label>
                      <div className="flex gap-2 items-center">
                        <input 
                          type="text" 
                          list="sponsors-list"
                          placeholder="es. /sponsor-adidas.png"
                          value={slide.img2 || ''}
                          onChange={(e) => handleLocalChange(slide.id, 'img2', e.target.value)}
                          className="flex-1 w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-sm"
                        />
                        <div className="relative w-24 shrink-0">
  <input 
    type="number" 
    value={slide.height2 ?? ''}
    onChange={(e) => handleLocalChange(slide.id, 'height2', e.target.value === '' ? '' : parseInt(e.target.value))}
    className="w-full p-3 pr-7 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-sm"
    title="Altezza logo in pixel"
  />
  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 pointer-events-none">px</span>
</div>
                      </div>
                    </div>
                  )}

                </div>

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
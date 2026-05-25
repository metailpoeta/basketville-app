import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function SponsorOutput() {
  const [slides, setSlides] = useState([]);
  const [settings, setSettings] = useState({ is_running: true, duration: 5 });
  const [currentIndex, setCurrentIndex] = useState(0);

  // Sincronizzazione continua con il Database (Ogni 3 secondi)
  useEffect(() => {
    const fetchData = async () => {
      const { data: setD } = await supabase.from('sponsor_settings').select('*').eq('id', 1).single();
      if (setD) setSettings(setD);

      const { data: slideD } = await supabase.from('sponsor_slides').select('*').order('created_at', { ascending: true });
      if (slideD) setSlides(slideD);
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Motore del Carosello
  useEffect(() => {
    let interval = null;
    if (settings.is_running && slides.length > 0) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % slides.length);
      }, settings.duration * 1000);
    }
    return () => clearInterval(interval);
  }, [settings.is_running, settings.duration, slides.length]);

  return (
    <div className="w-screen h-screen bg-neutral-950 overflow-hidden flex items-center justify-center">
      {/* AREA 1920x1080 ESATTA PER OBS */}
      <div 
        className="relative flex flex-col justify-center items-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-950 to-black overflow-hidden" 
        style={{ width: '1920px', height: '1080px' }}
      >
        {/* Texture Carbonio in Overlay */}
        <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay z-0"></div>
        
        {/* Bagliore Rosa Neon Centralizzato */}
        <div className="absolute w-[1000px] h-[1000px] bg-pink-500/10 blur-[180px] rounded-full pointer-events-none mix-blend-screen z-0"></div>

        {/* LOGO BASKETVILLE LIBERO E CENTRATO IN BASSO */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex items-center justify-center">
          <img 
            src="/Basketville_logo.svg" 
            alt="Basketville Logo" 
            className="h-24 w-auto object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]" 
            /* 💡 NOTA: Se il logo si chiama in un altro modo, ad esempio /Basketville_logo25.png, sostituiscilo qui sopra */
          />
        </div>

        {/* CONTAINER SLIDE */}
        <div className="relative w-full h-full flex items-center justify-center p-20 z-10">
          {slides.map((slide, index) => {
            const isActive = index === currentIndex;
            
            return (
              <div 
                key={slide.id} 
                className={`absolute inset-0 p-36 pb-48 flex items-center justify-center gap-24 transition-opacity duration-1000 ease-in-out ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
              >
                {slide.type === 'single' ? (
                  <div className="w-full h-full flex items-center justify-center">
                    {slide.img1 && (
                      <img src={slide.img1} alt="Sponsor" className="max-w-full max-h-full object-contain drop-shadow-[0_25px_60px_rgba(0,0,0,0.85)]" />
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center gap-32">
                    <div className="flex-1 h-full flex items-center justify-center">
                      {slide.img1 && (
                        <img src={slide.img1} alt="Sponsor 1" className="max-w-full max-h-full object-contain drop-shadow-[0_25px_60px_rgba(0,0,0,0.85)]" />
                      )}
                    </div>
                    
                    {/* Sottile linea di divisione elegante tra i due sponsor */}
                    <div className="w-[2px] h-2/3 bg-gradient-to-b from-transparent via-neutral-700 to-transparent opacity-40"></div>
                    
                    <div className="flex-1 h-full flex items-center justify-center">
                      {slide.img2 && (
                        <img src={slide.img2} alt="Sponsor 2" className="max-w-full max-h-full object-contain drop-shadow-[0_25px_60px_rgba(0,0,0,0.85)]" />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
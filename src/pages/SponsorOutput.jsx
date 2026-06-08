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
        className="relative flex flex-col justify-center items-center bg-neutral-950 overflow-hidden" 
        style={{ width: '1920px', height: '1080px' }}
      >
        {/* 👑 LOGO IN ALTO A SINISTRA (Perfettamente specchiato) */}
        <div className="absolute top-8 left-12 z-50 select-none">
          <img 
            src="/Basketville_logo26_vero.png" 
            alt="Basketville Logo" 
            className="h-24 w-auto drop-shadow-lg" 
          />
        </div>

        {/* 👑 IL SOLITO TITOLO IN ALTO A DESTRA */}
        <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right select-none">
          <span className="text-pink-500 font-bold uppercase tracking-[0.08em] text-sm mb-1 drop-shadow-md">BASKETVILLE 2026</span>
          <h2 className="text-4xl font-black uppercase text-white drop-shadow-lg tracking-wider">
            OFFICIAL PARTNERS
          </h2>
        </div>

        {/* Texture Carbonio in Overlay leggerissima */}
        <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay z-0"></div>

        {/* CONTAINER SLIDE */}
        <div className="relative w-full h-full flex items-center justify-center p-20 z-10">
          {slides.map((slide, index) => {
            const isActive = index === currentIndex;
            
            return (
              <div 
                key={slide.id} 
                className={`absolute inset-0 p-36 pb-48 flex items-center justify-center gap-24 transition-opacity duration-1000 ease-in-out ${
                  isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                }`}
              >
                {slide.type === 'single' ? (
                  <div className="w-full h-full flex items-center justify-center">
                    {slide.img1 && (
                      <img src={slide.img1} alt="Sponsor" className="max-w-full max-h-full object-contain" />
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center gap-32">
                    <div className="flex-1 h-full flex items-center justify-center">
                      {slide.img1 && (
                        <img src={slide.img1} alt="Sponsor 1" className="max-w-full max-h-full object-contain" />
                      )}
                    </div>
                    
                    {/* Sottile linea di divisione elegante tra i due sponsor */}
                    <div className="w-[2px] h-2/3 bg-gradient-to-b from-transparent via-neutral-700 to-transparent opacity-40"></div>
                    
                    <div className="flex-1 h-full flex items-center justify-center">
                      {slide.img2 && (
                        <img src={slide.img2} alt="Sponsor 2" className="max-w-full max-h-full object-contain" />
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
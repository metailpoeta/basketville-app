import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Download, ImagePlus, Upload } from 'lucide-react';

export default function InstagramGenerator() {
  const exportRef = useRef(null);

  // ==========================================
  // STATI DELLA GRAFICA
  // ==========================================
  const [bgColor, setBgColor] = useState('#86d3a5'); 
  const [topTitle, setTopTitle] = useState('I 4 ASSI');
  const [bottomText, setBottomText] = useState('MASTER CAMP 2026');
  const [topLogo, setTopLogo] = useState(null);
  const [bottomLogo, setBottomLogo] = useState(null);

  const [cards, setCards] = useState([
    { id: 1, suit: '♠️', color: 'text-neutral-800', firstName: 'NOME', lastName: 'COGNOME', team: 'SQUADRA', image: null },
    { id: 2, suit: '♥️', color: 'text-red-600', firstName: 'NOME', lastName: 'COGNOME', team: 'SQUADRA', image: null },
    { id: 3, suit: '♣️', color: 'text-neutral-800', firstName: 'NOME', lastName: 'COGNOME', team: 'SQUADRA', image: null },
    { id: 4, suit: '♦️', color: 'text-red-600', firstName: 'NOME', lastName: 'COGNOME', team: 'SQUADRA', image: null },
  ]);

  const handleImageUpload = (e, cardId) => {
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setCards(cards.map(c => c.id === cardId ? { ...c, image: imageUrl } : c));
    }
  };

  const handleLogoUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      if (type === 'top') setTopLogo(imageUrl);
      if (type === 'bottom') setBottomLogo(imageUrl);
    }
  };

  const handleCardText = (cardId, field, value) => {
    setCards(cards.map(c => c.id === cardId ? { ...c, [field]: value } : c));
  };

  const downloadGraphic = async () => {
    if (!exportRef.current) return;
    try {
      const canvas = await html2canvas(exportRef.current, {
        scale: 2, 
        useCORS: true,
      });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `Basketville-IG-${new Date().getTime()}.png`;
      link.click();
    } catch (err) {
      alert("Errore esportazione");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col md:flex-row p-4 gap-8">
      
      {/* 1. PANNELLO DI CONTROLLO */}
      <div className="w-full md:w-[450px] bg-white rounded-3xl p-6 shadow-xl overflow-y-auto max-h-[95vh] border border-neutral-200 shrink-0">
        <h2 className="text-2xl font-black uppercase mb-6 flex items-center justify-between text-neutral-800">
          IG Editor 4:5
          <button onClick={downloadGraphic} className="bg-pink-500 hover:bg-pink-600 text-white text-sm px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-pink-500/20">
            <Download size={16} /> Scarica PNG
          </button>
        </h2>

        <div className="space-y-4 mb-8">
          <div>
            <label className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">Colore Sfondo</label>
            <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-full h-10 rounded mb-2 cursor-pointer" />
          </div>
          <input type="text" placeholder="Titolo Alto Destra" value={topTitle} onChange={(e) => setTopTitle(e.target.value)} className="w-full p-2 border rounded font-bold uppercase text-sm" />
          <input type="text" placeholder="Testo Piè di Pagina" value={bottomText} onChange={(e) => setBottomText(e.target.value)} className="w-full p-2 border rounded font-bold uppercase text-sm" />
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-[10px] font-bold uppercase text-neutral-400">Logo Alto Sx</label><input type="file" onChange={(e) => handleLogoUpload(e, 'top')} className="text-[10px] mt-1" /></div>
            <div><label className="text-[10px] font-bold uppercase text-neutral-400">Logo Incastro</label><input type="file" onChange={(e) => handleLogoUpload(e, 'bottom')} className="text-[10px] mt-1" /></div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-neutral-800 border-b pb-2">Dati Giocatori</h3>
          {cards.map((card, i) => (
            <div key={card.id} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 text-xs">
              <div className="flex justify-between items-center mb-3">
                <p className="font-bold text-neutral-400">CARTA {i+1}</p>
                <span className={card.color}>{card.suit}</span>
              </div>
              <input type="file" onChange={(e) => handleImageUpload(e, card.id)} className="mb-3 w-full" />
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input type="text" placeholder="Nome" value={card.firstName} onChange={(e) => handleCardText(card.id, 'firstName', e.target.value)} className="p-2 border rounded uppercase font-bold" />
                <input type="text" placeholder="Cognome" value={card.lastName} onChange={(e) => handleCardText(card.id, 'lastName', e.target.value)} className="p-2 border rounded uppercase font-bold" />
              </div>
              <input type="text" placeholder="Squadra" value={card.team} onChange={(e) => handleCardText(card.id, 'team', e.target.value)} className="w-full p-2 border rounded uppercase font-bold" />
            </div>
          ))}
        </div>
      </div>

      {/* 2. AREA TELA (ANTEPRIMA) */}
      <div className="flex-1 flex items-center justify-center bg-neutral-200/50 rounded-3xl p-10 overflow-hidden border-4 border-dashed border-neutral-300">
        <div className="transform scale-[0.40] lg:scale-[0.5] xl:scale-[0.55] 2xl:scale-[0.65] origin-center shadow-2xl">
          
          {/* TELA INSTAGRAM 1080x1350 */}
          <div 
            ref={exportRef}
            className="w-[1080px] h-[1350px] relative flex flex-col overflow-hidden"
            style={{ backgroundColor: bgColor }}
          >
            {/* Texture di fondo */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.05] pointer-events-none mix-blend-overlay"></div>

            {/* HEADER AREA */}
            <div className="absolute top-16 left-16 right-16 flex justify-between items-start z-10">
              <div className="w-44 h-44 flex items-start justify-start">
                {topLogo && <img src={topLogo} className="max-w-full max-h-full object-contain drop-shadow-md" alt="Top Logo" />}
              </div>
              <h1 className="text-[100px] leading-[0.8] font-black text-white uppercase tracking-tighter text-right drop-shadow-lg">
                {topTitle}
              </h1>
            </div>

            {/* AREA CENTRALE (CARTE + LOGO INCASTRATO) */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                
                {/* Griglia 2x2 Assi */}
                <div className="grid grid-cols-2 gap-x-16 gap-y-12">
                  {cards.map((card, idx) => {
                    const rotations = ['-rotate-2', 'rotate-2', '-rotate-2', 'rotate-2'];
                    return (
                      <div 
                        key={card.id} 
                        className={`w-[320px] h-[450px] bg-white rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.18)] flex flex-col p-4 relative transform transition-transform ${rotations[idx]}`}
                      >
                        {/* Simboli Carta (Protetti da z-20 per stare sempre sopra a tutto) */}
                        <div className={`absolute top-4 left-4 text-4xl z-20 ${card.color}`}>{card.suit}</div>
                        <div className={`absolute bottom-4 right-4 text-4xl rotate-180 z-20 ${card.color}`}>{card.suit}</div>

                        {/* Foto Giocatore: mt-12 la spinge sotto al seme in alto, flex-1 la fa allungare al massimo */}
                        <div className="w-full flex-1 mt-12 mb-3 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200/40 shadow-inner relative z-10">
                          {card.image ? (
                            <img src={card.image} className="w-full h-full object-cover" alt="Player" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-neutral-300">
                              <ImagePlus size={40} />
                            </div>
                          )}
                        </div>

                        {/* Info Giocatore (Compresse e Compatte) */}
                        <div className="mt-auto mb-2 text-center z-20 relative">
                          <div className="text-[22px] font-black text-neutral-400 uppercase tracking-wider mb-[-8px]">{card.firstName}</div>
                          <div className="text-[44px] font-black text-black uppercase leading-none tracking-tighter mb-[-4px]">{card.lastName}</div>
                          <div className="text-[20px] font-black uppercase text-pink-500 tracking-wider">{card.team}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* LOGO INCASTRATO (BASKETVILLE) */}
                <div className="absolute -bottom-36 left-1/2 -translate-x-1/2 z-40 w-72 h-36 flex items-center justify-center">
                  {bottomLogo ? (
                    <img src={bottomLogo} className="max-w-full max-h-full object-contain drop-shadow-2xl" alt="Sponsor" />
                  ) : (
                    <div className="w-full h-full border-4 border-dashed border-black/10 rounded-full flex flex-col items-center justify-center text-black/20">
                      <span className="text-xs font-bold text-center">LOGO<br/>INCASTRATO</span>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* SCRITTA PIÈ DI PAGINA */}
            <div className="absolute bottom-4 left-0 right-0 text-center">
              <h2 className="text-[44px] font-bold uppercase tracking-widest text-white drop-shadow-lg">
                {bottomText}
              </h2>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}
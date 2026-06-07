import React from 'react';
import { motion } from 'framer-motion';

export default function BarMenuOBS() {
  
  // =========================================================================
  // 🍔 SEZIONE DATI: MODIFICA QUI I TESTI, GLI INGREDIENTI E I PREZZI
  // =========================================================================
  // Nota: Se aggiungi o togli voci, l'altezza dei box si adatterà in automatico.
  
  const foodItems = [
    { name: 'HAMBURGER', desc: 'Pane, hamburger, lattuga, pomodoro, cipolla', price: '6,00 €' },
    { name: 'CHEESEBURGER', desc: '+ cheddar', price: '7,00 €' },
    { name: 'BACONBURGER', desc: '+ cheddar + bacon', price: '8,00 €' },
    { name: 'PANINO C/PULLED PORK', desc: 'Pane, carne di maiale, salsa BBQ', price: '8,00 €' },
    { name: 'ARROSTICINI (8 PZ)', desc: '', price: '7,00 €' },
    { name: 'PIZZA MARGHERITA', desc: '', price: '6,00 €' },
    { name: 'PATATINE FRITTE', desc: '', price: '4,00 €' },
    { name: 'GELATO', desc: '', price: '2,50 €' }, // <-- Ricordati la virgola finale se aggiungi righe sotto!
  ];

  // COLONNA BEVERAGE 1: Modifica questi 8 elementi per la colonna centrale
  const beverageItems1 = [
    { name: 'ACQUA', price: '1,00 €' },
    { name: 'CAFFÈ', price: '1,00 €' },
    { name: 'BIBITA IN LATTINA', price: '2,50 €' },
    { name: 'BIRRA (0,4 LT)', price: '4,00 €' },
    { name: 'BIRRA S/GLUTINE (0,4 LT)', price: '5,00 €' },
    { name: 'SPRITZ APEROL (0,4 LT)', price: '4,00 €' },
    { name: 'SPRITZ CAMPARI (0,4 LT)', price: '4,00 €' },
    { name: 'PROSECCO (SPINA)', price: '2,00 €' }
  ];

  // COLONNA BEVERAGE 2: Modifica questi 8 elementi per la colonna di destra (caraffe)
  const beverageItems2 = [
    { name: 'AMERICANO', price: '6,00 €' },
    { name: 'GIN TONIC/LEMON', price: '7,00 €' },
    { name: 'NEGRONI', price: '8,00 €' },
    { name: 'PROSECCO', desc: 'Bottiglia Serena Wines', price: '10,00 €' },
    { name: 'CARAFFA BIRRA', price: '20,00 €' },
    { name: 'CARAFFA AMERICANO', price: '30,00 €' },
    { name: 'CARAFFA GIN TONIC/LEMON', price: '35,00 €' },
    { name: 'CARAFFA NEGRONI', price: '40,00 €' }
  ];

  // IMPOSTAZIONE LOGO: Percorso del file dentro la cartella /public
  let currentLogo = "/Basketville_logo26_vero.png";


  // =========================================================================
  // 🎛️ FUNZIONE STRUTTURA RIGA (RENDER): MODIFICA STILI E DIMENSIONI DELLE RIGHE
  // =========================================================================
  const renderMenuRow = (item, idx, highlightPrice = false) => (
    <div 
      key={idx} 
      // flex-1: distribuisce lo spazio; h-[66px]: altezza minima riga; bg-white/5: sfondo leggermente visibile (5% opacità)
      className="flex justify-between items-center bg-white/5 border border-white/5 px-6 py-4 rounded-2xl hover:bg-white/10 transition-colors flex-1 min-h-[76px] max-h-[76px]"
    >
      {/* Blocco sinistro: Nome prodotto + Descrizione */}
      <div className="flex flex-col pr-4 min-w-0 flex-1 justify-center">
        {/* text-[31px]: Dimensione font nome; truncate: taglia il testo se esce fuori dai bordi */}
        <span className="font-bold text-white uppercase text-[31px] tracking-wider truncate leading-none">
          {item.name}
        </span>
        {/* Gestione descrizione/ingredienti in piccolo (mostrata solo se c'è testo nel database statico) */}
        {item.desc && (
          <span className="text-[22px] font-semibold text-neutral-400 truncate tracking-wider mt-1 leading-none">
            {item.desc}
          </span>
        )}
      </div>

      {/* Blocco destro: Prezzo del prodotto */}
      {/* text-[35px]: Dimensione prezzo; tabular-nums: mantiene i numeri allineati; drop-shadow-lg: ombra per risaltare */}
      <span className={`font-black text-[35px] tracking-wider shrink-0 ml-4 tabular-nums leading-none pt-0.5 drop-shadow-lg ${
        // Se highlightPrice è vero (es: per le caraffe), usa il rosa fluo della Vero Cup con effetto neon (drop-shadow)
        highlightPrice 
          ? 'text-pink-400 drop-shadow-[0_0_12px_rgba(236,72,153,0.5)]' 
          : 'text-neutral-200'
      }`}>
        {item.price}
      </span>
    </div>
  );


  // =========================================================================
  // 📺 CANVAS PRINCIPALE: LAYOUT OBS E STRUTTURA DELLE 3 COLONNE GIGANTI
  // =========================================================================
  return (
    <motion.div
      // Animazioni d'ingresso e uscita (Framer Motion) clonate dallo scoreboard principale
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.4 }}
      // w-[1920px] h-[1080px]: Blocca lo schermo in risoluzione Full HD perfetta per OBS
      // font-dimbo: Carica il carattere tipografico ignorante e ufficiale di Basketville
      className="absolute inset-0 w-[1920px] h-[1080px] flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-950 to-black z-0 overflow-hidden font-dimbo text-white select-none p-12 pt-[220px]"
    >
      {/* BACKGROUND: Texture overlay in fibra di carbonio ad opacità 10% */}
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>

      {/* LOGO TORNEO: Posizionato in alto, perfettamente centrato in orizzontale */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50">
        <img 
          src={currentLogo} 
          alt="Logo Torneo" 
          // h-[140px]: Altezza del logo. Modificala se l'immagine risulta troppo grande o piccola
          className="h-[140px] w-auto" 
        />
      </div>

      {/* TITOLO TOP DESTRA: Stile e posizionamento identico al Live Draft e alle Classifiche */}
      <div className="absolute top-12 right-12 z-50 flex flex-col items-end text-right">
        <span className="text-pink-500 font-bold uppercase tracking-[0.08em] text-sm mb-1 drop-shadow-md">VERO Cup 2026</span>
        <h2 className="text-4xl font-black uppercase text-white drop-shadow-lg tracking-wider">
          Area Ristoro / Bar
        </h2>
      </div>

      {/* =========================================================================
          📦 GRIGLIA CONTENITORI COLONNE (MASSIMIZZATA A SCHERMO INTERO)
          ========================================================================= */}
      {/* gap-6: Spazio millimetrico tra una colonna e l'altra; items-stretch: forza tutte le colonne ad avere la stessa identica altezza */}
      {/*  DOPO (Altezza fissa decisa da te): */}
<div className="flex justify-center items-stretch gap-6 w-full h-[860px] pb-2 z-10">
        
        {/* 🍔 BLOCCO 1: FOOD (Colonna Sinistra) */}
        {/* bg-white/5: Pannello semitrasparente stile vetro fumé; rounded-[3rem]: Angoli super arrotondati pro */}
        <div className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-6 shadow-2xl flex flex-col min-w-0">
          {/* text-[42px]: Titolo del box cibo; border-b: Linea sottile divisoria inferiore */}
          <h3 className="text-center text-[42px] font-black uppercase text-pink-500 tracking-wider mb-4 border-b border-white/10 pb-3 drop-shadow-lg shrink-0">
            🍔 FOOD
          </h3>
          {/* justify-between + flex-1: Espande la lista e distribuisce le righe a tutta altezza senza lasciare vuoti */}
          <div className="flex flex-col justify-between flex-1 gap-2.5">
            {foodItems.map((item, idx) => renderMenuRow(item, idx))}
          </div>
        </div>

        {/* 🥤 BLOCCO 2: BEVERAGE PART 1 (Colonna Centrale) */}
        <div className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-6 shadow-2xl flex flex-col min-w-0">
          <h3 className="text-center text-[42px] font-black uppercase text-pink-500 tracking-wider mb-4 border-b border-white/10 pb-3 drop-shadow-lg shrink-0">
            🥤 BAR
          </h3>
          <div className="flex flex-col justify-between flex-1 gap-2.5">
            {beverageItems1.map((item, idx) => renderMenuRow(item, idx))}
          </div>
        </div>

        {/* 🍹 BLOCCO 3: BEVERAGE PART 2 (Colonna Destra - Caraffe e Vino) */}
        <div className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-6 shadow-2xl flex flex-col min-w-0">
          <h3 className="text-center text-[42px] font-black uppercase text-pink-500 tracking-wider mb-4 border-b border-white/10 pb-3 drop-shadow-lg shrink-0">
            🍹 DRINKS / CARAFFE
          </h3>
          <div className="flex flex-col justify-between flex-1 gap-2.5">
            {beverageItems2.map((item, idx) => {
              // LOGICA ILLUMINAZIONE NEON: 
              // Visto che l'array ha 8 voci, idx >= 4 intercetta le ultime 4 voci (Caraffa Birra, Americano, Gin Tonic, Negroni)
              // e le accende di rosa neon automatico. Se sposti l'ordine delle voci, cambia questo numero!
              const isCaraffa = idx >= 4;
              return renderMenuRow(item, idx, isCaraffa);
            })}
          </div>
        </div>

      </div>
    </motion.div>
  );
}
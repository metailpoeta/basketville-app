import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { 
  Target, Flame, Trash2, ChevronDown, Search, Edit2, 
  Check, X, ChevronLeft, ChevronRight, AlertCircle, 
  Tv, ListOrdered, Trophy, Wand2, Crown,
  Play, Pause, Square, Timer, Radio, Send
} from 'lucide-react';

export default function ContestManager() {
  const [activeEdition, setActiveEdition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('threepoint');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Dati Liste
  const [threePointList, setThreePointList] = useState([]);
  const [slamDunkList, setSlamDunkList] = useState([]);

  // Form Stati Condivisi / 3-Point
  const [playerName, setPlayerName] = useState('');
  const [round, setRound] = useState('Qualificazione');
  const [heat, setHeat] = useState('');
  const [score, setScore] = useState('');
  const [time, setTime] = useState('');

  // ==========================================
  // --- STATI SPECIFICI PER LA REGIA LIVE ---
  // ==========================================
  const [livePlayer, setLivePlayer] = useState(null); 
  const [liveScore, setLiveScore] = useState(0);
  const [liveTimeLeft, setLiveTimeLeft] = useState(60.0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // --- STATI PER RICERCA E PAGINAZIONE 3-POINT ---
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // --- STATI PER MODIFICA INLINE 3-POINT ---
  const [editingId, setEditingId] = useState(null);
  const [editScore, setEditScore] = useState('');
  const [editTime, setEditTime] = useState('');

  // ==========================================
  // --- STATI SPECIFICI PER SLAM DUNK ---
  // ==========================================
  const [dunk1, setDunk1] = useState('');
  const [dunk2, setDunk2] = useState('');

  const [sdSearchTerm, setSdSearchTerm] = useState('');
  const [sdCurrentPage, setSdCurrentPage] = useState(1);
  const [sdActiveTab, setSdActiveTab] = useState('Qualificazione'); // NUOVO STATO PER I TAB

  const [sdEditingId, setSdEditingId] = useState(null);
  const [sdEditDunk1, setSdEditDunk1] = useState('');
  const [sdEditDunk2, setSdEditDunk2] = useState('');

  // --- STATI PER REGIA LIVE SLAM DUNK (VOTI) ---
  const [sdLivePlayer, setSdLivePlayer] = useState(null);
  const [sdDunkNum, setSdDunkNum] = useState(1); 
  const [sdVotes, setSdVotes] = useState(['', '', '', '', '']); 

  useEffect(() => {
    async function init() {
      setLoading(true);
      const { data: ed } = await supabase
        .from('editions')
        .select('*')
        .eq('is_active', true)
        .single();
      if (ed) setActiveEdition(ed);
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (activeEdition) {
      loadThreePoint();
      loadSlamDunk();
    }
  }, [activeEdition]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    setSdCurrentPage(1);
  }, [sdSearchTerm, sdActiveTab]);

  async function loadThreePoint() {
    const { data, error } = await supabase
      .from('three_point')
      .select('*')
      .eq('edition_id', activeEdition.id)
      .order('updated_at', { ascending: false });
      
    if (error) console.error("Errore caricamento 3-Point:", error.message);
    if (data) setThreePointList(data);
  }

  async function loadSlamDunk() {
    const { data, error } = await supabase
      .from('slam_dunk')
      .select('*')
      .eq('edition_id', activeEdition.id)
      .order('id', { ascending: true }); // BLOCCATO L'ORDINAMENTO ALL'ID
      
    if (error) console.error("Errore caricamento Slam Dunk:", error.message);
    if (data) setSlamDunkList(data);
  }

  async function triggerOBS(type, payloadData = {}) {
    const { error } = await supabase.from('broadcast_state').update({
      active_graphic: type,
      payload: payloadData
    }).eq('id', 1);

    if (error) alert("Errore connessione Regia: " + error.message);
  }

  const isBetterPerformance = (oldScore, oldTime, newScore, newTime) => {
    if (oldScore === null || oldScore === undefined || oldScore === '') return true;
    if (newScore > oldScore) return true;
    if (newScore === oldScore) {
      const oT = parseFloat(oldTime) || 999;
      const nT = parseFloat(newTime) || 999;
      return nT < oT;
    }
    return false;
  };

  useEffect(() => {
    let interval = null;
    if (isTimerRunning && liveTimeLeft > 0) {
      interval = setInterval(() => {
        setLiveTimeLeft(prev => {
          const next = prev - 0.1;
          return next <= 0 ? 0 : Number(next.toFixed(1));
        });
      }, 100);
    } else if (liveTimeLeft <= 0 && isTimerRunning) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, liveTimeLeft]);

  useEffect(() => {
    if (!livePlayer) return;
    triggerOBS('3point_single', {
      command: isTimerRunning ? 'start' : 'pause',
      id: livePlayer.id,
      player_name: livePlayer.player_name,
      score: liveScore,
      time: liveTimeLeft.toFixed(1),
      round: livePlayer.round,
      prev_score: livePlayer.score,
      prev_time: livePlayer.time
    });
  }, [isTimerRunning, liveScore]); 
  
  const handleStartLiveFromRow = (playerItem) => {
    setLivePlayer(playerItem);
    setLiveScore(0);
    setLiveTimeLeft(60.0);
    setIsTimerRunning(false);

    triggerOBS('3point_single', {
      command: 'idle',
      id: playerItem.id,
      player_name: playerItem.player_name,
      score: 0,
      prev_score: playerItem.score,
      prev_time: playerItem.time,
      round: playerItem.round
    });
  };

  const handleCancelLiveMode = () => {
    if (!window.confirm("Vuoi chiudere la console live? Il risultato non verrà salvato.")) return;
    setLivePlayer(null);
    setIsTimerRunning(false);
    triggerOBS('none', {});
  };

  const handleStopAndSaveLive = async () => {
    setIsTimerRunning(false);
    const currentPlayer = livePlayer;
    const finalScore = liveScore;
    const elapsed = 60.0 - liveTimeLeft;
    const finalTimeStr = elapsed.toFixed(1);

    const oldScore = currentPlayer.score;
    const oldTime = currentPlayer.time;

    setLivePlayer(null);
    await new Promise(resolve => setTimeout(resolve, 100));

    const isPlayoff = ['Quarti di finale', 'Semifinale', 'Finale'].includes(currentPlayer.round);
    const nextScreen = isPlayoff ? '3point_bracket' : '3point_leaderboard';
    const isRecord = isBetterPerformance(oldScore, oldTime, finalScore, finalTimeStr);

    await triggerOBS('3point_result', { 
      player_name: currentPlayer.player_name,
      score: finalScore, 
      time: finalTimeStr, 
      status: isRecord ? 'record' : 'scartato',
      prev_score: oldScore, 
      prev_time: oldTime 
    });

    if (isRecord) {
      await supabase.from('three_point').update({
        score: finalScore,
        time: finalTimeStr,
        updated_at: new Date().toISOString()
      }).eq('id', currentPlayer.id);
    } 

    setTimeout(() => {
      triggerOBS(nextScreen, { id: currentPlayer.id });
    }, 5000);

    loadThreePoint();
  };

  const handleRoundChange = (e) => {
    const selectedRound = e.target.value;
    setRound(selectedRound);
    if (selectedRound === 'Quarti di finale' || selectedRound === 'Semifinale') {
      setHeat('Batteria 1');
    } else {
      setHeat('');
    }
  };

  const getWinner = (roundName, heatName = null) => {
    let filtered = threePointList.filter(p => p.round === roundName);
    if (heatName) {
      filtered = filtered.filter(p => p.heat === heatName);
    }
    if (filtered.length === 0) return null;
    
    return filtered.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const timeA = parseFloat(a.time) || 999;
      const timeB = parseFloat(b.time) || 999;
      return timeA - timeB;
    })[0];
  };

  const upsertPlayersToRound = async (players, targetRound, getHeatForPlayer, preserveScore = false) => {
    let errors = 0;
    for (const p of players) {
      if (!p) continue;
      const heat = getHeatForPlayer ? getHeatForPlayer(p) : null;
      
      const { data: existing } = await supabase
        .from('three_point')
        .select('id')
        .eq('edition_id', activeEdition.id)
        .eq('round', targetRound)
        .ilike('player_name', p.player_name)
        .maybeSingle();

      const payload = {
        edition_id: activeEdition.id,
        player_name: p.player_name,
        round: targetRound,
        heat: heat,
        score: preserveScore ? p.score : 0, 
        time: preserveScore ? p.time : null,
        updated_at: new Date().toISOString()
      };

      if (existing) {
        const { error } = await supabase.from('three_point').update(payload).eq('id', existing.id);
        if (error) errors++;
      } else {
        const { error } = await supabase.from('three_point').insert([payload]);
        if (error) errors++;
      }
    }
    return errors;
  };

  const handleGenResult = (errors) => {
    setIsGenerating(false);
    if (errors > 0) alert(`Fatto con ${errors} errori. Controlla la lista.`);
    else {
      triggerOBS('3point_bracket'); 
      alert("🪄 Magia completata! Tabellone aggiornato su OBS.");
    }
    loadThreePoint();
  };

  const generateQuarters = async () => {
    if (!window.confirm("Generare i Quarti di finale prendendo i Top 12 dalle Qualificazioni? I punteggi ripartiranno da 0.")) return;
    setIsGenerating(true);

    const qualies = threePointList
      .filter(p => p.round === 'Qualificazione')
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const timeA = parseFloat(a.time) || 999;
        const timeB = parseFloat(b.time) || 999;
        return timeA - timeB;
      })
      .slice(0, 12);

    if (qualies.length < 12 && !window.confirm(`Hai solo ${qualies.length} qualificati. Continuare?`)) {
      setIsGenerating(false); 
      return;
    }

    const matchups = [
      { heat: 'Batteria 1', p1: qualies[0], p2: qualies[11] },
      { heat: 'Batteria 2', p1: qualies[5], p2: qualies[6] },
      { heat: 'Batteria 3', p1: qualies[2], p2: qualies[9] },
      { heat: 'Batteria 4', p1: qualies[3], p2: qualies[8] },
      { heat: 'Batteria 5', p1: qualies[4], p2: qualies[7] },
      { heat: 'Batteria 6', p1: qualies[1], p2: qualies[10] },
    ];

    const playersToProcess = [];
    const heatMap = new Map();

    matchups.forEach(m => {
      if (m.p1) { playersToProcess.push(m.p1); heatMap.set(m.p1.player_name, m.heat); }
      if (m.p2) { playersToProcess.push(m.p2); heatMap.set(m.p2.player_name, m.heat); }
    });

    const errors = await upsertPlayersToRound(playersToProcess, 'Quarti di finale', (p) => heatMap.get(p.player_name), false);
    handleGenResult(errors);
  };

  const generateSemifinals = async () => {
    if (!window.confirm("Passare i 6 vincitori dei Quarti alle Semifinali? I punteggi ripartiranno da 0.")) return;
    setIsGenerating(true);

    const wQ1 = getWinner('Quarti di finale', 'Batteria 1');
    const wQ2 = getWinner('Quarti di finale', 'Batteria 2');
    const wQ3 = getWinner('Quarti di finale', 'Batteria 3');
    const wQ4 = getWinner('Quarti di finale', 'Batteria 4');
    const wQ5 = getWinner('Quarti di finale', 'Batteria 5');
    const wQ6 = getWinner('Quarti di finale', 'Batteria 6');

    const playersToProcess = [wQ1, wQ2, wQ3, wQ4, wQ5, wQ6].filter(Boolean);

    const getHeat = (p) => {
      if (p === wQ1 || p === wQ2) return 'Batteria 1';
      if (p === wQ3 || p === wQ4) return 'Batteria 2';
      if (p === wQ5 || p === wQ6) return 'Batteria 3';
      return null;
    };

    const errors = await upsertPlayersToRound(playersToProcess, 'Semifinale', getHeat, false);
    handleGenResult(errors);
  };

  const generateFinal = async () => {
    if (!window.confirm("Passare i 3 vincitori delle Semifinali alla Finale a tre? I punteggi ripartiranno da 0.")) return;
    setIsGenerating(true);

    const wS1 = getWinner('Semifinale', 'Batteria 1');
    const wS2 = getWinner('Semifinale', 'Batteria 2');
    const wS3 = getWinner('Semifinale', 'Batteria 3');

    const playersToProcess = [wS1, wS2, wS3].filter(Boolean);
    const errors = await upsertPlayersToRound(playersToProcess, 'Finale', () => null, false);
    handleGenResult(errors);
  };

  const generateWinner = async () => {
    if (!window.confirm("Incoronare il Vincitore Assoluto? Il punteggio della Finale verrà copiato per la grafica d'onore.")) return;
    setIsGenerating(true);

    const winner = getWinner('Finale', null);
    if (!winner) {
      alert("Nessun giocatore trovato nella Finale!");
      setIsGenerating(false);
      return;
    }

    const errors = await upsertPlayersToRound([winner], 'Vincitore', () => null, true);
    setIsGenerating(false);

    if (errors > 0) {
      alert(`Generazione completata con ${errors} errori. Controlla la lista.`);
    } else {
      triggerOBS('3point_winner', { 
        id: winner.id, 
        player_name: winner.player_name, 
        score: winner.score, 
        time: winner.time, 
        round: 'Vincitore' 
      });
      alert("👑 Campione decretato! Grafica Oro mandata in onda su OBS.");
    }
    
    loadThreePoint();
  };

  async function handleAddThreePoint(e) {
    e.preventDefault();
    const tName = playerName.trim();
    if (!tName) return alert("Inserisci il nome del partecipante!");

    const { data: existing } = await supabase
      .from('three_point')
      .select('*')
      .eq('edition_id', activeEdition.id)
      .eq('round', round)
      .ilike('player_name', tName)
      .maybeSingle();

    const newScore = score ? parseInt(score) : 0;
    const newTime = time || null;

    if (existing) {
      if (isBetterPerformance(existing.score, existing.time, newScore, newTime)) {
        const { error } = await supabase.from('three_point').update({
          score: newScore,
          time: newTime,
          updated_at: new Date().toISOString()
        }).eq('id', existing.id);
        
        if (error) alert("Errore: " + error.message);
        else alert("Record aggiornato con successo!");
      } else {
        alert(`⚠️ TENTATIVO SCARTATO\n\nPrestazione inserita: ${newScore} pt in ${newTime}s\nNon supera il record precedente di ${existing.score} pt in ${existing.time}s.\nIl database non è stato modificato.`);
      }
    } else {
      const payload = {
        edition_id: activeEdition.id,
        player_name: tName,
        round: round,
        heat: heat || null,
        score: newScore,
        time: newTime,
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from('three_point').insert([payload]);
      if (error) alert("Errore: " + error.message);
    }

    setPlayerName(''); 
    setScore(''); 
    setTime(''); 
    loadThreePoint();
  }

  async function handleAddSlamDunk(e) {
    e.preventDefault();
    const tName = playerName.trim();
    if (!tName) return alert("Inserisci il nome del partecipante!");

    let d1 = dunk1 ? parseInt(dunk1) : 0;
    let d2 = dunk2 ? parseInt(dunk2) : 0;

    if (d1 > 50 || d2 > 50) return alert("Il punteggio massimo per una schiacciata è 50!");

    const { data: existing } = await supabase
      .from('slam_dunk')
      .select('id')
      .eq('edition_id', activeEdition.id)
      .eq('round', round)
      .ilike('player_name', tName)
      .maybeSingle();

    const payload = {
      edition_id: activeEdition.id,
      player_name: tName,
      round: round,
      dunk_1: d1,
      dunk_2: d2,
      updated_at: new Date().toISOString()
    };

    let dbError = null;

    if (existing) {
      const { error } = await supabase.from('slam_dunk').update(payload).eq('id', existing.id);
      dbError = error;
    } else {
      const { error } = await supabase.from('slam_dunk').insert([payload]);
      dbError = error;
    }

    if (!dbError) {
      setPlayerName(''); 
      setDunk1(''); 
      setDunk2(''); 
      loadSlamDunk();
    } else {
      alert("Errore: " + dbError.message);
    }
  }

  async function handleDelete(table, id) {
    if (window.confirm("Rimuovere il partecipante dal contest?")) {
      await supabase.from(table).delete().eq('id', id);
      table === 'three_point' ? loadThreePoint() : loadSlamDunk();
    }
  }

  const startEditing = (item) => { 
    setEditingId(item.id); 
    setEditScore(item.score !== null ? item.score : ''); 
    setEditTime(item.time || ''); 
  };
  
  const cancelEditing = () => { 
    setEditingId(null); 
    setEditScore(''); 
    setEditTime(''); 
  };
  
  const saveEditing = async (id) => {
    const { error } = await supabase
      .from('three_point')
      .update({ 
        score: editScore ? parseInt(editScore) : 0, 
        time: editTime || null, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id);
      
    if (!error) { 
      setEditingId(null); 
      loadThreePoint(); 
    } else {
      alert("Errore salvataggio: " + error.message);
    }
  };

  const startSdEditing = (item) => { 
    setSdEditingId(item.id); 
    setSdEditDunk1(item.dunk_1 !== null ? item.dunk_1 : ''); 
    setSdEditDunk2(item.dunk_2 !== null ? item.dunk_2 : ''); 
  };
  
  const cancelSdEditing = () => { 
    setSdEditingId(null); 
    setSdEditDunk1(''); 
    setSdEditDunk2(''); 
  };
  
  const saveSdEditing = async (id) => {
    let d1 = sdEditDunk1 ? parseInt(sdEditDunk1) : 0; 
    let d2 = sdEditDunk2 ? parseInt(sdEditDunk2) : 0;
    if (d1 > 50 || d2 > 50) return alert("Il punteggio massimo per una schiacciata è 50!");
    
    const { error } = await supabase
      .from('slam_dunk')
      .update({ 
        dunk_1: d1, 
        dunk_2: d2, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id);
      
    if (!error) { 
      setSdEditingId(null); 
      loadSlamDunk(); 
    } else {
      alert("Errore salvataggio: " + error.message);
    }
  };

  // ==========================================
  // MOTORE REGIA SLAM DUNK
  // ==========================================
  const handleShowSlamDunkScreen = (targetRound) => {
    const players = slamDunkList.filter(p => p.round === targetRound);
    triggerOBS('slamdunk', { round: targetRound, players, winner: null });
  };

  const handleShowSlamDunkWinner = () => {
    const finalPlayers = slamDunkList.filter(p => p.round === 'Finale');
    if(finalPlayers.length === 0) return alert('Nessun finalista trovato!');
    
    const winner = finalPlayers.sort((a,b) => ((b.dunk_1||0)+(b.dunk_2||0)) - ((a.dunk_1||0)+(a.dunk_2||0)))[0];
    triggerOBS('slamdunk', { round: 'Finale', players: finalPlayers, winner: winner.player_name });
    alert(`👑 Vincitore decretato: ${winner.player_name}!`);
  };

  // 1. APRE LA CONSOLE E LANCIA IL CARTELLO GIGANTE SU OBS (Ora sa se è Dunk 1 o 2)
  const startSlamDunkLive = (player, dunkNum) => {
    setSdLivePlayer(player);
    setSdDunkNum(dunkNum);
    setSdVotes(['', '', '', '', '']);
    
    const players = slamDunkList.filter(p => p.round === player.round);
    triggerOBS('slamdunk', { 
      round: player.round, 
      players, 
      winner: null,
      liveDunker: { playerName: player.player_name, dunkNumber: dunkNum, round: player.round }
    });
  };

  // 2. AGGIORNA IL CARTELLO GIGANTE SE CAMBI DA DUNK 1 A DUNK 2
  const handleDunkNumChange = (num) => {
    setSdDunkNum(num);
    const players = slamDunkList.filter(p => p.round === sdLivePlayer.round);
    triggerOBS('slamdunk', {
      round: sdLivePlayer.round,
      players,
      winner: null,
      liveDunker: { playerName: sdLivePlayer.player_name, dunkNumber: num, round: sdLivePlayer.round }
    });
  };

  // 3. CHIUDE LA CONSOLE E RIMANDA ALLA GRIGLIA
  const closeSlamDunkLive = () => {
    const currentRound = sdLivePlayer.round;
    setSdLivePlayer(null);
    handleShowSlamDunkScreen(currentRound);
  };

  // 4. MANDA I VOTI IN DIRETTA E SALVA (IL LAMPEGGIO ENTRA QUI)
  const handleProcessSlamDunkVotes = async () => {
    const parsedVotes = sdVotes.map(v => parseInt(v) || 0);
    const total = parsedVotes.reduce((acc, curr) => acc + curr, 0);
    const fieldToUpdate = sdDunkNum === 1 ? 'dunk_1' : 'dunk_2';

    // A. Manda su OBS la schermata con i voti che girano
    const players = slamDunkList.filter(p => p.round === sdLivePlayer.round);
    triggerOBS('slamdunk', {
      round: sdLivePlayer.round,
      players: players,
      winner: null,
      activeVote: {
        playerName: sdLivePlayer.player_name,
        dunkNumber: sdDunkNum,
        votes: parsedVotes,
        total: total
      }
    });

    // B. Salva su Supabase in Background
    await supabase.from('slam_dunk').update({ 
      [fieldToUpdate]: total,
      updated_at: new Date().toISOString()
    }).eq('id', sdLivePlayer.id);

    loadSlamDunk();

    // C. Aspetta gli 8 secondi e richiama la griglia mandandole il comando per lampeggiare solo il box specifico
    setTimeout(async () => {
      const { data } = await supabase
        .from('slam_dunk')
        .select('*')
        .eq('edition_id', activeEdition.id)
        .order('id', { ascending: true }); // Mantiene l'ordine originale
        
      if (data) {
        setSlamDunkList(data);
        const updatedPlayers = data.filter(p => p.round === sdLivePlayer.round);
        
        triggerOBS('slamdunk', {
          round: sdLivePlayer.round,
          players: updatedPlayers,
          winner: null,
          lastUpdatedPlayer: sdLivePlayer.player_name, 
          lastUpdatedDunk: sdDunkNum 
        });
      }
      
      setSdLivePlayer(null);
    }, 8000);
  };


  const getHeatOptions = () => {
    if (round === 'Quarti di finale') return [1, 2, 3, 4, 5, 6];
    if (round === 'Semifinale') return [1, 2, 3];
    return [];
  };

  const filteredThreePoint = threePointList.filter(item => 
    item.player_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.ceil(filteredThreePoint.length / ITEMS_PER_PAGE);
  const currentThreePoint = filteredThreePoint.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // FILTRI AGGIORNATI PER I TAB DINAMICI SLAM DUNK
  const filteredSlamDunkByTab = slamDunkList.filter(item => item.round === sdActiveTab);
  const filteredSlamDunk = filteredSlamDunkByTab.filter(item => 
    item.player_name?.toLowerCase().includes(sdSearchTerm.toLowerCase())
  );
  const sdTotalPages = Math.ceil(filteredSlamDunk.length / ITEMS_PER_PAGE);
  const currentSlamDunk = filteredSlamDunk.slice((sdCurrentPage - 1) * ITEMS_PER_PAGE, sdCurrentPage * ITEMS_PER_PAGE);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto mt-20 flex flex-col items-center text-neutral-400">
        <div className="w-8 h-8 border-4 border-neutral-200 border-t-pink-500 rounded-full animate-spin mb-4"></div>
        <p className="text-sm">Caricamento contest...</p>
      </div>
    );
  }

  if (!activeEdition) {
    return (
      <div className="max-w-4xl mx-auto mt-20 animate-in fade-in duration-300">
        <div className="bg-white rounded-2xl border border-dashed border-neutral-300 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-neutral-400" />
          </div>
          <h2 className="text-xl font-semibold text-neutral-800 mb-2">Nessuna Edizione Attiva</h2>
          <p className="text-neutral-500 text-sm max-w-sm mx-auto">
            Per gestire i contest, devi prima impostare un'edizione come "Attiva" dal pannello di controllo.
          </p>
        </div>
      </div>
    );
  }

  const showHeats = round === 'Quarti di finale' || round === 'Semifinale';

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in pb-20 space-y-8">
      
      {/* HEADER E TABS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-neutral-100 pb-6">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-800">Gestione Contest & Regia</h2>
          <p className="text-sm text-neutral-500 mt-1">Edizione {activeEdition?.year}</p>
        </div>
        
        <div className="flex bg-neutral-100/50 p-1 rounded-xl w-fit border border-neutral-200/50">
          <button 
            onClick={() => {
              setActiveSection('threepoint'); 
              setPlayerName(''); 
              setRound('Qualificazione'); 
              setHeat('');
            }} 
            className={`flex items-center px-6 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSection === 'threepoint' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <Target size={16} className="mr-2" /> 
            3-Point
          </button>
          
          <button 
            onClick={() => {
              setActiveSection('slamdunk'); 
              setPlayerName(''); 
              setRound('Qualificazione'); 
              setHeat('');
            }} 
            className={`flex items-center px-6 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSection === 'slamdunk' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <Flame size={16} className="mr-2" /> 
            Slam Dunk
          </button>
        </div>
      </div>

      <main>
        
        {/* ================= SEZIONE 3-POINT ================= */}
        {activeSection === 'threepoint' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            
            {/* SEZIONE AUTOMAZIONI PLAYOFF */}
            <div className="bg-gradient-to-r from-neutral-50 to-neutral-100/50 p-5 rounded-2xl border border-neutral-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Wand2 size={18} className="text-purple-500"/>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-700">
                    Automazioni Tabellone
                  </h3>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => triggerOBS('3point_leaderboard')} 
                    className="flex items-center gap-2 px-3 py-1.5 bg-white text-neutral-600 rounded-md border border-neutral-200 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-50 transition-colors shadow-sm"
                  >
                    <ListOrdered size={14} /> Classifica
                  </button>
                  <button 
                    onClick={() => triggerOBS('3point_bracket')} 
                    className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 text-white rounded-md text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors shadow-sm"
                  >
                    <Trophy size={14} /> Tabellone
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button 
                  onClick={generateQuarters} 
                  disabled={isGenerating} 
                  className="p-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 hover:border-purple-300 hover:text-purple-600 transition-all shadow-sm text-center disabled:opacity-50"
                >
                  1. Genera Quarti
                </button>
                <button 
                  onClick={generateSemifinals} 
                  disabled={isGenerating} 
                  className="p-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 hover:border-purple-300 hover:text-purple-600 transition-all shadow-sm text-center disabled:opacity-50"
                >
                  2. Genera Semifinali
                </button>
                <button 
                  onClick={generateFinal} 
                  disabled={isGenerating} 
                  className="p-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 hover:border-purple-300 hover:text-purple-600 transition-all shadow-sm text-center disabled:opacity-50"
                >
                  3. Genera Finale
                </button>
                <button 
                  onClick={generateWinner} 
                  disabled={isGenerating} 
                  className="flex items-center justify-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-xs font-bold text-yellow-700 hover:bg-yellow-100 transition-all shadow-sm text-center disabled:opacity-50"
                >
                  <Crown size={14} /> 4. Decreta Vincitore
                </button>
              </div>
            </div>

            {livePlayer ? (
              // ========================================================
              // CONSOLE REGIA LIVE (ORA AL DECIMO DI SECONDO)
              // ========================================================
              <div className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 md:p-10 text-white flex flex-col items-center relative shadow-2xl animate-in zoom-in-95">
                <div className="absolute top-0 w-full h-1.5 bg-pink-500 animate-pulse rounded-t-3xl"></div>
                <button onClick={handleCancelLiveMode} className="absolute top-4 right-4 text-neutral-500 hover:text-white bg-neutral-900 p-2 rounded-lg transition-colors"><X size={20}/></button>
                
                <div className="flex items-center gap-2 mb-2 bg-red-500/10 border border-red-500/30 px-3 py-1 rounded-full">
                  <Radio size={14} className="text-red-500 animate-pulse"/>
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">ON AIR SU OBS</span>
                </div>

                <h2 className="text-5xl font-black uppercase tracking-tight text-white mb-1">{livePlayer.player_name}</h2>
                <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-10">{livePlayer.round} {livePlayer.heat ? `| ${livePlayer.heat}` : ''}</p>
                
                <div className="flex flex-col md:flex-row gap-12 w-full justify-center items-center mb-10 max-w-2xl">
                  {/* CRONOMETRO CON DECIMI */}
                  <div className="flex flex-col items-center bg-white/5 p-6 rounded-2xl border border-neutral-800 min-w-[200px]">
                     <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-2"><Timer size={14}/> Cronometro</span>
                     <span className={`text-7xl font-black tabular-nums ${liveTimeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                       {liveTimeLeft.toFixed(1)}s
                     </span>
                  </div>

                  {/* PUNTEGGI */}
                  <div className="flex flex-col items-center bg-white/5 p-6 rounded-2xl border border-neutral-800 flex-1 w-full">
                     <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">Incremento Canestri</span>
                     <div className="flex items-center justify-center gap-6 w-full">
                        <button type="button" onClick={() => setLiveScore(s => Math.max(0, s - 1))} className="w-14 h-14 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-center hover:bg-neutral-800 text-neutral-400 hover:text-white text-2xl font-black transition-colors">-1</button>
                        <span className="text-8xl font-black text-pink-500 min-w-[100px] text-center drop-shadow-[0_0_20px_rgba(236,72,153,0.4)]">{liveScore}</span>
                        <button type="button" onClick={() => setLiveScore(s => s + 1)} className="w-16 h-16 bg-pink-600 rounded-xl flex items-center justify-center hover:bg-pink-500 text-white text-4xl font-black shadow-lg transition-transform active:scale-95">+</button>
                     </div>
                  </div>
                </div>

                {/* PULSANTIERA TELECOMANDO */}
                <div className="flex gap-4 w-full max-w-md">
                   {!isTimerRunning && liveTimeLeft > 0 ? (
                      <button type="button" onClick={() => setIsTimerRunning(true)} className="flex-1 bg-green-500 hover:bg-green-400 text-neutral-950 py-3.5 rounded-xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                        <Play fill="currentColor" size={14}/> Avvia Tempo
                      </button>
                   ) : (
                      <button type="button" onClick={() => setIsTimerRunning(false)} className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-neutral-950 py-3.5 rounded-xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all">
                        <Pause fill="currentColor" size={14}/> Metti in Pausa
                      </button>
                   )}
                   <button type="button" onClick={handleStopAndSaveLive} className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3.5 rounded-xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(220,38,38,0.2)]">
                     <Square fill="currentColor" size={14}/> Stop e Salva
                   </button>
                </div>
              </div>
            ) : (
              <>
                {/* Form Inserimento Manuale */}
                <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-neutral-200">
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
                    <h3 className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
                      <Target size={18} className="text-pink-500"/> Iscrizione Rapida
                    </h3>
                  </div>
                  
                  <form onSubmit={handleAddThreePoint} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    
                    <div className="md:col-span-4 space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                        Nome Partecipante
                      </label>
                      <input 
                        type="text" 
                        placeholder="Es. Steph Curry" 
                        className="w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-sm" 
                        value={playerName} 
                        onChange={e => setPlayerName(e.target.value)} 
                      />
                    </div>
                    
                    <div className={`space-y-1 ${!showHeats ? 'md:col-span-4' : 'md:col-span-2'}`}>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                        Fase
                      </label>
                      <div className="relative">
                        <select 
                          className="w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 appearance-none outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-sm" 
                          value={round} 
                          onChange={handleRoundChange}
                        >
                          <option value="Qualificazione">Qualificazione</option>
                          <option value="Quarti di finale">Quarti di finale</option>
                          <option value="Semifinale">Semifinale</option>
                          <option value="Finale">Finale</option>
                          <option value="Vincitore">👑 Vincitore Assoluto</option>
                        </select>
                        <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                      </div>
                    </div>
                    
                    {showHeats && (
                      <div className="space-y-1 md:col-span-2 animate-in fade-in">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                          Batteria
                        </label>
                        <div className="relative">
                          <select 
                            className="w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 appearance-none outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-sm" 
                            value={heat} 
                            onChange={e => setHeat(e.target.value)}
                          >
                            {getHeatOptions().map(num => (
                              <option key={num} value={`Batteria ${num}`}>
                                Batteria {num}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                        </div>
                      </div>
                    )}

                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                        Punti (Opz.)
                      </label>
                      <input 
                        type="number" 
                        placeholder="Es. 25" 
                        className="w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-sm" 
                        value={score} 
                        onChange={e => setScore(e.target.value)} 
                      />
                    </div>
                    
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                        Tempo (Opz.)
                      </label>
                      <input 
                        type="text" 
                        placeholder="Es. 59.5" 
                        className="w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-sm" 
                        value={time} 
                        onChange={e => setTime(e.target.value)} 
                      />
                    </div>

                    <div className="md:col-span-4 mt-2">
                      <button 
                        type="submit" 
                        className="w-full md:w-auto px-6 py-3 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors shadow-sm"
                      >
                        Aggiungi Tiratore al Tabellone
                      </button>
                    </div>
                  </form>
                </div>

                {/* Lista Partecipanti Paginata e Ricercabile */}
                <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-neutral-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                    <h3 className="text-sm font-semibold text-neutral-800">Lista Iscritti 3-Point</h3>
                    <div className="relative w-full sm:w-auto">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input 
                        type="text" 
                        placeholder="Cerca giocatore..." 
                        className="w-full sm:w-64 pl-9 pr-4 py-2 bg-white border border-neutral-200 rounded-lg text-sm outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    {currentThreePoint.length === 0 ? (
                      <div className="p-8 border border-dashed border-neutral-200 rounded-xl text-center">
                        <p className="text-sm text-neutral-500">Nessun iscritto trovato</p>
                      </div>
                    ) : currentThreePoint.map(item => (
                      <div 
                        key={item.id} 
                        className={`flex flex-col md:flex-row md:items-center justify-between p-4 bg-white border rounded-xl group hover:shadow-sm transition-all gap-4 ${
                          item.round === 'Vincitore' ? 'border-yellow-400 bg-yellow-50/30' : 'border-neutral-200 hover:border-pink-300'
                        }`}
                      >
                        <div className="flex-1 flex flex-col">
                          <span className="text-base font-semibold text-neutral-900 flex items-center gap-2">
                            {item.round === 'Vincitore' && <Trophy size={16} className="text-yellow-500" />}
                            {item.player_name}
                          </span>
                          <span className="text-xs font-medium text-neutral-500 mt-0.5">
                            {item.round} {item.heat && <span className="text-pink-500 mx-1">•</span>} {item.heat}
                          </span>
                        </div>

                        {/* MODALITÀ MODIFICA (Inline Edit) */}
                        {editingId === item.id ? (
                          <div className="flex items-center gap-3 animate-in fade-in bg-pink-50/50 p-2 rounded-lg border border-pink-100">
                            <div className="flex flex-col gap-1 w-20">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 text-center">
                                Score
                              </label>
                              <input 
                                type="number" 
                                className="w-full text-center p-2 bg-white border border-neutral-300 rounded-lg text-sm font-semibold outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500" 
                                value={editScore} 
                                onChange={e => setEditScore(e.target.value)} 
                              />
                            </div>
                            <div className="flex flex-col gap-1 w-20">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 text-center">
                                Time
                              </label>
                              <input 
                                type="text" 
                                className="w-full text-center p-2 bg-white border border-neutral-300 rounded-lg text-sm font-semibold outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500" 
                                value={editTime} 
                                onChange={e => setEditTime(e.target.value)} 
                              />
                            </div>
                            <div className="flex gap-1 ml-2 mt-5">
                              <button 
                                onClick={() => saveEditing(item.id)} 
                                className="bg-green-50 text-green-600 p-2 rounded-lg hover:bg-green-500 hover:text-white transition-colors"
                              >
                                <Check size={16}/>
                              </button>
                              <button 
                                onClick={cancelEditing} 
                                className="bg-neutral-100 text-neutral-500 p-2 rounded-lg hover:bg-neutral-200 transition-colors"
                              >
                                <X size={16}/>
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* MODALITÀ VISUALIZZAZIONE E COMANDI OBS */
                          <div className="flex items-center gap-6 self-end md:self-auto border-t border-neutral-100 md:border-0 pt-3 md:pt-0 w-full md:w-auto">
                            <div className="text-center px-4 md:border-r border-neutral-100">
                              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Time</p>
                              <p className="text-lg font-semibold text-neutral-700">{item.time || '-'}</p>
                            </div>
                            <div className="text-center flex-1 md:flex-none">
                              <p className="text-[10px] font-bold text-pink-500 uppercase tracking-widest">Score</p>
                              <p className="text-xl font-bold text-neutral-900">{item.score}</p>
                            </div>
                            <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                              
                              <button 
                                onClick={() => handleStartLiveFromRow(item)} 
                                className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors text-[10px] font-black uppercase tracking-widest animate-pulse"
                                title="Apri Console Live"
                              >
                                🔴 Live
                              </button>

                              <button 
                                onClick={() => triggerOBS(item.round === 'Vincitore' ? '3point_winner' : '3point_single', { 
                                  id: item.id, 
                                  player_name: item.player_name, 
                                  score: item.score, 
                                  time: item.time, 
                                  round: item.round 
                                })} 
                                className={`flex items-center gap-1 px-3 py-1.5 text-white rounded-lg transition-colors text-[10px] font-bold uppercase tracking-widest ${
                                  item.round === 'Vincitore' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-pink-500 hover:bg-pink-600'
                                }`} 
                                title="Manda su OBS (Statica)"
                              >
                                <Tv size={14} /> In Onda
                              </button>
                              
                              <button 
                                onClick={() => triggerOBS('none', {})} 
                                className="px-3 py-1.5 bg-neutral-100 text-neutral-500 hover:bg-neutral-200 rounded-lg transition-colors text-[10px] font-bold uppercase tracking-widest mr-2" 
                                title="Togli da OBS"
                              >
                                Chiudi
                              </button>

                              <button 
                                onClick={() => startEditing(item)} 
                                className="p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 rounded-lg transition-colors" 
                                title="Modifica Punteggio"
                              >
                                <Edit2 size={16} />
                              </button>
                              
                              <button 
                                onClick={() => handleDelete('three_point', item.id)} 
                                className="p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors" 
                                title="Elimina"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Controlli Paginazione */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-neutral-100">
                      <p className="text-xs font-semibold text-neutral-500">Pagina {currentPage} di {totalPages}</p>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                          disabled={currentPage === 1}
                          className="p-2 border border-neutral-200 rounded-lg text-neutral-500 hover:bg-neutral-50 disabled:opacity-50 transition-colors"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button 
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                          disabled={currentPage === totalPages}
                          className="p-2 border border-neutral-200 rounded-lg text-neutral-500 hover:bg-neutral-50 disabled:opacity-50 transition-colors"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ================= SEZIONE SLAM DUNK ================= */}
        {activeSection === 'slamdunk' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            
            {/* PANNELLO REGIA GLOBALE SLAM DUNK */}
            <div className="bg-gradient-to-r from-neutral-50 to-neutral-100/50 p-5 rounded-2xl border border-neutral-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Tv size={18} className="text-pink-500"/>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-700">Regia Slam Dunk (Grafiche Intere)</h3>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button 
                  onClick={() => handleShowSlamDunkScreen('Qualificazione')} 
                  className="p-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 hover:border-pink-300 hover:text-pink-600 transition-all shadow-sm text-center"
                >
                  Mostra Qualificazioni
                </button>
                <button 
                  onClick={() => handleShowSlamDunkScreen('Spareggio')} 
                  className="p-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 hover:border-pink-300 hover:text-pink-600 transition-all shadow-sm text-center"
                >
                  Mostra Spareggio
                </button>
                <button 
                  onClick={() => handleShowSlamDunkScreen('Finale')} 
                  className="p-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 hover:border-pink-300 hover:text-pink-600 transition-all shadow-sm text-center"
                >
                  Mostra Finale
                </button>
                <button 
                  onClick={handleShowSlamDunkWinner} 
                  className="flex items-center justify-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-xs font-bold text-yellow-700 hover:bg-yellow-100 transition-all shadow-sm text-center"
                >
                  <Crown size={14} /> Incorona Vincitore
                </button>
              </div>
            </div>

            {sdLivePlayer ? (
              // CONSOLE LIVE VOTI SLAM DUNK
              <div className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 md:p-10 text-white flex flex-col items-center relative shadow-2xl animate-in zoom-in-95">
                <div className="absolute top-0 w-full h-1.5 bg-pink-500 animate-pulse rounded-t-3xl"></div>
                <button onClick={closeSlamDunkLive} className="absolute top-4 right-4 text-neutral-500 hover:text-white bg-neutral-900 p-2 rounded-lg transition-colors"><X size={20}/></button>
                
                <div className="flex items-center gap-2 mb-2 bg-red-500/10 border border-red-500/30 px-3 py-1 rounded-full">
                  <Radio size={14} className="text-red-500 animate-pulse"/>
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">CONSOLE GIUDICI</span>
                </div>

                <h2 className="text-5xl font-black uppercase tracking-tight text-white mb-1">{sdLivePlayer.player_name}</h2>
                <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-8">{sdLivePlayer.round}</p>
                
                {/* Selezione Schiacciata */}
                <div className="flex gap-4 mb-8 bg-neutral-900 p-2 rounded-xl">
                  <button onClick={() => handleDunkNumChange(1)} className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${sdDunkNum === 1 ? 'bg-pink-500 text-white' : 'text-neutral-500 hover:text-white'}`}>DUNK 1</button>
                  <button onClick={() => handleDunkNumChange(2)} className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${sdDunkNum === 2 ? 'bg-pink-500 text-white' : 'text-neutral-500 hover:text-white'}`}>DUNK 2</button>
                </div>

                {/* I 5 Voti */}
                <div className="flex gap-4 mb-8 flex-wrap justify-center">
                  {sdVotes.map((v, i) => (
                    <div key={i} className="flex flex-col items-center gap-2">
                      <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Giudice {i+1}</label>
                      <input 
                        type="number" 
                        min="0" max="10"
                        value={v}
                        onChange={(e) => {
                          const newVotes = [...sdVotes];
                          newVotes[i] = e.target.value;
                          setSdVotes(newVotes);
                        }}
                        className="w-20 h-24 bg-neutral-900 border-2 border-neutral-700 rounded-xl text-center text-4xl font-black text-white outline-none focus:border-pink-500 transition-colors"
                      />
                    </div>
                  ))}
                </div>

                {/* Totale Calcolato Automaticamente */}
                <div className="text-center mb-10">
                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Totale</span>
                  <div className="text-7xl font-black text-pink-500 drop-shadow-[0_0_20px_rgba(236,72,153,0.4)]">
                    {sdVotes.reduce((acc, curr) => acc + (parseInt(curr) || 0), 0)}
                  </div>
                </div>

                {/* TASTO UNICO MAGICO: Manda Voti + Salva + Transizione Automatica */}
                <div className="flex flex-col w-full max-w-md">
                   <button type="button" onClick={handleProcessSlamDunkVotes} className="w-full bg-pink-600 hover:bg-pink-500 text-white py-4 rounded-xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(236,72,153,0.3)]">
                     <Send size={16}/> Manda Voti in Diretta e Salva (Auto)
                   </button>
                   <span className="text-[10px] text-center text-neutral-500 mt-3 uppercase tracking-widest font-bold">
                     Tornerà in automatico alla griglia dopo 8 secondi
                   </span>
                </div>
              </div>
            ) : (
              <>
                {/* Form Inserimento Slam Dunk */}
                <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-800 mb-6 flex items-center gap-2">
                    <Flame size={18} className="text-pink-500"/> Iscrizione Slam Dunk Contest
                  </h3>
                  
                  <form onSubmit={handleAddSlamDunk} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-4 space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                        Nome Partecipante
                      </label>
                      <input 
                        type="text" 
                        placeholder="Es. Zach LaVine" 
                        className="w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-sm" 
                        value={playerName} 
                        onChange={e => setPlayerName(e.target.value)} 
                      />
                    </div>
                    
                    <div className="md:col-span-4 space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                        Fase
                      </label>
                      <div className="relative">
                        <select 
                          className="w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 appearance-none outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-sm" 
                          value={round} 
                          onChange={e => setRound(e.target.value)}
                        >
                          <option value="Qualificazione">Qualificazione</option>
                          <option value="Spareggio">Spareggio</option>
                          <option value="Finale">Finale</option>
                        </select>
                        <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                      </div>
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                        Dunk 1 (Max 50)
                      </label>
                      <input 
                        type="number" 
                        min="0" 
                        max="50" 
                        placeholder="Es. 45" 
                        className="w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-sm" 
                        value={dunk1} 
                        onChange={e => setDunk1(e.target.value)} 
                      />
                    </div>
                    
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                        Dunk 2 (Max 50)
                      </label>
                      <input 
                        type="number" 
                        min="0" 
                        max="50" 
                        placeholder="Es. 50" 
                        className="w-full p-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-800 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-sm" 
                        value={dunk2} 
                        onChange={e => setDunk2(e.target.value)} 
                      />
                    </div>

                    <div className="md:col-span-4 mt-2">
                      <button 
                        type="submit" 
                        className="w-full md:w-auto px-6 py-3 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors shadow-sm"
                      >
                        Aggiungi / Aggiorna Schiacciatore
                      </button>
                    </div>
                  </form>
                </div>

                {/* Lista Partecipanti Slam Dunk (CON TAB) */}
                <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-neutral-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                    <h3 className="text-sm font-semibold text-neutral-800">Lista Iscritti Slam Dunk</h3>
                    <div className="relative w-full sm:w-auto">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input 
                        type="text" 
                        placeholder="Cerca giocatore..." 
                        className="w-full sm:w-64 pl-9 pr-4 py-2 bg-white border border-neutral-200 rounded-lg text-sm outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all shadow-sm"
                        value={sdSearchTerm}
                        onChange={(e) => setSdSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* TAB DINAMICI PER ROUND */}
                  <div className="flex gap-2 mb-6 border-b border-neutral-100 pb-4 overflow-x-auto">
                    {['Qualificazione', 'Spareggio', 'Finale'].map(tab => (
                      <button 
                        key={tab}
                        onClick={() => { setSdActiveTab(tab); setSdCurrentPage(1); }}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                          sdActiveTab === tab ? 'bg-pink-50 text-pink-600 border border-pink-200' : 'text-neutral-500 hover:bg-neutral-50'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3">
                    {currentSlamDunk.length === 0 ? (
                      <div className="p-8 border border-dashed border-neutral-200 rounded-xl text-center">
                        <p className="text-sm text-neutral-500">Nessun iscritto trovato per questo round</p>
                      </div>
                    ) : currentSlamDunk.map(item => (
                      <div key={item.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white border border-neutral-200 rounded-xl group hover:border-pink-300 hover:shadow-sm transition-all gap-4">
                        
                        <div className="flex-1 flex flex-col">
                          <span className="text-base font-semibold text-neutral-900">{item.player_name}</span>
                          <span className="text-xs font-medium text-neutral-500 mt-0.5">{item.round}</span>
                        </div>

                        {/* MODALITÀ MODIFICA SLAM DUNK (Inline Edit) */}
                        {sdEditingId === item.id ? (
                          <div className="flex items-center gap-3 animate-in fade-in bg-pink-50/50 p-2 rounded-lg border border-pink-100">
                            <div className="flex flex-col gap-1 w-20">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 text-center">
                                Dunk 1
                              </label>
                              <input 
                                type="number" 
                                min="0" max="50" 
                                className="w-full text-center p-2 bg-white border border-neutral-300 rounded-lg text-sm font-semibold outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500" 
                                value={sdEditDunk1} 
                                onChange={e => setSdEditDunk1(e.target.value)} 
                              />
                            </div>
                            <div className="flex flex-col gap-1 w-20">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 text-center">
                                Dunk 2
                              </label>
                              <input 
                                type="number" 
                                min="0" max="50" 
                                className="w-full text-center p-2 bg-white border border-neutral-300 rounded-lg text-sm font-semibold outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500" 
                                value={sdEditDunk2} 
                                onChange={e => setSdEditDunk2(e.target.value)} 
                              />
                            </div>
                            <div className="flex gap-1 ml-2 mt-5">
                              <button onClick={() => saveSdEditing(item.id)} className="bg-green-50 text-green-600 p-2 rounded-lg hover:bg-green-500 hover:text-white transition-colors"><Check size={16}/></button>
                              <button onClick={cancelSdEditing} className="bg-neutral-100 text-neutral-500 p-2 rounded-lg hover:bg-neutral-200 transition-colors"><X size={16}/></button>
                            </div>
                          </div>
                        ) : (
                          /* MODALITÀ VISUALIZZAZIONE E COMANDI REGIA */
                          <div className="flex items-center gap-6 self-end md:self-auto border-t border-neutral-100 md:border-0 pt-3 md:pt-0 w-full md:w-auto">
                            <div className="text-center px-4 border-r border-neutral-100 flex-1 md:flex-none">
                              <p className="text-[10px] font-bold text-pink-500 uppercase tracking-widest">Dunk 1</p>
                              <p className="text-xl font-bold text-neutral-900">{item.dunk_1}</p>
                            </div>
                            <div className="text-center flex-1 md:flex-none">
                              <p className="text-[10px] font-bold text-pink-500 uppercase tracking-widest">Dunk 2</p>
                              <p className="text-xl font-bold text-neutral-900">{item.dunk_2}</p>
                            </div>
                            <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                              
                              {/* TASTI LIVE MIRATI: Chiedono subito la dunk giusta */}
                              <button 
                                onClick={() => startSlamDunkLive(item, 1)} 
                                className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors text-[10px] font-black uppercase tracking-widest mr-1"
                                title="Manda la Grafica Dunk 1"
                              >
                                LIVE DUNK 1
                              </button>
                              <button 
                                onClick={() => startSlamDunkLive(item, 2)} 
                                className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors text-[10px] font-black uppercase tracking-widest mr-2"
                                title="Manda la Grafica Dunk 2"
                              >
                                LIVE DUNK 2
                              </button>

                              <button onClick={() => startSdEditing(item)} className="p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 rounded-lg transition-colors" title="Modifica Punteggi"><Edit2 size={16} /></button>
                              <button onClick={() => handleDelete('slam_dunk', item.id)} className="p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors" title="Elimina"><Trash2 size={16} /></button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Controlli Paginazione Slam Dunk */}
                  {sdTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-neutral-100">
                      <p className="text-xs font-semibold text-neutral-500">Pagina {sdCurrentPage} di {sdTotalPages}</p>
                      <div className="flex gap-2">
                        <button onClick={() => setSdCurrentPage(p => Math.max(1, p - 1))} disabled={sdCurrentPage === 1} className="p-2 border border-neutral-200 rounded-lg text-neutral-500 hover:bg-neutral-50 disabled:opacity-50 transition-colors"><ChevronLeft size={16} /></button>
                        <button onClick={() => setSdCurrentPage(p => Math.min(sdTotalPages, p + 1))} disabled={sdCurrentPage === sdTotalPages} className="p-2 border border-neutral-200 rounded-lg text-neutral-500 hover:bg-neutral-50 disabled:opacity-50 transition-colors"><ChevronRight size={16} /></button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
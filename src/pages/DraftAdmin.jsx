import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { ListOrdered, Users, RefreshCw, X, UserPlus, Search, Trophy, Tv, LayoutGrid, Columns, PanelRight, Megaphone, UserCheck, Trash2 } from 'lucide-react';

export default function DraftAdmin() {
  const [draftTeams, setDraftTeams] = useState([]);
  const [draftPicks, setDraftPicks] = useState([]);
  const [totalTeamsFound, setTotalTeamsFound] = useState(0);
  
  // STATO PER I TAB DELLA UI
  const [activeTab, setActiveTab] = useState('board'); // 'board' o 'pool'

  // STATI DRAFT POOL
  const [eligiblePlayers, setEligiblePlayers] = useState([]);
  const [poolFn, setPoolFn] = useState('');
  const [poolLn, setPoolLn] = useState('');
  const [poolRole, setPoolRole] = useState('');
  const [poolDob, setPoolDob] = useState('');
  const [poolSearchResults, setPoolSearchResults] = useState([]);
  const [isPoolSearching, setIsPoolSearching] = useState(false);

  // Stati per il Modale Assegnazione Pick
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPick, setSelectedPick] = useState(null);
  const [pickSearchFn, setPickSearchFn] = useState('');
  const [pickSearchLn, setPickSearchLn] = useState('');
  const [pickSearchResults, setPickSearchResults] = useState([]);
  const [isPickSearching, setIsPickSearching] = useState(false);

  // 1. CARICAMENTO DATI BASE E POOL
  const loadData = async () => {
    // Carica Squadre e Picks
    const { data: ed } = await supabase.from('editions').select('id').eq('is_active', true).single();
    if (ed) {
      const { data: ev } = await supabase.from('events').select('id').ilike('name', '%vero cup%').single();
      if (ev) {
        const { data: teamsData } = await supabase
          .from('teams_edition_events')
          .select('id, team_id, coach, assistant_coach, teams(name)')
          .eq('edition_id', ed.id)
          .eq('event_id', ev.id);

        if (teamsData) {
          setTotalTeamsFound(teamsData.length);
          const top6 = teamsData.slice(0, 6);
          setDraftTeams(top6);

          if (top6.length > 0) {
            const teamIds = top6.map(t => t.id);
            const { data: picks } = await supabase
              .from('draft')
              .select('*, players(first_name, last_name), teams_edition_events(coach, assistant_coach, teams(name))')
              .in('team_edition_event_id', teamIds)
              .order('pick_number', { ascending: true });
            
            setDraftPicks(picks || []);
          }
        }
      }
    }

    // Carica Giocatori Eleggibili (Draft Pool)
    const { data: eligibles } = await supabase
      .from('players')
      .select('*')
      .eq('draft', true)
      .order('last_name', { ascending: true });
    setEligiblePlayers(eligibles || []);
  };

  useEffect(() => {
    loadData();
    const draftChannel = supabase.channel('draft-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'draft' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => loadData())
      .subscribe();
    return () => supabase.removeChannel(draftChannel);
  }, []);

  // FUNZIONE PER MANDARE IN ONDA SU OBS
  const triggerOBSGraphic = async (graphicType, extraPayload = {}) => {
    const { error } = await supabase.from('broadcast_state').update({
      active_graphic: graphicType,
      payload: { timestamp: Date.now(), ...extraPayload }
    }).eq('id', 1);

    if (error) alert("Errore connessione OBS: " + error.message);
  };

  // ==========================================
  // MOTORE DEL DRAFT CON SCHERMATA ATTESA
  // ==========================================
// ==========================================
  // MOTORE DEL DRAFT CON SCHERMATA ATTESA
  // ==========================================
  const generateRound = async (roundNumber) => {
    if (draftTeams.length < 6) return alert("Servono esattamente 6 squadre.");

    // 1. AL CLICK: Mandiamo SUBITO la grafica di attesa a OBS
    await triggerOBSGraphic('draft_round_attesa', { round: roundNumber });

    // 2. Ritardiamo l'alert di appena 100ms per permettere al segnale 
    // di arrivare a OBS prima che il browser si "congelo" per farti la domanda.
    setTimeout(async () => {
      
      // Ora il maxischermo è nero con il caricamento in corso. Chiediamo conferma.
      if (!window.confirm(`La grafica di attesa è live su OBS.\nVuoi calcolare segretamente il Round ${roundNumber}?`)) {
        // Se cambi idea e clicchi "Annulla", togliamo la schermata di attesa
        triggerOBSGraphic('draft_cronologica');
        return;
      }

      // 3. Hai dato l'OK: Calcoli segreti del database...
      const shuffled = [...draftTeams].sort(() => 0.5 - Math.random());
      const inserts = [];
      const startPick = (roundNumber - 1) * 12 + 1;

      for (let i = 0; i < 6; i++) {
        inserts.push({ team_edition_event_id: shuffled[i].id, pick_number: startPick + i, round_number: roundNumber, player_id: null });
      }
      for (let i = 0; i < 6; i++) {
        inserts.push({ team_edition_event_id: shuffled[5 - i].id, pick_number: startPick + 6 + i, round_number: roundNumber, player_id: null });
      }

      const teamIds = draftTeams.map(t => t.id);
      await supabase.from('draft').delete().in('team_edition_event_id', teamIds).eq('round_number', roundNumber);
      await supabase.from('draft').insert(inserts);
      
      loadData();

      // 4. POPUP DI CONFERMA SVELAMENTO
      setTimeout(() => {
        const wantToReveal = window.confirm(`✅ Round ${roundNumber} calcolato nel Database!\n\nLanciare ORA l'animazione di SVELAMENTO su OBS?`);
        if (wantToReveal) {
          triggerOBSGraphic('draft_round_reveal', { round: roundNumber });
        }
      }, 300); 

    }, 100); 
  };

  const resetEntireDraft = async () => {
    if (!window.confirm("⚠️ ATTENZIONE! Vuoi CANCELLARE TUTTO IL DRAFT?")) return;
    await supabase.from('draft').delete().gt('pick_number', 0);
    loadData();
  };

  // ==========================================
  // GESTIONE DRAFT POOL (ELEGGIBILI)
  // ==========================================
  useEffect(() => {
    const searchForPool = async () => {
      if (poolFn.length < 2 && poolLn.length < 2) {
        setPoolSearchResults([]);
        return;
      }
      setIsPoolSearching(true);
      let query = supabase.from('players').select('*');
      if (poolFn) query = query.ilike('first_name', `${poolFn}%`);
      if (poolLn) query = query.ilike('last_name', `${poolLn}%`);
      const { data } = await query.limit(5);
      setPoolSearchResults(data || []);
      setIsPoolSearching(false);
    };
    const t = setTimeout(searchForPool, 300);
    return () => clearTimeout(t);
  }, [poolFn, poolLn]);

  const addExistingToPool = async (player) => {
    if (!poolRole) return alert("Seleziona il ruolo prima di aggiungerlo al draft.");
    await supabase.from('players').update({ draft: true, role: poolRole }).eq('id', player.id);
    setPoolFn(''); setPoolLn(''); setPoolRole(''); setPoolSearchResults([]);
    loadData();
  };

  const createNewInPool = async (isHomonym = false) => {
    if (!poolFn || !poolLn || !poolRole) return alert("Compila Nome, Cognome e seleziona un Ruolo.");
    if (isHomonym && !poolDob) return alert("Inserisci la data di nascita per l'omonimo.");

    const payload = { first_name: poolFn, last_name: poolLn, role: poolRole, draft: true };
    if (poolDob) payload.date_of_birth = poolDob;

    const { error } = await supabase.from('players').insert([payload]);
    if (error) alert("Errore creazione.");
    setPoolFn(''); setPoolLn(''); setPoolRole(''); setPoolDob(''); setPoolSearchResults([]);
    loadData();
  };

  const removeFromPool = async (id) => {
    await supabase.from('players').update({ draft: false }).eq('id', id);
    loadData();
  };


  // ==========================================
  // GESTIONE ASSEGNAZIONE SCELTE (PICK MODAL)
  // ==========================================
  useEffect(() => {
    const searchForPick = async () => {
      if (pickSearchFn.length < 2 && pickSearchLn.length < 2) {
        setPickSearchResults([]);
        return;
      }
      setIsPickSearching(true);
      // Filtriamo solo quelli nella draft pool
      let query = supabase.from('players').select('*').eq('draft', true);
      if (pickSearchFn) query = query.ilike('first_name', `${pickSearchFn}%`);
      if (pickSearchLn) query = query.ilike('last_name', `${pickSearchLn}%`);
      
      const { data } = await query.limit(5);
      setPickSearchResults(data || []);
      setIsPickSearching(false);
    };
    const t = setTimeout(searchForPick, 300);
    return () => clearTimeout(t);
  }, [pickSearchFn, pickSearchLn]);

  // LA NOSTRA MAGIA: IL MODALE SI APRE E OBS MOSTRA L'ATTESA
  const openModal = (pick) => {
    setSelectedPick(pick);
    setPickSearchFn(''); setPickSearchLn(''); setPickSearchResults([]);
    setIsModalOpen(true);

    // Manda a OBS i dati pronti per essere stampati a schermo!
    triggerOBSGraphic('draft_attesa', { 
      pick_number: pick.pick_number,
      team_name: pick.teams_edition_events?.teams?.name,
      coach: pick.teams_edition_events?.coach,
      vice: pick.teams_edition_events?.assistant_coach
    });
  };

  const closeModal = () => setIsModalOpen(false);

  // LA NOSTRA MAGIA 2: ASSEGNA E CHIEDI SE FARE L'ANNUNCIO
  const assignPlayerToPick = async (playerId) => {
    if (!selectedPick) return;
    
    // Aggiorniamo il database in silenzio
    await supabase.from('draft').update({ player_id: playerId }).eq('id', selectedPick.id);
    closeModal();
    loadData();

    // Mostriamo il popup per lanciare l'annuncio
    setTimeout(() => {
      const wantToAnnounce = window.confirm("✅ Giocatore assegnato nel Database! Vuoi far partire l'animazione dell'ANNUNCIO su OBS?");
      if (wantToAnnounce) {
        triggerOBSGraphic('draft_annuncio');
      }
    }, 300);
  };

  const removePlayerFromPick = async (pickId) => {
    if (!window.confirm("Rimuovi giocatore da questa scelta?")) return;
    await supabase.from('draft').update({ player_id: null }).eq('id', pickId);
    loadData();
  };

  // RENDER DRAFT BOARD (Le 60 scelte)
  const renderDraftBoard = () => {
    const rows = [];
    for (let i = 1; i <= 60; i++) {
      const pick = draftPicks.find(p => p.pick_number === i);
      rows.push(
        <div key={i} className="flex flex-col md:flex-row items-center gap-4 bg-white p-3 rounded-2xl border border-neutral-100 hover:border-pink-200 hover:shadow-md transition-all group shadow-sm mb-3">
          <div className="flex items-center gap-4 w-full md:w-1/3 shrink-0 md:border-r border-neutral-100 md:pr-4">
            <div className="w-12 h-12 shrink-0 bg-pink-50 text-pink-600 font-black text-xl rounded-xl flex items-center justify-center">{i}</div>
            <div className="font-semibold text-neutral-800 truncate uppercase tracking-tight">
              {pick ? pick.teams_edition_events?.teams?.name : <span className="text-neutral-400 italic font-normal text-sm">Non generata</span>}
            </div>
          </div>
          <div className="flex-1 flex items-center w-full min-w-0">
            {pick?.player_id ? (
              <span className="font-bold text-neutral-900 text-lg uppercase tracking-wide flex items-center gap-2">
                <UserCheck size={18} className="text-pink-500" />
                {pick.players?.first_name} {pick.players?.last_name}
              </span>
            ) : (
              <span className="text-neutral-400 text-sm font-medium italic">Nessun giocatore assegnato</span>
            )}
          </div>
          <div className="shrink-0 w-full md:w-auto flex justify-end">
            {pick && !pick.player_id && (
              <button onClick={() => openModal(pick)} className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-sm"><Search size={14}/> Seleziona</button>
            )}
            {pick && pick.player_id && (
              <button onClick={() => removePlayerFromPick(pick.id)} className="flex items-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-sm"><X size={14}/> Rimuovi</button>
            )}
          </div>
        </div>
      );
    }
    return rows;
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in zoom-in-95 pb-20">
      
      {/* HEADER PANNELLO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-neutral-100 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-pink-50 text-pink-600 rounded-xl shadow-sm"><ListOrdered size={24}/></div>
          <div>
            <h2 className="text-2xl font-semibold text-neutral-800">Gestione Draft</h2>
            <p className="text-sm text-neutral-500 mt-1">Pool giocatori, generazione round e selezioni</p>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex gap-6 mb-8 border-b border-neutral-200">
        <button
          onClick={() => setActiveTab('board')}
          className={`pb-3 px-2 font-bold uppercase tracking-wider text-sm transition-colors border-b-2 ${
            activeTab === 'board' ? 'border-pink-500 text-pink-600' : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }`}
        >
          Draft Board & Regia
        </button>
        <button
          onClick={() => setActiveTab('pool')}
          className={`pb-3 px-2 font-bold uppercase tracking-wider text-sm transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'pool' ? 'border-pink-500 text-pink-600' : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }`}
        >
          Draft Pool
          <span className="bg-neutral-100 text-neutral-500 py-0.5 px-2 rounded-full text-[10px]">{eligiblePlayers.length}</span>
        </button>
      </div>

      {/* ==================================================== */}
      {/* TAB 1: DRAFT BOARD & REGIA OBS                       */}
      {/* ==================================================== */}
      {activeTab === 'board' && (
        <div className="animate-in fade-in slide-in-from-bottom-2">
          {/* PANNELLO REGIA OBS */}
          <div className="bg-neutral-900 p-6 rounded-3xl shadow-xl mb-8 border border-neutral-800">
            <div className="flex items-center gap-2 mb-4">
              <Tv size={18} className="text-pink-500" />
              <h2 className="text-sm font-bold text-white uppercase tracking-widest">Regia OBS Live</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <button onClick={() => triggerOBSGraphic('none')} className="flex flex-col items-center justify-center gap-2 p-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-xl transition-all border border-neutral-700 text-[10px] font-bold uppercase tracking-wider">
                <X size={20} /> Nascondi
              </button>
              <button onClick={() => triggerOBSGraphic('draft_pool_status')} className="flex flex-col items-center justify-center gap-2 p-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-xl transition-all border border-neutral-700 text-[10px] font-bold uppercase tracking-wider shadow-sm border-b-2 border-b-yellow-500">
                <Users size={20} className="text-yellow-400" /> Draft Pool
              </button>
              <button onClick={() => triggerOBSGraphic('draft_cronologica')} className="flex flex-col items-center justify-center gap-2 p-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-xl transition-all border border-neutral-700 text-[10px] font-bold uppercase tracking-wider shadow-sm">
                <LayoutGrid size={20} className="text-blue-400" /> Griglia 60
              </button>
              <button onClick={() => triggerOBSGraphic('draft_rosters')} className="flex flex-col items-center justify-center gap-2 p-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-xl transition-all border border-neutral-700 text-[10px] font-bold uppercase tracking-wider shadow-sm">
                <Columns size={20} className="text-emerald-400" /> 6 Roster
              </button>
              <button onClick={() => triggerOBSGraphic('draft_mista')} className="flex flex-col items-center justify-center gap-2 p-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-xl transition-all border border-neutral-700 text-[10px] font-bold uppercase tracking-wider shadow-sm border-b-2 border-b-purple-500">
                <PanelRight size={20} className="text-purple-400" /> + On Clock
              </button>
              <button onClick={() => triggerOBSGraphic('draft_annuncio')} className="flex flex-col items-center justify-center gap-2 p-3 bg-pink-600 hover:bg-pink-500 text-white rounded-xl transition-all text-[10px] font-bold uppercase tracking-wider shadow-lg active:scale-95">
                <Megaphone size={20} /> Annuncia Pick
              </button>
            </div>
          </div>

          {/* BOTTONI GENERAZIONE E INFO SQUADRE */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-neutral-200 shadow-sm mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={18} className="text-neutral-400" />
              <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-widest">Generazione Round</h2>
            </div>
            
            {draftTeams.length < 6 ? (
              <div className="text-red-500 font-semibold bg-red-50 p-4 rounded-xl border border-red-100 mb-4">
                Attenzione: Trovate solo {draftTeams.length} squadre per l'evento Vero Cup. Ne servono 6.
              </div>
            ) : (
              <div className="text-neutral-500 text-xs mb-6 font-medium uppercase tracking-wider">
                Trovate <span className="font-bold text-pink-600">{totalTeamsFound}</span> squadre. Il sistema utilizza le prime 6 per i sorteggi.
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              {[1, 2, 3, 4, 5].map(round => (
                <button key={round} onClick={() => generateRound(round)} disabled={draftTeams.length < 6} className="bg-white hover:bg-pink-50 hover:border-pink-300 border border-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-700 hover:text-pink-600 font-semibold uppercase py-4 rounded-2xl transition-all shadow-sm flex flex-col items-center justify-center gap-1 group">
                  <span className="text-[10px] text-neutral-400 group-hover:text-pink-400 font-bold tracking-widest">Genera</span>
                  <span className="text-lg flex items-center gap-1.5"><RefreshCw size={16} className="opacity-50 group-hover:opacity-100"/> Round {round}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end border-t border-neutral-100 pt-4 mt-2">
              <button onClick={resetEntireDraft} className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-bold uppercase py-2 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-xs">
                <X size={16} /> Svuota Tutto il Draft
              </button>
            </div>
          </div>

          {/* DRAFT BOARD */}
          <div className="bg-white border border-neutral-200 rounded-3xl p-6 md:p-8 shadow-sm">
            <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-widest mb-6 border-b border-neutral-100 pb-4">Le 60 Scelte</h3>
            <div className="flex flex-col">{renderDraftBoard()}</div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 2: DRAFT POOL (ELEGGIBILI)                       */}
      {/* ==================================================== */}
      {activeTab === 'pool' && (
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-neutral-200 shadow-sm animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 mb-6 border-b border-neutral-100 pb-4">
            <UserPlus size={20} className="text-pink-500" />
            <h2 className="text-lg font-semibold text-neutral-800">Inserimento Giocatori Eleggibili</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-2 ml-1">Nome</label>
              <input type="text" value={poolFn} onChange={e => setPoolFn(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-sm focus:border-pink-500 focus:outline-none" placeholder="Cerca o inserisci..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-2 ml-1">Cognome</label>
              <input type="text" value={poolLn} onChange={e => setPoolLn(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-sm focus:border-pink-500 focus:outline-none" placeholder="Cerca o inserisci..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-2 ml-1">Ruolo (Obbligatorio)</label>
              <select 
                value={poolRole} 
                onChange={e => setPoolRole(e.target.value)} 
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-sm focus:border-pink-500 focus:outline-none cursor-pointer text-neutral-800"
              >
                <option value="" disabled>Seleziona un ruolo...</option>
                <option value="Playmaker">Playmaker</option>
                <option value="Guardia">Guardia</option>
                <option value="Ala Piccola">Ala Piccola</option>
                <option value="Ala Grande">Ala Grande</option>
                <option value="Centro">Centro</option>
              </select>
            </div>
          </div>

          {/* Risultati Esistenti */}
          {poolSearchResults.length > 0 && (
            <div className="bg-white border border-neutral-200 rounded-2xl p-2 mt-2 shadow-inner mb-4">
              <p className="text-[10px] text-neutral-400 font-bold px-3 py-2 uppercase tracking-widest border-b border-neutral-100 mb-2">Giocatori Esistenti (Clicca per rendere Eleggibile)</p>
              {poolSearchResults.map(p => (
                <div key={p.id} onClick={() => addExistingToPool(p)} className="flex justify-between items-center px-4 py-3 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors group">
                  <span className="font-bold text-neutral-800 uppercase group-hover:text-pink-600">{p.first_name} {p.last_name}</span>
                  <span className="text-xs text-neutral-500">{p.draft ? 'Già in Pool ✅' : 'Non in Pool ❌'}</span>
                </div>
              ))}
            </div>
          )}

          {/* Creazione Nuovo Eleggibile */}
          {poolFn && poolLn && poolSearchResults.length === 0 && !isPoolSearching && (
            <div className="bg-pink-50 border border-pink-100 rounded-xl p-4 flex flex-col md:flex-row items-center gap-4 justify-between mb-4">
              <div className="text-sm text-pink-800 font-medium">Nessun giocatore trovato. Vuoi creare <b>{poolFn.toUpperCase()} {poolLn.toUpperCase()}</b> e aggiungerlo alla Draft Pool?</div>
              <button onClick={() => createNewInPool(false)} className="bg-pink-500 hover:bg-pink-600 text-white font-bold uppercase text-xs tracking-wider py-2.5 px-6 rounded-lg shadow-sm whitespace-nowrap">Crea e Aggiungi</button>
            </div>
          )}

          {/* Omonimo */}
          {poolSearchResults.length > 0 && (
            <div className="flex flex-col md:flex-row items-center gap-4 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
              <span className="text-xs text-neutral-600 font-bold uppercase">Crea un omonimo:</span>
              <input type="date" value={poolDob} onChange={e => setPoolDob(e.target.value)} className="bg-white border border-neutral-200 rounded-lg p-2 text-sm focus:border-pink-500 focus:outline-none" />
              <button onClick={() => createNewInPool(true)} className="bg-neutral-900 hover:bg-black text-white text-xs font-bold uppercase py-2.5 px-4 rounded-lg">Crea Nuovo Omonimo</button>
            </div>
          )}

          {/* Lista degli attuali eleggibili */}
          <div className="mt-8 border-t border-neutral-100 pt-6">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Users size={16}/> Draft Pool Attuale ({eligiblePlayers.length} Giocatori)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-2">
              {eligiblePlayers.map(ep => {
                const isAlreadyPicked = draftPicks.some(pick => pick.player_id === ep.id);
                return (
                  <div key={ep.id} className={`flex items-center justify-between p-3 rounded-xl border ${isAlreadyPicked ? 'bg-neutral-50 border-neutral-100 opacity-60' : 'bg-white border-neutral-200 shadow-sm'}`}>
                    <div className="flex flex-col min-w-0">
                      <span className={`font-bold uppercase text-sm truncate ${isAlreadyPicked ? 'line-through text-neutral-400' : 'text-neutral-800'}`}>{ep.last_name} {ep.first_name}</span>
                      <span className="text-[10px] text-pink-500 font-bold uppercase">{ep.role || 'Ruolo N/D'} {isAlreadyPicked && '• GIÀ SCELTO'}</span>
                    </div>
                    <button onClick={() => removeFromPool(ep.id)} className="text-neutral-400 hover:text-red-500 p-1 rounded-md hover:bg-red-50 transition-colors" title="Rimuovi dal Draft">
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODALE ASSEGNAZIONE GIOCATORE (GLOBALE)              */}
      {/* ==================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-neutral-200 rounded-3xl p-8 w-full max-w-xl shadow-2xl relative animate-in zoom-in-95">
            <button onClick={closeModal} className="absolute top-6 right-6 p-2 text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 rounded-full transition-colors"><X size={20} /></button>
            
            <div className="flex items-center gap-4 mb-6 border-b border-neutral-100 pb-4">
              <div className="w-14 h-14 bg-pink-50 text-pink-600 font-black text-2xl rounded-2xl flex items-center justify-center shadow-sm">{selectedPick?.pick_number}</div>
              <div>
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">In the clock for</h3>
                <p className="text-xl font-bold text-neutral-900 uppercase">{selectedPick?.teams_edition_events?.teams?.name}</p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[11px] text-pink-700 font-bold uppercase tracking-widest mb-2 bg-pink-50 p-2.5 rounded-lg border border-pink-100 text-center">
                Ricerca limitata ai giocatori nella Draft Pool
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-2 ml-1">Nome</label>
                  <input type="text" value={pickSearchFn} onChange={e => setPickSearchFn(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3.5 text-neutral-800 font-medium focus:border-pink-500 focus:outline-none shadow-sm" placeholder="Es. Mario" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-2 ml-1">Cognome</label>
                  <input type="text" value={pickSearchLn} onChange={e => setPickSearchLn(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3.5 text-neutral-800 font-medium focus:border-pink-500 focus:outline-none shadow-sm" placeholder="Es. Rossi" />
                </div>
              </div>

              {/* RISULTATI RICERCA ELEGGIBILI */}
              {pickSearchResults.length > 0 && (
                <div className="bg-white border border-neutral-200 rounded-2xl p-2 mt-4 max-h-48 overflow-y-auto shadow-inner">
                  <p className="text-[10px] text-neutral-400 font-bold px-3 py-2 uppercase tracking-widest border-b border-neutral-100 mb-2">Risultati (Clicca per assegnare)</p>
                  {pickSearchResults.map(p => {
                    const isAlreadyPicked = draftPicks.some(pick => pick.player_id === p.id);
                    return (
                      <div key={p.id} onClick={() => !isAlreadyPicked && assignPlayerToPick(p.id)} className={`flex justify-between items-center px-4 py-3 rounded-xl transition-colors ${isAlreadyPicked ? 'opacity-50 cursor-not-allowed bg-neutral-50' : 'hover:bg-pink-50 cursor-pointer group'}`}>
                        <div className="flex flex-col">
                          <span className={`font-bold uppercase transition-colors ${isAlreadyPicked ? 'text-neutral-500 line-through' : 'text-neutral-800 group-hover:text-pink-600'}`}>{p.first_name} {p.last_name}</span>
                          <span className="text-[10px] text-pink-500 font-bold uppercase">{p.role || 'Ruolo N/D'} {isAlreadyPicked && '- GIÀ SCELTO'}</span>
                        </div>
                        <span className="text-xs font-medium text-neutral-500 bg-white border border-neutral-200 px-2 py-1 rounded-md shadow-sm">
                          {p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString('it-IT') : 'Nessuna data'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* NON TROVATO IN POOL */}
              {pickSearchFn && pickSearchLn && pickSearchResults.length === 0 && !isPickSearching && (
                <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6 mt-6 flex flex-col items-center text-center">
                  <p className="text-sm text-neutral-700 font-bold uppercase tracking-wide mb-2">Giocatore non trovato nella Draft Pool</p>
                  <p className="text-xs text-neutral-500">Per assegnare un nuovo giocatore, chiudi questa finestra e aggiungilo prima dal tab <b>"Draft Pool"</b>.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
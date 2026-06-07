import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabase';

import AdminLayout from './layouts/AdminLayout';
import TeamsManager from './pages/TeamsManager';
import EditionsManager from './pages/EditionsManager';
import Login from './pages/Login';
import RosterManager from './pages/RosterManager';
import EventManager from './pages/EventManager';
import ContestManager from './pages/ContestManager';
import CalendarManager from './pages/CalendarManager';
import LiveScoreCenter from './pages/LiveScoreCenter';
import ObsController from './pages/ObsController';
import BTOverlayGraphic from './pages/BTOverlayGraphic';
import DraftAdmin from './pages/DraftAdmin';
import MatchScoreboard from './pages/MatchScoreboard';
import SponsorCarousel from './pages/SponsorCarousel';
import SponsorOutput from './pages/SponsorOutput';
import SponsorManager from './pages/SponsorManager';
import InstagramGenerator from './pages/InstagramGenerator'; 
import MobileApp from './pages/MobileApp';
import BarMenuOBS from './pages/BarMenuOBS'; // Assicurati che il percorso sia corretto in base alle tue cartelle

// Importiamo il nuovo canale OBS (che creeremo tra un attimo)
import ObsOutput from './pages/ObsOutput';

// --- COMPONENTE DI PROTEZIONE ---
// Questo "butta fuori" chi cerca di entrare nell'Admin senza login
function ProtectedRoute({ session, children }) {
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Manteniamo il tuo stato per il menu interno dell'Admin
  const [activeView, setActiveView] = useState('teams'); 

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;

  // Il tuo caro vecchio smistatore (viene usato solo dentro la rotta /admin)
  const renderAdminView = () => {
    switch (activeView) {
      case 'teams': return <TeamsManager />;
      case 'editions': return <EditionsManager />;
      case 'enrollments': return <RosterManager />;
      case 'schedule': return <EventManager />; 
      case 'contests': return <ContestManager />;
      case 'calendar': return <CalendarManager />;
      case 'live-score': return <LiveScoreCenter />;
      case 'controller-obs': return <ObsController />;
      case 'draft': return <DraftAdmin />; // <--- AGGIUNTO QUI!
      case 'sponsor-manager': return <SponsorManager />;
      default: return <TeamsManager />;      
    }
  };

  return (
    <Router>
      <Routes>
        
        {/* 1. ROTTA BASE: Rimanda all'admin */}
        <Route path="/" element={<Navigate to="/admin" replace />} />

        {/* 2. ROTTA LOGIN: Se sei già loggato, ti butta nell'admin */}
        <Route path="/login" element={session ? <Navigate to="/admin" replace /> : <Login />} />

        {/* 3. ROTTA ADMIN: Il tuo gestionale, chiuso in cassaforte */}
        <Route 
          path="/admin/*" 
          element={
            <ProtectedRoute session={session}>
              <AdminLayout activeView={activeView} setActiveView={setActiveView}>
                {renderAdminView()}
              </AdminLayout>
            </ProtectedRoute>
          } 
        />

        {/* 4. ROTTA OBS: Pubblica e trasparente per la Regia! */}
        <Route path="/obs" element={<ObsOutput />} />
        <Route path="/bt-overlay" element={<BTOverlayGraphic />} />
        <Route path="/match-scoreboard" element={<MatchScoreboard />} />
        <Route path="/sponsor-carousel" element={<SponsorCarousel />} />
        <Route path="/sponsor-output" element={<SponsorOutput />} />
        <Route path="/instagram" element={<InstagramGenerator />} />
        <Route path="/app" element={<MobileApp />} />
        <Route path="/menu-bar" element={<BarMenuOBS />} />
      </Routes>
    </Router>
  );
}

export default App;
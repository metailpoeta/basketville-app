import React, { useState } from 'react';
import { supabase } from '../supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Chiediamo a Supabase di fare l'accesso
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // TRUCCO DA PRO: Stampiamo il VERO errore nella console e a schermo!
      console.error("ERRORE VERO DA SUPABASE:", error);
      setError("Errore Supabase: " + error.message);
    }
    setLoading(false);
  }

  return (
    <div className="flex h-screen items-center justify-center bg-neutral-100">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-200 w-96">
        <div className="text-center mb-8">
          <h1 className="text-xl font-medium tracking-[0.3em] uppercase text-pink-500 mb-1">Basketville</h1>
          <div className="text-[10px] font-medium tracking-widest text-neutral-500 uppercase">Accesso Riservato</div>
        </div>
        
        {error && <div className="mb-4 p-3 bg-red-50 text-red-500 text-xs text-center rounded-lg">{error}</div>}
        
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input 
            type="email" 
            placeholder="Email Admin" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none focus:border-pink-500"
            required
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none focus:border-pink-500"
            required
          />
          <button 
            type="submit" 
            disabled={loading}
            className="mt-2 w-full py-3 bg-neutral-900 text-white rounded-lg text-xs font-bold tracking-widest uppercase hover:bg-pink-600 transition-all disabled:opacity-50"
          >
            {loading ? 'Accesso in corso...' : 'Entra nel Pannello'}
          </button>
        </form>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext'; // Pfad anpassen
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react';

const BACKEND_URL = "http://localhost:5195";

// Das ist der schicke Login-Screen (funktioniert immer im Dark-Mode für einen coolen Einstieg)
export const LoginView = () => {
  const { login } = useAuth(); // Hier holen wir uns die login-Funktion
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Wir schicken die Daten an das C#-Backend (AuthController)
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        throw new Error("E-Mail oder Passwort falsch.");
      }

      // Das Backend schickt uns die User-Daten inkl. Array der Permissions!
      const userData = await response.json();
      
      // Wir loggen den User im React-System ein
      login(userData);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      
      <div style={{ width: '100%', maxWidth: '400px', padding: '40px', backgroundColor: '#141414', borderRadius: '24px', border: '1px solid #222', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
        
        {/* LOGO BEREICH */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ width: '60px', height: '60px', background: 'linear-gradient(135deg, #8a6ce0 0%, #5d3eb0 100%)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <span style={{ fontSize: '24px', fontWeight: 'bold' }}>C</span>
          </div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' }}>CitySync Admin</h1>
          <p style={{ margin: '8px 0 0 0', color: '#888', fontSize: '14px' }}>Bitte logge dich ein, um fortzufahren.</p>
        </div>

        {/* FEHLERMELDUNG */}
        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '12px 16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}

        {/* LOGIN FORMULAR */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#666', marginBottom: '8px', letterSpacing: '1px' }}>E-MAIL ADRESSE</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="#666" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)}
                required
                style={{ width: '100%', padding: '16px 16px 16px 48px', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '12px', color: '#fff', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s' }} 
                onFocus={e => e.target.style.borderColor = '#8a6ce0'}
                onBlur={e => e.target.style.borderColor = '#333'}
                placeholder="admin@citysync.at"
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#666', marginBottom: '8px', letterSpacing: '1px' }}>PASSWORT</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="#666" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '16px 16px 16px 48px', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '12px', color: '#fff', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s' }} 
                onFocus={e => e.target.style.borderColor = '#8a6ce0'}
                onBlur={e => e.target.style.borderColor = '#333'}
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            style={{ marginTop: '12px', width: '100%', padding: '16px', background: isLoading ? '#5d3eb0' : '#8a6ce0', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'background-color 0.2s' }}
            onMouseEnter={e => { if(!isLoading) e.currentTarget.style.backgroundColor = '#7a5bc7'; }}
            onMouseLeave={e => { if(!isLoading) e.currentTarget.style.backgroundColor = '#8a6ce0'; }}
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : "Anmelden"}
          </button>
        </form>

      </div>
    </div>
  );
};
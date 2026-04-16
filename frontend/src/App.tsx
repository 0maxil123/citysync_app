// src/App.tsx
import { useState, useEffect } from 'react'
import { DashboardView } from './components/DashboardView'
import { ScheduleView } from './components/ScheduleView';
import { ScreenManagementView } from './components/ScreenManagementView';
import { Archive } from './components/Archive';

// Stilisiertes Dashboard-Icon (aus CSS)
const DashboardIcon = () => (
  <div style={{
    width: '20px', height: '15px', border: '2px solid white', borderRadius: '3px',
    marginRight: '10px'
  }}></div>
);

export default function App() {
  const [aktiveSeite, setAktiveSeite] = useState<string>('dashboard');
  
  // NEU: Der globale Status für das Backend
  const [isServerOnline, setIsServerOnline] = useState(true);

  // NEU: Der "Heartbeat" (Herzschlag), der das Backend alle 5 Sekunden anpingt
  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const response = await fetch("http://localhost:5195/api/dashboard");
        setIsServerOnline(response.ok);
      } catch (error) {
        setIsServerOnline(false);
      }
    };

    checkServerStatus(); // Sofort 1x prüfen beim Start
    const intervalId = setInterval(checkServerStatus, 5000); // Dann alle 5 Sekunden

    return () => clearInterval(intervalId); // Sauber aufräumen
  }, []);

  const navigationsPunkte = [
    { id: 'dashboard', text: 'Dashboard', icon: <DashboardIcon /> },
    { id: 'schedule', text: 'Schedule', icon: '📅' },
    { id: 'screenmanagement', text: 'Screen Management', icon: '⚙️' },
    { id: 'archive', text: 'Archive', icon: '📦' },
  ];

  return (
    <div style={{ 
      display: 'flex',
      width: '100vw',
      height: '100vh', 
      backgroundColor: '#1a1a1a', // Tief-schwarz
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      
      {/* SIDEBAR */}
      <div style={{ 
        width: '220px', backgroundColor: '#222', padding: '20px 20px 20px 20px', 
        borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', 
        alignItems: 'center',
        boxShadow: '10px 0 30px rgba(0,0,0,0.5)' // Schatten nach Rechts
      }}>
        <div style={{ color: '#aaa', fontWeight: 'bold', fontSize: '24px', marginBottom: '50px' }}>CitySync</div>

        {navigationsPunkte.map(punkt => (
          <button
            key={punkt.id}
            onClick={() => setAktiveSeite(punkt.id)}
            style={{
              width: '100%', padding: '15px 12px',
              backgroundColor: aktiveSeite === punkt.id ? '#333' : 'transparent',
              color: aktiveSeite === punkt.id ? 'white' : '#aaa',
              border: 'none', borderRadius: '10px', textAlign: 'left', cursor: 'pointer',
              marginBottom: '10px', fontSize: '15px', display: 'flex', gap: '10px', alignItems: 'center',
              boxShadow: aktiveSeite === punkt.id ? 'inset 0 2px 4px rgba(0,0,0,0.3)' : 'none'
            }}
          >
            <span>{punkt.icon}</span> {punkt.text}
          </button>
        ))}

        {/* NEU: Der Status-Badge ganz unten */}
        <div style={{ marginTop: 'auto', width: '100%' }}>
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center',
            padding: '12px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
            backgroundColor: isServerOnline ? 'rgba(76, 175, 80, 0.05)' : 'rgba(244, 67, 54, 0.05)',
            color: isServerOnline ? '#4caf50' : '#f44336',
            border: `1px solid ${isServerOnline ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)'}`,
            transition: 'all 0.3s ease'
          }}>
            <div style={{ 
              width: '8px', height: '8px', borderRadius: '50%', 
              backgroundColor: isServerOnline ? '#4caf50' : '#f44336',
              boxShadow: isServerOnline ? '0 0 8px rgba(76, 175, 80, 0.6)' : '0 0 8px rgba(244, 67, 54, 0.6)'
            }} />
            {isServerOnline ? 'System Online' : 'Offline-Modus'}
          </div>
        </div>

      </div>

      {/* INHALT */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {aktiveSeite === 'dashboard' && <DashboardView />}
        {aktiveSeite === 'schedule' && <ScheduleView />}
        {aktiveSeite === 'screenmanagement' && <ScreenManagementView />}
        {aktiveSeite === 'archive' && <Archive />}
        {(aktiveSeite !== 'dashboard' && aktiveSeite !== 'schedule' && aktiveSeite !== 'screenmanagement'
          && aktiveSeite !== 'archive') && <div style={{color: 'white', padding: '40px'}}>Seite: {aktiveSeite} (In Arbeit...)</div>}
      </div>
    </div>
  )
}
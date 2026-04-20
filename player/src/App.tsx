import { useState, useEffect } from 'react';
import { SetupView } from './components/SetupView';
import { PlaybackView } from './components/PlaybackView';

function App() {
  const [screenConfig, setScreenConfig] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // 1. BEIM START: Gedächtnis + Paranoia-Check
  useEffect(() => {
    const checkIdentity = async () => {
      const savedConfigStr = localStorage.getItem('citysync_player_config');
      
      if (savedConfigStr) {
        const savedConfig = JSON.parse(savedConfigStr);
        // Fallback, je nachdem ob dein Backend 'id' oder 'monitorId' speichert
        const monitorId = savedConfig.monitorId || savedConfig.id; 
        
        try {
          // --- DER PARANOIA CHECK ---
          const response = await fetch(`http://localhost:5195/api/player/check/${monitorId}`);
          
          if (response.ok) {
            // Server sagt: "Ja, dich kenne ich noch!"
            setScreenConfig(savedConfig);
          } else if (response.status === 404) {
            // Server sagt: "Du wurdest gelöscht!" -> Selbstzerstörung
            console.warn("Wurde aus dem Dashboard gelöscht. Führe Reset durch...");
            localStorage.removeItem('citysync_player_config');
          }
        } catch (error) {
          // Server nicht erreichbar (WLAN tot) -> OFFLINE MODUS!
          console.warn("Server nicht erreichbar. Starte sicherheitshalber im Offline-Modus.");
          setScreenConfig(savedConfig);
        }
      }
      
      setIsInitializing(false);
    };

    checkIdentity();
  }, []);

  // Kurzer Ladebildschirm
  if (isInitializing) {
    return <div style={{ backgroundColor: '#1a1a1a', height: '100vh', width: '100vw' }} />;
  }

  // WENN UNBEKANNT: Setup-Screen
  if (!screenConfig) {
    return (
      <SetupView 
        onPaired={(data) => {
          localStorage.setItem('citysync_player_config', JSON.stringify(data));
          setScreenConfig(data);
        }} 
      />
    );
  }

  // WENN BEKANNT: Live-Bildschirm
  return <PlaybackView screenConfig={screenConfig} />;
}

export default App;
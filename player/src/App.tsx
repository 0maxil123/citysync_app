import { useState, useEffect } from 'react';
import { SetupView } from './components/SetupView';
import { PlaybackView } from './components/PlaybackView';
import { db } from './db'; // <--- WICHTIG: Deine Dexie Datenbank importieren!

function App() {
  const [screenConfig, setScreenConfig] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // 1. BEIM START: Gedächtnis + Paranoia-Check
  useEffect(() => {
    const checkIdentity = async () => {
      const savedConfigStr = localStorage.getItem('citysync_player_config');
      
      if (savedConfigStr) {
        const savedConfig = JSON.parse(savedConfigStr);
        const monitorId = savedConfig.monitorId || savedConfig.id; 
        
        try {
          // --- DER PARANOIA CHECK ---
          const response = await fetch(`http://localhost:5195/api/player/check/${monitorId}`);
          
          if (response.ok) {
            // Server sagt: "Ja, dich kenne ich noch!"
            setScreenConfig(savedConfig);
          } else if (response.status === 404) {
            // ====================================================
            // 🚨 VOLLSTÄNDIGER FACTORY RESET (Selbstzerstörung) 🚨
            // ====================================================
            console.warn("Wurde aus dem Dashboard gelöscht. Führe vollständigen Reset durch...");
            
            // 1. GANZ WICHTIG: Zuerst die aktive Verbindung trennen!
            // Ohne diesen Befehl weigert sich der Browser, die Datei zu löschen.
            if (db.isOpen()) {
              db.close();
            }
            
            // 2. Komplette lokale Datenbank (Bilder, Videos, Routinen) physisch sprengen!
            try {
              await db.delete(); 
              console.log("Lokale Datenbank wurde restlos gelöscht.");
            } catch (dbError) {
              console.error("Fehler beim Löschen der Datenbank:", dbError);
            }

            // 3. ALLES aus dem Browser-Gedächtnis löschen (nicht nur die Config, 
            // sondern auch den Watchdog-Timer, damit wirklich alles bei Null startet)
            localStorage.clear();
            sessionStorage.clear();

            // 4. Ein winziger Moment Pause, damit der Browser die Datei auf 
            // der Festplatte auch wirklich fertig löschen kann, bevor er neu lädt.
            setTimeout(() => {
              window.location.reload();
            }, 500);
            
            return; // Verhindert, dass der restliche Code weiterläuft
            // ====================================================
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

  // ==========================================
  // 💓 HEARTBEAT: "Ich lebe noch!" (Ressourcenschonend)
  // ==========================================
  useEffect(() => {
    const activeId = screenConfig?.monitorId || screenConfig?.id;
    
    if (!activeId) return;

    const pingServer = async () => {
      try {
        await fetch(`http://localhost:5195/api/player/heartbeat/${activeId}`, { method: 'POST' });
      } catch (e) {
        // Leiser Fehler
      }
    };

    pingServer(); 

    const baseInterval = 180000; 

    let timeoutId: any;
    const scheduleNextPing = () => {
      const jitter = Math.floor(Math.random() * 30000); 
      const nextPingIn = baseInterval + jitter;

      timeoutId = setTimeout(() => {
        pingServer();
        scheduleNextPing();
      }, nextPingIn);
    };

    scheduleNextPing();

    return () => clearTimeout(timeoutId);
  }, [screenConfig]);

  // ==========================================
  // 🛡️ WATCHDOG: Standby & 4-Uhr-Check
  // ==========================================
  useEffect(() => {
    let lastTick = Date.now();

    const watchdogInterval = setInterval(() => {
      const now = Date.now();
      const dateObj = new Date(now);

      if (now - lastTick > 10 * 60 * 1000) {
        console.log("🛠️ Watchdog: PC ist aus dem Standby aufgewacht. Führe Neustart durch...");
        window.location.reload();
        return; 
      }
      
      lastTick = now;

      if (dateObj.getHours() === 4 && dateObj.getMinutes() === 0) {
        const lastReload = localStorage.getItem('citysync_last_reload');
        const today = dateObj.toDateString();

        if (lastReload !== today) {
          console.log("🛠️ Watchdog: 04:00 Uhr. Führe tägliche System-Reinigung durch...");
          localStorage.setItem('citysync_last_reload', today);
          window.location.reload();
        }
      }
    }, 60000); 

    return () => clearInterval(watchdogInterval);
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
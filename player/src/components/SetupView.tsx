import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Monitor, Wifi, Maximize, Cpu, Loader2 } from 'lucide-react';

// Das ist die URL zu deinem echten C#-Backend
const BACKEND_URL = 'http://localhost:5195'; 

export const SetupView = ({ onPaired }: { onPaired: (screenData: any) => void }) => {
  const [networkInfo, setNetworkInfo] = useState({
    ip: 'Wird geladen...',
    port: 'Wird geladen...',
    resolution: `${window.screen.width}x${window.screen.height}`,
    aspectRatio: (window.screen.width / window.screen.height).toFixed(2),
    pairingCode: ''
  });

  const [isLoading, setIsLoading] = useState(true);

  // 1. HOOK: Code holen (Läuft nur ein einziges Mal beim Start!)
  useEffect(() => {
    const initializePlayer = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/player/register`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolution: `${window.screen.width}x${window.screen.height}` })
        });
        const data = await response.json();
        
        // IP "schön" machen, falls es localhost (::1) ist
        let displayIp = data.clientIp || 'Lokal';
        if (displayIp === '::1') displayIp = '127.0.0.1 (Lokal)';

        setNetworkInfo(prev => ({
          ...prev,
          pairingCode: data.pairingCode,
          ip: displayIp,
          port: '80'
        }));
        setIsLoading(false);
      } catch (error) {
        console.error("Konnte Backend nicht erreichen.", error);
        setNetworkInfo(prev => ({ ...prev, pairingCode: 'ERROR', ip: 'Offline' }));
        setIsLoading(false);
      }
    };

    initializePlayer();
  }, []); // <--- Das LEERE Array hier ist wichtig! Es verhindert den unendlichen Loop.


  // 2. HOOK: Polling (Prüft alle 3 Sek, ob der Admin uns adoptiert hat)
  useEffect(() => {
    // Wenn wir noch keinen gültigen Code haben, tun wir nichts
    if (!networkInfo.pairingCode || networkInfo.pairingCode === 'ERROR') return;

    const checkInterval = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/player/status?code=${networkInfo.pairingCode}`);
        if (res.ok) {
          const statusData = await res.json();
          // Wenn der Status "isPaired: true" ist, wechseln wir die Ansicht!
          if (statusData.isPaired) {
            clearInterval(checkInterval);
            onPaired(statusData.screenConfig);
          }
        }
      } catch (error) {
        // Leiser Fehler
      }
    }, 3000);

    return () => clearInterval(checkInterval);
  }, [networkInfo.pairingCode, onPaired]);
  // Die URL, die der QR-Code enthält. Scannt man sie, öffnet sich das Dashboard am Handy.
  const qrCodeUrl = `http://localhost:5173/pair?code=${networkInfo.pairingCode}`;

  if (isLoading) {
    return (
      <div style={{ height: '100vh', width: '100vw', backgroundColor: '#0a0a0a', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={48} className="animate-spin" color="#8a6ce0" style={{ animation: 'spin 2s linear infinite' }} />
        <h2 style={{ marginTop: '20px' }}>Verbinde mit CitySync Server...</h2>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', width: '100vw', backgroundColor: '#0a0a0a', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* HEADER */}
      <div style={{ textAlign: 'center', marginBottom: '60px' }}>
        <h1 style={{ fontSize: '48px', fontWeight: 800, margin: '0 0 10px 0', background: 'linear-gradient(to right, #8a6ce0, #b8a2e8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          CitySync Player
        </h1>
        <p style={{ fontSize: '20px', color: '#888', margin: 0 }}>Wartet auf Registrierung...</p>
      </div>

      {/* MAIN CONTENT CARD */}
      <div style={{ display: 'flex', backgroundColor: '#141414', border: '1px solid #333', borderRadius: '24px', padding: '40px', gap: '60px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        
        {/* LINKS: QR CODE */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '16px' }}>
            {/* Wir zeigen den QR-Code nur, wenn wir einen echten Code vom Server haben */}
            {networkInfo.pairingCode !== 'ERROR' ? (
              <QRCodeSVG value={qrCodeUrl} size={250} level="H" />
            ) : (
              <div style={{ width: 250, height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f44336', fontWeight: 'bold' }}>Server Offline</div>
            )}
          </div>
          <div style={{ fontSize: '14px', color: '#888' }}>
            Scanne den Code mit der CitySync App
          </div>
        </div>

        {/* RECHTS: SYSTEM INFO */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '24px', minWidth: '300px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ padding: '12px', background: 'rgba(138, 108, 224, 0.1)', borderRadius: '12px', color: '#8a6ce0' }}><Cpu size={24} /></div>
            <div>
              <div style={{ fontSize: '12px', color: '#888', fontWeight: 700, letterSpacing: '1px' }}>PAIRING CODE</div>
              <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '4px', color: networkInfo.pairingCode === 'ERROR' ? '#f44336' : '#fff' }}>
                {networkInfo.pairingCode}
              </div>
            </div>
          </div>

          <div style={{ height: '1px', background: '#333', margin: '10px 0' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ padding: '12px', background: '#222', borderRadius: '12px', color: '#aaa' }}><Wifi size={24} /></div>
            <div>
              <div style={{ fontSize: '12px', color: '#888', fontWeight: 700, letterSpacing: '1px' }}>IP-ADRESSE</div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>{networkInfo.ip}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ padding: '12px', background: '#222', borderRadius: '12px', color: '#aaa' }}><Maximize size={24} /></div>
            <div>
              <div style={{ fontSize: '12px', color: '#888', fontWeight: 700, letterSpacing: '1px' }}>AUFLÖSUNG & RATIO</div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>{networkInfo.resolution} <span style={{ color: '#666', fontSize: '14px' }}>({networkInfo.aspectRatio})</span></div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
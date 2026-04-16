import { useState, useRef, useEffect } from 'react';
import jsQR from 'jsqr';
import { ScreenCard } from './ScreenCard';
import { ChevronDown, Plus, LayoutGrid, CheckCircle2, XCircle, FolderOpen, Image as ImageIcon, Trash2 } from 'lucide-react';
const API_BASE = "http://localhost:5195/api/dashboard";

export const DashboardView = () => {
  // 1. STATE: DATENBANK
  const [standorte, setStandorte] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 2. STATE: HINZUFÜGEN MODAL
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempScreen, setTempScreen] = useState<any>(null); 
  const [configData, setConfigData] = useState({ name: '', locationId: 'new', newLocationName: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 3. STATE: BEARBEITEN MODAL
  const [editingScreen, setEditingScreen] = useState<{ortId: string, screen: any} | null>(null);

  // 4. STATE: ZUSAMMENKLAPPEN
  const [collapsedStandorte, setCollapsedStandorte] = useState<string[]>([]);
  // Der Schlüssel, unter dem wir die Daten im Browser-Gedächtnis speichern
  const CACHE_KEY = "citysync_standorte_cache";

  const loadData = async () => {
    // 1. OFFLINE-FALLBACK: Zuerst schauen, ob wir alte Daten im Gedächtnis haben
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
      setStandorte(JSON.parse(cachedData));
      setIsLoading(false); // <--- FIX 1: Lade-Screen sofort beenden, wenn wir alte Daten haben!
    }

    // 2. FRISCHE DATEN: Jetzt lautlos im Hintergrund beim Server anfragen
    try {
      const response = await fetch(API_BASE); // <-- Prüfe kurz, ob die Variable bei dir API_BASE oder API_DASHBOARD heißt!
      
      if (response.ok) {
        const freshData = await response.json();
        setStandorte(freshData); 
        localStorage.setItem(CACHE_KEY, JSON.stringify(freshData)); 
      }
    } catch (error) {
      console.warn("Backend nicht erreichbar. Nutze Offline-Daten.", error);
    } finally {
      setIsLoading(false); // <--- FIX 2: Lade-Screen beenden, falls wir das allererste Mal starten und keinen Cache haben!
    }
  };

  useEffect(() => {
    loadData(); // Sofort laden
    
    const interval = setInterval(() => {
      loadData(); // Alle 30 Sekunden im Hintergrund neu laden
    }, 30000); 

    // Aufräumen, wenn man das Dashboard verlässt
    return () => clearInterval(interval);
  }, []);

  const toggleStandort = (id: string) => {
    setCollapsedStandorte(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  // --- LOGIK: QR SCAN ---
  const handleQRUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = img.width; canvas.height = img.height;
        context?.drawImage(img, 0, 0);
        const imageData = context?.getImageData(0, 0, canvas.width, canvas.height);
        if (imageData) {
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code) {
            const parts = code.data.split(',');
            setTempScreen({ ip: parts[0], width: parts[1] || '0', height: parts[2] || '0' });
          } else { alert("Fehler: Kein QR-Code im Bild gefunden."); }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // --- LOGIK: BILDCHIRM HINZUFÜGEN ---
  const confirmAddScreen = async () => {
    if (!configData.name) return alert("Bitte Namen eingeben");

    const newScreenId = 'screen_' + Date.now();
    const locId = configData.locationId === 'new' ? 'loc_' + Date.now() : configData.locationId;
    const locName = configData.locationId === 'new' ? configData.newLocationName : standorte.find(s => s.id === locId)?.name;

    const payload = {
      id: newScreenId,
      locationId: locId,
      locationName: locName || "Unbekannter Standort",
      name: configData.name,
      ip: tempScreen.ip,
      resolution: `${tempScreen.width}x${tempScreen.height}`
    };

    try {
      await fetch(`${API_BASE}/monitor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      setIsModalOpen(false);
      setTempScreen(null);
      setConfigData({ name: '', locationId: 'new', newLocationName: '' });
      loadData(); // Liste neu vom Server laden
    } catch (error) {
      alert("Fehler beim Speichern im Backend");
    }
  };

  // --- LOGIK: BEARBEITEN & LÖSCHEN ---
  const handleSaveEdit = async () => {
    if (!editingScreen) return;
    
    try {
      await fetch(`${API_BASE}/monitor/${editingScreen.screen.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingScreen.screen.name,
          ip: editingScreen.screen.ip,
          resolution: editingScreen.screen.resolution
        })
      });
      setEditingScreen(null);
      loadData(); // Refresh
    } catch (error) {
      alert("Fehler beim Updaten");
    }
  };

  const handleDeleteScreen = async () => {
    if (!editingScreen) return;
    
    try {
      await fetch(`${API_BASE}/monitor/${editingScreen.screen.id}`, {
        method: 'DELETE'
      });
      setEditingScreen(null);
      loadData(); // Refresh
    } catch (error) {
      alert("Fehler beim Löschen");
    }
  };

  // --- KPI BERECHNUNGEN ---
  const totalScreens = standorte.reduce((acc, s) => acc + s.screens.length, 0);
  const onlineScreens = standorte.reduce((acc, s) => acc + s.screens.filter((sc: any) => sc.status === 'online').length, 0);
  const offlineScreens = totalScreens - onlineScreens;

  return (
    <div style={{ color: '#fff', backgroundColor: '#121212', height: '100vh', overflow: 'hidden', width: '100%', display: 'flex', flexDirection: 'column' }}> 
      {/* HEADER */}
      
      <div style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: '#121212', padding: '40px 40px 24px 40px' }}> 
        {/* ^ Hier haben wir den Rahmen (borderBottom) entfernt */}
        
        {/* TITEL & UNTERTITEL */}
        <div style={{ 
          marginBottom: '24px', // Abstand nach unten zu den KPIs
          paddingBottom: '24px', // Abstand vom Text zur neuen Linie
          borderBottom: '1px solid rgba(255,255,255,0.05)' // <--- HIER ist die Linie jetzt!
        }}>
          <h1 style={{ fontSize: '24px', fontWeight: 400, margin: 0, marginBottom: '8px' }}>Dashboard - Übersicht</h1>
          <p style={{ color: '#888', margin: 0, fontSize: '14px' }}>Überwache den Status und verwalte alle Bildschirme in deinem Netzwerk.</p>
        </div>

        {/* KPIs & BUTTON (NEUES LAYOUT) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
          {/* Linke Seite: Die Statistiken */}
          <div style={{ display: 'flex', gap: '16px' }}>
            <KPICard label="Gesamt" value={totalScreens} icon={<LayoutGrid size={20}/>} color="#fff" />
            <KPICard label="Online" value={onlineScreens} icon={<CheckCircle2 size={20}/>} color="#4caf50" />
            <KPICard label="Offline" value={offlineScreens} icon={<XCircle size={20}/>} color="#f44336" />
          </div>

          {/* Rechte Seite: Der dicke Action-Button */}
          <button 
            onClick={() => setIsModalOpen(true)} 
            style={{ 
              backgroundColor: '#5e42a6', padding: '16px 28px', borderRadius: '12px', border: 'none', 
              color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', 
              fontWeight: 600, fontSize: '15px', transition: 'all 0.2s',
              boxShadow: '0 4px 14px rgba(94, 66, 166, 0.3)' 
            }}
            onMouseEnter={(e) => { 
              e.currentTarget.style.backgroundColor = '#7a5bc7'; 
              e.currentTarget.style.transform = 'translateY(-2px)'; 
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(94, 66, 166, 0.4)';
            }}
            onMouseLeave={(e) => { 
              e.currentTarget.style.backgroundColor = '#5e42a6'; 
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(94, 66, 166, 0.3)';
            }}
          >
            <Plus size={20} strokeWidth={2.5} /> Bildschirm hinzufügen
          </button>
        </div>
      </div>
      {/* CONTENT BEREICH */}
      <div style={{ padding: '12px 40px', flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          // 1. WÄHREND WIR LADEN: Zeige nichts (oder einen dezenten Text)
          <div style={{ textAlign: 'center', padding: '100px', color: '#555' }}>
            Lade Daten...
          </div>
        ) : standorte.length === 0 ? (
          // 2. WENN FERTIG GELADEN, ABER LEER: Zeige den leeren Ordner
          <div style={{ textAlign: 'center', padding: '100px', opacity: 0.5 }}>
            <FolderOpen size={48} style={{ marginBottom: '16px' }} />
            <p>Keine Daten vom Server empfangen.</p>
          </div>
        ) : (
          // 3. WENN DATEN DA SIND: Zeige die Bildschirme
          standorte.map(ort => {
            const isCollapsed = collapsedStandorte.includes(ort.id);
            return (
              <div key={ort.id} style={{ marginBottom: '32px' }}>
                <div onClick={() => toggleStandort(ort.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', backgroundColor: '#1e1e1e', borderLeft: '4px solid #5e42a6', borderRadius: isCollapsed ? '10px' : '10px 10px 0 0', cursor: 'pointer', transition: 'border-radius 0.2s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '16px', fontWeight: 600 }}>
                    <ChevronDown size={18} color="#5e42a6" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease-in-out' }} /> 
                    {ort.name.toUpperCase()}
                  </div>
                </div>
                {!isCollapsed && (
                  <div style={{ backgroundColor: '#181818', padding: '20px 20px 20px 20px', borderRadius: '0 0 10px 10px', minHeight: '80px' }}>
                    {ort.screens.length === 0 ? (
                      <div style={{ color: '#555', textAlign: 'center', padding: '20px', fontSize: '14px' }}>Keine Bildschirme in diesem Standort.</div>
                    ) : (
                      ort.screens.map((s: any, i: number) => (
                        <ScreenCard 
                          key={i} 
                          {...s} 
                          onEdit={() => setEditingScreen({ ortId: ort.id, screen: { ...s } })} 
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* --- MODAL 1: BILDCHIRM HINZUFÜGEN --- */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(5px)' }}>
          <div style={{ backgroundColor: '#1c1c1c', padding: '40px 30px 30px 30px', borderRadius: '20px', width: '420px', textAlign: 'center', border: '1px solid #2a2a2a', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            
            {!tempScreen ? (
              /* SCHRITT 1: UPLOAD */
              <>
                <div style={{ backgroundColor: 'rgba(94, 66, 166, 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                  <ImageIcon size={30} color="#8a6ce0" strokeWidth={1.5} />
                </div>
                <h2 style={{ margin: '0 0 16px 0', fontSize: '22px', fontWeight: 700, color: '#fff', letterSpacing: '0.5px' }}>QR-Code hochladen</h2>
                <p style={{ color: '#888', fontSize: '15px', lineHeight: '1.6', marginBottom: '32px' }}>Wähle ein Bild des QR-Codes aus, um die IP-<br/>Adresse automatisch zu konfigurieren.</p>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleQRUpload} style={{ display: 'none' }} />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  style={{ width: '100%', padding: '14px', backgroundColor: '#6347a6', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginBottom: '20px', transition: 'background-color 0.2s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#7a5bc7')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#6347a6')}
                >
                  Datei auswählen
                </button>
              </>
            ) : (
              /* SCHRITT 2: KONFIGURATION */
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ marginBottom: '20px', fontWeight: 600, color: '#fff', textAlign: 'center' }}>Konfiguration</h2>
                
                <div style={{ backgroundColor: '#121212', padding: '15px', borderRadius: '10px', marginBottom: '24px', fontSize: '13px', color: '#aaa', border: '1px solid #2a2a2a' }}>
                  <div style={{ color: '#8a6ce0', fontWeight: 'bold', marginBottom: '6px' }}>Erkannte Hardware:</div>
                  IP: {tempScreen.ip} <br />
                  Display: {tempScreen.width} x {tempScreen.height} px
                </div>

                <input 
                  type="text" 
                  placeholder="Name des Bildschirms"
                  value={configData.name}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '14px', backgroundColor: '#121212', border: '1px solid #2a2a2a', borderRadius: '10px', color: 'white', marginBottom: '16px', outline: 'none' }}
                  onChange={(e) => setConfigData({...configData, name: e.target.value})}
                />

                <select 
                   value={configData.locationId}
                   style={{ 
                     width: '100%', boxSizing: 'border-box', padding: '14px', paddingRight: '40px',
                     backgroundColor: '#121212', border: '1px solid #2a2a2a', borderRadius: '10px', color: 'white', marginBottom: '16px', outline: 'none',
                     appearance: 'none', WebkitAppearance: 'none',
                     backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%23888888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>')`,
                     backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center'
                   }}
                   onChange={(e) => setConfigData({...configData, locationId: e.target.value})}
                >
                  {standorte.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  <option value="new">+ Neuer Standort...</option>
                </select>

                {configData.locationId === 'new' && (
                  <input 
                    type="text" 
                    placeholder="Name des neuen Standorts"
                    value={configData.newLocationName}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '14px', backgroundColor: '#121212', border: '1px solid #2a2a2a', borderRadius: '10px', color: 'white', marginBottom: '24px', outline: 'none' }}
                    onChange={(e) => setConfigData({...configData, newLocationName: e.target.value})}
                  />
                )}

                <button 
                  onClick={confirmAddScreen} 
                  style={{ width: '100%', padding: '14px', backgroundColor: '#6347a6', border: 'none', borderRadius: '10px', color: 'white', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#7a5bc7')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#6347a6')}
                >
                   Bildschirm registrieren
                </button>
              </div>
            )}
            
            <button 
              onClick={() => { setIsModalOpen(false); setTempScreen(null); }} 
              style={{ background: 'none', border: 'none', color: '#777', cursor: 'pointer', width: '100%', fontSize: '14px', fontWeight: 500, transition: 'color 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ccc')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#777')}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL 2: BILDCHIRM BEARBEITEN / LÖSCHEN --- */}
      {editingScreen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(5px)' }}>
          <div style={{ backgroundColor: '#1c1c1c', padding: '40px 30px 30px 30px', borderRadius: '20px', width: '420px', textAlign: 'left', border: '1px solid #2a2a2a', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            
            <h2 style={{ margin: '0 0 24px 0', fontSize: '22px', fontWeight: 600, color: '#fff', textAlign: 'center' }}>
              Gerät bearbeiten
            </h2>

            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#888' }}>Anzeigename</label>
            <input 
              type="text" 
              value={editingScreen.screen.name}
              style={{ width: '100%', boxSizing: 'border-box', padding: '14px', backgroundColor: '#121212', border: '1px solid #2a2a2a', borderRadius: '10px', color: 'white', marginBottom: '20px', outline: 'none' }}
              onChange={(e) => setEditingScreen({...editingScreen, screen: {...editingScreen.screen, name: e.target.value}})}
            />

            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#888' }}>Netzwerk (IP:Port)</label>
            <input 
              type="text" 
              value={editingScreen.screen.ip}
              style={{ width: '100%', boxSizing: 'border-box', padding: '14px', backgroundColor: '#121212', border: '1px solid #2a2a2a', borderRadius: '10px', color: 'white', marginBottom: '20px', outline: 'none' }}
              onChange={(e) => setEditingScreen({...editingScreen, screen: {...editingScreen.screen, ip: e.target.value}})}
            />
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#888' }}>Auflösung (z.B. 1920x1080)</label>
            <input 
              type="text" 
              value={editingScreen.screen.resolution || ''}
              style={{ width: '100%', boxSizing: 'border-box', padding: '14px', backgroundColor: '#121212', border: '1px solid #2a2a2a', borderRadius: '10px', color: 'white', marginBottom: '32px', outline: 'none' }}
              onChange={(e) => setEditingScreen({...editingScreen, screen: {...editingScreen.screen, resolution: e.target.value}})}
            />
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              {/* SPEICHERN BUTTON */}
              <button 
                onClick={handleSaveEdit} 
                style={{ 
                  flex: 1, 
                  padding: '14px', // 14px Abstand oben/unten
                  backgroundColor: '#6347a6', border: 'none', borderRadius: '10px', 
                  color: 'white', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' // Text perfekt zentrieren
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#7a5bc7')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#6347a6')}
              >
                Speichern
              </button>

              {/* LÖSCHEN BUTTON (Rot) */}
              <button 
                onClick={handleDeleteScreen} 
                style={{ 
                  padding: '14px 20px', // HIER WAR DER FEHLER! Jetzt auch 14px oben/unten
                  backgroundColor: 'rgba(244, 67, 54, 0.1)', border: '1px solid rgba(244, 67, 54, 0.3)', 
                  borderRadius: '10px', color: '#f44336', cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' // Icon perfekt zentrieren
                }}
                title="Bildschirm löschen"
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f44336'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(244, 67, 54, 0.1)'; e.currentTarget.style.color = '#f44336'; }}
              >
                <Trash2 size={20} />
              </button>
            </div>
            <button 
              onClick={() => setEditingScreen(null)} 
              style={{ background: 'none', border: 'none', color: '#777', cursor: 'pointer', width: '100%', fontSize: '14px', fontWeight: 500, transition: 'color 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ccc')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#777')}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const KPICard = ({ label, value, icon, color }: any) => (
  <div style={{ backgroundColor: '#1e1e1e', padding: '14px 37px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '16px' }}>
    <div style={{ color: color, opacity: 0.8 }}>{icon}</div>
    <div>
      <div style={{ fontSize: '13px', color: '#888', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '21px', fontWeight: 700 }}>{value}</div>
    </div>
  </div>
);
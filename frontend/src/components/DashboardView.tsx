import { useState, useRef, useEffect } from 'react';
import jsQR from 'jsqr';
import { ScreenCard } from './ScreenCard';
import { AuthProvider, useAuth } from '../context/AuthContext'; 
import { ChevronDown, Plus, LayoutGrid, CheckCircle2, XCircle, FolderOpen, Image as ImageIcon, Trash2 } from 'lucide-react';
const API_BASE = "http://localhost:5195/api/dashboard";
interface DashboardProps {
  globalTheme: 'dark' | 'light';
}

export const DashboardView = ({ globalTheme }: DashboardProps) => {
  // 1. STATE: DATENBANK
  const [standorte, setStandorte] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const {user, hasPermission } = useAuth();

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
      user: user?.id?.toString(),
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
          user: user?.id?.toString(),
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
      await fetch(`${API_BASE}/monitor/${editingScreen.screen.id}?userId=${user?.id}`, {
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
  // --- THEME-FARBEN ---
  const isDark = globalTheme === 'dark';
  const colors = {
    background: isDark ? '#121212' : '#f3f4f6',      // Haupt-Hintergrund
    card: isDark ? '#1e1e1e' : '#ffffff',            // Karten & Standorte
    cardBody: isDark ? '#181818' : '#f9fafb',        // Aufgeklappter Bereich
    text: isDark ? '#ffffff' : '#111827',            // Normaler Text
    textMuted: isDark ? '#888888' : '#6b7280',       // Grauer Text
    border: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)', // Linien
    modalBg: isDark ? '#1c1c1c' : '#ffffff',         // Modal Fenster
    inputField: isDark ? '#121212' : '#f9fafb',      // Textfelder
    inputBorder: isDark ? '#2a2a2a' : '#e5e7eb',
    primary: '#5e42a6',                              // Dein Lila
    primaryHover: '#7a5bc7'
  };

  // --- HIER STARTET DEIN NEUES HTML ---
  return (
    <div style={{ color: colors.text, backgroundColor: colors.background, height: '100%', overflow: 'hidden', width: '100%', display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease' }}> 
      
      {/* HEADER */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: colors.background, padding: '40px 40px 24px 40px', transition: 'background-color 0.3s ease' }}> 
        
        {/* TITEL & UNTERTITEL */}
        <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: `1px solid ${colors.border}`, transition: 'border-color 0.3s ease' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 400, margin: 0, marginBottom: '8px' }}>Dashboard - Übersicht</h1>
          <p style={{ color: colors.textMuted, margin: 0, fontSize: '14px', transition: 'color 0.3s ease' }}>Überwache den Status und verwalte alle Bildschirme in deinem Netzwerk.</p>
        </div>

        {/* KPIs & BUTTON */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            
            <KPICard 
              label="Gesamt" 
              value={totalScreens} 
              icon={<LayoutGrid size={20}/>} 
              color={isDark ? "#fff" : "#111827"} 
              bgColor={colors.card}
              textColor={colors.text}
            />
            
            <KPICard 
              label="Online" 
              value={onlineScreens} 
              icon={<CheckCircle2 size={20}/>} 
              color="#10b981"                     
              bgColor={colors.card}
              textColor={colors.text}
            />
            
            <KPICard 
              label="Offline" 
              value={offlineScreens} 
              icon={<XCircle size={20}/>} 
              color="#ef4444"                     
              bgColor={colors.card}
              textColor={colors.text}
            />

          </div>

          {hasPermission('screens.manage') && (<button 
            onClick={() => setIsModalOpen(true)} 
            style={{ backgroundColor: colors.primary, padding: '16px 28px', borderRadius: '12px', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, fontSize: '15px', transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(94, 66, 166, 0.3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.primaryHover; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(94, 66, 166, 0.4)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = colors.primary; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(94, 66, 166, 0.3)'; }}
          >
            <Plus size={20} strokeWidth={2.5} /> Bildschirm hinzufügen
          </button>
          )}
        </div>
      </div>

      {/* CONTENT BEREICH */}
      <div style={{ padding: '12px 40px', flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '100px', color: colors.textMuted }}>Lade Daten...</div>
        ) : standorte.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px', opacity: 0.5, color: colors.text }}>
            <FolderOpen size={48} style={{ marginBottom: '16px' }} />
            <p>Keine Daten vom Server empfangen.</p>
          </div>
        ) : (
          standorte.map(ort => {
            const isCollapsed = collapsedStandorte.includes(ort.id);
            return (
              <div key={ort.id} style={{ marginBottom: '32px' }}>
                <div onClick={() => toggleStandort(ort.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', backgroundColor: colors.card, borderLeft: `4px solid ${colors.primary}`, borderRadius: isCollapsed ? '10px' : '10px 10px 0 0', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: isDark ? 'none' : '0 2px 4px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '16px', fontWeight: 600, color: colors.text }}>
                    <ChevronDown size={18} color={colors.primary} style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease-in-out' }} /> 
                    {ort.name.toUpperCase()}
                  </div>
                </div>
                {!isCollapsed && (
                  <div style={{ backgroundColor: colors.cardBody, padding: '20px', borderRadius: '0 0 10px 10px', minHeight: '80px', border: `1px solid ${colors.border}`, borderTop: 'none', transition: 'all 0.3s ease' }}>
                    {ort.screens.length === 0 ? (
                      <div style={{ color: colors.textMuted, textAlign: 'center', padding: '20px', fontSize: '14px' }}>Keine Bildschirme in diesem Standort.</div>
                    ) : (
                      ort.screens.map((s: any, i: number) => (
                        <ScreenCard 
                          key={i} 
                          {...s} 
                          globalTheme={globalTheme} 
                          /* Wenn kein Recht da ist, übergeben wir kein onEdit -> der Button verschwindet in der Card */
                          onEdit={hasPermission('screens.manage') ? () => setEditingScreen({ ortId: ort.id, screen: { ...s } }) : undefined} 
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

      {/* --- MODALE UNVERÄNDERT, NUR FARBEN ANGEPASST --- */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(5px)' }}>
          <div style={{ backgroundColor: colors.modalBg, padding: '40px 30px 30px 30px', borderRadius: '20px', width: '420px', textAlign: 'center', border: `1px solid ${colors.inputBorder}`, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', transition: 'all 0.3s ease' }}>
            
            {!tempScreen ? (
              <>
                <div style={{ backgroundColor: 'rgba(94, 66, 166, 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                  <ImageIcon size={30} color={colors.primary} strokeWidth={1.5} />
                </div>
                <h2 style={{ margin: '0 0 16px 0', fontSize: '22px', fontWeight: 700, color: colors.text, letterSpacing: '0.5px' }}>QR-Code hochladen</h2>
                <p style={{ color: colors.textMuted, fontSize: '15px', lineHeight: '1.6', marginBottom: '32px' }}>Wähle ein Bild des QR-Codes aus, um die IP-<br/>Adresse automatisch zu konfigurieren.</p>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleQRUpload} style={{ display: 'none' }} />
                <button onClick={() => fileInputRef.current?.click()} style={{ width: '100%', padding: '14px', backgroundColor: colors.primary, color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginBottom: '20px' }}>
                  Datei auswählen
                </button>
              </>
            ) : (
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ marginBottom: '20px', fontWeight: 600, color: colors.text, textAlign: 'center' }}>Konfiguration</h2>
                
                <div style={{ backgroundColor: colors.inputField, padding: '15px', borderRadius: '10px', marginBottom: '24px', fontSize: '13px', color: colors.textMuted, border: `1px solid ${colors.inputBorder}` }}>
                  <div style={{ color: colors.primary, fontWeight: 'bold', marginBottom: '6px' }}>Erkannte Hardware:</div>
                  IP: {tempScreen.ip} <br /> Display: {tempScreen.width} x {tempScreen.height} px
                </div>

                <input type="text" placeholder="Name des Bildschirms" value={configData.name} onChange={(e) => setConfigData({...configData, name: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', padding: '14px', backgroundColor: colors.inputField, border: `1px solid ${colors.inputBorder}`, borderRadius: '10px', color: colors.text, marginBottom: '16px', outline: 'none' }} />

                <select value={configData.locationId} onChange={(e) => setConfigData({...configData, locationId: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', padding: '14px', backgroundColor: colors.inputField, border: `1px solid ${colors.inputBorder}`, borderRadius: '10px', color: colors.text, marginBottom: '16px', outline: 'none' }}>
                  {standorte.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  <option value="new">+ Neuer Standort...</option>
                </select>

                {configData.locationId === 'new' && (
                  <input type="text" placeholder="Name des neuen Standorts" value={configData.newLocationName} onChange={(e) => setConfigData({...configData, newLocationName: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', padding: '14px', backgroundColor: colors.inputField, border: `1px solid ${colors.inputBorder}`, borderRadius: '10px', color: colors.text, marginBottom: '24px', outline: 'none' }} />
                )}

                <button onClick={confirmAddScreen} style={{ width: '100%', padding: '14px', backgroundColor: colors.primary, border: 'none', borderRadius: '10px', color: 'white', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px' }}>
                   Bildschirm registrieren
                </button>
              </div>
            )}
            
            <button onClick={() => { setIsModalOpen(false); setTempScreen(null); }} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', width: '100%', fontSize: '14px', fontWeight: 500 }}>
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2 */}
      {editingScreen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(5px)' }}>
          <div style={{ backgroundColor: colors.modalBg, padding: '40px 30px 30px 30px', borderRadius: '20px', width: '420px', textAlign: 'left', border: `1px solid ${colors.inputBorder}`, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', transition: 'all 0.3s ease' }}>
            
            <h2 style={{ margin: '0 0 24px 0', fontSize: '22px', fontWeight: 600, color: colors.text, textAlign: 'center' }}>Gerät bearbeiten</h2>

            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: colors.textMuted }}>Anzeigename</label>
            <input type="text" value={editingScreen.screen.name} onChange={(e) => setEditingScreen({...editingScreen, screen: {...editingScreen.screen, name: e.target.value}})} style={{ width: '100%', boxSizing: 'border-box', padding: '14px', backgroundColor: colors.inputField, border: `1px solid ${colors.inputBorder}`, borderRadius: '10px', color: colors.text, marginBottom: '20px', outline: 'none' }} />

            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: colors.textMuted }}>Netzwerk (IP:Port)</label>
            <input type="text" value={editingScreen.screen.ip} onChange={(e) => setEditingScreen({...editingScreen, screen: {...editingScreen.screen, ip: e.target.value}})} style={{ width: '100%', boxSizing: 'border-box', padding: '14px', backgroundColor: colors.inputField, border: `1px solid ${colors.inputBorder}`, borderRadius: '10px', color: colors.text, marginBottom: '20px', outline: 'none' }} />

            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: colors.textMuted }}>Auflösung (z.B. 1920x1080)</label>
            <input type="text" value={editingScreen.screen.resolution || ''} onChange={(e) => setEditingScreen({...editingScreen, screen: {...editingScreen.screen, resolution: e.target.value}})} style={{ width: '100%', boxSizing: 'border-box', padding: '14px', backgroundColor: colors.inputField, border: `1px solid ${colors.inputBorder}`, borderRadius: '10px', color: colors.text, marginBottom: '32px', outline: 'none' }} />
            
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <button onClick={handleSaveEdit} disabled={!hasPermission('screens.manage')} style={{ flex: 1, padding: '14px', backgroundColor: hasPermission('screens.manage') ? colors.primary : colors.textMuted, border: 'none', borderRadius: '10px', color: 'white', fontWeight: 'bold', cursor: hasPermission('screens.manage') ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {hasPermission('screens.manage') ? 'Speichern' : 'Keine Berechtigung'}
              </button>
              {hasPermission('screens.manage') && (
              <button onClick={handleDeleteScreen} title="Bildschirm löschen" style={{ /* dein style */ }}>
                <Trash2 size={20} />
              </button>
              )}
            </div>
            
            <button onClick={() => setEditingScreen(null)} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', width: '100%', fontSize: '14px', fontWeight: 500 }}>
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
const KPICard = ({ label, value, icon, color, bgColor, textColor }: any) => (
  <div style={{ 
    backgroundColor: bgColor || '#1e1e1e', // Nutzt die übergebene Farbe
    color: textColor || '#ffffff',         // Nutzt die übergebene Textfarbe
    padding: '14px 37px', 
    borderRadius: '12px', 
    border: `1px solid ${textColor === '#ffffff' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)'}`, 
    display: 'flex', 
    alignItems: 'center', 
    gap: '16px',
    boxShadow: textColor === '#ffffff' ? 'none' : '0 2px 8px rgba(0,0,0,0.05)',
    transition: 'all 0.3s ease'
  }}>
    <div style={{ color: color, opacity: 0.8 }}>{icon}</div>
    <div>
      <div style={{ 
        fontSize: '13px', 
        color: textColor === '#ffffff' ? '#888' : '#6b7280', // Helles oder dunkles Grau für "GESAMT"
        textTransform: 'uppercase',
        transition: 'color 0.3s ease'
      }}>
        {label}
      </div>
      <div style={{ fontSize: '21px', fontWeight: 700 }}>{value}</div>
    </div>
  </div>
);
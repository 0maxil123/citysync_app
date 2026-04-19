import { useState, useEffect } from 'react';
import { Clock, CalendarDays, Plus, MonitorPlay, Trash2, Info, PowerOff } from 'lucide-react';
import {useAuth} from '../context/AuthContext'

const API_DASHBOARD = "http://localhost:5195/api/dashboard"; 
const API_SCHEDULE = "http://localhost:5195/api/schedule"; 
interface ScheduleProp {
  globalTheme: 'dark' | 'light';
}
export const ScheduleView = ({globalTheme}: ScheduleProp) => {
  const [standorte, setStandorte] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedScreen, setSelectedScreen] = useState<any>(null);
  const [overviewScreen, setOverviewScreen] = useState<any>(null);
  const [routineForm, setRoutineForm] = useState({ days: [] as string[], startTime: '08:00', endTime: '20:00' });
  const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const {user, hasPermission } = useAuth();

  // Wir nutzen exakt denselben Schlüsselnamen wie im Dashboard!
  const CACHE_KEY = "citysync_standorte_cache";

  const loadData = async () => {
    // 1. OFFLINE-FALLBACK: Daten aus dem gemeinsamen Gedächtnis holen
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
      setStandorte(JSON.parse(cachedData));
    }

    // 2. FRISCHE DATEN: Server lautlos nach Updates fragen
    try {
      const response = await fetch(API_DASHBOARD); 
      
      if (response.ok) {
        const freshData = await response.json();
        
        setStandorte(freshData); 
        localStorage.setItem(CACHE_KEY, JSON.stringify(freshData)); // Gedächtnis überschreiben
      }
    } catch (error) {  
      console.warn("Backend nicht erreichbar. Nutze Offline-Daten für Schedule.", error);
    }
  };

  useEffect(() => { loadData(); }, []);

  const toggleDay = (day: string) => {
    setRoutineForm(prev => ({
      ...prev, days: prev.days.includes(day) ? prev.days.filter(d => d !== day) : [...prev.days, day]
    }));
  };

  const getTodayStatus = (routines: any[]) => {
    if (!routines || routines.length === 0) return null; 

    const daysMap: { [key: number]: string } = { 1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa', 0: 'So' };
    const today = daysMap[new Date().getDay()];
    const todaysRoutines = routines.filter(r => r.days.includes(today));

    if (todaysRoutines.length > 0) {
      if (todaysRoutines.length === 1) return `Heute aktiv: ${todaysRoutines[0].startTime} - ${todaysRoutines[0].endTime}`;
      return `Heute aktiv: ${todaysRoutines.length} Zeitfenster`;
    }
    
    // NEU: Text angepasst
    return `Heute ausgeschaltet (andere Tage aktiv)`;
  };

  const openRoutineModal = (screen: any) => {
    setSelectedScreen(screen);
    setRoutineForm({ days: ['Mo', 'Di', 'Mi', 'Do', 'Fr'], startTime: '08:00', endTime: '20:00' });
    setIsModalOpen(true);
  };

  const handleSaveRoutine = async () => {
    if (!selectedScreen || routineForm.days.length === 0) return alert("Bitte Tage auswählen!");
    try {
      await fetch(API_SCHEDULE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user?.id?.toString(), // <--- HIER: userId hinzugefügt
          monitorId: selectedScreen.id, 
          days: routineForm.days, 
          startTime: routineForm.startTime, 
          endTime: routineForm.endTime 
        })
      });
      setIsModalOpen(false);
      loadData(); 
    } catch (error) { alert("Fehler beim Speichern"); }
  };

  const handleDeleteRoutine = async (routineId: number) => {
    if (!confirm("Möchtest du diese Zeitregel wirklich löschen?")) return;
    try {
      // <--- HIER: ?userId=... an die URL angehängt
      await fetch(`${API_SCHEDULE}/${routineId}?userId=${user?.id}`, { method: 'DELETE' });
      
      setOverviewScreen((prev: any) => {
        if (!prev) return prev;
        return { ...prev, routines: prev.routines.filter((r: any) => r.id !== routineId) };
      });
      loadData(); 
    } catch (error) {
      console.error("Löschfehler:", error);
    }
  };
  // --- HIER KOMMEN DIE THEME-FARBEN HIN ---
  const isDark = globalTheme === 'dark';
  const colors = {
    background: isDark ? '#121212' : '#f3f4f6',      // Haupt-Hintergrund
    card: isDark ? '#1e1e1e' : '#ffffff',            // Monitor-Karten
    modalBg: isDark ? '#1c1c1c' : '#ffffff',         // Modal Hintergrund
    inputBg: isDark ? '#121212' : '#f9fafb',         // Textfelder / Listen-Hintergrund
    textMain: isDark ? '#ffffff' : '#111827',        // Normaler Text
    textSub: isDark ? '#888888' : '#6b7280',         // Grauer Text
    border: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)', // Normale Linien
    borderStrong: isDark ? '#333333' : '#e5e7eb',    // Stärkere Linien
    primary: '#5e42a6',                              // Dein Lila
    primaryHover: '#7a5bc7',
    iconBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    dayBtnInactive: isDark ? '#2a2a2a' : '#e5e7eb',
    dayBtnInactiveText: isDark ? '#777777' : '#6b7280',
    textMuted: isDark ? '#888888' : '#6b7280',       // Grauer Text

  };

  return (
    <div style={{ color: colors.textMain, backgroundColor: colors.background, height: '100%', overflow: 'hidden', width: '100%', display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease' }}>
      
      {/* HEADER */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: colors.background, padding: '40px 40px 12px 40px', transition: 'background-color 0.3s ease' }}>
        <div style={{paddingBottom: '24px', borderBottom: `1px solid ${colors.border}`, transition: 'border-color 0.3s ease' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 400, margin: 0, marginBottom: '8px' }}>Schedule - Timeline</h1>
          <p style={{ color: colors.textSub, margin: 0, fontSize: '14px', transition: 'color 0.3s ease' }}>Verwalte die automatischen Betriebszeiten. Ohne aktive Regeln bleiben die Monitore standardmäßig AUS.</p>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding: '0px 40px 40px 40px', flex: 1, overflowY: 'auto' }}>
        {standorte.map(ort => (
          <div key={ort.id} style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '16px', color: '#8a6ce0', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>{ort.name}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {ort.screens.map((screen: any) => {
                const hasRoutines = screen.routines && screen.routines.length > 0;
                const todayStatus = getTodayStatus(screen.routines);
                const isTodayActive = todayStatus?.includes('aktiv');
                
                return (
                  <div key={screen.id} style={{ backgroundColor: colors.card, padding: '20px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${colors.border}`, transition: 'all 0.3s ease', boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.04)' }}>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '250px' }}>
                      <div style={{ backgroundColor: colors.iconBg, padding: '12px', borderRadius: '10px', transition: 'background-color 0.3s ease' }}>
                        <MonitorPlay size={24} color={hasRoutines ? (isTodayActive ? "#4caf50" : (isDark ? "#aaa" : "#888")) : "#f44336"} />
                      </div>
                      <div>
                        <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px', color: colors.textMain, transition: 'color 0.3s ease' }}>{screen.name}</div>
                        <div style={{ fontSize: '13px', color: colors.textSub, transition: 'color 0.3s ease' }}>IP: {screen.ip}</div>
                      </div>
                    </div>

                    {/* MITTE: HEUTE STATUS */}
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                      {hasRoutines ? (
                        <div style={{ 
                          backgroundColor: isTodayActive ? 'rgba(76, 175, 80, 0.1)' : colors.iconBg, 
                          border: isTodayActive ? '1px solid rgba(76, 175, 80, 0.2)' : `1px solid ${colors.border}`,
                          color: isTodayActive ? '#4caf50' : colors.textSub,
                          padding: '8px 20px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.3s ease'
                        }}>
                          <Clock size={16} /> {todayStatus}
                        </div>
                      ) : (
                        <div style={{ backgroundColor: 'rgba(244, 67, 54, 0.1)', border: '1px solid rgba(244, 67, 54, 0.3)', color: '#f44336', padding: '8px 20px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <PowerOff size={16} /> Standardmäßig AUS
                        </div>
                      )}
                    </div>

                    {/* RECHTS: AKTIONEN */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button 
                        onClick={() => setOverviewScreen(screen)}
                        style={{ background: 'none', border: `1px solid ${colors.borderStrong}`, color: colors.textSub, padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.iconBg; e.currentTarget.style.color = colors.textMain; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = colors.textSub; }}
                      >
                        <CalendarDays size={18} /> Wochenplan
                      </button>
                      {hasPermission('screens.manage') && (
                        <button 
                          onClick={() => openRoutineModal(screen)} 
                          style={{ backgroundColor: colors.primary, border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.primaryHover}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primary}
                        >
                          <Plus size={16} /> Neue Regel
                        </button>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* MODAL 1: WOCHENPLAN ÜBERSICHT */}
      {overviewScreen && (
        <div style={{ position: 'fixed', inset: 0, background: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(5px)' }}>
          <div style={{ backgroundColor: colors.modalBg, padding: '40px', borderRadius: '20px', width: '500px', border: `1px solid ${colors.borderStrong}`, boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.5)' : '0 20px 50px rgba(0,0,0,0.1)', transition: 'all 0.3s ease' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: 600, color: colors.textMain }}>Hinterlegte Regeln</h2>
                <p style={{ color: colors.textSub, fontSize: '14px', margin: 0 }}>Für: <strong style={{color: colors.textMain}}>{overviewScreen.name}</strong></p>
                {!hasPermission('screens.manage') && (
                <div style={{ color: colors.textSub, fontSize: '12px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Info size={14} /> Nur Lesezugriff
                </div>
              )}
              {/* ------------------------------------ */}
              </div>
            </div>

            <div style={{ backgroundColor: colors.inputBg, borderRadius: '12px', border: `1px solid ${colors.borderStrong}`, overflow: 'hidden', marginBottom: '24px' }}>
              {weekDays.map((day, index) => {
                const routineForThisDay = overviewScreen.routines?.find((r: any) => r.days.includes(day));

                return (
                  <div key={day} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: index < 6 ? `1px solid ${colors.borderStrong}` : 'none', backgroundColor: routineForThisDay ? 'rgba(76, 175, 80, 0.05)' : 'transparent' }}>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontWeight: 600, color: routineForThisDay ? colors.textMain : colors.textSub, width: '30px' }}>{day}</span>
                      {routineForThisDay ? (
                        <span style={{ color: '#4caf50', fontWeight: 600, fontSize: '15px' }}>
                          {routineForThisDay.startTime} - {routineForThisDay.endTime} Uhr
                        </span>
                      ) : (
                        <span style={{ color: colors.textSub, fontSize: '14px' }}>Ausgeschaltet</span>
                      )}
                    </div>

                    {routineForThisDay && hasPermission('screens.manage') && (
                      <button 
                        onClick={() => handleDeleteRoutine(routineForThisDay.id)}
                        style={{ background: 'rgba(244, 67, 54, 0.1)', border: '1px solid rgba(244, 67, 54, 0.3)', color: '#f44336', padding: '8px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(244, 67, 54, 0.2)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(244, 67, 54, 0.1)'}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '12px', padding: '16px', backgroundColor: 'rgba(94, 66, 166, 0.1)', borderRadius: '12px', color: '#b095f5', fontSize: '13px', lineHeight: '1.5' }}>
              <Info size={20} style={{ flexShrink: 0 }} />
              <div>Außerhalb dieser festgelegten Zeiten schaltet das System den Monitor automatisch aus (Energiesparmodus).</div>
            </div>

            <button onClick={() => setOverviewScreen(null)} style={{ width: '100%', marginTop: '24px', padding: '14px', backgroundColor: isDark ? '#333' : '#e5e7eb', border: 'none', borderRadius: '10px', color: colors.textMain, fontWeight: 600, cursor: 'pointer', transition: 'background-color 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? '#444' : '#d1d5db'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isDark ? '#333' : '#e5e7eb'}
            >
              Schließen
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: NEUE REGEL HINZUFÜGEN */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(5px)' }}>
          <div style={{ backgroundColor: colors.modalBg, padding: '40px 30px', borderRadius: '20px', width: '460px', border: `1px solid ${colors.borderStrong}`, boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.5)' : '0 20px 50px rgba(0,0,0,0.1)', transition: 'all 0.3s ease' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: 600, color: colors.textMain }}>Neue Regel erstellen</h2>
            <p style={{ color: colors.textSub, fontSize: '14px', marginBottom: '24px' }}>Für: <strong style={{color: colors.textMain}}>{selectedScreen?.name}</strong></p>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '12px', fontSize: '13px', color: colors.textSub }}>Aktiv an folgenden Tagen:</label>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {weekDays.map(day => {
                  const isActive = routineForm.days.includes(day);
                  return (
                    <button key={day} onClick={() => toggleDay(day)} style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', backgroundColor: isActive ? colors.primary : colors.dayBtnInactive, color: isActive ? '#fff' : colors.dayBtnInactiveText, transition: 'all 0.2s' }}>
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '20px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: colors.textSub }}>Einschalten um</label>
                <input type="time" value={routineForm.startTime} onChange={(e) => setRoutineForm({...routineForm, startTime: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', padding: '14px', backgroundColor: colors.inputBg, border: `1px solid ${colors.borderStrong}`, borderRadius: '10px', color: colors.textMain, fontSize: '16px', colorScheme: isDark ? 'dark' : 'light' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: colors.textSub }}>Ausschalten um</label>
                <input type="time" value={routineForm.endTime} onChange={(e) => setRoutineForm({...routineForm, endTime: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', padding: '14px', backgroundColor: colors.inputBg, border: `1px solid ${colors.borderStrong}`, borderRadius: '10px', color: colors.textMain, fontSize: '16px', colorScheme: isDark ? 'dark' : 'light' }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
              <button 
                onClick={() => setRoutineForm({...routineForm, startTime: '00:00', endTime: '23:59'})}
                style={{ background: 'none', border: 'none', color: '#8a6ce0', fontSize: '13px', cursor: 'pointer', padding: 0 }}
                onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
              >
                Ganzen Tag auswählen (00:00 - 23:59)
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '14px', backgroundColor: 'transparent', border: `1px solid ${colors.borderStrong}`, borderRadius: '10px', color: colors.textSub, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
               onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.iconBg; e.currentTarget.style.color = colors.textMain; }}
               onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = colors.textSub; }}
              >Abbrechen</button>
              <button onClick={handleSaveRoutine} disabled={!hasPermission('screens.manage')} style={{ flex: 2, padding: '14px', backgroundColor: hasPermission('screens.manage') ? colors.primary : colors.textMuted, border: 'none', borderRadius: '10px', color: 'white', fontWeight: 600, cursor: hasPermission('screens.manage') ? 'pointer' : 'not-allowed', transition: 'background-color 0.2s' }}
               onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.primaryHover}
               onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primary}
              >{hasPermission('screens.manage') ? 'Regel hinzufügen' : 'Keine Berechtigung'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
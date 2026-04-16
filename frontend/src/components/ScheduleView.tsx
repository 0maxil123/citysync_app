import { useState, useEffect } from 'react';
import { Clock, CalendarDays, Plus, MonitorPlay, Trash2, Info, PowerOff } from 'lucide-react';

const API_DASHBOARD = "http://localhost:5195/api/dashboard"; 
const API_SCHEDULE = "http://localhost:5195/api/schedule"; 

export const ScheduleView = () => {
  const [standorte, setStandorte] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedScreen, setSelectedScreen] = useState<any>(null);
  const [overviewScreen, setOverviewScreen] = useState<any>(null);
  const [routineForm, setRoutineForm] = useState({ days: [] as string[], startTime: '08:00', endTime: '20:00' });
  const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

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
        body: JSON.stringify({ monitorId: selectedScreen.id, days: routineForm.days, startTime: routineForm.startTime, endTime: routineForm.endTime })
      });
      setIsModalOpen(false);
      loadData(); 
    } catch (error) { alert("Fehler beim Speichern"); }
  };

  const handleDeleteRoutine = async (routineId: number) => {
    if (!confirm("Möchtest du diese Zeitregel wirklich löschen?")) return;
    try {
      await fetch(`${API_SCHEDULE}/${routineId}`, { method: 'DELETE' });
      setOverviewScreen((prev: any) => {
        if (!prev) return prev;
        return { ...prev, routines: prev.routines.filter((r: any) => r.id !== routineId) };
      });
      loadData(); 
    } catch (error) {
      console.error("Löschfehler:", error);
    }
  };

  return (
    <div style={{ color: '#fff', backgroundColor: '#121212', height: '100vh', overflow: 'hidden', width: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* HEADER */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: '#121212', padding: '40px 40px 12px 40px' }}>
        <div style={{paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 400, margin: 0, marginBottom: '8px' }}>Schedule - Timeline</h1>
          {/* NEU: Untertitel angepasst */}
          <p style={{ color: '#888', margin: 0, fontSize: '14px' }}>Verwalte die automatischen Betriebszeiten. Ohne aktive Regeln bleiben die Monitore standardmäßig AUS.</p>
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
                  <div key={screen.id} style={{ backgroundColor: '#1e1e1e', padding: '20px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(255,255,255,0.05)' }}>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '250px' }}>
                      <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '10px' }}>
                        <MonitorPlay size={24} color={hasRoutines ? (isTodayActive ? "#4caf50" : "#aaa") : "#f44336"} />
                      </div>
                      <div>
                        <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>{screen.name}</div>
                        <div style={{ fontSize: '13px', color: '#777' }}>IP: {screen.ip}</div>
                      </div>
                    </div>

                    {/* MITTE: HEUTE STATUS */}
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                      {hasRoutines ? (
                        <div style={{ 
                          backgroundColor: isTodayActive ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 255, 255, 0.05)', 
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: isTodayActive ? '#4caf50' : '#888',
                          padding: '8px 20px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px'
                        }}>
                          <Clock size={16} /> {todayStatus}
                        </div>
                      ) : (
                        // NEU: Roter Badge für "Standardmäßig AUS"
                        <div style={{ backgroundColor: 'rgba(244, 67, 54, 0.1)', border: '1px solid rgba(244, 67, 54, 0.3)', color: '#f44336', padding: '8px 20px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <PowerOff size={16} /> Standardmäßig AUS
                        </div>
                      )}
                    </div>

                    {/* RECHTS: AKTIONEN */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {/* NEU: Button wird IMMER angezeigt, egal ob Regeln da sind oder nicht */}
                      <button 
                        onClick={() => setOverviewScreen(screen)}
                        style={{ background: 'none', border: '1px solid #333', color: '#ccc', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <CalendarDays size={18} /> Wochenplan
                      </button>
                      <button 
                        onClick={() => openRoutineModal(screen)} 
                        style={{ backgroundColor: '#5e42a6', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#7a5bc7'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#5e42a6'}
                      >
                        <Plus size={16} /> Neue Regel
                      </button>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(5px)' }}>
          <div style={{ backgroundColor: '#1c1c1c', padding: '40px', borderRadius: '20px', width: '500px', border: '1px solid #2a2a2a' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: 600, color: '#fff' }}>Hinterlegte Regeln</h2>
                <p style={{ color: '#888', fontSize: '14px', margin: 0 }}>Für: <strong style={{color: '#fff'}}>{overviewScreen.name}</strong></p>
              </div>
            </div>

            <div style={{ backgroundColor: '#121212', borderRadius: '12px', border: '1px solid #333', overflow: 'hidden', marginBottom: '24px' }}>
              {weekDays.map((day, index) => {
                const routineForThisDay = overviewScreen.routines?.find((r: any) => r.days.includes(day));

                return (
                  <div key={day} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: index < 6 ? '1px solid #222' : 'none', backgroundColor: routineForThisDay ? 'rgba(76, 175, 80, 0.05)' : 'transparent' }}>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontWeight: 600, color: routineForThisDay ? '#fff' : '#555', width: '30px' }}>{day}</span>
                      {routineForThisDay ? (
                        <span style={{ color: '#4caf50', fontWeight: 600, fontSize: '15px' }}>
                          {routineForThisDay.startTime} - {routineForThisDay.endTime} Uhr
                        </span>
                      ) : (
                        // NEU: Text angepasst
                        <span style={{ color: '#555', fontSize: '14px' }}>Ausgeschaltet</span>
                      )}
                    </div>

                    {routineForThisDay && (
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

            {/* NEU: Info Text angepasst */}
            <div style={{ display: 'flex', gap: '12px', padding: '16px', backgroundColor: 'rgba(94, 66, 166, 0.1)', borderRadius: '12px', color: '#b095f5', fontSize: '13px', lineHeight: '1.5' }}>
              <Info size={20} style={{ flexShrink: 0 }} />
              <div>Außerhalb dieser festgelegten Zeiten schaltet das System den Monitor automatisch aus (Energiesparmodus).</div>
            </div>

            <button onClick={() => setOverviewScreen(null)} style={{ width: '100%', marginTop: '24px', padding: '14px', backgroundColor: '#333', border: 'none', borderRadius: '10px', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
              Schließen
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: NEUE REGEL HINZUFÜGEN */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(5px)' }}>
          <div style={{ backgroundColor: '#1c1c1c', padding: '40px 30px', borderRadius: '20px', width: '460px', border: '1px solid #2a2a2a' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: 600, color: '#fff' }}>Neue Regel erstellen</h2>
            <p style={{ color: '#888', fontSize: '14px', marginBottom: '24px' }}>Für: <strong style={{color: '#fff'}}>{selectedScreen?.name}</strong></p>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '12px', fontSize: '13px', color: '#aaa' }}>Aktiv an folgenden Tagen:</label>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {weekDays.map(day => {
                  const isActive = routineForm.days.includes(day);
                  return (
                    <button key={day} onClick={() => toggleDay(day)} style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', backgroundColor: isActive ? '#5e42a6' : '#2a2a2a', color: isActive ? '#fff' : '#777', transition: 'all 0.2s' }}>
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '20px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}><label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#aaa' }}>Einschalten um</label><input type="time" value={routineForm.startTime} onChange={(e) => setRoutineForm({...routineForm, startTime: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', padding: '14px', backgroundColor: '#121212', border: '1px solid #333', borderRadius: '10px', color: 'white', fontSize: '16px' }} /></div>
              <div style={{ flex: 1 }}><label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#aaa' }}>Ausschalten um</label><input type="time" value={routineForm.endTime} onChange={(e) => setRoutineForm({...routineForm, endTime: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', padding: '14px', backgroundColor: '#121212', border: '1px solid #333', borderRadius: '10px', color: 'white', fontSize: '16px' }} /></div>
            </div>

            {/* NEU: 24/7 Shortcut Button */}
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
              <button onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '14px', backgroundColor: 'transparent', border: '1px solid #333', borderRadius: '10px', color: '#aaa', fontWeight: 600, cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={handleSaveRoutine} style={{ flex: 2, padding: '14px', backgroundColor: '#6347a6', border: 'none', borderRadius: '10px', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Regel hinzufügen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
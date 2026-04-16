import React, { useState, useRef, useEffect } from 'react';
import { Plus,Rocket, ArrowLeft, Clock, Trash2, CalendarDays, ImagePlus, Upload, X, Send, CheckCircle2, AlertCircle, Edit3 } from 'lucide-react';

interface EventEditorProps {
  monitorId: string;
  tabName: string;
  events: any[];
  onRefresh: () => Promise<void>;
  onDelete: (id: number) => void;
  onPublish: () => Promise<void>;
}

const BACKEND_URL = "http://localhost:5195";

export const EventEditor: React.FC<EventEditorProps> = ({ monitorId, tabName, events, onRefresh, onDelete, onPublish }) => {
  const [view, setView] = useState<'list' | 'form'>('list');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Formular States
  const [editingId, setEditingId] = useState<number | null>(null); // NEU: Merkt sich, ob wir bearbeiten!
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Status-Nachricht (Toast)
  const [statusMsg, setStatusMsg] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);

  useEffect(() => {
    if (statusMsg) {
      const timer = setTimeout(() => setStatusMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMsg]);

  // --- NEU: Klick auf "Bearbeiten" ---
  const handleEditClick = (ev: any) => {
    setEditingId(ev.id);
    setTitle(ev.title || '');
    setDate(ev.eventDate || '');
    setTime(ev.eventTime || '');
    setPreviewUrl(ev.url); // Wir zeigen das bestehende Bild an
    setSelectedImage(null); // Bild wird beim Bearbeiten nicht neu hochgeladen
    setView('form');
  };

  // --- NEU: Formular leeren ---
  const resetForm = () => {
    setEditingId(null);
    setTitle(''); setDate(''); setTime(''); setSelectedImage(null); setPreviewUrl(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleBackClick = () => {
    if (title || date || time || selectedImage) {
      setShowExitModal(true);
    } else {
      resetForm();
      setView('list');
    }
  };

  const handleSave = async (publishAfter: boolean = false) => {
    // Beim NEUEN Event brauchen wir ein Bild, beim BEARBEITEN nicht zwingend (es bleibt das alte)
    if (!editingId && !selectedImage) {
      setStatusMsg({ text: "Bitte ein Titelbild auswählen!", type: 'error' });
      return;
    }
    if (!title || !date || !time) {
      setStatusMsg({ text: "Bitte Titel, Datum und Uhrzeit ausfüllen!", type: 'error' });
      return;
    }

    try {
      if (editingId) {
        // FALL A: WIR BEARBEITEN EIN BESTEHENDES EVENT (Nur Text Update per JSON)
        // FALL A: WIR BEARBEITEN EIN BESTEHENDES EVENT
        const response = await fetch(`${BACKEND_URL}/api/media/update/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            title: title || '', 
            eventDate: date || '', 
            eventTime: time || '',
            content: '',               // <--- WICHTIG: Leeres Feld für C#
            expirationDate: 'Immer'    // <--- WICHTIG: Standardwert für C#
          })
        });
        if (!response.ok) throw new Error("Fehler beim Update");

      } else {
        // FALL B: WIR ERSTELLEN EIN GANZ NEUES EVENT (Upload per FormData)
        const formData = new FormData();
        formData.append('file', selectedImage!);
        formData.append('monitorId', monitorId);
        formData.append('tabName', tabName);
        formData.append('duration', '15s');
        formData.append('title', title);
        formData.append('eventDate', date);
        formData.append('eventTime', time);
        formData.append('type', 'event');

        const response = await fetch(`${BACKEND_URL}/api/media/upload`, { method: 'POST', body: formData });
        if (!response.ok) throw new Error("Fehler beim Speichern");
      }

      // Wenn der User "Speichern & Live schalten" geklickt hat
      if (publishAfter) {
        await fetch(`${BACKEND_URL}/api/monitors/${monitorId}/publish`, { method: 'POST' });
      }
      
      // Liste neu laden und UI zurücksetzen
      await onRefresh();
      setStatusMsg({ text: editingId ? "Erfolgreich aktualisiert!" : "Erfolgreich gespeichert!", type: 'success' });
      resetForm();
      setShowExitModal(false);
      setView('list'); 

    } catch (error) {
      setStatusMsg({ text: "Fehler bei der Kommunikation mit dem Server.", type: 'error' });
    }
  };

  // --- HILFSFUNKTION FÜR DAS STATUS-BADGE ---
  const getEventStatus = (eventDateStr: string) => {
    if (!eventDateStr) return { label: 'Aktiv', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' }; // Blau
    const evDate = new Date(eventDateStr);
    const today = new Date();
    today.setHours(0,0,0,0); // Uhrzeit ignorieren, nur Tag vergleichen
    
    if (evDate > today) return { label: 'Geplant', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' }; // Grün (Zukunft)
    if (evDate < today) return { label: 'Abgelaufen', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' }; // Grau (Vergangenheit)
    return { label: 'Heute', color: '#8a6ce0', bg: 'rgba(138, 108, 224, 0.1)' }; // Lila (Heute)
  };


  if (view === 'list') {
    return (
      <div style={{ padding: '32px', color: '#fff', maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
        
        {/* MODERNE STATUS-BAR (Toast) */}
        {statusMsg && (
          <div style={{ 
            position: 'fixed', top: '24px', right: '24px', zIndex: 10000,
            backgroundColor: statusMsg.type === 'success' ? '#065f46' : '#991b1b',
            color: '#fff', padding: '12px 24px', borderRadius: '12px',
            display: 'flex', alignItems: 'center', gap: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            animation: 'slideIn 0.3s ease-out'
          }}>
            {statusMsg.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span style={{ fontSize: '14px', fontWeight: 500 }}>{statusMsg.text}</span>
          </div>
        )}

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>Events: {tabName}</h2>
            <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>{events.length} Termine geplant</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {/* NEUER BUTTON: Alle Live schalten */}
            {events.length > 0 && (
              <button 
                onClick={async () => {
                  // HIER IST DER FIX: Den TabNamen (?tabName=...) an die URL anhängen
                  await fetch(`${BACKEND_URL}/api/media/publish-all/${monitorId}?tabName=${encodeURIComponent(tabName)}`, { method: 'POST' });
                  
                  await onPublish();
                  await onRefresh();
                  
                  setStatusMsg({ text: "Alle Events in diesem Tab Live geschaltet!", type: 'success' });
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: 'transform 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <Rocket size={18} /> Alle Live schalten
              </button>
            )}

            <button 
              onClick={() => { resetForm(); setView('form'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', background: '#8a6ce0', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: 'transform 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <Plus size={18} /> Neues Event
            </button>
          </div>
        </div>

        {/* EVENT-LISTE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', backgroundColor: '#1e1e1e', borderRadius: '16px', border: '1px dashed #333' }}>
              <CalendarDays size={48} color="#444" style={{ marginBottom: '16px', margin: '0 auto' }} />
              <div style={{ color: '#888' }}>Noch keine Events vorhanden.</div>
            </div>
          ) : (
            events.map((ev) => {
              const isLive = ev.isLive === 1;
              
              // 1. Datum und Uhrzeit zusammenbauen
              const eventDateTimeString = `${ev.eventDate}T${ev.eventTime || '00:00'}:00`;
              const eventDateTime = new Date(eventDateTimeString);
              const now = new Date();
              
              // 2. Prüfen, ob das Event in der Vergangenheit liegt
              const isExpired = eventDateTime < now;

              // 3. Prüfen, ob es HEUTE ist (für das lila Datum)
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const evDateOnly = new Date(ev.eventDate);
              evDateOnly.setHours(0,0,0,0);
              const isToday = evDateOnly.getTime() === today.getTime();

              return (
                <div key={ev.id} style={{ 
                  display: 'flex', alignItems: 'center', backgroundColor: '#1e1e1e', 
                  border: isExpired ? '1px dashed #333' : '1px solid #333', // Gestrichelt, wenn abgelaufen
                  borderRadius: '16px', padding: '16px', gap: '20px',
                  opacity: isExpired ? 0.4 : (isLive ? 1 : 0.8), // Abgelaufene sind stark transparent
                  filter: isExpired ? 'grayscale(100%)' : 'none', // NEU: Abgelaufene werden schwarz-weiß!
                  transition: 'all 0.3s'
                }}>
                  <div style={{ width: '120px', height: '80px', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#111', flexShrink: 0 }}>
                    <img src={ev.url} alt="Event" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    {/* TITELZEILE & BADGE */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', color: '#fff', fontWeight: 600, textDecoration: isExpired ? 'line-through' : 'none' }}>
                        {ev.title || "Unbenannt"}
                      </h3>
                      
                      {/* DIE NEUE BADGE-LOGIK */}
                      {isExpired ? (
                        <span style={{ backgroundColor: 'rgba(107, 114, 128, 0.1)', color: '#9ca3af', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', border: '1px solid rgba(107, 114, 128, 0.2)' }}>
                          Abgelaufen
                        </span>
                      ) : (
                        <span style={{ 
                          backgroundColor: isLive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', 
                          color: isLive ? '#10b981' : '#f59e0b', 
                          padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                          border: `1px solid ${isLive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`
                        }}>
                          {isLive ? '● Live' : 'Entwurf'}
                        </span>
                      )}
                    </div>

                    {/* DATUMSZEILE */}
                    <div style={{ display: 'flex', gap: '16px', color: '#aaa', fontSize: '13px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isToday && !isExpired ? '#8a6ce0' : '#aaa', fontWeight: isToday && !isExpired ? 700 : 400 }}>
                        <CalendarDays size={14} color={isToday && !isExpired ? "#8a6ce0" : "#666"} /> 
                        {isToday ? "HEUTE" : new Date(ev.eventDate).toLocaleDateString('de-DE')}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={14} color="#666" /> {ev.eventTime || "---"}
                      </span>
                    </div>
                  </div>
                  
                  {/* ACTION BUTTONS */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {/* Raketen-Button (Versteckt, wenn das Event abgelaufen ist) */}
                    {!isExpired && (
                      <button 
                        onClick={async () => {
                          await fetch(`${BACKEND_URL}/api/media/${ev.id}/publish-item`, { method: 'POST' });
                          await onPublish(); 
                          await onRefresh(); 
                          setStatusMsg({ text: `"${ev.title}" live geschaltet!`, type: 'success' });
                        }}
                        style={{ background: isLive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)', border: 'none', color: isLive ? '#10b981' : '#666', padding: '12px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = isLive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = isLive ? '#10b981' : '#666'; }}
                        title="Dieses Event sofort live schalten"
                      >
                        <Rocket size={18} />
                      </button>
                    )}

                  <button 
                    onClick={() => handleEditClick(ev)}
                    style={{ background: 'rgba(255, 255, 255, 0.05)', border: 'none', color: '#aaa', padding: '12px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = '#aaa'; }}
                    title="Bearbeiten"
                  >
                    <Edit3 size={18} />
                  </button>

                  <button 
                    onClick={() => onDelete(ev.id)}
                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', padding: '12px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444'; }}
                    title="Löschen"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            )})
          )}
        </div>

        <style>{`
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  // --- FORMULAR ANSICHT ---
  return (
    <div style={{ padding: '32px', color: '#fff', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <button onClick={handleBackClick} style={{ background: '#252525', border: '1px solid #333', color: '#aaa', cursor: 'pointer', padding: '10px', borderRadius: '10px', display: 'flex' }}>
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ margin: 0, fontSize: '24px' }}>{editingId ? 'Event bearbeiten' : 'Neues Event'}</h2>
      </div>

      <div style={{ backgroundColor: '#1e1e1e', padding: '28px', borderRadius: '20px', border: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* IMAGE UPLOAD (Im Bearbeiten-Modus gesperrt, um es simpel zu halten) */}
        <div>
          <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: '#666', fontWeight: 700, letterSpacing: '1px' }}>TITELBILD</label>
          <input type="file" accept="image/*" onChange={handleImageChange} ref={fileInputRef} style={{ display: 'none' }} disabled={!!editingId} />
          <div 
            onClick={() => !editingId && fileInputRef.current?.click()}
            style={{ 
              width: '100%', height: previewUrl ? 'auto' : '180px', background: '#141414', border: previewUrl ? 'none' : '2px dashed #333', borderRadius: '14px', 
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
              cursor: editingId ? 'not-allowed' : 'pointer', overflow: 'hidden', position: 'relative', opacity: editingId ? 0.7 : 1
            }}
          >
            {previewUrl ? (
              <img src={previewUrl} style={{ width: '100%', maxHeight: '300px', objectFit: 'cover' }} />
            ) : (
              <div style={{ color: '#444', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <ImagePlus size={32} />
                <span style={{ fontSize: '13px' }}>Bild auswählen</span>
              </div>
            )}
            {/* Overlay-Text, wenn man bearbeitet */}
            {editingId && (
               <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                 <span style={{ fontSize: '12px', color: '#aaa', backgroundColor: '#111', padding: '6px 12px', borderRadius: '8px' }}>Bild kann nicht nachträglich geändert werden.</span>
               </div>
            )}
          </div>
        </div>

        {/* TITLE INPUT */}
        <div>
          <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: '#666', fontWeight: 700, letterSpacing: '1px' }}>EVENT-TITEL</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Was findet statt?" style={{ width: '100%', padding: '14px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '12px', color: '#fff', fontSize: '15px', outline: 'none' }} />
        </div>

        {/* DATE & TIME */}
        {/* DATE & TIME */}
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: '#666', fontWeight: 700, letterSpacing: '1px' }}>DATUM</label>
            <div style={{ position: 'relative' }}>
              <CalendarDays size={18} color="#8a6ce0" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                className="date-time-input" 
                style={{cursor:'text', width: '100%', padding: '14px 14px 14px 44px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '12px', color: '#fff', fontSize: '15px', outline: 'none', colorScheme: 'dark', fontFamily: 'inherit' }} 
                onFocus={(e) => e.target.style.borderColor = '#8a6ce0'} 
                onBlur={(e) => e.target.style.borderColor = '#333'} 
              />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: '#666', fontWeight: 700, letterSpacing: '1px' }}>UHRZEIT</label>
            <div style={{ position: 'relative' }}>
              <Clock size={18} color="#eab308" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input 
                type="time" 
                value={time} 
                onChange={(e) => setTime(e.target.value)} 
                className="date-time-input"
                style={{cursor:'text', width: '100%', padding: '14px 14px 14px 44px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '12px', color: '#fff', fontSize: '15px', outline: 'none', colorScheme: 'dark', fontFamily: 'inherit' }} 
                onFocus={(e) => e.target.style.borderColor = '#eab308'} 
                onBlur={(e) => e.target.style.borderColor = '#333'} 
              />
            </div>
          </div>
        </div>

        {/* NEU: CSS-Trick, um nur die nativen Icons anklickbar zu machen */}
        <style>{`
          .date-time-input::-webkit-calendar-picker-indicator {
            cursor: pointer;
          }
        `}</style>

        <button 
          onClick={() => handleSave(false)}
          style={{ marginTop: '10px', padding: '16px', background: '#8a6ce0', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
        >
          <Upload size={18} /> {editingId ? 'Änderungen speichern' : 'Event speichern'}
        </button>
      </div>

      {/* EXIT MODAL */}
      {showExitModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: '#1c1c1c', padding: '32px', borderRadius: '24px', width: '400px', border: '1px solid #333', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 12px 0' }}>Nicht gespeichert!</h3>
            <p style={{ color: '#888', fontSize: '14px', marginBottom: '24px' }}>Möchtest du die Änderungen vor dem Verlassen speichern?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button onClick={() => handleSave(true)} style={{ padding: '14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Send size={18} /> Speichern & Live schalten</button>
              <button onClick={() => handleSave(false)} style={{ padding: '14px', background: '#8a6ce0', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>Nur Speichern</button>
              <button onClick={() => { resetForm(); setView('list'); setShowExitModal(false); }} style={{ padding: '14px', background: 'transparent', color: '#ff6b6b', border: '1px solid #333', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>Verwerfen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
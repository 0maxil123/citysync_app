import React, { useState, useRef, useEffect } from 'react';
import { Plus,Rocket, ArrowLeft, Clock, Trash2, CalendarDays, ImagePlus, Upload, X, Send, CheckCircle2, AlertCircle, Edit3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
interface EventEditorProps {
  monitorId: string;
  tabName: string;
  events: any[];
  onRefresh: () => Promise<void>;
  onDelete: (id: number) => void;
  onPublish: () => Promise<void>;
  globalTheme: 'dark' | 'light'
}

const BACKEND_URL = "http://localhost:5195";

export const EventEditor: React.FC<EventEditorProps> = ({ monitorId, tabName, events, onRefresh, onDelete, onPublish, globalTheme }) => {
  const [view, setView] = useState<'list' | 'form'>('list');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {user, hasPermission} = useAuth()

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
        // FALL A: WIR BEARBEITEN EIN BESTEHENDES EVENT
        const response = await fetch(`${BACKEND_URL}/api/media/update/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userId: user?.id?.toString(),
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
        formData.append('userId',user?.id?.toString() || '');
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
        await fetch(`${BACKEND_URL}/api/monitors/${monitorId}/publish`, 
          { method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({userId:user?.id?.toString()})
           });
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
  // const getEventStatus = (eventDateStr: string) => {
  //   if (!eventDateStr) return { label: 'Aktiv', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' }; // Blau
  //   const evDate = new Date(eventDateStr);
  //   const today = new Date();
  //   today.setHours(0,0,0,0); // Uhrzeit ignorieren, nur Tag vergleichen
    
  //   if (evDate > today) return { label: 'Geplant', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' }; // Grün (Zukunft)
  //   if (evDate < today) return { label: 'Abgelaufen', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' }; // Grau (Vergangenheit)
  //   return { label: 'Heute', color: '#8a6ce0', bg: 'rgba(138, 108, 224, 0.1)' }; // Lila (Heute)
  // };


  // --- FARB-LOGIK FÜR EVENT-EDITOR ---
  const isDark = globalTheme === 'dark';
  const colors = {
    background: isDark ? 'transparent' : '#f3f4f6', 
    textMuted: isDark ? '#888888' : '#6b7280',       // Grauer Text
    card: isDark ? '#1e1e1e' : '#ffffff',
    inputBg: isDark ? '#0a0a0a' : '#f9fafb',
    textMain: isDark ? '#ffffff' : '#111827',
    textSub: isDark ? '#888888' : '#6b7280',
    border: isDark ? '#333333' : '#e5e7eb',
    borderLight: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    primary: '#8a6ce0',
    primaryHover: '#7a5bc7',
    dangerBg: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fee2e2',
    dangerText: '#ef4444',
    modalOverlay: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)',
    modalBg: isDark ? '#1c1c1c' : '#ffffff',
  };

  if (view === 'list') {
    return (
      <div style={{ padding: '32px', color: colors.textMain, maxWidth: '800px', margin: '0 auto', position: 'relative', transition: 'all 0.3s ease' }}>
        
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
            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', color: colors.textMain }}>Events: {tabName}</h2>
            <p style={{ margin: 0, color: colors.textSub, fontSize: '14px' }}>{events.length} Termine geplant</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {/* NEUER BUTTON: Alle Live schalten */}
            {events.length > 0 && hasPermission('media.publish') &&(
              <button 
                onClick={async () => {
                  await fetch(`${BACKEND_URL}/api/media/publish-all/${monitorId}?tabName=${encodeURIComponent(tabName)}`, { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user?.id?.toString() }) // <--- HIER eingefügt
                  });
                  
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
            {hasPermission('media.upload') && (
            <button 
              onClick={() => { resetForm(); setView('form'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', background: colors.primary, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: 'transform 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <Plus size={18} /> Neues Event
            </button>
            )}
          </div>
        </div>

        {/* EVENT-LISTE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', backgroundColor: colors.card, borderRadius: '16px', border: `1px dashed ${colors.border}`, transition: 'all 0.3s ease' }}>
              <CalendarDays size={48} color={colors.textSub} style={{ marginBottom: '16px', margin: '0 auto', opacity: 0.3 }} />
              <div style={{ color: colors.textSub }}>Noch keine Events vorhanden.</div>
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
                  display: 'flex', alignItems: 'center', backgroundColor: colors.card, 
                  border: isExpired ? `1px dashed ${colors.border}` : `1px solid ${colors.border}`, // Gestrichelt, wenn abgelaufen
                  borderRadius: '16px', padding: '16px', gap: '20px',
                  opacity: isExpired ? 0.4 : (isLive ? 1 : 0.8), // Abgelaufene sind stark transparent
                  filter: isExpired ? 'grayscale(100%)' : 'none', // NEU: Abgelaufene werden schwarz-weiß!
                  boxShadow: isDark ? 'none' : '0 2px 4px rgba(0,0,0,0.05)',
                  transition: 'all 0.3s'
                }}>
                  <div style={{ width: '120px', height: '80px', borderRadius: '10px', overflow: 'hidden', backgroundColor: colors.inputBg, flexShrink: 0 }}>
                    <img src={ev.url} alt="Event" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    {/* TITELZEILE & BADGE */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', color: colors.textMain, fontWeight: 600, textDecoration: isExpired ? 'line-through' : 'none' }}>
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
                    <div style={{ display: 'flex', gap: '16px', color: colors.textSub, fontSize: '13px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isToday && !isExpired ? colors.primary : colors.textSub, fontWeight: isToday && !isExpired ? 700 : 400 }}>
                        <CalendarDays size={14} color={isToday && !isExpired ? colors.primary : colors.textSub} /> 
                        {isToday ? "HEUTE" : new Date(ev.eventDate).toLocaleDateString('de-DE')}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: colors.textSub }}>
                        <Clock size={14} color={colors.textSub} /> {ev.eventTime || "---"}
                      </span>
                    </div>
                  </div>
                  
                  {/* ACTION BUTTONS */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {/* Raketen-Button (Versteckt, wenn das Event abgelaufen ist) */}
                    {!isExpired && hasPermission('media.publish') &&(
                      <button 
                        onClick={async () => {
                          await fetch(`${BACKEND_URL}/api/media/${ev.id}/publish-item`, { 
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: user?.id?.toString() }) // <--- HIER eingefügt
                          });
                          await onPublish(); 
                          await onRefresh(); 
                          setStatusMsg({ text: `"${ev.title}" live geschaltet!`, type: 'success' });
                        }}
                        style={{ background: isLive ? 'rgba(16, 185, 129, 0.2)' : colors.inputBg, border: isDark ? 'none' : `1px solid ${colors.border}`, color: isLive ? '#10b981' : colors.textSub, padding: '12px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseEnter={(e) => { if(!isLive) { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = '#fff'; } }}
                        onMouseLeave={(e) => { if(!isLive) { e.currentTarget.style.background = colors.inputBg; e.currentTarget.style.color = colors.textSub; } }}
                        title="Dieses Event sofort live schalten"
                      >
                        <Rocket size={18} />
                      </button>
                    )}
                  {hasPermission('media.upload') &&(
                  <button 
                    onClick={() => handleEditClick(ev)}
                    style={{ background: colors.inputBg, border: isDark ? 'none' : `1px solid ${colors.border}`, color: colors.textSub, padding: '12px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = colors.textMain; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = colors.inputBg; e.currentTarget.style.color = colors.textSub; }}
                    title="Bearbeiten"
                  >
                    <Edit3 size={18} />
                  </button>
                  )}
                  {hasPermission('media.delete') && (
                  <button 
                    onClick={() => onDelete(ev.id)}
                    style={{ background: colors.dangerBg, border: 'none', color: colors.dangerText, padding: '12px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = colors.dangerBg; e.currentTarget.style.color = colors.dangerText; }}
                    title="Löschen"
                  >
                    <Trash2 size={18} />
                  </button>
                  )}
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
    <div style={{ padding: '32px', color: colors.textMain, maxWidth: '600px', margin: '0 auto', transition: 'all 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <button onClick={handleBackClick} style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.textSub, cursor: 'pointer', padding: '10px', borderRadius: '10px', display: 'flex', transition: 'all 0.2s' }}
          onMouseEnter={(e) => e.currentTarget.style.color = colors.textMain}
          onMouseLeave={(e) => e.currentTarget.style.color = colors.textSub}
        >
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ margin: 0, fontSize: '24px', color: colors.textMain }}>{editingId ? 'Event bearbeiten' : 'Neues Event'}</h2>
      </div>

      <div style={{ backgroundColor: colors.card, padding: '28px', borderRadius: '20px', border: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', gap: '24px', boxShadow: isDark ? 'none' : '0 10px 30px rgba(0,0,0,0.05)', transition: 'all 0.3s ease' }}>
        
        {/* IMAGE UPLOAD (Im Bearbeiten-Modus gesperrt, um es simpel zu halten) */}
        <div>
          <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: colors.textSub, fontWeight: 700, letterSpacing: '1px' }}>TITELBILD</label>
          <input type="file" accept="image/*" onChange={handleImageChange} ref={fileInputRef} style={{ display: 'none' }} disabled={!!editingId} />
          <div 
            onClick={() => !editingId && fileInputRef.current?.click()}
            style={{ 
              width: '100%', height: previewUrl ? 'auto' : '180px', 
              background: colors.inputBg, border: previewUrl ? 'none' : `2px dashed ${isDark ? '#333' : '#d1d5db'}`, borderRadius: '14px', 
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
              cursor: editingId ? 'not-allowed' : 'pointer', overflow: 'hidden', position: 'relative', opacity: editingId ? 0.7 : 1,
              transition: 'all 0.3s ease'
            }}
          >
            {previewUrl ? (
              <img src={previewUrl} style={{ width: '100%', maxHeight: '300px', objectFit: 'cover' }} />
            ) : (
              <div style={{ color: colors.textSub, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <ImagePlus size={32} />
                <span style={{ fontSize: '13px' }}>Bild auswählen</span>
              </div>
            )}
            {/* Overlay-Text, wenn man bearbeitet */}
            {editingId && (
               <div style={{ position: 'absolute', inset: 0, backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                 <span style={{ fontSize: '12px', color: colors.textSub, backgroundColor: colors.card, padding: '6px 12px', borderRadius: '8px', border: `1px solid ${colors.border}` }}>Bild kann nicht nachträglich geändert werden.</span>
               </div>
            )}
          </div>
        </div>

        {/* TITLE INPUT */}
        <div>
          <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: colors.textSub, fontWeight: 700, letterSpacing: '1px' }}>EVENT-TITEL</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Was findet statt?" style={{ width: '100%', padding: '14px', background: colors.inputBg, border: `1px solid ${colors.border}`, borderRadius: '12px', color: colors.textMain, fontSize: '15px', outline: 'none', transition: 'all 0.3s ease' }} />
        </div>

        {/* DATE & TIME */}
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: colors.textSub, fontWeight: 700, letterSpacing: '1px' }}>DATUM</label>
            <div style={{ position: 'relative' }}>
              <CalendarDays size={18} color={colors.primary} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                className="date-time-input" 
                style={{cursor:'text', width: '100%', padding: '14px 14px 14px 44px', background: colors.inputBg, border: `1px solid ${colors.border}`, borderRadius: '12px', color: colors.textMain, fontSize: '15px', outline: 'none', colorScheme: isDark ? 'dark' : 'light', fontFamily: 'inherit', transition: 'all 0.3s ease' }} 
                onFocus={(e) => e.target.style.borderColor = colors.primary} 
                onBlur={(e) => e.target.style.borderColor = colors.border} 
              />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: colors.textSub, fontWeight: 700, letterSpacing: '1px' }}>UHRZEIT</label>
            <div style={{ position: 'relative' }}>
              <Clock size={18} color="#eab308" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input 
                type="time" 
                value={time} 
                onChange={(e) => setTime(e.target.value)} 
                className="date-time-input"
                style={{cursor:'text', width: '100%', padding: '14px 14px 14px 44px', background: colors.inputBg, border: `1px solid ${colors.border}`, borderRadius: '12px', color: colors.textMain, fontSize: '15px', outline: 'none', colorScheme: isDark ? 'dark' : 'light', fontFamily: 'inherit', transition: 'all 0.3s ease' }} 
                onFocus={(e) => e.target.style.borderColor = '#eab308'} 
                onBlur={(e) => e.target.style.borderColor = colors.border} 
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
          disabled={!hasPermission('media.upload')}
          style={{ 
            marginTop: '10px', padding: '16px', 
            background: hasPermission('media.upload') ? colors.primary : colors.textMuted, 
            color: '#fff', border: 'none', borderRadius: '12px', 
            cursor: hasPermission('media.upload') ? 'pointer' : 'not-allowed', 
            fontWeight: 700, fontSize: '15px', display: 'flex', 
            alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'background-color 0.2s',
            opacity: hasPermission('media.upload') ? 1 : 0.5
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.primaryHover}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primary}
        >
          <Upload size={18} /> 
          {hasPermission('media.upload') ? (editingId ? 'Änderungen speichern' : 'Event speichern') : 'Keine Berechtigung'}
        </button>
      </div>

      {/* EXIT MODAL */}
      {showExitModal && (
        <div style={{ position: 'fixed', inset: 0, background: colors.modalOverlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: colors.modalBg, padding: '32px', borderRadius: '24px', width: '400px', border: `1px solid ${colors.border}`, textAlign: 'center', boxShadow: isDark ? '0 20px 40px rgba(0,0,0,0.4)' : '0 20px 40px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 12px 0', color: colors.textMain }}>Nicht gespeichert!</h3>
            <p style={{ color: colors.textSub, fontSize: '14px', marginBottom: '24px' }}>Möchtest du die Änderungen vor dem Verlassen speichern?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button onClick={() => handleSave(true)} style={{ padding: '14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Send size={18} /> Speichern & Live schalten</button>
              <button onClick={() => handleSave(false)} style={{ padding: '14px', background: colors.primary, color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>Nur Speichern</button>
              <button onClick={() => { resetForm(); setView('list'); setShowExitModal(false); }} style={{ padding: '14px', background: 'transparent', color: colors.dangerText, border: `1px solid ${colors.border}`, borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>Verwerfen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
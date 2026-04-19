import React, { useState, useRef, useEffect } from 'react';
import { Plus,Upload, Rocket, ArrowLeft, Trash2, CalendarDays, ImagePlus, CheckCircle2, AlertCircle, Edit3, FileText } from 'lucide-react';
import { AuthProvider, useAuth } from '../context/AuthContext'; 
// 1. NEU: Strikte Typen für TypeScript
interface NewsEditorProps {
  monitorId: string;
  tabName: string;
  news: any[];
  onRefresh: () => Promise<void>;
  onDelete: (id: number) => void;
  onPublish: () => Promise<void>;
  globalTheme: 'dark' | 'light';
}

const BACKEND_URL = "http://localhost:5195";

export const NewsEditor: React.FC<NewsEditorProps> = ({ monitorId, tabName, news, onRefresh, onDelete, onPublish, globalTheme }) => {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<number | null>(null);
  const {user, hasPermission } = useAuth();
  // Formular States mit strikten Typen
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  // 2. NEU: Ref weiß jetzt, dass es ein Input-Feld ist
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (statusMsg) {
      const timer = setTimeout(() => setStatusMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMsg]);

  const resetForm = () => {
    setEditingId(null);
    setTitle(''); setContent(''); setExpiryDate(''); setSelectedImage(null); setPreviewUrl(null);
  };

  const handleEditClick = (item: any) => {
    setEditingId(item.id);
    setTitle(item.title || '');
    setContent(item.content || '');
    // Wenn in der DB "Immer" steht, lassen wir das Datumsfeld leer
    setExpiryDate(item.date === 'Immer' ? '' : item.date);
    setPreviewUrl(item.url);
    setView('form');
  };

  // 3. NEU: Saubere Funktion für den Datei-Upload
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    // Beim Neu-Erstellen ist ein Bild Pflicht
    if (!editingId && !selectedImage) {
        setStatusMsg({ text: "Bitte ein Titelbild auswählen!", type: 'error' });
        return;
    }
    if (!title || !content) {
        setStatusMsg({ text: "Bitte Titel und Nachrichtentext ausfüllen!", type: 'error' });
        return;
    }

    try {
      if (editingId) {
        // FALL A: Update einer bestehenden News
        // (Hinweis: Dazu müssen wir später in C# noch den Content ins Update aufnehmen!)
        const response = await fetch(`${BACKEND_URL}/api/media/update/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userId: user?.id?.toString(),
            title: title || '', 
            content: content || '', 
            expirationDate: expiryDate || 'Immer',
            eventDate: '', // <--- WICHTIG: Leeres Feld für C#
            eventTime: ''  // <--- WICHTIG: Leeres Feld für C#
          })
        });
        if (!response.ok) throw new Error("Fehler beim Update");

      } else {
        // FALL B: Neue News anlegen
        const formData = new FormData();
        formData.append('userId',user?.id?.toString() || '');
        if (selectedImage) formData.append('file', selectedImage);
        formData.append('monitorId', monitorId);
        formData.append('tabName', tabName);
        formData.append('title', title);
        formData.append('content', content);
        formData.append('expirationDate', expiryDate || 'Immer');
        formData.append('type', 'news');
        formData.append('duration', '15s');

        const response = await fetch(`${BACKEND_URL}/api/media/upload`, { method: 'POST', body: formData });
        if (!response.ok) throw new Error("Fehler beim Speichern");
      }

      await onRefresh();
      setStatusMsg({ text: "News erfolgreich gespeichert!", type: 'success' });
      resetForm();
      setView('list');
      
    } catch (e) {
      setStatusMsg({ text: "Fehler beim Speichern", type: 'error' });
    }
  };

  // 1. NEU: Dynamische Farben basierend auf globalTheme
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
    primaryHover: '#7a5bc7', // <-- Da ist die fehlende Farbe!
    dangerBg: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fee2e2',
    dangerText: '#ef4444'
  };

  if (view === 'list') {
    return (
      <div style={{ padding: '32px', color: colors.textMain, maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
        
        {/* STATUS TOAST */}
        {statusMsg && (
          <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 10000, backgroundColor: statusMsg.type === 'success' ? '#065f46' : '#991b1b', color: '#fff', padding: '12px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
            {statusMsg.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span style={{ fontSize: '14px', fontWeight: 500 }}>{statusMsg.text}</span>
          </div>
        )}

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', color: colors.textMain }}>News: {tabName}</h2>
            <p style={{ margin: 0, color: colors.textSub, fontSize: '14px' }}>{news.length} Nachrichten online</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            
            {/* DIE BUTTONS SIND WIEDER DA! */}
            {news.length > 0 && hasPermission('media.publish') && (
              <button 
                onClick={async () => {
                  await fetch(`${BACKEND_URL}/api/media/publish-all/${monitorId}?tabName=${encodeURIComponent(tabName)}`, 
                  { method: 'POST', 
                    headers: {'Content-Type':'application/json' },
                    body: JSON.stringify({ userId: user?.id?.toString() })
                  });
                  await onPublish();
                  await onRefresh();
                  setStatusMsg({ text: "Alle News in diesem Tab Live geschaltet!", type: 'success' });
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                <Rocket size={18} /> Alle Live schalten
              </button>
            )}

            {hasPermission('media.upload') && (
              <button 
                onClick={() => { resetForm(); setView('form'); }} 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', background: colors.primary, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                <Plus size={18} /> Neue Nachricht
              </button>
            )}

          </div>
        </div>

        {/* NEWS LISTE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {news.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', backgroundColor: colors.card, borderRadius: '16px', border: `1px dashed ${colors.border}` }}>
              <FileText size={48} color={colors.textSub} style={{ marginBottom: '16px', margin: '0 auto', opacity: 0.3 }} />
              <div style={{ color: colors.textSub }}>Noch keine News vorhanden.</div>
            </div>
          ) : (
            news.map((item) => {
              const isLive = item.isLive === 1;
              
              let isExpired = false;
              if (item.date && item.date !== 'Immer') {
                const cleanDateStr = item.date.replace('Bis ', '').trim();
                let expDate;
                if (cleanDateStr.includes('-')) expDate = new Date(`${cleanDateStr}T23:59:59`);
                else if (cleanDateStr.includes('.')) {
                  const [day, month, year] = cleanDateStr.split('.');
                  expDate = new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59);
                }
                if (expDate && !isNaN(expDate.getTime())) isExpired = expDate < new Date();
              }

              return (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', backgroundColor: colors.card, border: isExpired ? `1px dashed ${colors.border}` : `1px solid ${colors.border}`, borderRadius: '16px', padding: '16px', gap: '20px', opacity: isExpired ? 0.4 : 1, filter: isExpired ? 'grayscale(100%)' : 'none', boxShadow: isDark ? 'none' : '0 2px 4px rgba(0,0,0,0.05)' }}>
                  <div style={{ width: '120px', height: '80px', borderRadius: '10px', overflow: 'hidden', backgroundColor: colors.inputBg, flexShrink: 0 }}>
                    <img src={item.url} alt="News" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', color: colors.textMain, fontWeight: 600, textDecoration: isExpired ? 'line-through' : 'none' }}>{item.title || "Ohne Titel"}</h3>
                      
                      {isExpired ? (
                        <span style={{ backgroundColor: 'rgba(107, 114, 128, 0.1)', color: '#9ca3af', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', border: '1px solid rgba(107, 114, 128, 0.2)' }}>Abgelaufen</span>
                      ) : (
                        <span style={{ backgroundColor: isLive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: isLive ? '#10b981' : '#f59e0b', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', border: `1px solid ${isLive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}` }}>{isLive ? '● Live' : 'Entwurf'}</span>
                      )}
                    </div>
                    
                    <p style={{ margin: '0 0 10px 0', color: colors.textSub, fontSize: '13px', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.content || "Kein Textinhalt..."}
                    </p>

                    <div style={{ display: 'flex', gap: '16px', color: colors.textSub, fontSize: '12px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isExpired ? '#ef4444' : colors.textSub }}>
                        <CalendarDays size={14} /> {isExpired ? 'Frist abgelaufen' : `Anzeigen bis: ${item.date || 'Immer'}`}
                      </span>
                    </div>
                  </div>
                  
                  {/* AUCH DIE ACTION BUTTONS SIND WIEDER DA! */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {!isExpired && hasPermission('media.publish') && (
                      <button 
                        onClick={async () => {
                          await fetch(`${BACKEND_URL}/api/media/${item.id}/publish-item`, 
                            { method: 'POST', 
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ userId: user?.id?.toString() })
                            });
                          await onPublish(); await onRefresh(); 
                          setStatusMsg({ text: `News live geschaltet!`, type: 'success' });
                        }}
                        style={{ background: isLive ? 'rgba(16, 185, 129, 0.2)' : colors.inputBg, border: 'none', color: isLive ? '#10b981' : colors.textSub, padding: '12px', borderRadius: '12px', cursor: 'pointer' }}
                        title="Sofort live schalten"
                      >
                        <Rocket size={18} />
                      </button>
                    )}

                    {hasPermission('media.upload') && (
                      <button 
                        onClick={() => handleEditClick(item)} 
                        style={{ background: colors.inputBg, border: 'none', color: colors.textSub, padding: '12px', borderRadius: '12px', cursor: 'pointer' }} 
                        title="Bearbeiten"
                      >
                        <Edit3 size={18} />
                      </button>
                    )}

                    {hasPermission('media.delete') && (
                      <button 
                        onClick={() => onDelete(item.id)} 
                        style={{ background: colors.dangerBg, border: 'none', color: colors.dangerText, padding: '12px', borderRadius: '12px', cursor: 'pointer' }} 
                        title="Löschen"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', color: colors.textMain, maxWidth: '600px', margin: '0 auto', transition: 'all 0.3s ease' }}>
      
      {/* HEADER BEREICH */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <button onClick={() => setView('list')} style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.textSub, cursor: 'pointer', padding: '10px', borderRadius: '10px', display: 'flex', transition: 'all 0.2s' }}
         onMouseEnter={(e) => e.currentTarget.style.color = colors.textMain}
         onMouseLeave={(e) => e.currentTarget.style.color = colors.textSub}
        >
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ margin: 0, fontSize: '24px', color: colors.textMain }}>{editingId ? 'News bearbeiten' : 'Neue Nachricht'}</h2>
      </div>

      <div style={{ backgroundColor: colors.card, padding: '28px', borderRadius: '20px', border: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', gap: '24px', boxShadow: isDark ? 'none' : '0 10px 30px rgba(0,0,0,0.05)', transition: 'all 0.3s ease' }}>
        
        {/* TITELBILD */}
        <div>
          <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: colors.textSub, fontWeight: 700, letterSpacing: '1px' }}>TITELBILD</label>
          <input type="file" accept="image/*" onChange={handleImageChange} ref={fileInputRef} style={{ display: 'none' }} disabled={!!editingId} />
          
          <div 
            onClick={() => !editingId && fileInputRef.current?.click()}
            style={{ 
              width: '100%', 
              height: previewUrl ? 'auto' : '180px', 
              background: colors.inputBg, 
              border: previewUrl ? 'none' : `2px dashed ${isDark ? '#333' : '#d1d5db'}`,
              borderRadius: '14px', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              cursor: editingId ? 'not-allowed' : 'pointer', 
              overflow: 'hidden', 
              position: 'relative', 
              opacity: editingId ? 0.7 : 1,
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
            
            {/* Overlay wenn man bearbeitet (Bild gesperrt) */}
            {editingId && (
              <div style={{ position: 'absolute', inset: 0, backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <span style={{ fontSize: '12px', color: colors.textSub, backgroundColor: colors.card, padding: '6px 12px', borderRadius: '8px', border: `1px solid ${colors.border}` }}>
                  Bild kann nicht nachträglich geändert werden.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* SCHLAGZEILE */}
        <div>
          <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: colors.textSub, fontWeight: 700, letterSpacing: '1px' }}>SCHLAGZEILE</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Worum geht's?" style={{ width: '100%', padding: '14px', background: colors.inputBg, border: `1px solid ${colors.border}`, borderRadius: '12px', color: colors.textMain, fontSize: '15px', outline: 'none', transition: 'all 0.3s ease' }} />
        </div>

        {/* TEXTINHALT (TEXTAREA) */}
        <div>
          <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: colors.textSub, fontWeight: 700, letterSpacing: '1px' }}>NACHRICHT (TEXT)</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Hier kommt die eigentliche Information rein..." style={{ width: '100%', height: '150px', padding: '14px', background: colors.inputBg, border: `1px solid ${colors.border}`, borderRadius: '12px', color: colors.textMain, fontSize: '15px', outline: 'none', resize: 'none', fontFamily: 'inherit', transition: 'all 0.3s ease' }} />
        </div>

        {/* ABLAUFDATUM */}
        <div>
          <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: colors.textSub, fontWeight: 700, letterSpacing: '1px' }}>ANZEIGEN BIS (Optional)</label>
          <div style={{ position: 'relative' }}>
            <CalendarDays size={18} color={colors.primary} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="date-time-input" style={{ cursor: 'pointer', width: '100%', padding: '14px 14px 14px 44px', background: colors.inputBg, border: `1px solid ${colors.border}`, borderRadius: '12px', color: colors.textMain, fontSize: '15px', outline: 'none', colorScheme: isDark ? 'dark' : 'light', fontFamily: 'inherit', transition: 'all 0.3s ease' }} />
          </div>
        </div>

        <button 
          onClick={handleSave} 
          disabled={!hasPermission('media.upload')}
          style={{ 
            marginTop: '10px', padding: '16px', 
            background: hasPermission('media.upload') ? colors.primary : colors.textMuted, 
            color: '#fff', border: 'none', borderRadius: '12px', 
            cursor: hasPermission('media.upload') ? 'pointer' : 'not-allowed', 
            fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', 
            justifyContent: 'center', gap: '10px', transition: 'background-color 0.2s',
            opacity: hasPermission('media.upload') ? 1 : 0.5
          }}
          onMouseEnter={(e) => { if(hasPermission('media.upload')) e.currentTarget.style.backgroundColor = colors.primaryHover || '#7a5bc7'; }}
          onMouseLeave={(e) => { if(hasPermission('media.upload')) e.currentTarget.style.backgroundColor = colors.primary; }}
        >
          <Upload size={18} /> 
          {hasPermission('media.upload') ? (editingId ? 'Änderungen speichern' : 'News veröffentlichen') : 'Keine Berechtigung'}
        </button>

      </div>
      <style>{`.date-time-input::-webkit-calendar-picker-indicator { cursor: pointer; }`}</style>
    </div>
  );
};
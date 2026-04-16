import React, { useState, useRef, useEffect } from 'react';
import { Plus,Upload, Rocket, ArrowLeft, Trash2, CalendarDays, ImagePlus, CheckCircle2, AlertCircle, Edit3, FileText } from 'lucide-react';

// 1. NEU: Strikte Typen für TypeScript
interface NewsEditorProps {
  monitorId: string;
  tabName: string;
  news: any[];
  onRefresh: () => Promise<void>;
  onDelete: (id: number) => void;
  onPublish: () => Promise<void>;
}

const BACKEND_URL = "http://localhost:5195";

export const NewsEditor: React.FC<NewsEditorProps> = ({ monitorId, tabName, news, onRefresh, onDelete, onPublish }) => {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<number | null>(null);
  
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

  if (view === 'list') {
    return (
      <div style={{ padding: '32px', color: '#fff', maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
        
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
            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>News: {tabName}</h2>
            <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>{news.length} Nachrichten online</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            
            {/* ALLE LIVE SCHALTEN BUTTON */}
            {news.length > 0 && (
              <button 
                onClick={async () => {
                  await fetch(`${BACKEND_URL}/api/media/publish-all/${monitorId}?tabName=${encodeURIComponent(tabName)}`, { method: 'POST' });
                  await onPublish();
                  await onRefresh();
                  setStatusMsg({ text: "Alle News in diesem Tab Live geschaltet!", type: 'success' });
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                <Rocket size={18} /> Alle Live schalten
              </button>
            )}

            <button onClick={() => { resetForm(); setView('form'); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', background: '#8a6ce0', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
              <Plus size={18} /> Neue Nachricht
            </button>
          </div>
        </div>

        {/* NEWS LISTE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {news.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', backgroundColor: '#1e1e1e', borderRadius: '16px', border: '1px dashed #333' }}>
              <FileText size={48} color="#444" style={{ marginBottom: '16px', margin: '0 auto' }} />
              <div style={{ color: '#888' }}>Noch keine News vorhanden.</div>
            </div>
          ) : (
            news.map((item) => {
              const isLive = item.isLive === 1;
              
              // Ablauf-Logik für News
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
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', backgroundColor: '#1e1e1e', border: isExpired ? '1px dashed #333' : '1px solid #333', borderRadius: '16px', padding: '16px', gap: '20px', opacity: isExpired ? 0.4 : 1, filter: isExpired ? 'grayscale(100%)' : 'none' }}>
                  <div style={{ width: '120px', height: '80px', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#111', flexShrink: 0 }}>
                    <img src={item.url} alt="News" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', color: '#fff', fontWeight: 600, textDecoration: isExpired ? 'line-through' : 'none' }}>{item.title || "Ohne Titel"}</h3>
                      
                      {isExpired ? (
                        <span style={{ backgroundColor: 'rgba(107, 114, 128, 0.1)', color: '#9ca3af', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', border: '1px solid rgba(107, 114, 128, 0.2)' }}>Abgelaufen</span>
                      ) : (
                        <span style={{ backgroundColor: isLive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: isLive ? '#10b981' : '#f59e0b', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', border: `1px solid ${isLive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}` }}>{isLive ? '● Live' : 'Entwurf'}</span>
                      )}
                    </div>
                    
                    {/* Text-Vorschau */}
                    <p style={{ margin: '0 0 10px 0', color: '#aaa', fontSize: '13px', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.content || "Kein Textinhalt..."}
                    </p>

                    <div style={{ display: 'flex', gap: '16px', color: '#888', fontSize: '12px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isExpired ? '#ef4444' : '#888' }}>
                        <CalendarDays size={14} /> {isExpired ? 'Frist abgelaufen' : `Anzeigen bis: ${item.date || 'Immer'}`}
                      </span>
                    </div>
                  </div>
                  
                  {/* ACTION BUTTONS */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {!isExpired && (
                      <button 
                        onClick={async () => {
                          await fetch(`${BACKEND_URL}/api/media/${item.id}/publish-item`, { method: 'POST' });
                          await onPublish(); await onRefresh(); 
                          setStatusMsg({ text: `News live geschaltet!`, type: 'success' });
                        }}
                        style={{ background: isLive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)', border: 'none', color: isLive ? '#10b981' : '#666', padding: '12px', borderRadius: '12px', cursor: 'pointer' }}
                        title="Sofort live schalten"
                      >
                        <Rocket size={18} />
                      </button>
                    )}

                    <button onClick={() => handleEditClick(item)} style={{ background: 'rgba(255, 255, 255, 0.05)', border: 'none', color: '#aaa', padding: '12px', borderRadius: '12px', cursor: 'pointer' }} title="Bearbeiten">
                      <Edit3 size={18} />
                    </button>

                    <button onClick={() => onDelete(item.id)} style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', padding: '12px', borderRadius: '12px', cursor: 'pointer' }} title="Löschen">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // FORMULAR ANSICHT
  return (
    <div style={{ padding: '32px', color: '#fff', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <button onClick={() => setView('list')} style={{ background: '#252525', border: '1px solid #333', color: '#aaa', cursor: 'pointer', padding: '10px', borderRadius: '10px', display: 'flex' }}>
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ margin: 0, fontSize: '24px' }}>{editingId ? 'News bearbeiten' : 'Neue Nachricht'}</h2>
      </div>

      <div style={{ backgroundColor: '#1e1e1e', padding: '28px', borderRadius: '20px', border: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* TITELBILD */}
        <div>
          <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: '#666', fontWeight: 700, letterSpacing: '1px' }}>TITELBILD</label>
          <input type="file" accept="image/*" onChange={handleImageChange} ref={fileInputRef} style={{ display: 'none' }} disabled={!!editingId} />
          <div 
            onClick={() => !editingId && fileInputRef.current?.click()}
            style={{ width: '100%', height: previewUrl ? 'auto' : '180px', background: '#141414', border: previewUrl ? 'none' : '2px dashed #333', borderRadius: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: editingId ? 'not-allowed' : 'pointer', overflow: 'hidden', position: 'relative', opacity: editingId ? 0.7 : 1 }}
          >
            {previewUrl ? <img src={previewUrl} style={{ width: '100%', maxHeight: '300px', objectFit: 'cover' }} /> : <div style={{ color: '#444', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}><ImagePlus size={32} /><span style={{ fontSize: '13px' }}>Bild auswählen</span></div>}
            {editingId && <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><span style={{ fontSize: '12px', color: '#aaa', backgroundColor: '#111', padding: '6px 12px', borderRadius: '8px' }}>Bild kann nicht nachträglich geändert werden.</span></div>}
          </div>
        </div>

        {/* SCHLAGZEILE */}
        <div>
          <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: '#666', fontWeight: 700, letterSpacing: '1px' }}>SCHLAGZEILE</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Worum geht's?" style={{ width: '100%', padding: '14px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '12px', color: '#fff', fontSize: '15px', outline: 'none' }} />
        </div>

        {/* TEXTINHALT (TEXTAREA) */}
        <div>
          <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: '#666', fontWeight: 700, letterSpacing: '1px' }}>NACHRICHT (TEXT)</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Hier kommt die eigentliche Information rein..." style={{ width: '100%', height: '150px', padding: '14px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '12px', color: '#fff', fontSize: '15px', outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
        </div>

        {/* ABLAUFDATUM */}
        <div>
          <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: '#666', fontWeight: 700, letterSpacing: '1px' }}>ANZEIGEN BIS (Optional)</label>
          <div style={{ position: 'relative' }}>
            <CalendarDays size={18} color="#8a6ce0" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="date-time-input" style={{ cursor: 'pointer', width: '100%', padding: '14px 14px 14px 44px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '12px', color: '#fff', fontSize: '15px', outline: 'none', colorScheme: 'dark', fontFamily: 'inherit' }} />
          </div>
        </div>

        <button onClick={handleSave} style={{ marginTop: '10px', padding: '16px', background: '#8a6ce0', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <Upload size={18} /> {editingId ? 'Änderungen speichern' : 'News veröffentlichen'}
        </button>

      </div>
      <style>{`.date-time-input::-webkit-calendar-picker-indicator { cursor: pointer; }`}</style>
    </div>
  );
};
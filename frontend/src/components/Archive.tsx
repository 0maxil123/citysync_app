import React, { useState, useEffect } from 'react';
import { Search, Download, Trash2, FileText, CalendarDays, Hash, Tag, Archive as ArchiveIcon, Filter, Edit3, Loader2, X, Lock } from 'lucide-react';
import jsPDF from 'jspdf';
import { useAuth } from '../context/AuthContext';
interface ArchiveProps {
  monitorId?: string;
  globalTheme: 'dark' | 'light';
}

const BACKEND_URL = "http://localhost:5195";

export const Archive: React.FC<ArchiveProps> = ({ monitorId, globalTheme }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Alle');
  const [archivedDocs, setArchivedDocs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const {user, hasPermission} = useAuth();

  // --- NEUE STATES FÜR MODALS ---
  const [pinDialog, setPinDialog] = useState<{ isOpen: boolean, item: any, action: 'restore' | 'delete' | null }>({ isOpen: false, item: null, action: null });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  
  const [restoreDialog, setRestoreDialog] = useState<{ isOpen: boolean, item: any }>({ isOpen: false, item: null });
  const [newEndDate, setNewEndDate] = useState('');

  const fetchArchive = async () => {
    setIsLoading(true);
    try {
      // Wenn du userId im Backend für GET nicht prüfst, kannst du das "?userId=..." auch weglassen.
      const url = monitorId ? `${BACKEND_URL}/api/media/archive/${monitorId}` : `${BACKEND_URL}/api/media/archive`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setArchivedDocs(data);
      }
    } catch (error) {
      console.error("Fehler beim Laden", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchArchive(); }, [monitorId]);

  // --- 1. FUNKTION: PDF MIT STEMPEL GENERIEREN ---
  const handleDownloadPDF = async (doc: any) => {
    try {
      // 1. Bild vom Server laden
      const res = await fetch(`${BACKEND_URL}${doc.url}`);
      const blob = await res.blob();
      const imgDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      // 2. PDF erstellen
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Bild formatfüllend einsetzen
      pdf.addImage(imgDataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight);

      // 3. Den offiziellen Abnahme-Stempel draufsetzen!
      const cleanEndDate = doc.endDate ? doc.endDate.split(' ')[0] : 'Unbekannt';
      
      pdf.setFillColor(220, 38, 38, 0.1); // Leichter roter Hintergrund
      pdf.rect(pdfWidth - 260, pdfHeight - 100, 240, 60, 'F');
      pdf.setDrawColor(220, 38, 38);
      pdf.setLineWidth(2);
      pdf.rect(pdfWidth - 260, pdfHeight - 100, 240, 60, 'S'); // Roter Rahmen
      
      pdf.setTextColor(220, 38, 38);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("OFFIZIELL ABGENOMMEN AM:", pdfWidth - 250, pdfHeight - 75);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text(cleanEndDate, pdfWidth - 140, pdfHeight - 55, { align: 'center' });

      // 4. Download starten
      pdf.save(`Archiv_${doc.title.replace(/[^a-z0-9]/gi, '_')}.pdf`);

    } catch (e) {
      alert("Fehler beim Erstellen des PDFs.");
      console.error(e);
    }
  };

  // --- 2. FUNKTION: ENDGÜLTIG LÖSCHEN ---
  const executeDelete = async (id: number) => {
    try {
      // HIER: ?userId=${user?.id} hinzugefügt
      const response = await fetch(`${BACKEND_URL}/api/media/archive/${id}?userId=${user?.id}`, { 
        method: 'DELETE' 
      });
      
      if(response.ok) {
        fetchArchive(); // Liste aktualisieren
      } else {
        console.error("Löschen fehlgeschlagen", await response.text());
        alert("Fehler: Keine Berechtigung oder Datei nicht gefunden.");
      }
    } catch (e) { 
      console.error("Fehler beim Löschen", e); 
    }
  };

  // --- 3. FUNKTION: WIEDERHERSTELLEN (RESTORE) ---
  const executeRestore = async () => {
    if (!newEndDate) { alert("Bitte ein neues Ablaufdatum wählen!"); return; }
    try {
      const response = await fetch(`${BACKEND_URL}/api/media/archive/restore/${restoreDialog.item.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // HIER: userId hinzugefügt
        body: JSON.stringify({ 
          userId: user?.id?.toString(), // Wichtig: Als String oder Zahl, je nach Backend DTO
          newEndDate: newEndDate 
        })
      });
      
      if(response.ok) {
        setRestoreDialog({ isOpen: false, item: null });
        setNewEndDate('');
        fetchArchive();
      } else {
        console.error("Wiederherstellen fehlgeschlagen", await response.text());
        alert("Fehler: Keine Berechtigung oder Serverfehler.");
      }
    } catch (e) { 
      console.error("Fehler beim Wiederherstellen", e); 
    }
  };

  // --- PIN LOGIK ---
  const handlePinSubmit = () => {
    if (pinInput === pinDialog.item?.pinCode) {
      const { action, item } = pinDialog;
      setPinDialog({ isOpen: false, item: null, action: null });
      setPinInput('');
      
      if (action === 'delete') {
        if (window.confirm("PIN korrekt. Dokument jetzt unwiderruflich löschen?")) executeDelete(item.id);
      }
      if (action === 'restore') {
        setRestoreDialog({ isOpen: true, item: item });
      }
    } else {
      setPinError(true);
    }
  };

  const filteredDocs = archivedDocs.filter(doc => {
    const matchesCategory = selectedCategory === 'Alle' || doc.category === selectedCategory;
    const searchLower = searchTerm.toLowerCase();
    const title = doc.title ? doc.title.toLowerCase() : '';
    const docNum = doc.docNumber ? doc.docNumber.toLowerCase() : '';
    return matchesCategory && (title.includes(searchLower) || docNum.includes(searchLower));
  });

  // --- FARB-LOGIK FÜR ARCHIV ---
  const isDark = globalTheme === 'dark';
  const colors = {
    card: isDark ? '#1e1e1e' : '#ffffff',
    inputBg: isDark ? '#111111' : '#f9fafb',
    textMain: isDark ? '#ffffff' : '#111827',
    textSub: isDark ? '#888888' : '#6b7280',
    textMuted: isDark ? '#aaaaaa' : '#9ca3af',
    border: isDark ? '#333333' : '#e5e7eb',
    primary: '#8a6ce0',
    dangerBg: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fee2e2',
    dangerBorder: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fca5a5',
    dangerText: '#ef4444',
    modalOverlay: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)',
    modalBg: isDark ? '#1e1e1e' : '#ffffff',
    btnSecondaryBg: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6',
    btnCancel: isDark ? '#2a2a2a' : '#e5e7eb',
    imgPlaceholder: isDark ? '#ffffff' : '#e5e7eb',
  };

  return (
    <div style={{ padding: '40px', color: colors.textMain, maxWidth: '1200px', margin: '0 auto', position: 'relative', transition: 'all 0.3s ease' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '50px', height: '50px', background: 'rgba(138, 108, 224, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArchiveIcon size={28} color={colors.primary} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: colors.textMain }}>Archive Explorer</h1>
            <p style={{ margin: '4px 0 0 0', color: colors.textSub, fontSize: '14px' }}>Alle abgelaufenen und aufbewahrten Dokumente ({filteredDocs.length} Treffer)</p>
          </div>
        </div>
      </div>

      {/* FILTER & SUCHE */}
      <div style={{ backgroundColor: colors.card, padding: '16px', borderRadius: '16px', border: `1px solid ${colors.border}`, marginBottom: '24px', display: 'flex', gap: '16px', boxShadow: isDark ? 'none' : '0 2px 10px rgba(0,0,0,0.02)', transition: 'all 0.3s ease' }}>
        <div style={{ flex: 2, position: 'relative' }}>
          <Search size={20} color={colors.textSub} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" placeholder="Durchsuche Archive..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '16px 16px 16px 48px', background: colors.inputBg, border: `1px solid ${colors.border}`, borderRadius: '12px', color: colors.textMain, fontSize: '15px', outline: 'none', transition: 'all 0.3s ease' }} />
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <Filter size={20} color={colors.primary} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} style={{ width: '100%', padding: '16px 16px 16px 48px', background: colors.inputBg, border: `1px solid ${colors.border}`, borderRadius: '12px', color: colors.textMain, fontSize: '15px', outline: 'none', appearance: 'none', cursor: 'pointer', transition: 'all 0.3s ease' }}>
            <option value="Alle">Alle Kategorien</option>
            <option value="Kundmachung">Kundmachungen</option>
            <option value="Verordnung">Verordnungen</option>
            <option value="Bauverhandlung">Bauverhandlung</option>
            <option value="Stellenausschreibung">Stellenausschreibung</option>
          </select>
        </div>
      </div>

      {/* LISTE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredDocs.map(doc => {
          const cleanStartDate = doc.startDate ? doc.startDate.split(' ')[0] : 'Unbekannt';
          const cleanEndDate = doc.endDate ? doc.endDate.split(' ')[0] : 'Unbekannt';

          return (
            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', backgroundColor: colors.card, padding: '20px 24px', borderRadius: '16px', border: `1px solid ${colors.border}`, boxShadow: isDark ? 'none' : '0 2px 4px rgba(0,0,0,0.02)', transition: 'all 0.3s ease' }}>
              <div style={{ flex: 2, display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ width: '40px', height: '55px', background: colors.imgPlaceholder, borderRadius: '6px', overflow: 'hidden', flexShrink: 0, border: isDark ? 'none' : `1px solid ${colors.border}` }}>
                  <img src={`${BACKEND_URL}${doc.url}`} alt="Vorschau" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 600, color: colors.textMain }}>{doc.title}</h3>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: colors.textMuted }}><Hash size={14} /> {doc.docNumber || 'Keine Nummer'}</span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: '13px', color: colors.textMuted, marginBottom: '4px' }}><span style={{ width: '40px', display: 'inline-block', color: colors.textSub }}>Von:</span> {cleanStartDate}</span>
                <span style={{ display: 'block', fontSize: '13px', color: colors.textMuted }}><span style={{ width: '40px', display: 'inline-block', color: colors.textSub }}>Bis:</span> {cleanEndDate}</span>
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(138, 108, 224, 0.1)', color: colors.primary, borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}><Tag size={14} /> {doc.category || 'Dokument'}</span>
              </div>

              {/* DIE ECHTEN BUTTONS */}
              <div style={{ width: '160px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              
              {/* BEARBEITEN / WIEDERHERSTELLEN */}
              <button 
                onClick={() => hasPermission('media.upload') && (doc.isProtected === 1 ? setPinDialog({ isOpen: true, item: doc, action: 'restore' }) : setRestoreDialog({ isOpen: true, item: doc }))}
                disabled={!hasPermission('media.upload')}
                style={{ 
                  background: colors.btnSecondaryBg, 
                  border: `1px solid ${colors.border}`, 
                  color: colors.textMuted, 
                  padding: '10px', 
                  borderRadius: '10px', 
                  cursor: hasPermission('media.upload') ? 'pointer' : 'not-allowed', 
                  transition: 'all 0.2s',
                  opacity: hasPermission('media.upload') ? 1 : 0.4 
                }} 
                title={hasPermission('media.upload') ? "Ablaufdatum korrigieren" : "Keine Berechtigung"}
                onMouseEnter={(e) => { if(hasPermission('media.upload')) e.currentTarget.style.color = colors.textMain; }}
                onMouseLeave={(e) => { if(hasPermission('media.upload')) e.currentTarget.style.color = colors.textMuted; }}
              >
                <Edit3 size={18} />
              </button>

              {/* DOWNLOAD (Immer erlaubt) */}
              <button 
                onClick={() => handleDownloadPDF(doc)}
                style={{ 
                  background: colors.btnSecondaryBg, border: `1px solid ${colors.border}`, 
                  color: colors.textMain, padding: '10px', borderRadius: '10px', 
                  cursor: 'pointer', transition: 'all 0.2s' 
                }} 
                title="Als PDF herunterladen"
                onMouseEnter={(e) => { e.currentTarget.style.background = colors.primary; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = colors.primary; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = colors.btnSecondaryBg; e.currentTarget.style.color = colors.textMain; e.currentTarget.style.borderColor = colors.border; }}
              >
                <Download size={18} />
              </button>

              {/* LÖSCHEN */}
              <button 
                onClick={() => hasPermission('media.delete') && (doc.isProtected === 1 ? setPinDialog({ isOpen: true, item: doc, action: 'delete' }) : (window.confirm(`WIRKLICH endgültig löschen?`) && executeDelete(doc.id)))}
                disabled={!hasPermission('media.delete')}
                style={{ 
                  background: colors.dangerBg, 
                  border: `1px solid ${colors.dangerBorder}`, 
                  color: colors.dangerText, 
                  padding: '10px', 
                  borderRadius: '10px', 
                  cursor: hasPermission('media.delete') ? 'pointer' : 'not-allowed', 
                  transition: 'all 0.2s',
                  opacity: hasPermission('media.delete') ? 1 : 0.4
                }} 
                title={hasPermission('media.delete') ? "Endgültig löschen" : "Keine Berechtigung"}
                onMouseEnter={(e) => { if(hasPermission('media.delete')) { e.currentTarget.style.background = colors.dangerText; e.currentTarget.style.color = '#fff'; } }}
                onMouseLeave={(e) => { if(hasPermission('media.delete')) { e.currentTarget.style.background = colors.dangerBg; e.currentTarget.style.color = colors.dangerText; } }}
              >
                <Trash2 size={18} />
              </button>
            </div>
            </div>
          );
        })}
      </div>

      {/* --- OVERLAYS / MODALS --- */}
      {/* 1. PIN MODAL */}
      {pinDialog.isOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: colors.modalOverlay, backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: colors.modalBg, padding: '32px', borderRadius: '24px', border: `1px solid ${colors.border}`, textAlign: 'center', position: 'relative', boxShadow: isDark ? '0 20px 40px rgba(0,0,0,0.4)' : '0 20px 40px rgba(0,0,0,0.1)' }}>
            <button onClick={() => setPinDialog({ isOpen: false, item: null, action: null })} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: colors.textSub, cursor: 'pointer' }}><X size={20} /></button>
            <Lock size={28} color="#eab308" style={{ margin: '0 auto 20px' }} />
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', color: colors.textMain }}>Dokument geschützt</h3>
            <p style={{ margin: '0 0 24px 0', color: colors.textSub, fontSize: '14px' }}>PIN eingeben, um das Archiv-Dokument zu {pinDialog.action === 'restore' ? 'bearbeiten' : 'löschen'}.</p>
            <input type="password" maxLength={4} autoFocus value={pinInput} onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, '')); setPinError(false); }} onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()} placeholder="****" style={{ width: '100%', textAlign: 'center', letterSpacing: '12px', padding: '16px', backgroundColor: colors.inputBg, border: pinError ? '1px solid #ef4444' : `1px solid ${colors.border}`, borderRadius: '12px', color: colors.textMain, fontSize: '28px', outline: 'none', marginBottom: '12px' }} />
            {pinError && <p style={{ color: '#ef4444', fontSize: '13px' }}>Falscher PIN.</p>}
            <button onClick={handlePinSubmit} style={{ width: '100%', padding: '14px', backgroundColor: '#eab308', color: '#000', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 700 }}>Entsperren</button>
          </div>
        </div>
      )}

      {/* 2. DATUM WIEDERHERSTELLEN MODAL */}
      {restoreDialog.isOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: colors.modalOverlay, backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: colors.modalBg, padding: '32px', borderRadius: '24px', border: `1px solid ${colors.border}`, width: '360px', boxShadow: isDark ? '0 20px 40px rgba(0,0,0,0.4)' : '0 20px 40px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', color: colors.textMain }}>Neues Ablaufdatum</h3>
            <p style={{ margin: '0 0 24px 0', color: colors.textSub, fontSize: '14px' }}>Wähle ein neues Datum, um das Dokument wieder auf die Monitore zu schicken.</p>
            <input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} style={{ width: '100%', padding: '14px', background: colors.inputBg, border: `1px solid ${colors.border}`, borderRadius: '12px', color: colors.textMain, fontSize: '15px', outline: 'none', marginBottom: '24px', colorScheme: isDark ? 'dark' : 'light' }} />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setRestoreDialog({ isOpen: false, item: null })} style={{ flex: 1, padding: '14px', backgroundColor: colors.btnCancel, color: colors.textMain, border: 'none', borderRadius: '12px', cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={executeRestore} style={{ flex: 1, padding: '14px', backgroundColor: colors.primary, color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 700 }}>Aktivieren</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
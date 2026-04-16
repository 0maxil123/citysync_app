import React, { useState, useEffect } from 'react';
import { Search, Download, Trash2, FileText, CalendarDays, Hash, Tag, Archive as ArchiveIcon, Filter, Edit3, Loader2, X, Lock } from 'lucide-react';
import jsPDF from 'jspdf';

interface ArchiveProps {
  monitorId?: string;
}

const BACKEND_URL = "http://localhost:5195";

export const Archive: React.FC<ArchiveProps> = ({ monitorId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Alle');
  const [archivedDocs, setArchivedDocs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- NEUE STATES FÜR MODALS ---
  const [pinDialog, setPinDialog] = useState<{ isOpen: boolean, item: any, action: 'restore' | 'delete' | null }>({ isOpen: false, item: null, action: null });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  
  const [restoreDialog, setRestoreDialog] = useState<{ isOpen: boolean, item: any }>({ isOpen: false, item: null });
  const [newEndDate, setNewEndDate] = useState('');

  const fetchArchive = async () => {
    setIsLoading(true);
    try {
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
      await fetch(`${BACKEND_URL}/api/media/archive/${id}`, { method: 'DELETE' });
      fetchArchive(); // Liste aktualisieren
    } catch (e) { console.error("Fehler beim Löschen", e); }
  };

  // --- 3. FUNKTION: WIEDERHERSTELLEN (RESTORE) ---
  const executeRestore = async () => {
    if (!newEndDate) { alert("Bitte ein neues Ablaufdatum wählen!"); return; }
    try {
      await fetch(`${BACKEND_URL}/api/media/archive/restore/${restoreDialog.item.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEndDate })
      });
      setRestoreDialog({ isOpen: false, item: null });
      setNewEndDate('');
      fetchArchive();
    } catch (e) { console.error("Fehler beim Wiederherstellen", e); }
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

  return (
    <div style={{ padding: '40px', color: '#fff', maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
      
      {/* ... DEIN HEADER UND DEINE SUCHLEISTE (BLEIBEN UNVERÄNDERT) ... */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '50px', height: '50px', background: 'rgba(138, 108, 224, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArchiveIcon size={28} color="#8a6ce0" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>Archive Explorer</h1>
            <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '14px' }}>Alle abgelaufenen und aufbewahrten Dokumente ({filteredDocs.length} Treffer)</p>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: '#1e1e1e', padding: '16px', borderRadius: '16px', border: '1px solid #333', marginBottom: '24px', display: 'flex', gap: '16px' }}>
        <div style={{ flex: 2, position: 'relative' }}>
          <Search size={20} color="#666" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" placeholder="Durchsuche Archive..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '16px 16px 16px 48px', background: '#111', border: '1px solid #333', borderRadius: '12px', color: '#fff', fontSize: '15px', outline: 'none' }} />
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <Filter size={20} color="#8a6ce0" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} style={{ width: '100%', padding: '16px 16px 16px 48px', background: '#111', border: '1px solid #333', borderRadius: '12px', color: '#fff', fontSize: '15px', outline: 'none', appearance: 'none', cursor: 'pointer' }}>
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
            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', backgroundColor: '#1e1e1e', padding: '20px 24px', borderRadius: '16px', border: '1px solid #333' }}>
              <div style={{ flex: 2, display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ width: '40px', height: '55px', background: '#fff', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
                  <img src={`${BACKEND_URL}${doc.url}`} alt="Vorschau" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 600, color: '#fff' }}>{doc.title}</h3>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#aaa' }}><Hash size={14} /> {doc.docNumber || 'Keine Nummer'}</span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: '13px', color: '#aaa', marginBottom: '4px' }}><span style={{ width: '40px', display: 'inline-block', color: '#666' }}>Von:</span> {cleanStartDate}</span>
                <span style={{ display: 'block', fontSize: '13px', color: '#aaa' }}><span style={{ width: '40px', display: 'inline-block', color: '#666' }}>Bis:</span> {cleanEndDate}</span>
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(138, 108, 224, 0.1)', color: '#8a6ce0', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}><Tag size={14} /> {doc.category || 'Dokument'}</span>
              </div>

              {/* DIE ECHTEN BUTTONS */}
              <div style={{ width: '160px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button 
                  onClick={() => doc.isProtected === 1 ? setPinDialog({ isOpen: true, item: doc, action: 'restore' }) : setRestoreDialog({ isOpen: true, item: doc })}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #333', color: '#aaa', padding: '10px', borderRadius: '10px', cursor: 'pointer' }} title="Ablaufdatum korrigieren"
                ><Edit3 size={18} /></button>

                <button 
                  onClick={() => handleDownloadPDF(doc)}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #333', color: '#fff', padding: '10px', borderRadius: '10px', cursor: 'pointer' }} title="Als PDF herunterladen"
                ><Download size={18} /></button>

                <button 
                  onClick={() => doc.isProtected === 1 ? setPinDialog({ isOpen: true, item: doc, action: 'delete' }) : (window.confirm(`WIRKLICH endgültig löschen?`) && executeDelete(doc.id))}
                  style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '10px', borderRadius: '10px', cursor: 'pointer' }} title="Endgültig löschen"
                ><Trash2 size={18} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {/* --- OVERLAYS / MODALS --- */}
      {/* 1. PIN MODAL */}
      {pinDialog.isOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#1e1e1e', padding: '32px', borderRadius: '24px', border: '1px solid #333', textAlign: 'center', position: 'relative' }}>
            <button onClick={() => setPinDialog({ isOpen: false, item: null, action: null })} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }}><X size={20} /></button>
            <Lock size={28} color="#eab308" style={{ margin: '0 auto 20px' }} />
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>Dokument geschützt</h3>
            <p style={{ margin: '0 0 24px 0', color: '#888', fontSize: '14px' }}>PIN eingeben, um das Archiv-Dokument zu {pinDialog.action === 'restore' ? 'bearbeiten' : 'löschen'}.</p>
            <input type="password" maxLength={4} autoFocus value={pinInput} onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, '')); setPinError(false); }} onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()} placeholder="****" style={{ width: '100%', textAlign: 'center', letterSpacing: '12px', padding: '16px', backgroundColor: '#111', border: pinError ? '1px solid #ef4444' : '1px solid #333', borderRadius: '12px', color: '#fff', fontSize: '28px', outline: 'none', marginBottom: '12px' }} />
            {pinError && <p style={{ color: '#ef4444', fontSize: '13px' }}>Falscher PIN.</p>}
            <button onClick={handlePinSubmit} style={{ width: '100%', padding: '14px', backgroundColor: '#eab308', color: '#000', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 700 }}>Entsperren</button>
          </div>
        </div>
      )}

      {/* 2. DATUM WIEDERHERSTELLEN MODAL */}
      {restoreDialog.isOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#1e1e1e', padding: '32px', borderRadius: '24px', border: '1px solid #333', width: '360px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#fff' }}>Neues Ablaufdatum</h3>
            <p style={{ margin: '0 0 24px 0', color: '#888', fontSize: '14px' }}>Wähle ein neues Datum, um das Dokument wieder auf die Monitore zu schicken.</p>
            <input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} style={{ width: '100%', padding: '14px', background: '#111', border: '1px solid #333', borderRadius: '12px', color: '#fff', fontSize: '15px', outline: 'none', marginBottom: '24px', colorScheme: 'dark' }} />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setRestoreDialog({ isOpen: false, item: null })} style={{ flex: 1, padding: '14px', backgroundColor: '#2a2a2a', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={executeRestore} style={{ flex: 1, padding: '14px', backgroundColor: '#8a6ce0', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 700 }}>Aktivieren</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
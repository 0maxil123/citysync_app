import React, { useState, useRef, useEffect } from 'react';
import { Plus, Rocket, ArrowLeft, Trash2, CalendarDays, FileText, CheckCircle2, AlertCircle, Edit3, Lock, Unlock, Loader2, Tag, Hash, X, ChevronLeft, ChevronRight, Archive as ArchiveIcon } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

interface DocumentEditorProps {
  monitorId: string;
  tabName: string;
  documents: any[];
  onRefresh: () => Promise<void>;
  onDelete: (id: number) => void;
  onPublish: () => Promise<void>;
}

const BACKEND_URL = "http://localhost:5195";

export const DocumentEditor: React.FC<DocumentEditorProps> = ({ monitorId, tabName, documents, onRefresh, onDelete, onPublish }) => {
  const [view, setView] = useState<'list' | 'form'>('list');
  
  // NEU: Statt einer einzelnen ID merken wir uns ein Array von IDs (für Mehrseiten-PDFs)
  const [editingIds, setEditingIds] = useState<number[]>([]);
  
  const [pinDialog, setPinDialog] = useState<{ isOpen: boolean, group: any, action: 'edit' | 'delete' | null }>({ isOpen: false, group: null, action: null });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  
  // NEU: Auch beim Löschen merken wir uns ein Array von IDs
  const [confirmDeleteDialog, setConfirmDeleteDialog] = useState<{ isOpen: boolean, itemIds: number[] | null }>({ isOpen: false, itemIds: null });
  
  const [title, setTitle] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [category, setCategory] = useState('Kundmachung');
  const [expiryDate, setExpiryDate] = useState('');
  const [isProtected, setIsProtected] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [keepInArchive, setKeepInArchive] = useState(false);
  
  const [pdfPages, setPdfPages] = useState<File[]>([]); 
  const [previewUrls, setPreviewUrls] = useState<string[]>([]); 
  const [previewIndex, setPreviewIndex] = useState(0); 
  
  const [statusMsg, setStatusMsg] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (statusMsg) {
      const timer = setTimeout(() => setStatusMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [statusMsg]);

  const resetForm = () => {
    setEditingIds([]); setTitle(''); setDocNumber(''); setCategory('Kundmachung'); 
    setExpiryDate(''); setIsProtected(false); setPinCode(''); setKeepInArchive(false);
    setPdfPages([]); setPreviewUrls([]); setPreviewIndex(0); 
  };

  // --- NEU: Bearbeiten lädt jetzt die Gruppe ---
  const startEditing = (group: any) => {
    setEditingIds(group.pages.map((p: any) => p.id));
    setTitle(group.displayTitle || ''); 
    setDocNumber(group.docNumber || '');
    setCategory(group.category || 'Kundmachung'); 
    setExpiryDate(group.date === 'Immer' ? '' : group.date);
    setIsProtected(group.isProtected === 1); 
    setPinCode(group.pinCode || '');
    setKeepInArchive(group.keepInArchive === 1);
    
    // Für die Vorschau laden wir einfach alle Bilder der Gruppe
    setPreviewUrls(group.pages.map((p: any) => p.url)); 
    setPreviewIndex(0);
    setView('form');
  };

  const handleEditClick = (group: any) => {
    if (group.isProtected === 1) {
      setPinInput(''); setPinError(false); setPinDialog({ isOpen: true, group, action: 'edit' });
    } else startEditing(group);
  };

  const handleDeleteClick = (group: any) => {
    if (group.isProtected === 1) {
      setPinInput(''); setPinError(false); setPinDialog({ isOpen: true, group, action: 'delete' });
    } else setConfirmDeleteDialog({ isOpen: true, itemIds: group.pages.map((p: any) => p.id) });
  };

  const handlePinSubmit = () => {
    if (pinInput === pinDialog.group?.pinCode) {
      const { action, group } = pinDialog;
      setPinDialog({ isOpen: false, group: null, action: null });
      if (action === 'edit') startEditing(group);
      if (action === 'delete') setConfirmDeleteDialog({ isOpen: true, itemIds: group.pages.map((p: any) => p.id) });
    } else setPinError(true);
  };

  const processPDF = async (file: File) => {
    setIsProcessingPdf(true);
    setPdfProgress('Lese PDF aus...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const newFiles: File[] = [];
      const newUrls: string[] = [];

      setPdfProgress(`Verarbeite ${pdf.numPages} Seiten...`);

      for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) throw new Error("Canvas Context Error");
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({ canvasContext: context, viewport: viewport, canvas: canvas } as any).promise;

          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          
          newFiles.push(new File([blob], `${file.name.replace('.pdf', '')}_Seite_${i}.jpg`, { type: 'image/jpeg' }));
          newUrls.push(dataUrl);

          if (i === 1) {
              setPdfProgress('Suche Aktenzahl...');
              const textContent = await page.getTextContent();
              let text = textContent.items.map((item: any) => item.str).join(' ');
              const regex = /(?:GZ|AZ|Zahl|Geschäftszahl|Aktenzeichen)[\s.:-]*([a-zA-Z0-9-/]+(?:\s*[-]?\s*[a-zA-Z0-9-/]+)?)/i;
              let match = text.match(regex);

              if (!match || text.trim().length < 50) {
                  setPdfProgress('Scan erkannt! KI-Texterkennung läuft...');
                  try {
                      const { data: { text: ocrText } } = await Tesseract.recognize(dataUrl, 'deu', { logger: m => console.log("OCR Status:", m) });
                      match = ocrText.match(regex);
                  } catch (ocrError) { console.error("OCR Fehler:", ocrError); }
              }

              if (match && match[1]) {
                let finalNumber = match[1].replace(/\b111\b/g, 'III').replace(/111\//g, 'III/').replace(/\b11\b/g, 'II').replace(/11\//g, 'II/');
                setDocNumber(finalNumber);
                setStatusMsg({ text: `Aktenzahl ${finalNumber} erkannt!`, type: 'success' });
              } else {
                setStatusMsg({ text: `Keine Aktenzahl gefunden. Bitte eintragen.`, type: 'error' });
              }
          }
      }
      setPdfPages(newFiles); setPreviewUrls(newUrls); setPreviewIndex(0);
    } catch (e) { 
        console.error(e); setStatusMsg({ text: "Fehler beim PDF-Verarbeiten.", type: 'error' }); 
    }
    finally { setIsProcessingPdf(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        processPDF(file);
      } else {
        setPdfPages([file]); setPreviewUrls([URL.createObjectURL(file)]); setPreviewIndex(0);
      }
    }
  };

  const handleSave = async () => {
    if (editingIds.length === 0 && pdfPages.length === 0) { setStatusMsg({ text: "Datei fehlt!", type: 'error' }); return; }
    if (!title) { setStatusMsg({ text: "Titel fehlt!", type: 'error' }); return; }
    try {
      if (editingIds.length > 0) {
        // MEHRSEITEN-UPDATE: Wir updaten alle IDs, die zu diesem Dokument gehören
        const updatePromises = editingIds.map((id, index) => {
          const pageTitle = editingIds.length > 1 ? `${title} (Seite ${index + 1}/${editingIds.length})` : title;
          return fetch(`${BACKEND_URL}/api/media/update/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              title: pageTitle, expirationDate: expiryDate || 'Immer', docNumber, category, 
              isProtected: isProtected ? 1 : 0, pinCode, eventDate: '', eventTime: '', content: '',
              keepInArchive: keepInArchive ? 1 : 0
            })
          });
        });
        await Promise.all(updatePromises);
      } else {
        const uploadPromises = pdfPages.map((file, index) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('monitorId', monitorId);
            formData.append('tabName', tabName);
            const pageTitle = pdfPages.length > 1 ? `${title} (Seite ${index + 1}/${pdfPages.length})` : title;
            formData.append('title', pageTitle);
            formData.append('expirationDate', expiryDate || 'Immer');
            formData.append('type', 'document');
            formData.append('duration', '20s');
            formData.append('docNumber', docNumber);
            formData.append('category', category);
            formData.append('isProtected', isProtected ? '1' : '0');
            formData.append('pinCode', pinCode);
            formData.append('keepInArchive', keepInArchive ? '1' : '0');
            return fetch(`${BACKEND_URL}/api/media/upload`, { method: 'POST', body: formData });
        });
        await Promise.all(uploadPromises);
      }
      await onRefresh();
      setStatusMsg({ text: "Gespeichert!", type: 'success' });
      resetForm(); setView('list');
    } catch (e) { setStatusMsg({ text: "Fehler beim Speichern", type: 'error' }); }
  };

  // =========================================================================
  // DIE MAGIE: GRUPPIERUNG DER DOKUMENTE FÜR DIE ANSICHT
  // =========================================================================
  const groupedDocs: any[] = [];
  const groupMap = new Map<string, any>();

  documents.forEach(doc => {
    // Schneidet "(Seite 1/2)" etc. vom Namen ab
    const baseTitleMatch = doc.title.match(/(.*?)(?:\s*\(Seite\s*\d+\/\d+\))?$/);
    const baseTitle = baseTitleMatch ? baseTitleMatch[1].trim() : doc.title;
    const key = `${baseTitle}_${doc.docNumber || 'no-num'}`;

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        ...doc,
        displayTitle: baseTitle,
        pages: [doc],
        isMultiPage: false
      });
      groupedDocs.push(groupMap.get(key));
    } else {
      const group = groupMap.get(key);
      group.pages.push(doc);
      group.isMultiPage = true;
      // Sortiere, damit Seite 1 immer vorne ist
      group.pages.sort((a: any, b: any) => a.title.localeCompare(b.title));
    }
  });


  if (view === 'list') {
    return (
      <div style={{ padding: '32px', color: '#fff', maxWidth: '850px', margin: '0 auto', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h2 style={{ margin: 0 }}>{tabName}</h2>
            <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '14px' }}>{groupedDocs.length} Dokumente im Archiv</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {documents.length > 0 && (
                <button onClick={async () => {
                    await fetch(`${BACKEND_URL}/api/media/publish-all/${monitorId}?tabName=${encodeURIComponent(tabName)}`, { method: 'POST' });
                    await onPublish(); await onRefresh();
                    setStatusMsg({ text: "Alle Dokumente live geschaltet!", type: 'success' });
                }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                  <Rocket size={18} /> Alle Live schalten
                </button>
            )}
            <button onClick={() => { resetForm(); setView('form'); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', background: '#8a6ce0', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
              <Plus size={18} /> Neues Dokument
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {groupedDocs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', background: '#1e1e1e', borderRadius: '20px', border: '1px dashed #333', color: '#555' }}>Keine Dokumente vorhanden</div>
          ) : (
            groupedDocs.map((group, index) => {
              // Status überprüfen (Alle Seiten Live?)
              const isLive = group.pages.every((p: any) => p.isLive === 1);
              
              let isExpired = false;
              if (group.date && group.date !== 'Immer') {
                  const cleanDateStr = group.date.replace('Bis ', '').trim();
                  let expDate;
                  if (cleanDateStr.includes('-')) expDate = new Date(`${cleanDateStr}T23:59:59`);
                  else if (cleanDateStr.includes('.')) {
                      const [day, month, year] = cleanDateStr.split('.');
                      expDate = new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59);
                  }
                  if (expDate && !isNaN(expDate.getTime())) isExpired = expDate < new Date();
              }

              return (
                <div key={`group-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '20px', backgroundColor: '#1e1e1e', border: isExpired ? '1px dashed #333' : '1px solid #333', borderRadius: '16px', padding: '16px', position: 'relative', opacity: isExpired ? 0.4 : 1, filter: isExpired ? 'grayscale(100%)' : 'none' }}>
                  
                  {/* VORSCHAU: Wir zeigen immer nur Seite 1 an! */}
                  <div style={{ width: '90px', height: '120px', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', border: '1px solid #444', flexShrink: 0, position: 'relative' }}>
                    <img src={group.pages[0].url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div> 

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '17px', color: '#fff', fontWeight: 600, textDecoration: isExpired ? 'line-through' : 'none' }}>
                        {group.displayTitle}
                      </h3>
                      {isExpired ? (
                          <span style={{ backgroundColor: 'rgba(107, 114, 128, 0.1)', color: '#9ca3af', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', border: '1px solid rgba(107, 114, 128, 0.2)' }}>Abgelaufen</span>
                      ) : (
                          <span style={{ backgroundColor: isLive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: isLive ? '#10b981' : '#f59e0b', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', border: `1px solid ${isLive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}` }}>
                            {isLive ? '● Live' : 'Entwurf'}
                          </span>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#8a6ce0', fontWeight: 600 }}><Tag size={14} /> {group.category || 'Dokument'}</span>
                      <span style={{ color: '#444' }}>•</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#aaa' }}><Hash size={14} /> {group.docNumber || 'Keine Nummer'}</span>
                      <span style={{ color: '#444' }}>•</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: isExpired ? '#ef4444' : '#888' }}><CalendarDays size={14} /> {isExpired ? 'Frist um' : (group.date || 'Immer')}</span>
                      
                      {/* NEU: Das Badge für mehrere Seiten */}
                      {group.isMultiPage && (
                        <>
                          <span style={{ color: '#444' }}>•</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#3b82f6', fontWeight: 600 }}>📚 {group.pages.length} Seiten</span>
                        </>
                      )}

                      {group.isProtected === 1 && (<><span style={{ color: '#444' }}>•</span><span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#eab308' }}><Lock size={14} /> Geschützt</span></>)}
                      {group.keepInArchive === 1 && (<><span style={{ color: '#444' }}>•</span><span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#8a6ce0' }}><ArchiveIcon size={14} /> Archivierung aktiv</span></>)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    {!isExpired && (
                      <button onClick={async () => { 
                        // Alle Seiten live schalten
                        const promises = group.pages.map((p: any) => fetch(`${BACKEND_URL}/api/media/${p.id}/publish-item`, { method: 'POST' }));
                        await Promise.all(promises);
                        await onPublish(); await onRefresh(); 
                        setStatusMsg({ text: "Dokument live geschaltet!", type: 'success' }); 
                      }} style={{ background: isLive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)', border: 'none', color: isLive ? '#10b981' : '#666', padding: '12px', borderRadius: '12px', cursor: 'pointer' }}><Rocket size={18} /></button>
                    )}
                    <button onClick={() => handleEditClick(group)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#aaa', padding: '12px', borderRadius: '12px', cursor: 'pointer' }}><Edit3 size={18} /></button>
                    <button onClick={() => handleDeleteClick(group)} style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', padding: '12px', borderRadius: '12px', cursor: 'pointer' }}><Trash2 size={18} /></button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {pinDialog.isOpen && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ backgroundColor: '#1e1e1e', padding: '32px', borderRadius: '24px', border: '1px solid #333', width: '100%', maxWidth: '360px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', position: 'relative' }}>
              <button onClick={() => setPinDialog({ isOpen: false, group: null, action: null })} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }}><X size={20} /></button>
              <div style={{ width: '60px', height: '60px', backgroundColor: 'rgba(234, 179, 8, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}><Lock size={28} color="#eab308" /></div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 600 }}>Dokument geschützt</h3>
              <p style={{ margin: '0 0 24px 0', color: '#888', fontSize: '14px' }}>Gib den PIN ein, um dieses Dokument zu {pinDialog.action === 'edit' ? 'bearbeiten' : 'löschen'}.</p>
              <input type="password" maxLength={4} autoFocus value={pinInput} onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, '')); setPinError(false); }} onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()} placeholder="****" style={{ width: '100%', textAlign: 'center', letterSpacing: '12px', padding: '16px', backgroundColor: '#111', border: pinError ? '1px solid #ef4444' : '1px solid #333', borderRadius: '12px', color: '#fff', fontSize: '28px', outline: 'none', marginBottom: '12px' }} />
              {pinError && <p style={{ color: '#ef4444', fontSize: '13px', margin: '0 0 16px 0' }}>Falscher PIN, bitte versuche es erneut.</p>}
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button onClick={() => setPinDialog({ isOpen: false, group: null, action: null })} style={{ flex: 1, padding: '14px', backgroundColor: '#2a2a2a', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600 }}>Abbrechen</button>
                <button onClick={handlePinSubmit} style={{ flex: 1, padding: '14px', backgroundColor: '#eab308', color: '#000', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 700 }}>Entsperren</button>
              </div>
            </div>
          </div>
        )}

        {confirmDeleteDialog.isOpen && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ backgroundColor: '#1e1e1e', padding: '32px', borderRadius: '24px', border: '1px solid #333', width: '100%', maxWidth: '360px', textAlign: 'center' }}>
              <div style={{ width: '60px', height: '60px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}><Trash2 size={28} color="#ef4444" /></div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 600 }}>Endgültig löschen?</h3>
              <p style={{ margin: '0 0 24px 0', color: '#888', fontSize: '14px' }}>Das Dokument (inkl. aller Seiten) wird entfernt. Möchtest du fortfahren?</p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setConfirmDeleteDialog({ isOpen: false, itemIds: null })} style={{ flex: 1, padding: '14px', backgroundColor: '#2a2a2a', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600 }}>Abbrechen</button>
                <button onClick={() => { 
                  if(confirmDeleteDialog.itemIds) {
                      for(const id of confirmDeleteDialog.itemIds) onDelete(id);
                  }
                  setConfirmDeleteDialog({ isOpen: false, itemIds: null });
                }} style={{ flex: 1, padding: '14px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 700 }}>Löschen</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // ANSICHT 2: DAS EINGABE-FORMULAR (Unverändert, bis auf editingIds Check)
  // =========================================================================
  return (
    <div style={{ padding: '32px', color: '#fff', maxWidth: '700px', margin: '0 auto', position: 'relative' }}>
      
      {statusMsg && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 10000, backgroundColor: statusMsg.type === 'success' ? '#065f46' : '#991b1b', color: '#fff', padding: '12px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
          {statusMsg.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span style={{ fontSize: '14px', fontWeight: 500 }}>{statusMsg.text}</span>
        </div>
      )}

      {isProcessingPdf && (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(30, 30, 30, 0.9)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '20px' }}>
          <Loader2 size={48} color="#8a6ce0" className="animate-spin" style={{ marginBottom: '20px' }} />
          <h3 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>Verarbeite Dokument...</h3>
          <p style={{ color: '#aaa' }}>{pdfProgress}</p>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <button onClick={() => setView('list')} style={{ background: '#252525', border: '1px solid #333', color: '#aaa', cursor: 'pointer', padding: '10px', borderRadius: '10px', display: 'flex' }}><ArrowLeft size={20} /></button>
        <h2 style={{ margin: 0, fontSize: '24px' }}>{editingIds.length > 0 ? 'Dokument bearbeiten' : 'Neues Dokument'}</h2>
      </div>

      <div style={{ backgroundColor: '#1e1e1e', padding: '28px', borderRadius: '20px', border: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* DATEI UPLOAD */}
        <div>
          <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: '#666', fontWeight: 700, letterSpacing: '1px' }}>PDF ODER BILD</label>
          <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} ref={fileInputRef} style={{ display: 'none' }} disabled={editingIds.length > 0} />
          
          <div onClick={() => editingIds.length === 0 && fileInputRef.current?.click()} style={{ width: '100%', minHeight: '180px', background: '#141414', border: previewUrls.length > 0 ? 'none' : '2px dashed #333', borderRadius: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: editingIds.length > 0 ? 'not-allowed' : 'pointer', overflow: 'hidden', position: 'relative', opacity: editingIds.length > 0 ? 0.7 : 1 }}>
            {previewUrls.length > 0 ? (
                <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <img src={previewUrls[previewIndex]} style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', backgroundColor: '#fff' }} />
                    {previewUrls.length > 1 && (
                        <>
                            <button onClick={(e) => { e.stopPropagation(); setPreviewIndex(p => Math.max(0, p - 1)); }} disabled={previewIndex === 0} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', background: previewIndex === 0 ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.7)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: previewIndex === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={24} /></button>
                            <button onClick={(e) => { e.stopPropagation(); setPreviewIndex(p => Math.min(previewUrls.length - 1, p + 1)); }} disabled={previewIndex === previewUrls.length - 1} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: previewIndex === previewUrls.length - 1 ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.7)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: previewIndex === previewUrls.length - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={24} /></button>
                            <div style={{ position: 'absolute', bottom: '16px', background: 'rgba(0,0,0,0.8)', padding: '6px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>Seite {previewIndex + 1} von {previewUrls.length}</div>
                        </>
                    )}
                </div>
            ) : (
                <div style={{ color: '#444', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '40px' }}><FileText size={40} /><span style={{ fontSize: '14px', fontWeight: 500 }}>PDF auswählen oder hierher ziehen</span></div>
            )}

            {editingIds.length > 0 && (
              <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <span style={{ fontSize: '12px', color: '#aaa', backgroundColor: '#111', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, border: '1px solid #333' }}>Dokument kann nachträglich nicht geändert werden.</span>
              </div>
            )}
          </div>
        </div>

        {/* METADATEN */}
        <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: '#666', fontWeight: 700, letterSpacing: '1px' }}>KATEGORIE</label>
                <div style={{ position: 'relative' }}>
                    <Tag size={16} color="#8a6ce0" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                    <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%', padding: '14px 14px 14px 40px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '12px', color: '#fff', fontSize: '15px', outline: 'none', appearance: 'none' }}>
                        <option value="Kundmachung">Kundmachung</option><option value="Verordnung">Verordnung</option><option value="Bauverhandlung">Bauverhandlung</option><option value="Stellenausschreibung">Stellenausschreibung</option>
                    </select>
                </div>
            </div>

            <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: '#666', fontWeight: 700, letterSpacing: '1px' }}>GESCHÄFTSZAHL</label>
                <div style={{ position: 'relative' }}>
                    <Hash size={16} color="#8a6ce0" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input type="text" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} placeholder="z.B. AZ-2026/04" style={{ width: '100%', padding: '14px 14px 14px 40px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '12px', color: '#fff', fontSize: '15px', outline: 'none' }} />
                </div>
            </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: '#666', fontWeight: 700, letterSpacing: '1px' }}>TITEL DES DOKUMENTS</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Änderung des Flächenwidmungsplans" style={{ width: '100%', padding: '14px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '12px', color: '#fff', fontSize: '15px', outline: 'none' }} />
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #333', margin: '0px 0' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#666', fontWeight: 700, letterSpacing: '1px', marginBottom: '4px' }}>ZUSÄTZLICHE OPTIONEN</label>

          <div style={{ background: keepInArchive ? 'rgba(138, 108, 224, 0.1)' : 'transparent', border: keepInArchive ? '1px solid rgba(138, 108, 224, 0.3)' : '1px solid transparent', padding: keepInArchive ? '16px' : '0', borderRadius: '12px', transition: 'all 0.2s' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={keepInArchive} onChange={(e) => setKeepInArchive(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#8a6ce0' }} />
              <span style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', color: keepInArchive ? '#8a6ce0' : '#fff' }}><ArchiveIcon size={16} />Dokument nach Ablauf im Archiv aufbewahren</span>
            </label>
            {keepInArchive && <p style={{ margin: '8px 0 0 28px', fontSize: '12px', color: '#aaa', lineHeight: '1.4' }}>Wandert nach Ablauf dauerhaft in den Archive-Explorer.</p>}
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '16px' }}>
              <input type="checkbox" checked={isProtected} onChange={(e) => setIsProtected(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#8a6ce0' }} />
              <span style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>{isProtected ? <Lock size={16} color="#eab308" /> : <Unlock size={16} color="#666" />}Bearbeitungsschutz aktivieren</span>
            </label>
            {isProtected && (
              <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', padding: '16px', borderRadius: '12px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}><p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#eab308', fontWeight: 600 }}>PIN-Code vergeben</p><p style={{ margin: 0, fontSize: '12px', color: '#aaa' }}>Schützt vor versehentlichem Löschen oder Bearbeiten.</p></div>
                  <input type="password" maxLength={4} value={pinCode} onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))} placeholder="****" style={{ width: '80px', textAlign: 'center', letterSpacing: '4px', padding: '12px', background: '#111', border: '1px solid #eab308', borderRadius: '8px', color: '#fff', fontSize: '18px', outline: 'none' }} />
              </div>
            )}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px', color: '#666', fontWeight: 700, letterSpacing: '1px' }}>AUSHANG-FRIST</label>
          <div style={{ position: 'relative' }}>
            <CalendarDays size={18} color="#8a6ce0" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="date-time-input" style={{ cursor: 'pointer', width: '100%', padding: '14px 14px 14px 44px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '12px', color: '#fff', fontSize: '15px', outline: 'none', colorScheme: 'dark' }} />
          </div>
        </div>

        <button onClick={handleSave} style={{ marginTop: '10px', padding: '16px', background: '#8a6ce0', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <Rocket size={18} /> Dokument speichern
        </button>

      </div>
      <style>{`.date-time-input::-webkit-calendar-picker-indicator { cursor: pointer; }`}</style>
    </div>
  );
};
import { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, CopyPlus, X, CheckCircle2, AlertCircle, Loader2, Upload, Monitor, MapPin, Lock, Unlock, Archive as ArchiveIcon, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { ScreenEditor } from './ScreenEditor'; 
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

// Initialisiere PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

const BACKEND_URL = "http://localhost:5195";
const API_DASHBOARD = `${BACKEND_URL}/api/dashboard`; 

export const ScreenManagementView = () => {
  const [standorte, setStandorte] = useState<any[]>([]);
  const [selectedScreen, setSelectedScreen] = useState<any>(null);
  
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(''); // NEU: Lade-Text
  const [contentType, setContentType] = useState('Allgemein'); 
  
  const [selectedTargets, setSelectedTargets] = useState<{monitorId: string, tabName: string}[]>([]);
  const [statusMsg, setStatusMsg] = useState<{text: string, type: 'success' | 'error'} | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [category, setCategory] = useState('Kundmachung');
  const [docNumber, setDocNumber] = useState('');
  const [isProtected, setIsProtected] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [keepInArchive, setKeepInArchive] = useState(false);

  // --- NEUE STATES FÜR DATEI & PDF VERARBEITUNG ---
  const [processedFiles, setProcessedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [originalFileName, setOriginalFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    try {
      const response = await fetch(API_DASHBOARD);
      if (response.ok) setStandorte(await response.json());
    } catch (error) { console.warn("Offline-Modus."); }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    setSelectedTargets([]);
    // Resette Dateivorschau bei Typ-Wechsel
    setProcessedFiles([]);
    setPreviewUrls([]);
    setOriginalFileName('');
  }, [contentType]);

  const getMatchingTabs = (screen: any, type: string) => {
    if (type === 'Allgemein') return ['Allgemein'];
    if (!screen.buttonNames || !screen.buttonTypes) return [];
    const names = screen.buttonNames.split(',').map((s: string) => s.trim());
    const types = screen.buttonTypes.split(',').map((s: string) => s.trim());
    const targetType = type === 'News' ? 'news' : type === 'Events' ? 'event' : 'document';
    
    // HIER DIE KORREKTUR: (_: string, i: number)
    return names.filter((_: string, i: number) => types[i] === targetType);
  };

  const toggleTarget = (monitorId: string, tabName: string) => {
    setSelectedTargets(prev => {
      const exists = prev.some(t => t.monitorId === monitorId && t.tabName === tabName);
      if (exists) return prev.filter(t => !(t.monitorId === monitorId && t.tabName === tabName));
      return [...prev, { monitorId, tabName }];
    });
  };

  const toggleLocation = (location: any) => {
    const validTargetsForLoc: {monitorId: string, tabName: string}[] = [];
    location.screens.forEach((s: any) => {
        getMatchingTabs(s, contentType).forEach((t:string) => validTargetsForLoc.push({ monitorId: s.id, tabName: t }));
    });
    const areAllSelected = validTargetsForLoc.every(vt => selectedTargets.some(st => st.monitorId === vt.monitorId && st.tabName === vt.tabName));

    setSelectedTargets(prev => {
        let newTargets = [...prev];
        if (areAllSelected) {
            newTargets = newTargets.filter(st => !validTargetsForLoc.some(vt => vt.monitorId === st.monitorId && vt.tabName === st.tabName));
        } else {
            validTargetsForLoc.forEach(vt => {
                if (!newTargets.some(st => st.monitorId === vt.monitorId && st.tabName === vt.tabName)) newTargets.push(vt);
            });
        }
        return newTargets;
    });
  };

  // =========================================================================
  // DIE PDF MAGIE (Kopiert aus DocumentEditor & angepasst für Bulk)
  // =========================================================================
  const processFile = async (file: File) => {
    setOriginalFileName(file.name);
    
    // Wenn es ein Bild oder Video ist -> direkt in die Liste
    if (file.type !== 'application/pdf') {
       setProcessedFiles([file]);
       if (file.type.startsWith('image/')) {
          setPreviewUrls([URL.createObjectURL(file)]);
       } else {
          setPreviewUrls([]); // Videos kriegen das Icon
       }
       setPreviewIndex(0);
       return;
    }

    // --- ES IST EIN PDF! LASS DIE MAGIE BEGINNEN ---
    setIsUploading(true);
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

          // Nur im Dokumenten-Tab nach Aktenzahlen suchen!
          if (i === 1 && contentType === 'Dokumente') {
              setPdfProgress('Suche Aktenzahl...');
              const textContent = await page.getTextContent();
              let text = textContent.items.map((item: any) => item.str).join(' ');
              const regex = /(?:GZ|AZ|Zahl|Geschäftszahl|Aktenzeichen)[\s.:-]*([a-zA-Z0-9-/]+(?:\s*[-]?\s*[a-zA-Z0-9-/]+)?)/i;
              let match = text.match(regex);

              if (!match || text.trim().length < 50) {
                  setPdfProgress('KI-Texterkennung (OCR) läuft...');
                  try {
                      const { data: { text: ocrText } } = await Tesseract.recognize(dataUrl, 'deu', { logger: m => console.log("OCR Status:", m) });
                      match = ocrText.match(regex);
                  } catch (ocrError) { console.error("OCR Fehler:", ocrError); }
              }

              if (match && match[1]) {
                let finalNumber = match[1].replace(/\b111\b/g, 'III').replace(/111\//g, 'III/').replace(/\b11\b/g, 'II').replace(/11\//g, 'II/');
                setDocNumber(finalNumber);
                // Kurzzeitig StatusMsg zeigen, dass es geklappt hat
                setStatusMsg({ text: `Aktenzahl ${finalNumber} erkannt!`, type: 'success' });
                setTimeout(() => setStatusMsg(null), 3000);
              }
          }
      }
      setProcessedFiles(newFiles); 
      setPreviewUrls(newUrls); 
      setPreviewIndex(0);
      
      // Auto-Titel vergeben (ohne .pdf Endung)
      if (!title) {
         setTitle(file.name.replace('.pdf', ''));
      }

    } catch (e) { 
        console.error(e); 
        alert("Fehler beim Verarbeiten des PDFs."); 
    } finally { 
        setIsUploading(false); 
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };


  // =========================================================================
  // DER BULK UPLOAD BEFEHL (Angepasst für mehrere Seiten!)
  // =========================================================================
  const handleBulkUpload = async () => {
    if (processedFiles.length === 0 || selectedTargets.length === 0) {
      alert("Bitte Datei und mindestens einen Ziel-Button auswählen!");
      return;
    }
    
    if (contentType !== 'Allgemein' && !title) {
         alert("Bitte einen Titel eingeben.");
         return;
    }

    setIsUploading(true);
    setPdfProgress('Sende an Bildschirme...');

    try {
      // WICHTIG: Da wir jetzt evtl. mehrere Dateien (aus einem PDF) haben, 
      // müssen wir JEDE Datei über die API schicken.
      
      const uploadPromises = processedFiles.map((file, index) => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('duration', '20s');
          formData.append('monitorTargetsJson', JSON.stringify(selectedTargets));
          
          // Wenn es mehrere Seiten sind, fügen wir (Seite X/Y) an den Titel an
          const finalTitle = processedFiles.length > 1 && contentType !== 'Allgemein' 
               ? `${title} (Seite ${index + 1}/${processedFiles.length})` 
               : title;
               
          formData.append('title', finalTitle);
          formData.append('content', content);
          formData.append('eventDate', eventDate);
          formData.append('expirationDate', expirationDate);
          formData.append('category', category);
          formData.append('docNumber', docNumber);
          formData.append('isProtected', isProtected ? '1' : '0');
          formData.append('pinCode', pinCode);
          formData.append('keepInArchive', keepInArchive ? '1' : '0');
          
          return fetch(`${BACKEND_URL}/api/media/bulk-upload`, { method: 'POST', body: formData });
      });

      await Promise.all(uploadPromises);

      setStatusMsg({ text: `Erfolgreich an ${selectedTargets.length} Ziele verteilt!`, type: 'success' });
      setTimeout(() => {
        setIsBulkModalOpen(false);
        setProcessedFiles([]); setPreviewUrls([]); setOriginalFileName('');
        setContentType('Allgemein'); 
        setSelectedTargets([]);
        setTitle(''); setContent(''); setEventDate(''); setExpirationDate('');
        setCategory('Kundmachung'); setDocNumber(''); setIsProtected(false); setPinCode(''); setKeepInArchive(false);
        loadData();
      }, 2000);
      
    } catch (e) {
      setStatusMsg({ text: "Fehler bei der Verteilung.", type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  const availableStandorte = standorte.map(ort => {
      const validScreens = ort.screens.filter((s: any) => getMatchingTabs(s, contentType).length > 0);
      return { ...ort, screens: validScreens };
  }).filter(ort => ort.screens.length > 0);


  if (selectedScreen) {
    return <ScreenEditor screen={selectedScreen} onBack={() => { setSelectedScreen(null); loadData(); }} />;
  }

  return (
    <div style={{ color: '#fff', backgroundColor: '#121212', minHeight: '100vh', padding: '40px' }}>
      
      {statusMsg && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 10001, backgroundColor: statusMsg.type === 'success' ? '#065f46' : '#991b1b', color: '#fff', padding: '16px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
          {statusMsg.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span style={{ fontWeight: 600 }}>{statusMsg.text}</span>
        </div>
      )}

      {/* --- LADEBILDSCHIRM (Zeigt PDF oder Upload Fortschritt) --- */}
      {isUploading && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(5px)' }}>
          <Loader2 size={64} color="#8a6ce0" style={{ animation: 'spin 2s linear infinite', marginBottom: '24px' }} />
          <h2 style={{ margin: '0 0 12px 0', fontSize: '24px', fontWeight: 600, color: '#fff' }}>Bitte warten...</h2>
          <p style={{ color: '#aaa', fontSize: '14px' }}>{pdfProgress}</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 400, margin: 0, marginBottom: '8px' }}>Screen Management</h1>
          <p style={{ color: '#888', margin: 0, fontSize: '14px' }}>Wähle einen Monitor aus oder verteile Medien global.</p>
        </div>
        <button 
          onClick={() => setIsBulkModalOpen(true)}
          style={{ backgroundColor: '#8a6ce0', border: 'none', color: '#fff', padding: '12px 24px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, boxShadow: '0 4px 15px rgba(138, 108, 224, 0.3)' }}
        >
          <CopyPlus size={18} /> Medien auf mehrere verteilen
        </button>
      </div>

      {/* DASHBOARD KACHELN */}
      {standorte.map(ort => (
        <div key={ort.id} style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '14px', color: '#8a6ce0', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>{ort.name}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
            {ort.screens.map((screen: any) => (
              <div key={screen.id} onClick={() => setSelectedScreen(screen)} style={{ backgroundColor: '#1c1c1c', borderRadius: '16px', border: '1px solid #2a2a2a', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s' }}>
                <div style={{ height: '160px', backgroundColor: '#0a0a0a', position: 'relative' }}>
                  {screen.previewUrl ? <img src={`${BACKEND_URL}${screen.previewUrl}?t=${new Date().getTime()}`} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} /> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><ImageIcon size={40} color="#333" /></div>}
                </div>
                <div style={{ padding: '16px', fontWeight: 600 }}>{screen.name}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* --- BULK DISTRIBUTION MODAL --- */}
      {isBulkModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#1e1e1e', width: '100%', maxWidth: '950px', maxHeight: '90vh', borderRadius: '24px', border: '1px solid #333', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
            
            <div style={{ padding: '24px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'rgba(138, 108, 224, 0.2)', padding: '10px', borderRadius: '10px' }}><CopyPlus color="#8a6ce0" /></div>
                <h2 style={{ margin: 0, fontSize: '20px' }}>Medien global verteilen</h2>
              </div>
              <button onClick={() => setIsBulkModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }}><X /></button>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              
              {/* LINKE SEITE: FORMULAR */}
              <div style={{ flex: 1, padding: '32px', borderRight: '1px solid #333', overflowY: 'auto' }}>
                
                <label style={{ display: 'block', color: '#888', fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>INHALTSTYP WÄHLEN</label>
                <select value={contentType} onChange={(e) => setContentType(e.target.value)} style={{ width: '100%', padding: '14px', background: '#111', border: '1px solid #333', borderRadius: '12px', color: '#fff', marginBottom: '24px', outline: 'none', appearance: 'none', cursor: 'pointer' }}>
                  <option value="Allgemein">Allgemein (Nur Bild/Video)</option>
                  <option value="News">News (Mit Text)</option>
                  <option value="Events">Events (Mit Datum)</option>
                  <option value="Dokumente">Dokumente / Archiv (Mit Schutz)</option>
                </select>

                <label style={{ display: 'block', color: '#888', fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>DATEI AUSWÄHLEN</label>
                
                {/* --- DIE NEUE, INTERAKTIVE UPLOAD KACHEL --- */}
                <input type="file" id="bulk-file" accept="image/*,video/*,application/pdf" hidden onChange={handleFileChange} ref={fileInputRef} />
                <div onClick={() => !processedFiles.length && document.getElementById('bulk-file')?.click()} style={{ width: '100%', minHeight: '160px', background: '#111', border: processedFiles.length > 0 ? '1px solid #333' : '2px dashed #333', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: processedFiles.length > 0 ? 'default' : 'pointer', marginBottom: '24px', overflow: 'hidden', position: 'relative' }}>
                  
                  {previewUrls.length > 0 ? (
                      <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                          <img src={previewUrls[previewIndex]} style={{ width: '100%', maxHeight: '300px', objectFit: 'contain', backgroundColor: '#fff' }} />
                          {previewUrls.length > 1 && (
                              <>
                                  <button onClick={(e) => { e.stopPropagation(); setPreviewIndex(p => Math.max(0, p - 1)); }} disabled={previewIndex === 0} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.7)', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: previewIndex === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={20} /></button>
                                  <button onClick={(e) => { e.stopPropagation(); setPreviewIndex(p => Math.min(previewUrls.length - 1, p + 1)); }} disabled={previewIndex === previewUrls.length - 1} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.7)', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: previewIndex === previewUrls.length - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={20} /></button>
                                  <div style={{ position: 'absolute', bottom: '12px', background: 'rgba(0,0,0,0.8)', padding: '6px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>Seite {previewIndex + 1} von {previewUrls.length}</div>
                              </>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); setProcessedFiles([]); setPreviewUrls([]); setOriginalFileName(''); }} style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
                      </div>
                  ) : processedFiles.length > 0 ? (
                      <div style={{ textAlign: 'center' }}>
                         <FileText size={32} color="#8a6ce0" />
                         <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>{originalFileName}</p>
                         <button onClick={(e) => { e.stopPropagation(); setProcessedFiles([]); setOriginalFileName(''); }} style={{ marginTop: '12px', background: 'none', border: '1px solid #444', color: '#aaa', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>Entfernen</button>
                      </div>
                  ) : (
                      <><Upload size={32} color="#444" /><p style={{ margin: '8px 0 0 0', color: '#666' }}>PDF, Bild oder Video</p></>
                  )}
                </div>

                {/* DYNAMISCHE FELDER */}
                {contentType !== 'Allgemein' && (
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', color: '#888', fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>TITEL {processedFiles.length > 1 && '(Alle Seiten)'}</label>
                        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titel eingeben..." style={{ width: '100%', padding: '14px', background: '#111', border: '1px solid #333', borderRadius: '12px', color: '#fff', outline: 'none' }} />
                    </div>
                )}
                {contentType === 'News' && (
                  <>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', color: '#888', fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>NACHRICHTENTEXT</label>
                        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Text für die News..." style={{ width: '100%', padding: '14px', background: '#111', border: '1px solid #333', borderRadius: '12px', color: '#fff', minHeight: '80px', outline: 'none' }} />
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', color: '#888', fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>ANZEIGE BIS</label>
                        <input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} style={{ width: '100%', padding: '14px', background: '#111', border: '1px solid #333', borderRadius: '12px', color: '#fff', outline: 'none', colorScheme: 'dark' }} />
                    </div>
                  </>
                )}
                {contentType === 'Events' && (
                  <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', color: '#888', fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>EVENT-DATUM</label>
                      <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={{ width: '100%', padding: '14px', background: '#111', border: '1px solid #333', borderRadius: '12px', color: '#fff', outline: 'none', colorScheme: 'dark' }} />
                  </div>
                )}
                {contentType === 'Dokumente' && (
                  <>
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', color: '#888', fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>KATEGORIE</label>
                            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%', padding: '14px', background: '#111', border: '1px solid #333', borderRadius: '12px', color: '#fff', outline: 'none', appearance: 'none' }}>
                                <option value="Kundmachung">Kundmachung</option><option value="Verordnung">Verordnung</option><option value="Bauverhandlung">Bauverhandlung</option><option value="Stellenausschreibung">Stellenausschreibung</option>
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', color: '#888', fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>GESCHÄFTSZAHL</label>
                            <input type="text" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} placeholder="z.B. AZ-2026/04" style={{ width: '100%', padding: '14px', background: '#111', border: '1px solid #333', borderRadius: '12px', color: '#fff', outline: 'none' }} />
                        </div>
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', color: '#888', fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>AUSHANG-FRIST</label>
                        <input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} style={{ width: '100%', padding: '14px', background: '#111', border: '1px solid #333', borderRadius: '12px', color: '#fff', outline: 'none', colorScheme: 'dark' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={keepInArchive} onChange={(e) => setKeepInArchive(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#8a6ce0' }} />
                            <span style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}><ArchiveIcon size={16} />Dokument im Archiv aufbewahren</span>
                        </label>
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: isProtected ? '16px' : '0' }}>
                                <input type="checkbox" checked={isProtected} onChange={(e) => setIsProtected(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#8a6ce0' }} />
                                <span style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>{isProtected ? <Lock size={16} color="#eab308" /> : <Unlock size={16} color="#666" />}Bearbeitungsschutz</span>
                            </label>
                            {isProtected && (
                                <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', padding: '12px', borderRadius: '12px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                                    <div style={{ flex: 1 }}><p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#eab308', fontWeight: 600 }}>PIN vergeben</p></div>
                                    <input type="password" maxLength={4} value={pinCode} onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))} placeholder="****" style={{ width: '80px', textAlign: 'center', letterSpacing: '4px', padding: '10px', background: '#111', border: '1px solid #eab308', borderRadius: '8px', color: '#fff', fontSize: '16px', outline: 'none' }} />
                                </div>
                            )}
                        </div>
                    </div>
                  </>
                )}

                <button 
                  onClick={handleBulkUpload}
                  disabled={isUploading}
                  style={{ width: '100%', padding: '16px', background: '#8a6ce0', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '16px' }}
                >
                  <CheckCircle2 size={20} /> Verteilung starten
                </button>
              </div>

              {/* RECHTE SEITE: FILTERED MONITOR AUSWAHL */}
              <div style={{ flex: 1, padding: '32px', backgroundColor: '#181818', overflowY: 'auto' }}>
                <label style={{ display: 'block', color: '#888', fontSize: '12px', fontWeight: 700, marginBottom: '16px', letterSpacing: '1px' }}>
                  ZIEL-BUTTONS WÄHLEN ({selectedTargets.length})
                </label>
                
                {availableStandorte.length === 0 ? (
                  <div style={{ color: '#666', textAlign: 'center', marginTop: '40px' }}>Keine Monitore für diesen Inhaltstyp gefunden.</div>
                ) : (
                  availableStandorte.map(ort => (
                    <div key={ort.id} style={{ marginBottom: '24px', background: '#222', borderRadius: '16px', padding: '16px', border: '1px solid #333' }}>
                      <div onClick={() => toggleLocation(ort)} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #333' }}>
                        <span style={{ fontWeight: 700, color: '#8a6ce0', display: 'flex', alignItems: 'center', gap: '8px' }}><MapPin size={14} /> {ort.name}</span>
                        <span style={{ fontSize: '12px', color: '#666' }}>Alle wählen</span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {ort.screens.map((s: any) => {
                          const tabs = getMatchingTabs(s, contentType);

                          if (contentType === 'Allgemein') {
                            const isSelected = selectedTargets.some(t => t.monitorId === s.id && t.tabName === 'Allgemein');
                            return (
                              <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '10px', borderRadius: '8px', background: isSelected ? 'rgba(138, 108, 224, 0.1)' : 'transparent', border: isSelected ? '1px solid rgba(138, 108, 224, 0.3)' : '1px solid transparent' }}>
                                <input type="checkbox" checked={isSelected} onChange={() => toggleTarget(s.id, 'Allgemein')} style={{ width: '18px', height: '18px', accentColor: '#8a6ce0' }} />
                                <Monitor size={16} color={isSelected ? '#8a6ce0' : '#666'} />
                                <span style={{ fontSize: '14px', fontWeight: isSelected ? 600 : 400 }}>{s.name}</span>
                              </label>
                            );
                          }

                          return (
                            <div key={s.id} style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid #333' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#aaa', fontSize: '13px', fontWeight: 600 }}>
                                <Monitor size={14} /> {s.name}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '22px' }}>
                                {tabs.map((tabName : string) => {
                                  const isSelected = selectedTargets.some(t => t.monitorId === s.id && t.tabName === tabName);
                                  return (
                                    <label key={tabName} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                      <input type="checkbox" checked={isSelected} onChange={() => toggleTarget(s.id, tabName)} style={{ width: '16px', height: '16px', accentColor: '#8a6ce0' }} />
                                      <span style={{ fontSize: '14px', color: isSelected ? '#fff' : '#aaa' }}>Button: {tabName}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );

                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
import { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, CopyPlus, X, CheckCircle2, AlertCircle, Loader2, Upload, Monitor, MapPin, Lock, Unlock, Archive as ArchiveIcon, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { ScreenEditor } from './ScreenEditor'; 
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import { AuthProvider, useAuth } from '../context/AuthContext'; 


// Initialisiere PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

const BACKEND_URL = "http://localhost:5195";
const API_DASHBOARD = `${BACKEND_URL}/api/dashboard`; 

interface ScreenManagementProp{
  globalTheme: 'light' | 'dark'
}

export const ScreenManagementView = ({globalTheme}: ScreenManagementProp) => {
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
  const {user, hasPermission } = useAuth();

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
          formData.append('userId', user?.id?.toString() || '')
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
  return (
    <ScreenEditor 
      screen={selectedScreen} 
      globalTheme={globalTheme} // <-- Hier als Prop übergeben
      onBack={() => {
        // Hier drin nur die Logik, was beim Schließen passieren soll
        setSelectedScreen(null); 
        loadData(); 
      }} 
    />
  );
}
  // --- HIER KOMMEN DIE THEME-FARBEN HIN ---
  const isDark = globalTheme === 'dark';
  const colors = {
    background: isDark ? '#121212' : '#f3f4f6',      // Haupt-Hintergrund
    card: isDark ? '#1c1c1c' : '#ffffff',            // Monitor-Kacheln
    imagePlaceholder: isDark ? '#0a0a0a' : '#e5e7eb',// Bild-Platzhalter in den Kacheln
    modalBg: isDark ? '#1e1e1e' : '#ffffff',         // Bulk-Modal
    rightPanelBg: isDark ? '#181818' : '#f9fafb',    // Rechte Seite im Bulk-Modal
    locationCard: isDark ? '#222222' : '#ffffff',    // Standort-Karten im Bulk-Modal
    inputBg: isDark ? '#111111' : '#f9fafb',         // Textfelder & Upload-Box
    textMain: isDark ? '#ffffff' : '#111827',        // Normaler Text
    textSub: isDark ? '#888888' : '#6b7280',         // Grauer Text
    border: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)',
    borderStrong: isDark ? '#333333' : '#e5e7eb',
    borderAccent: isDark ? '#2a2a2a' : '#d1d5db',
    primary: '#8a6ce0',                              // Dein Lila
    primaryHover: '#7a5bc7',
    hoverBg: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
    backdrop: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.5)'
  };

  return (
    <div style={{ color: colors.textMain, backgroundColor: colors.background, minHeight: '100vh', padding: '40px', transition: 'all 0.3s ease' }}>
      
      {/* ERFOLGS/FEHLER-MELDUNG */}
      {statusMsg && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 10001, backgroundColor: statusMsg.type === 'success' ? '#065f46' : '#991b1b', color: '#fff', padding: '16px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
          {statusMsg.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span style={{ fontWeight: 600 }}>{statusMsg.text}</span>
        </div>
      )}

      {/* --- LADEBILDSCHIRM (Zeigt PDF oder Upload Fortschritt) --- */}
      {isUploading && (
        <div style={{ position: 'fixed', inset: 0, background: colors.backdrop, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(5px)' }}>
          <Loader2 size={64} color={colors.primary} style={{ animation: 'spin 2s linear infinite', marginBottom: '24px' }} />
          <h2 style={{ margin: '0 0 12px 0', fontSize: '24px', fontWeight: 600, color: colors.textMain }}>Bitte warten...</h2>
          <p style={{ color: colors.textSub, fontSize: '14px' }}>{pdfProgress}</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px', borderBottom: `1px solid ${colors.border}`, paddingBottom: '24px', transition: 'border-color 0.3s ease' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 400, margin: 0, marginBottom: '8px' }}>Screen Management</h1>
          <p style={{ color: colors.textSub, margin: 0, fontSize: '14px', transition: 'color 0.3s ease' }}>Wähle einen Monitor aus oder verteile Medien global.</p>
        </div>
        {hasPermission('media.publish') && (
        <button 
          onClick={() => setIsBulkModalOpen(true)}
          style={{ backgroundColor: colors.primary, border: 'none', color: '#fff', padding: '12px 24px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, boxShadow: '0 4px 15px rgba(138, 108, 224, 0.3)', transition: 'all 0.2s' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.primaryHover}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primary}
        >
          <CopyPlus size={18} /> Medien auf mehrere verteilen
        </button>
        )}
      </div>

      {/* DASHBOARD KACHELN */}
      {standorte.map(ort => (
        <div key={ort.id} style={{ marginBottom: '40px' }}>
          {/* Hier wird 'ort' definiert und benutzt */}
          <h2 style={{ fontSize: '14px', color: colors.primary, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {ort.name}
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
            {/* Innere Schleife: Hier greifen wir auf ort.screens zu */}
            {ort.screens.map((screen: any) => {
              
              // NEU: Wir prüfen, ob der User den Monitor verwalten ODER Medien hochladen/publizieren darf!
              const canAccessScreen = hasPermission('screens.manage') || hasPermission('media.upload') || hasPermission('media.publish');
              
              return (
                <div 
                  key={screen.id} 
                  onClick={() => canAccessScreen && setSelectedScreen(screen)} 
                  style={{ 
                    backgroundColor: colors.card, 
                    borderRadius: '16px', 
                    border: `1px solid ${colors.borderAccent}`, 
                    overflow: 'hidden', 
                    // Cursor und Opacity reagieren jetzt auf die neue Erlaubnis
                    cursor: canAccessScreen ? 'pointer' : 'default', 
                    transition: 'all 0.2s', 
                    boxShadow: isDark ? 'none' : '0 4px 6px -1px rgba(0,0,0,0.05)',
                    opacity: canAccessScreen ? 1 : 0.6 
                  }}
                  onMouseEnter={(e) => { 
                    if(canAccessScreen) {
                      e.currentTarget.style.transform = 'translateY(-4px)'; 
                      e.currentTarget.style.boxShadow = isDark ? '0 10px 20px rgba(0,0,0,0.5)' : '0 10px 20px rgba(0,0,0,0.1)'; 
                    }
                  }}
                  onMouseLeave={(e) => { 
                    if(canAccessScreen) {
                      e.currentTarget.style.transform = 'translateY(0)'; 
                      e.currentTarget.style.boxShadow = isDark ? 'none' : '0 4px 6px -1px rgba(0,0,0,0.05)'; 
                    }
                  }}
                >
                  <div style={{ height: '160px', backgroundColor: colors.imagePlaceholder, position: 'relative' }}>
                    {screen.previewUrl ? (
                      <img src={`${BACKEND_URL}${screen.previewUrl}?t=${new Date().getTime()}`} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        <ImageIcon size={40} color={colors.textSub} opacity={0.5} />
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '16px', fontWeight: 600, color: colors.textMain }}>{screen.name}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* --- BULK DISTRIBUTION MODAL --- */}
      {isBulkModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: colors.backdrop, backdropFilter: 'blur(10px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: colors.modalBg, width: '100%', maxWidth: '950px', maxHeight: '90vh', borderRadius: '24px', border: `1px solid ${colors.borderStrong}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: isDark ? '0 25px 50px rgba(0,0,0,0.5)' : '0 25px 50px rgba(0,0,0,0.1)', transition: 'all 0.3s ease' }}>
            
            <div style={{ padding: '24px', borderBottom: `1px solid ${colors.borderStrong}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'rgba(138, 108, 224, 0.2)', padding: '10px', borderRadius: '10px' }}><CopyPlus color={colors.primary} /></div>
                <h2 style={{ margin: 0, fontSize: '20px', color: colors.textMain }}>Medien global verteilen</h2>
              </div>
              <button onClick={() => setIsBulkModalOpen(false)} style={{ background: 'transparent', border: 'none', color: colors.textSub, cursor: 'pointer' }}><X /></button>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              
              {/* LINKE SEITE: FORMULAR */}
              <div style={{ flex: 1, padding: '32px', borderRight: `1px solid ${colors.borderStrong}`, overflowY: 'auto' }}>
                
                <label style={{ display: 'block', color: colors.textSub, fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>INHALTSTYP WÄHLEN</label>
                <select value={contentType} onChange={(e) => setContentType(e.target.value)} style={{ width: '100%', padding: '14px', background: colors.inputBg, border: `1px solid ${colors.borderStrong}`, borderRadius: '12px', color: colors.textMain, marginBottom: '24px', outline: 'none', appearance: 'none', cursor: 'pointer' }}>
                  <option value="Allgemein">Allgemein (Nur Bild/Video)</option>
                  <option value="News">News (Mit Text)</option>
                  <option value="Events">Events (Mit Datum)</option>
                  <option value="Dokumente">Dokumente / Archiv (Mit Schutz)</option>
                </select>

                <label style={{ display: 'block', color: colors.textSub, fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>DATEI AUSWÄHLEN</label>
                
                {/* INTERAKTIVE UPLOAD KACHEL */}
                <input type="file" id="bulk-file" accept="image/*,video/*,application/pdf" hidden onChange={handleFileChange} ref={fileInputRef} />
                <div onClick={() => !processedFiles.length && document.getElementById('bulk-file')?.click()} style={{ width: '100%', minHeight: '160px', background: colors.inputBg, border: processedFiles.length > 0 ? `1px solid ${colors.borderStrong}` : `2px dashed ${colors.borderStrong}`, borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: processedFiles.length > 0 ? 'default' : 'pointer', marginBottom: '24px', overflow: 'hidden', position: 'relative' }}>
                  
                  {previewUrls.length > 0 ? (
                      <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                          <img src={previewUrls[previewIndex]} style={{ width: '100%', maxHeight: '300px', objectFit: 'contain', backgroundColor: '#fff' }} />
                          {previewUrls.length > 1 && (
                              <>
                                  <button onClick={(e) => { e.stopPropagation(); setPreviewIndex(p => Math.max(0, p - 1)); }} disabled={previewIndex === 0} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.7)', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: previewIndex === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={20} /></button>
                                  <button onClick={(e) => { e.stopPropagation(); setPreviewIndex(p => Math.min(previewUrls.length - 1, p + 1)); }} disabled={previewIndex === previewUrls.length - 1} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.7)', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: previewIndex === previewUrls.length - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={20} /></button>
                                  <div style={{ position: 'absolute', bottom: '12px', background: 'rgba(0,0,0,0.8)', padding: '6px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, color: 'white' }}>Seite {previewIndex + 1} von {previewUrls.length}</div>
                              </>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); setProcessedFiles([]); setPreviewUrls([]); setOriginalFileName(''); }} style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
                      </div>
                  ) : processedFiles.length > 0 ? (
                      <div style={{ textAlign: 'center' }}>
                         <FileText size={32} color={colors.primary} />
                         <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: colors.textMain }}>{originalFileName}</p>
                         <button onClick={(e) => { e.stopPropagation(); setProcessedFiles([]); setOriginalFileName(''); }} style={{ marginTop: '12px', background: 'none', border: `1px solid ${colors.textSub}`, color: colors.textSub, padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>Entfernen</button>
                      </div>
                  ) : (
                      <><Upload size={32} color={colors.textSub} /><p style={{ margin: '8px 0 0 0', color: colors.textSub }}>PDF, Bild oder Video</p></>
                  )}
                </div>

                {/* DYNAMISCHE FELDER */}
                {contentType !== 'Allgemein' && (
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', color: colors.textSub, fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>TITEL {processedFiles.length > 1 && '(Alle Seiten)'}</label>
                        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titel eingeben..." style={{ width: '100%', padding: '14px', background: colors.inputBg, border: `1px solid ${colors.borderStrong}`, borderRadius: '12px', color: colors.textMain, outline: 'none' }} />
                    </div>
                )}
                {contentType === 'News' && (
                  <>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', color: colors.textSub, fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>NACHRICHTENTEXT</label>
                        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Text für die News..." style={{ width: '100%', padding: '14px', background: colors.inputBg, border: `1px solid ${colors.borderStrong}`, borderRadius: '12px', color: colors.textMain, minHeight: '80px', outline: 'none', resize: 'vertical' }} />
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', color: colors.textSub, fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>ANZEIGE BIS</label>
                        <input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} style={{ width: '100%', padding: '14px', background: colors.inputBg, border: `1px solid ${colors.borderStrong}`, borderRadius: '12px', color: colors.textMain, outline: 'none', colorScheme: isDark ? 'dark' : 'light' }} />
                    </div>
                  </>
                )}
                {contentType === 'Events' && (
                  <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', color: colors.textSub, fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>EVENT-DATUM</label>
                      <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={{ width: '100%', padding: '14px', background: colors.inputBg, border: `1px solid ${colors.borderStrong}`, borderRadius: '12px', color: colors.textMain, outline: 'none', colorScheme: isDark ? 'dark' : 'light' }} />
                  </div>
                )}
                {contentType === 'Dokumente' && (
                  <>
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', color: colors.textSub, fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>KATEGORIE</label>
                            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%', padding: '14px', background: colors.inputBg, border: `1px solid ${colors.borderStrong}`, borderRadius: '12px', color: colors.textMain, outline: 'none', appearance: 'none' }}>
                                <option value="Kundmachung">Kundmachung</option><option value="Verordnung">Verordnung</option><option value="Bauverhandlung">Bauverhandlung</option><option value="Stellenausschreibung">Stellenausschreibung</option>
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', color: colors.textSub, fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>GESCHÄFTSZAHL</label>
                            <input type="text" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} placeholder="z.B. AZ-2026/04" style={{ width: '100%', padding: '14px', background: colors.inputBg, border: `1px solid ${colors.borderStrong}`, borderRadius: '12px', color: colors.textMain, outline: 'none' }} />
                        </div>
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', color: colors.textSub, fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>AUSHANG-FRIST</label>
                        <input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} style={{ width: '100%', padding: '14px', background: colors.inputBg, border: `1px solid ${colors.borderStrong}`, borderRadius: '12px', color: colors.textMain, outline: 'none', colorScheme: isDark ? 'dark' : 'light' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: colors.textMain }}>
                            <input type="checkbox" checked={keepInArchive} onChange={(e) => setKeepInArchive(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: colors.primary }} />
                            <span style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}><ArchiveIcon size={16} />Dokument im Archiv aufbewahren</span>
                        </label>
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: isProtected ? '16px' : '0', color: colors.textMain }}>
                                <input type="checkbox" checked={isProtected} onChange={(e) => setIsProtected(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: colors.primary }} />
                                <span style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>{isProtected ? <Lock size={16} color="#eab308" /> : <Unlock size={16} color={colors.textSub} />}Bearbeitungsschutz</span>
                            </label>
                            {isProtected && (
                                <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', padding: '12px', borderRadius: '12px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                                    <div style={{ flex: 1 }}><p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#d97706', fontWeight: 600 }}>PIN vergeben</p></div>
                                    <input type="password" maxLength={4} value={pinCode} onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))} placeholder="****" style={{ width: '80px', textAlign: 'center', letterSpacing: '4px', padding: '10px', background: colors.inputBg, border: '1px solid #eab308', borderRadius: '8px', color: colors.textMain, fontSize: '16px', outline: 'none' }} />
                                </div>
                            )}
                        </div>
                    </div>
                  </>
                )}

                <button 
                  onClick={handleBulkUpload}
                  // Button sperren, wenn kein Recht da ist
                  disabled={isUploading || !hasPermission('media.publish')}
                  style={{ 
                    width: '100%', 
                    padding: '16px', 
                    // Farbe ändern, wenn deaktiviert
                    background: hasPermission('media.publish') ? colors.primary : colors.textSub, 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: '12px', 
                    cursor: hasPermission('media.publish') ? 'pointer' : 'not-allowed', 
                    fontWeight: 700, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '10px', 
                    marginTop: '16px' 
                  }}
                >
                  <CheckCircle2 size={20} /> 
                  {hasPermission('media.publish') ? "Verteilung starten" : "Keine Berechtigung zum Veröffentlichen"}
                </button>
              </div>

              {/* RECHTE SEITE: FILTERED MONITOR AUSWAHL */}
              <div style={{ flex: 1, padding: '32px', backgroundColor: colors.rightPanelBg, overflowY: 'auto' }}>
                <label style={{ display: 'block', color: colors.textSub, fontSize: '12px', fontWeight: 700, marginBottom: '16px', letterSpacing: '1px' }}>
                  ZIEL-BUTTONS WÄHLEN ({selectedTargets.length})
                </label>
                
                {availableStandorte.length === 0 ? (
                  <div style={{ color: colors.textSub, textAlign: 'center', marginTop: '40px' }}>Keine Monitore für diesen Inhaltstyp gefunden.</div>
                ) : (
                  availableStandorte.map(ort => (
                    <div key={ort.id} style={{ marginBottom: '24px', background: colors.locationCard, borderRadius: '16px', padding: '16px', border: `1px solid ${colors.borderStrong}` }}>
                      <div onClick={() => toggleLocation(ort)} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '12px', paddingBottom: '8px', borderBottom: `1px solid ${colors.borderStrong}` }}>
                        <span style={{ fontWeight: 700, color: colors.primary, display: 'flex', alignItems: 'center', gap: '8px' }}><MapPin size={14} /> {ort.name}</span>
                        <span style={{ fontSize: '12px', color: colors.textSub }}>Alle wählen</span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {ort.screens.map((s: any) => {
                          const tabs = getMatchingTabs(s, contentType);

                          if (contentType === 'Allgemein') {
                            const isSelected = selectedTargets.some(t => t.monitorId === s.id && t.tabName === 'Allgemein');
                            return (
                              <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '10px', borderRadius: '8px', background: isSelected ? 'rgba(138, 108, 224, 0.1)' : 'transparent', border: isSelected ? '1px solid rgba(138, 108, 224, 0.3)' : '1px solid transparent', transition: 'all 0.2s' }}>
                                <input type="checkbox" checked={isSelected} onChange={() => toggleTarget(s.id, 'Allgemein')} style={{ width: '18px', height: '18px', accentColor: colors.primary }} />
                                <Monitor size={16} color={isSelected ? colors.primary : colors.textSub} />
                                <span style={{ fontSize: '14px', fontWeight: isSelected ? 600 : 400, color: colors.textMain }}>{s.name}</span>
                              </label>
                            );
                          }

                          return (
                            <div key={s.id} style={{ padding: '12px', borderRadius: '8px', background: colors.hoverBg, border: `1px solid ${colors.borderStrong}` }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: colors.textSub, fontSize: '13px', fontWeight: 600 }}>
                                <Monitor size={14} /> {s.name}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '22px' }}>
                                {tabs.map((tabName : string) => {
                                  const isSelected = selectedTargets.some(t => t.monitorId === s.id && t.tabName === tabName);
                                  return (
                                    <label key={tabName} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                      <input type="checkbox" checked={isSelected} onChange={() => toggleTarget(s.id, tabName)} style={{ width: '16px', height: '16px', accentColor: colors.primary }} />
                                      <span style={{ fontSize: '14px', color: isSelected ? colors.textMain : colors.textSub, fontWeight: isSelected ? 600 : 400 }}>Button: {tabName}</span>
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
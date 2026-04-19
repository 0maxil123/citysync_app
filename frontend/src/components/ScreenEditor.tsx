import { useState, useRef, useEffect } from 'react';
import { EventEditor } from './EventEditor';
import { NewsEditor } from './NewsEditor';
import { DocumentEditor } from './DocumentEditor';
import {useAuth} from '../context/AuthContext';
import { 
  ArrowLeft, Monitor, Settings2, Upload, Trash2, Clock, 
  CalendarDays, LayoutDashboard, Loader2, GripVertical, CheckSquare, Square, 
  ImagePlus, Film, FileText, Infinity, X, Edit3, Newspaper, Calendar, Info
} from 'lucide-react';

interface ScreenEditorProps {
  globalTheme: 'dark' | 'light'; // Hier lag wahrscheinlich der Fehler
  screen: any;                   // Dein Monitor-Objekt
  onBack: () => void;            // Die Zurück-Funktion
}

const BACKEND_URL = "http://localhost:5195";

// --- DEINE ORIGINALEN MODULE (Mit Beschreibungen für die Info-Box) ---
const buttonModules = [
  { value: 'document', label: 'Dokumente', icon: <FileText size={24} />, color: '#2196f3', description: 'Perfekt für PDFs, Aushänge und Kundmachungen. Bietet Bearbeitungsschutz (PIN) und wandert nach Ablauf automatisch ins Archiv.' },
  { value: 'news', label: 'Neuigkeiten', icon: <Newspaper size={24} />, color: '#ff9800', description: 'Ideal für Stadt-News oder Ankündigungen. Bietet neben dem Bild auch große Textfelder für Nachrichten und ein generelles Ablaufdatum.' },
  { value: 'event', label: 'Events', icon: <Calendar size={24} />, color: '#9c27b0', description: 'Speziell für Veranstaltungen. Beinhaltet ein klares Event-Datum, nach dem die Einträge automatisch chronologisch auf dem Monitor sortiert werden.' }
];

export const ScreenEditor = ({globalTheme, screen, onBack }: ScreenEditorProps) => {
  // --- GLOBALE STATES ---
  const [playlist, setPlaylist] = useState<any[]>([]);
  const {user, hasPermission} = useAuth();
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [selectedMediaIds, setSelectedMediaIds] = useState<number[]>([]);
  const [autoSelectNames, setAutoSelectNames] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [draggedItemIdx, setDraggedItemIdx] = useState<number | null>(null);

  // --- MODAL STATES ---
  const [isUploadTypeModalOpen, setIsUploadTypeModalOpen] = useState(false);
  const [uploadAcceptType, setUploadAcceptType] = useState<string>('image/*');
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [customDateInput, setCustomDateInput] = useState('');

  // =========================================================================
  // LAYOUT & TAB DESIGN STATES
  // =========================================================================
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [layoutType, setLayoutType] = useState(screen.layoutType || 'sidebar');
  
  const initialExtraCount = screen.buttonCount ? (screen.buttonNames?.includes('Allgemein') ? screen.buttonCount - 1 : screen.buttonCount) : 0;
  const [extraButtonCount, setExtraButtonCount] = useState(Math.max(0, initialExtraCount));

  const getInitialArray = (str: string) => {
    if (!str) return [];
    let arr = str.split(',').map(s => s.trim());
    if (arr.length > 0) arr.shift(); 
    return arr;
  };
  
  const [extraNames, setExtraNames] = useState<string[]>(getInitialArray(screen.buttonNames));
  const [extraTypes, setExtraTypes] = useState<string[]>(getInitialArray(screen.buttonTypes));

  const [tabConfig, setTabConfig] = useState<{isOpen: boolean, index: number, name: string, type: string} | null>(null);

  const currentTabName = activeTabIdx === 0 ? 'Allgemein' : (extraNames[activeTabIdx - 1] || `Tab ${activeTabIdx}`);
  const activePlaylist = playlist.filter(item => item.tabName === currentTabName);

  // --- INITIALISIERUNG ---
  useEffect(() => {
    if (screen.id) loadExistingMedia();
    if (!screen.buttonCount || screen.buttonCount === 0) {
      setIsLayoutModalOpen(true);
    }
  }, [screen.id]);

  useEffect(() => {
    if (autoSelectNames.length > 0 && playlist.length > 0) {
      const newlyUploadedIds = playlist.filter(item => autoSelectNames.includes(item.name)).map(item => item.id);
      if (newlyUploadedIds.length > 0) {
        setSelectedMediaIds(prev => Array.from(new Set([...prev, ...newlyUploadedIds])));
        setAutoSelectNames([]); 
      }
    }
  }, [playlist, autoSelectNames]);


  // =========================================================================
  // API FUNKTIONEN
  // =========================================================================

  const loadExistingMedia = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/media/${screen.id}?t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        const formattedMedia = data.map((item: any) => ({
          id: item.id, tabName: item.tabName, name: item.fileName, duration: item.duration,
          type: item.fileType, date: item.expirationDate || 'Immer', uploadDate: item.uploadDate,
          title: item.title, content: item.content, eventDate: item.eventDate, eventTime: item.eventTime,
          docNumber: item.docNumber || '', category: item.category || 'Dokument', isProtected: item.isProtected,
          pinCode: item.pinCode, isLive: item.isLive, url: `${BACKEND_URL}/uploads/${item.fileName}`,
          thumbnailUrl: item.fileType === 'video' ? `${BACKEND_URL}/uploads/${(item.fileName || "").replace(/\.[^/.]+$/, "")}_thumb.jpg` : undefined
        }));
        setPlaylist(formattedMedia);
      }
    } catch (error) { console.error("Fehler beim Laden:", error); }
  };

  const saveLayoutToDatabase = async () => {
    try {
      const finalNames = ['Allgemein', ...extraNames.slice(0, extraButtonCount)].join(',');
      const finalTypes = ['image', ...extraTypes.slice(0, extraButtonCount)].join(',');
      
      const response = await fetch(`${BACKEND_URL}/api/media/monitor/${screen.id}/layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id?.toString(), // <--- HIER eingefügt
          layoutType: layoutType,
          buttonCount: extraButtonCount + 1,
          buttonNames: finalNames,
          buttonTypes: finalTypes
        })
      });

      if (response.ok) {
        screen.buttonCount = extraButtonCount + 1;
        screen.layoutType = layoutType;
        screen.buttonNames = finalNames;
        screen.buttonTypes = finalTypes;
        setIsLayoutModalOpen(false);
      } else {
        alert("Fehler beim Speichern in der Datenbank.");
      }
    } catch (error) { alert("Server nicht erreichbar."); }
  };

  const saveTabConfigToDatabase = async () => {
    if (!tabConfig) return;
    if (!tabConfig.name.trim()) { alert("Bitte vergib einen Namen für den Tab!"); return; }
    
    const newNames = [...extraNames];
    const newTypes = [...extraTypes];
    
    while(newNames.length <= tabConfig.index) newNames.push('');
    while(newTypes.length <= tabConfig.index) newTypes.push('document');

    newNames[tabConfig.index] = tabConfig.name;
    newTypes[tabConfig.index] = tabConfig.type;

    try {
      const finalNames = ['Allgemein', ...newNames.slice(0, extraButtonCount)].join(',');
      const finalTypes = ['image', ...newTypes.slice(0, extraButtonCount)].join(',');

      await fetch(`${BACKEND_URL}/api/media/monitor/${screen.id}/layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id?.toString(), // <--- HIER eingefügt
          layoutType: layoutType,
          buttonCount: extraButtonCount + 1,
          buttonNames: finalNames,
          buttonTypes: finalTypes
        })
      });
      
      setExtraNames(newNames);
      setExtraTypes(newTypes);
      screen.buttonNames = finalNames;
      screen.buttonTypes = finalTypes;
      setTabConfig(null);
    } catch (e) { alert("Fehler beim Speichern des Tabs!"); }
  };


  // --- RESTLICHE MEDIEN FUNKTIONEN ---
  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await fetch(`${BACKEND_URL}/api/media/publish-all/${screen.id}?tabName=${encodeURIComponent(currentTabName)}`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id?.toString() }) // <--- HIER eingefügt
      });
      // Falls dieser 2. Endpunkt auch im C# Backend gesichert ist:
      await fetch(`${BACKEND_URL}/api/monitors/${screen.id}/publish`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id?.toString() }) // <--- HIER eingefügt
      });
      await loadExistingMedia(); 
    } catch (error) { alert('Fehler beim Publizieren.'); }
    setIsPublishing(false);
  };

  const deleteSingleItem = async (id: number) => {
    if (!window.confirm("Dieses Element wirklich unwiderruflich löschen?")) return;
    try {
      // <--- HIER: ?userId=... an die URL angehängt
      const response = await fetch(`${BACKEND_URL}/api/media/${id}?userId=${user?.id}`, { method: 'DELETE' });
      if (response.ok) setPlaylist(prev => prev.filter(item => item.id !== id));
    } catch (error) { console.error(error); }
  };

  const deleteSelected = async () => {
    if (selectedMediaIds.length === 0) return;
    try {
      await Promise.all(selectedMediaIds.map(id => 
        // <--- HIER: ?userId=... an die URL angehängt
        fetch(`${BACKEND_URL}/api/media/${id}?userId=${user?.id}`, { method: 'DELETE' })
      ));
      setPlaylist(prev => prev.filter(item => !selectedMediaIds.includes(item.id)));
      setSelectedMediaIds([]);
    } catch (error) { alert("Einige Elemente konnten nicht gelöscht werden."); }
  };

  const toggleSelection = (id: number) => {
    setSelectedMediaIds(prev => prev.includes(id) ? prev.filter(mediaId => mediaId !== id) : [...prev, id]);
  };

  const applyExpirationDate = async (dateString: string) => {
    if (selectedMediaIds.length === 0) return;
    try {
      await Promise.all(selectedMediaIds.map(id =>
        fetch(`${BACKEND_URL}/api/media/${id}/expire`, { 
          method: 'PUT', 
          headers: { 'Content-Type': 'application/json' }, 
          // <--- HIER: userId eingefügt
          body: JSON.stringify({ userId: user?.id?.toString(), Date: dateString }) 
        })
      ));
      setPlaylist(prev => prev.map(item => selectedMediaIds.includes(item.id) ? { ...item, date: dateString } : item));
    } catch (error) { alert("Fehler beim Speichern."); } 
    finally { setSelectedMediaIds([]); setIsDateModalOpen(false); setCustomDateInput(''); }
  };

  const handleDragStart = (index: number) => { setDraggedItemIdx(index); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const handleDrop = async (dropIdx: number) => {
    if (draggedItemIdx === null || draggedItemIdx === dropIdx) return;
    const newActiveItems = [...activePlaylist];
    const draggedItem = newActiveItems[draggedItemIdx];
    newActiveItems.splice(draggedItemIdx, 1);
    newActiveItems.splice(dropIdx, 0, draggedItem);
    
    const hiddenItems = playlist.filter(item => item.tabName !== currentTabName);
    const newPlaylist = [...hiddenItems, ...newActiveItems];
    setPlaylist(newPlaylist);
    setDraggedItemIdx(null);

    const orderedIds = newPlaylist.map(item => item.id);
    try { 
      await fetch(`${BACKEND_URL}/api/media/reorder`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        // <--- HIER: Die Struktur an das C# ReorderRequest-DTO angepasst
        body: JSON.stringify({ 
          userId: user?.id?.toString(), 
          OrderedIds: orderedIds 
        }) 
      }); 
    } 
    catch (e) { alert("Speichern der Reihenfolge fehlgeschlagen."); }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('userId',user?.id?.toString()||'');
    formData.append('file', file);
    formData.append('monitorId', screen.id);
    formData.append('tabName', currentTabName);
    formData.append('duration', '15s');

    try {
      const response = await fetch(`${BACKEND_URL}/api/media/upload`, { method: 'POST', body: formData });
      if (response.ok) {
        const result = await response.json();
        if (result.urls) {
          setAutoSelectNames(result.urls.map((url: string) => url.split('/').pop() || ""));
          const newItems = result.urls.map((urlPath: string, index: number) => ({
            id: Date.now() + index, tabName: currentTabName, isLive: 0,
            name: urlPath.split('/').pop() || 'Unbekannt', duration: '15s',
            type: urlPath.endsWith('.mp4') || urlPath.endsWith('.webm') ? 'video' : 'image', 
            date: 'Immer', uploadDate: new Date().toLocaleDateString('de-DE'), url: `${BACKEND_URL}${urlPath}`
          }));
          setPlaylist(prev => [...prev, ...newItems]);
        }
      }
    } catch (e) { console.error(e); } 
    finally { setIsUploading(false); if(fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleUploadTypeSelect = (acceptType: string) => {
    setUploadAcceptType(acceptType);
    setIsUploadTypeModalOpen(false);
    setTimeout(() => { if (fileInputRef.current) fileInputRef.current.click(); }, 100);
  };

  const handleSelectAllToggle = () => {
    if (selectedMediaIds.length === playlist.length && playlist.length > 0) {
      setSelectedMediaIds([]);
    } else {
      setSelectedMediaIds(playlist.map(item => item.id));
    }
  };

  // --- HIER KOMMEN DIE THEME-FARBEN HIN ---
  const isDark = globalTheme === 'dark';
  const colors = {
    bgMain: isDark ? '#1e1e1e' : '#f3f4f6',          // Äußerster Hintergrund
    bgHeader: isDark ? '#141414' : '#ffffff',        // Header oben
    bgTabs: isDark ? '#1c1c1c' : '#ffffff',          // Tab-Leiste
    bgSidebar: isDark ? '#1e1e1e' : '#ffffff',       // Linke Leiste (Playlist)
    bgContent: isDark ? '#0a0a0a' : '#f9fafb',       // Rechte Hauptfläche (Vorschau)
    bgItem: isDark ? '#252525' : '#ffffff',          // Normales Element in der Liste
    bgItemSelected: isDark ? '#2a2638' : '#f3f0ff',  // Ausgewähltes Element in der Liste
    bgModal: isDark ? '#1c1c1c' : '#ffffff',         // Modal Hintergrund
    bgInput: isDark ? '#0a0a0a' : '#f9fafb',         // Textfelder
    textMain: isDark ? '#ffffff' : '#111827',        // Normaler Text
    textSub: isDark ? '#888888' : '#6b7280',         // Grauer Text
    border: isDark ? '#2d2d2d' : '#e5e7eb',          // Standard-Linien
    borderItem: isDark ? '#333333' : '#e5e7eb',      // Linien um Kacheln
    borderStrong: isDark ? '#444444' : '#d1d5db',    // NEU: Stärkere Kontrastlinien (z.B. Sidebar-Trenner)
    primary: '#8a6ce0',                              // Dein Lila
    primaryHover: '#7a5bc7',
    backdrop: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.5)',
    btnSecondaryBg: isDark ? '#252525' : '#f3f4f6',
    btnSecondaryHover: isDark ? '#333333' : '#e5e7eb',
    btnActionBg: isDark ? '#333333' : '#f3f4f6',
    btnActionHover: isDark ? '#444444' : '#e5e7eb'
  };
  return (
    <div style={{ color: colors.textMain, backgroundColor: colors.bgMain, height: '100vh', display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease' }}>
      
      {/* --- HEADER --- */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', backgroundColor: colors.bgHeader, borderBottom: `1px solid ${colors.border}`, transition: 'all 0.3s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: colors.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowLeft size={20} />
          </button>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 400, color: colors.textMain }}>Screen - Management <span style={{ color: colors.textSub }}>| {screen.name}</span></h2>
        </div>
        {hasPermission('screens.manage') && (<button onClick={() => setIsLayoutModalOpen(true)} style={{ background: colors.btnSecondaryBg, border: `1px solid ${colors.borderItem}`, color: colors.textMain, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', transition: 'all 0.2s' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.btnSecondaryHover}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.btnSecondaryBg}
        >
          <Settings2 size={16} /> Layout / Design
        </button>
        )}
      </div>

      {/* --- DYNAMISCHE TABS --- */}
      <div style={{ backgroundColor: colors.bgTabs, borderBottom: `1px solid ${colors.border}`, padding: '12px 24px 0 24px', display: 'flex', gap: '4px', overflowX: 'auto', transition: 'all 0.3s ease' }}>
        
        {/* TAB 0: ALLGEMEIN */}
        <button onClick={() => { setActiveTabIdx(0); setSelectedMediaIds([]); }}
          style={{ padding: '10px 24px', backgroundColor: activeTabIdx === 0 ? (isDark ? '#2d2d2d' : '#f9fafb') : 'transparent', color: activeTabIdx === 0 ? colors.textMain : colors.textSub, border: 'none', borderTopLeftRadius: '8px', borderTopRightRadius: '8px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: activeTabIdx === 0 ? `2px solid ${colors.primary}` : '2px solid transparent', transition: 'all 0.2s' }}
        >
          <LayoutDashboard size={16} /> Allgemein
        </button>

        {/* EXTRA TABS */}
        {Array.from({ length: extraButtonCount }).map((_, i) => {
          const tabIndex = i + 1; 
          const isActive = activeTabIdx === tabIndex;
          const isConfigured = !!extraNames[i] && extraNames[i] !== '' && !!extraTypes[i] && extraTypes[i] !== '';
          const name = isConfigured ? extraNames[i] : `Tab ${tabIndex}`;
          
          return (
            <button key={tabIndex} 
              onClick={() => { 
                setActiveTabIdx(tabIndex); 
                setSelectedMediaIds([]); 
                if (!isConfigured) {
                  setTabConfig({ isOpen: true, index: i, name: '', type: 'document' }); 
                }
              }}
              style={{ padding: '10px 24px', backgroundColor: isActive ? (isDark ? '#2d2d2d' : '#f9fafb') : 'transparent', color: isActive ? colors.textMain : colors.textSub, border: 'none', borderTopLeftRadius: '8px', borderTopRightRadius: '8px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: isActive ? `2px solid ${colors.primary}` : '2px solid transparent', position: 'relative', transition: 'all 0.2s' }}
            >
              {name}
              {isActive && isConfigured && hasPermission('screens.manage') && (
                <div onClick={(e) => { e.stopPropagation(); setTabConfig({ isOpen: true, index: i, name: extraNames[i] || '', type: extraTypes[i] || 'document' }); }}
                  style={{ marginLeft: '8px', padding: '4px', background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', borderRadius: '4px', display: 'flex' }}>
                  <Edit3 size={12} color={colors.textSub} />
                </div>
              )}
            </button>
          );
        })}

        {activeTabIdx === 0 && hasPermission('media.publish') && (
          <button onClick={handlePublish} disabled={isPublishing} style={{ opacity: isPublishing ? 0.7 : 1,marginLeft: 'auto', marginBottom: '11px', padding: '8px 16px', background: isPublishing ? (isDark ? '#555' : '#9ca3af') : '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: isPublishing ? 'wait' : 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.2s' }}>
            {isPublishing ? <Loader2 size={14} className="animate-spin" /> : '🚀'} {isPublishing ? 'Wird gesendet...' : 'Änderungen Live schalten'}
          </button>
        )}
      </div>

      {/* --- MAIN CONTENT SWITCHER --- */}
      {/* Die Unter-Editoren bekommen ihr Theme idealerweise auch mitgegeben, falls sie eigene feste Farben haben */}
      {activeTabIdx !== 0 && extraTypes[activeTabIdx - 1] === 'event' ? (
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: colors.bgContent }}><EventEditor monitorId={screen.id} tabName={currentTabName} events={activePlaylist} onRefresh={async () => await loadExistingMedia()} onDelete={deleteSingleItem} onPublish={handlePublish} globalTheme={globalTheme} /></div>
      ) : activeTabIdx !== 0 && extraTypes[activeTabIdx - 1] === 'news' ? (
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: colors.bgContent }}><NewsEditor monitorId={screen.id} tabName={currentTabName} news={activePlaylist} onRefresh={async () => await loadExistingMedia()} onDelete={deleteSingleItem} onPublish={handlePublish} globalTheme={globalTheme} /></div>
      ) : activeTabIdx !== 0 && extraTypes[activeTabIdx - 1] === 'document' ? (
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: colors.bgContent }}><DocumentEditor monitorId={screen.id} tabName={currentTabName} documents={activePlaylist} onRefresh={async () => await loadExistingMedia()} onDelete={deleteSingleItem} onPublish={handlePublish} globalTheme={globalTheme} /></div>
      ) : (
        // --- ALLGEMEIN ---
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', backgroundColor: colors.bgMain }}>
          
          {/* LINKE SEITE: PLAYLIST */}
          <div style={{ width: '320px', backgroundColor: colors.bgSidebar, borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease' }}>
            <div style={{ padding: '12px', borderBottom: `1px solid ${colors.border}`, color: colors.textSub, fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}><span>Reihenfolge & Auswahl</span><span>{activePlaylist.length} Elemente</span></div>
              {playlist.length > 0 && (
                <button onClick={handleSelectAllToggle} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '12px', fontWeight: 500, padding: 0 }}>
                  {selectedMediaIds.length === playlist.length ? 'Auswahl aufheben' : 'Alle auswählen'}
                </button>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activePlaylist.length === 0 ? <div style={{ textAlign: 'center', padding: '40px 0', color: colors.textSub, fontSize: '13px' }}>Keine Medien vorhanden</div> : activePlaylist.map((item, index) => {
                const isSelected = selectedMediaIds.includes(item.id);
                const isLive = item.isLive === 1;
                let isExpired = false;
                if (item.date && item.date !== 'Immer') {
                  const cleanDateStr = item.date.replace('Bis ', '').trim();
                  let expDate;
                  if (cleanDateStr.includes('-')) expDate = new Date(`${cleanDateStr}T23:59:59`);
                  else if (cleanDateStr.includes('.')) { const [d, m, y] = cleanDateStr.split('.'); expDate = new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59); }
                  if (expDate && !isNaN(expDate.getTime())) isExpired = expDate < new Date();
                }

                return (
                  <div key={item.id} draggable onDragStart={() => handleDragStart(index)} onDragOver={handleDragOver} onDrop={() => handleDrop(index)} onClick={() => toggleSelection(item.id)} 
                    style={{ display: 'flex', backgroundColor: isSelected ? colors.bgItemSelected : colors.bgItem, border: isSelected ? `1px solid ${colors.primary}` : (isExpired ? `1px dashed ${colors.borderItem}` : `1px solid ${colors.borderItem}`), borderRadius: '6px', padding: '8px', cursor: 'pointer', position: 'relative', opacity: isExpired || draggedItemIdx === index ? 0.4 : 1, filter: isExpired ? 'grayscale(100%)' : 'none', transition: 'all 0.2s', boxShadow: (!isDark && !isSelected) ? '0 1px 3px rgba(0,0,0,0.05)' : 'none' }}>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: colors.textSub, marginRight: '8px', cursor: 'grab' }}><GripVertical size={14} /><span style={{ fontSize: '10px', marginTop: '4px' }}>{index + 1}</span></div>
                    <div style={{ width: '70px', height: '52px', backgroundColor: isDark ? '#111' : '#e5e7eb', borderRadius: '4px', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                      {item.url ? <img src={item.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <FileText size={20} color={colors.textSub} style={{ margin: '16px auto', display: 'block' }} />}
                      {item.date && item.date !== 'Immer' && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: isExpired ? 'rgba(239, 68, 68, 0.9)' : 'rgba(217, 119, 6, 0.9)', color: '#fff', fontSize: '9px', padding: '2px 4px', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={8} /> {item.date.replace('Bis ', '')}</div>}
                    </div>
                    <div style={{ marginLeft: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden', flex: 1 }}>
                      <div style={{ fontSize: '12px', color: colors.textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: isExpired ? 'line-through' : 'none' }}>{item.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                        {isExpired ? <span style={{ backgroundColor: 'rgba(107, 114, 128, 0.1)', color: '#9ca3af', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', border: '1px solid rgba(107, 114, 128, 0.2)' }}>Abgelaufen</span> : <span style={{ backgroundColor: isLive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: isLive ? '#10b981' : '#f59e0b', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', border: `1px solid ${isLive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}` }}>{isLive ? '● Live' : 'Entwurf'}</span>}
                        <span style={{ color: colors.textSub, fontSize: '12px' }}>•</span><span style={{ fontSize: '11px', color: colors.textSub }}>{item.uploadDate || 'Heute'}</span>
                        {item.type === 'video' && <><span style={{ color: colors.textSub, fontSize: '12px' }}>•</span><span style={{ fontSize: '11px', color: colors.textSub }}>🎬</span></>}
                      </div>
                    </div>
                    <div style={{ position: 'absolute', top: '8px', right: '8px', color: isSelected ? colors.primary : colors.textSub }}>{isSelected ? <CheckSquare size={16} /> : <Square size={16} />}</div>
                  </div>
                );
              })}
            </div>

            {/* AKTIONEN-BEREICH UNTEN */}
          <div style={{ padding: '16px', borderTop: `1px solid ${colors.borderStrong}`, backgroundColor: colors.bgSidebar, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            
            {/* Versteckter File-Upload */}
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept={uploadAcceptType} onChange={handleFileUpload} />
            
            {/* HINZUFÜGEN BUTTON */}
            <button 
              onClick={() => setIsUploadTypeModalOpen(true)} 
              disabled={isUploading || !hasPermission('media.upload')} 
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                width: '100%', padding: '8px', 
                backgroundColor: hasPermission('media.upload') ? colors.primary : colors.bgInput,
                color: hasPermission('media.upload') ? '#fff' : colors.textSub,
                border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, 
                cursor: (isUploading || !hasPermission('media.upload')) ? 'not-allowed' : 'pointer',
                opacity: (isUploading || !hasPermission('media.upload')) ? 0.6 : 1,
                transition: 'all 0.2s'
              }}
            >
              {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} 
              {hasPermission('media.upload') ? 'Hinzufügen' : 'Kein Upload-Recht'}
            </button>
            
            {/* ABLAUFDATUM BUTTON */}
            <button 
              onClick={() => setIsDateModalOpen(true)} 
              disabled={selectedMediaIds.length === 0 || !hasPermission('media.upload')} 
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                width: '100%', padding: '8px', 
                backgroundColor: 'transparent',
                color: (selectedMediaIds.length > 0 && hasPermission('media.upload')) ? colors.textMain : colors.textSub,
                border: `1px solid ${(selectedMediaIds.length > 0 && hasPermission('media.upload')) ? colors.borderStrong : colors.border}`, 
                borderRadius: '8px', fontSize: '13px', fontWeight: 600, 
                cursor: (selectedMediaIds.length === 0 || !hasPermission('media.upload')) ? 'not-allowed' : 'pointer',
                opacity: (selectedMediaIds.length === 0 || !hasPermission('media.upload')) ? 0.5 : 1,
                transition: 'all 0.2s'
              }}
            >
              <CalendarDays size={14} /> Ablaufdatum setzen
            </button>
            
            {/* LÖSCHEN BUTTON */}
            <button 
              onClick={deleteSelected} 
              disabled={selectedMediaIds.length === 0 || !hasPermission('media.delete')} 
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                width: '100%', padding: '8px', 
                backgroundColor: (selectedMediaIds.length > 0 && hasPermission('media.delete')) ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                color: (selectedMediaIds.length > 0 && hasPermission('media.delete')) ? '#ef4444' : colors.textSub,
                border: (selectedMediaIds.length > 0 && hasPermission('media.delete')) ? '1px solid rgba(239, 68, 68, 0.3)' : `1px solid ${colors.border}`, 
                borderRadius: '8px', fontSize: '13px', fontWeight: 600, 
                cursor: (selectedMediaIds.length === 0 || !hasPermission('media.delete')) ? 'not-allowed' : 'pointer',
                opacity: (selectedMediaIds.length === 0 || !hasPermission('media.delete')) ? 0.5 : 1,
                transition: 'all 0.2s'
              }}
            >
              <Trash2 size={14} /> {hasPermission('media.delete') ? 'Ausgewählte löschen' : 'Kein Lösch-Recht'}
            </button>

          </div>
          </div>

          {/* RECHTE SEITE: MAIN PREVIEW */}
          <div style={{ flex: 1, overflowY: 'auto', backgroundColor: colors.bgContent, padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px', transition: 'all 0.3s ease' }}>
            {activePlaylist.length === 0 && <div style={{ marginTop: '20vh', textAlign: 'center', color: colors.textSub }}><Monitor size={64} style={{ opacity: 0.2, margin: '0 auto 16px' }} /><div style={{ fontSize: '18px' }}>Keine Medien zur Anzeige</div></div>}
            
            {activePlaylist.map((item, index) => (
               <div key={item.id} style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ color: colors.textSub, fontSize: '12px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}><span>{index + 1}. {item.name}</span><span>{item.duration}</span></div>
                  <div style={{ width: '100%', aspectRatio: '16/9', backgroundColor: isDark ? '#111' : '#fff', border: `1px solid ${colors.borderItem}`, boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: '8px' }}>
                     {item.type === 'image' && item.url ? <img src={item.url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : item.type === 'video' && item.url ? <video src={item.url} controls muted style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <FileText size={48} color={colors.textSub} />}
                  </div>
               </div>
            ))}
          </div>
          
        </div>
      )}

      {/* --- MODALS --- */}
      
      {isUploadTypeModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: colors.backdrop, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, backdropFilter: 'blur(5px)' }}>
          <div style={{ backgroundColor: colors.bgModal, padding: '40px', borderRadius: '16px', width: '550px', border: `1px solid ${colors.borderStrong}`, boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.5)' : '0 20px 50px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div><h2 style={{ margin: '0 0 8px 0', fontSize: '20px', color: colors.textMain }}>Neues Medium hinzufügen</h2><p style={{ margin: 0, color: colors.textSub, fontSize: '14px' }}>Welche Art von Datei möchtest du hochladen?</p></div>
              <button onClick={() => setIsUploadTypeModalOpen(false)} style={{ background: 'none', border: 'none', color: colors.textSub, cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div onClick={() => handleUploadTypeSelect('image/*')} style={{ backgroundColor: colors.bgItem, border: `1px solid ${colors.borderItem}`, borderRadius: '12px', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', cursor: 'pointer' }}><div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(138, 108, 224, 0.1)', color: '#8a6ce0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ImagePlus size={24} /></div><div style={{ textAlign: 'center' }}><div style={{ fontWeight: 600, fontSize: '14px', color: colors.textMain }}>Bild</div><div style={{ fontSize: '11px', color: colors.textSub, marginTop: '4px' }}>JPG, PNG, GIF</div></div></div>
              <div onClick={() => handleUploadTypeSelect('video/*')} style={{ backgroundColor: colors.bgItem, border: `1px solid ${colors.borderItem}`, borderRadius: '12px', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', cursor: 'pointer' }}><div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(76, 175, 80, 0.1)', color: '#4caf50', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Film size={24} /></div><div style={{ textAlign: 'center' }}><div style={{ fontWeight: 600, fontSize: '14px', color: colors.textMain }}>Video</div><div style={{ fontSize: '11px', color: colors.textSub, marginTop: '4px' }}>MP4, WebM</div></div></div>
              <div onClick={() => handleUploadTypeSelect('application/pdf')} style={{ backgroundColor: colors.bgItem, border: `1px solid ${colors.borderItem}`, borderRadius: '12px', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', cursor: 'pointer' }}><div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(33, 150, 243, 0.1)', color: '#2196f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={24} /></div><div style={{ textAlign: 'center' }}><div style={{ fontWeight: 600, fontSize: '14px', color: colors.textMain }}>PDF Dokument</div><div style={{ fontSize: '11px', color: colors.textSub, marginTop: '4px' }}>Wird in Bilder konvertiert</div></div></div>
            </div>
          </div>
        </div>
      )}

      {isDateModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: colors.backdrop, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, backdropFilter: 'blur(5px)' }}>
          <div style={{ backgroundColor: colors.bgModal, padding: '32px', borderRadius: '16px', width: '500px', border: `1px solid ${colors.borderStrong}`, boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.5)' : '0 20px 50px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div><h2 style={{ margin: '0 0 8px 0', fontSize: '20px', color: colors.textMain }}>Ablaufdatum setzen</h2><p style={{ margin: 0, color: colors.textSub, fontSize: '13px' }}>Wie lange sollen die ausgewählten Medien angezeigt werden?</p></div>
              <button onClick={() => setIsDateModalOpen(false)} style={{ background: 'none', border: 'none', color: colors.textSub, cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              <div onClick={() => applyExpirationDate('Immer')} style={{ backgroundColor: colors.bgItem, border: `1px solid ${colors.borderItem}`, borderRadius: '10px', padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><Infinity size={20} color="#8a6ce0" /><span style={{ fontSize: '13px', fontWeight: 600, color: colors.textMain }}>Unbegrenzt</span></div>
              <div onClick={() => { let d = new Date(); d.setDate(d.getDate()+7); applyExpirationDate(`Bis ${d.toLocaleDateString('de-DE')}`); }} style={{ backgroundColor: colors.bgItem, border: `1px solid ${colors.borderItem}`, borderRadius: '10px', padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><CalendarDays size={20} color="#2196f3" /><span style={{ fontSize: '13px', fontWeight: 600, color: colors.textMain }}>1 Woche</span></div>
              <div onClick={() => { let d = new Date(); d.setDate(d.getDate()+30); applyExpirationDate(`Bis ${d.toLocaleDateString('de-DE')}`); }} style={{ backgroundColor: colors.bgItem, border: `1px solid ${colors.borderItem}`, borderRadius: '10px', padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><CalendarDays size={20} color="#4caf50" /><span style={{ fontSize: '13px', fontWeight: 600, color: colors.textMain }}>1 Monat</span></div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input type="text" placeholder="z.B. Bis 24.12.2026" value={customDateInput} onChange={(e) => setCustomDateInput(e.target.value)} style={{ flex: 1, backgroundColor: colors.bgInput, border: `1px solid ${colors.borderStrong}`, color: colors.textMain, padding: '12px 16px', borderRadius: '8px', fontSize: '14px', outline: 'none' }} />
              <button onClick={() => { if(customDateInput.trim() !== '') applyExpirationDate(customDateInput); }} style={{ backgroundColor: colors.primary, color: '#fff', border: 'none', padding: '0 20px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Anwenden</button>
            </div>
          </div>
        </div>
      )}

      {isLayoutModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: colors.backdrop, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: colors.bgModal, padding: '40px', borderRadius: '12px', width: '600px', border: `1px solid ${colors.borderStrong}` }}>
            <h2 style={{ marginTop: 0, textAlign: 'center', color: colors.textMain }}>Layout & Design</h2>
            <p style={{ textAlign: 'center', color: colors.textSub, marginBottom: '30px' }}>Wie soll der Monitor grundsätzlich aussehen?</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '32px' }}>
              {['sidebar', 'bottom', 'fullscreen'].map(type => (
                <div key={type} onClick={() => setLayoutType(type)} style={{ cursor: 'pointer', textAlign: 'center' }}>
                  <div style={{ height: '100px', borderRadius: '12px', border: layoutType === type ? `3px solid ${colors.primary}` : `1px solid ${colors.borderItem}`, backgroundColor: isDark ? '#0a0a0a' : '#f9fafb', position: 'relative', overflow: 'hidden' }}>
                    {type === 'sidebar' && <div style={{ width: '25%', height: '100%', background: isDark ? '#1a1a1a' : '#e5e7eb', borderRight: `1px solid ${colors.borderItem}` }} />}
                    {type === 'bottom' && <div style={{ width: '100%', height: '25%', background: isDark ? '#1a1a1a' : '#e5e7eb', borderTop: `1px solid ${colors.borderItem}`, position: 'absolute', bottom: 0 }} />}
                  </div>
                  <p style={{ marginTop: '10px', fontSize: '12px', color: layoutType === type ? colors.textMain : colors.textSub, textTransform: 'uppercase', fontWeight: layoutType === type ? 'bold' : 'normal' }}>{type}</p>
                </div>
              ))}
            </div>

            <p style={{ textAlign: 'center', color: colors.textSub, marginBottom: '20px' }}>Wie viele <b>zusätzliche</b> Menü-Punkte (neben "Allgemein") benötigst du?</p>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '40px' }}>
                <button onClick={() => setExtraButtonCount(Math.max(0, extraButtonCount - 1))} style={{ padding: '10px 20px', fontSize: '20px', background: colors.btnSecondaryBg, color: colors.textMain, border: `1px solid ${colors.borderItem}`, borderRadius: '8px', cursor: 'pointer' }}>-</button>
                <span style={{ fontSize: '32px', fontWeight: 'bold', color: colors.textMain }}>{extraButtonCount}</span>
                <button onClick={() => setExtraButtonCount(Math.min(5, extraButtonCount + 1))} style={{ padding: '10px 20px', fontSize: '20px', background: colors.btnSecondaryBg, color: colors.textMain, border: `1px solid ${colors.borderItem}`, borderRadius: '8px', cursor: 'pointer' }}>+</button>
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { if (!screen.buttonCount || screen.buttonCount === 0) { onBack(); } else { setLayoutType(screen.layoutType || 'sidebar'); const resetCount = screen.buttonCount ? (screen.buttonNames?.includes('Allgemein') ? screen.buttonCount - 1 : screen.buttonCount) : 0; setExtraButtonCount(Math.max(0, resetCount)); setIsLayoutModalOpen(false); } }} style={{ flex: 1, padding: '14px', background: 'transparent', border: `1px solid ${colors.textSub}`, color: colors.textSub, borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>Abbrechen</button>
              <button onClick={saveLayoutToDatabase} style={{ flex: 2, padding: '14px', background: colors.primary, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Speichern & Anwenden</button>
            </div>          
          </div>
        </div>
      )}

      {tabConfig?.isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: colors.backdrop, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ backgroundColor: colors.bgModal, padding: '32px', borderRadius: '24px', width: '480px', border: `1px solid ${colors.primary}` }}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: '20px', color: colors.textMain }}>Tab konfigurieren</h3>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '11px', color: colors.textSub, fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '1px' }}>NAME DES BUTTONS</label>
              <input value={tabConfig.name} onChange={(e) => setTabConfig({...tabConfig, name: e.target.value})} placeholder="z.B. Verordnungen, Events..." style={{ width: '100%', background: colors.bgInput, border: `1px solid ${colors.borderStrong}`, padding: '16px', color: colors.textMain, borderRadius: '12px', outline: 'none' }} />
            </div>
            
            <div style={{ marginBottom: '32px' }}>
              <label style={{ fontSize: '11px', color: colors.textSub, fontWeight: 600, display: 'block', marginBottom: '8px', letterSpacing: '1px' }}>FUNKTION (MODUL)</label>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                {buttonModules.map(m => {
                  const isSelected = tabConfig.type === m.value;
                  return (
                    <div key={m.value} onClick={() => setTabConfig({...tabConfig, type: m.value})} style={{ padding: '16px', borderRadius: '12px', cursor: 'pointer', border: isSelected ? `2px solid ${m.color}` : `1px solid ${colors.borderItem}`, textAlign: 'center', backgroundColor: isSelected ? m.color + '15' : colors.bgItem, color: isSelected ? m.color : colors.textSub, transition: 'all 0.2s' }}>
                      {m.icon}
                      <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '8px', color: isSelected ? colors.textMain : colors.textSub }}>{m.label}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: '16px', padding: '16px', backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderRadius: '12px', border: `1px solid ${colors.borderItem}`, display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                 <Info size={18} color={colors.primary} style={{ flexShrink: 0, marginTop: '2px' }} />
                 <div style={{ fontSize: '13px', color: colors.textSub, lineHeight: '1.5' }}>
                   {buttonModules.find(m => m.value === tabConfig.type)?.description || 'Bitte wähle ein Modul aus.'}
                 </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setTabConfig(null)} style={{ flex: 1, padding: '16px', borderRadius: '12px', background: 'transparent', border: `1px solid ${colors.textSub}`, color: colors.textSub, fontWeight: 600, cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={saveTabConfigToDatabase} style={{ flex: 2, padding: '16px', borderRadius: '12px', background: colors.primary, border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Tab Speichern</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
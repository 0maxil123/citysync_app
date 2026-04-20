import React, { useState, useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { FileText, Newspaper, Calendar, LayoutGrid, Shield, CloudSun, Monitor, Home } from 'lucide-react';
import { db } from '../db'; 
import { DocumentLayout } from './DocumentLayout';
import {EventLayout} from './EventLayout';
import { NewsLayout } from './NewsLayout';

export const PlaybackView = ({ screenConfig }: { screenConfig: any }) => {
  const [time, setTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [playlist, setPlaylist] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const slideshowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tabs, setTabs] = useState<{name: string, type: string}[]>([]);

  const [branding, setBranding] = useState({
    municipalityName: 'Wird geladen...',
    logoBase64: '',
    globalTicker: 'System startet...'
  });

  const renderMainContent = () => {
    const activeTabConfig = tabs.find(tab => tab.name === activeTab);
    const currentTabType = activeTabConfig?.type || 'image';
    const currentTabMedia = playlist.filter(m => m.tabName === activeTab);

    if (currentTabMedia.length === 0) {
      return (
        <div style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>
          <Monitor size={48} style={{ opacity: 0.2, marginBottom: '10px' }} />
          <h2 style={{ fontSize: '18px' }}>Keine Live-Inhalte in "{activeTab}"</h2>
          <p style={{ fontSize: '14px' }}>Bitte im Dashboard Inhalte live schalten.</p>
        </div>
      );
    }

    switch (currentTabType) {
      case 'document':
        return <DocumentLayout data={currentTabMedia} tabTitle={activeTab} />;
    case 'event':
      return <EventLayout data={currentTabMedia} tabTitle={activeTab} />;
    case 'news':
      return <NewsLayout data={currentTabMedia} tabTitle={activeTab} />;
      default:
        const activeMedia = currentTabMedia[currentIndex] || currentTabMedia[0];
        return (
          <div key={activeMedia?.id} style={{ width: '100%', height: '100%', animation: 'fadeIn 0.5s ease-in' }}>
            {activeMedia?.fileType === 'video' ? (
              <video src={activeMedia.localUrl} autoPlay muted loop style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <img src={activeMedia?.localUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Content" />
            )}
          </div>
        );
    }
  };

  const loadFromBunker = async () => {
    try {
      const allMedia = await db.content.toArray();
      playlist.forEach(item => { if (item.localUrl) URL.revokeObjectURL(item.localUrl); });
      const readyToPlay = allMedia.map(item => ({
        ...item,
        localUrl: URL.createObjectURL(item.blob),
        displayMs: parseInt(item.duration) * 1000 || 15000 
      }));
      setPlaylist(readyToPlay);
      if (!activeTab) setActiveTab('Allgemein');
      setCurrentIndex(0); 
    } catch (err) {
      console.error("Fehler beim Lesen aus IndexedDB:", err);
    }
  };
  // --- DYNAMISCHE TICKER-LOGIK ---
const dynamicTickerText = React.useMemo(() => {
  // 1. Starte mit dem globalen Text vom Server
  let textParts = [branding.globalTicker];

  // 2. Suche alle News-Titel raus
  const newsItems = playlist.filter(m => {
    const tab = tabs.find(t => t.name === m.tabName);
    return tab?.type === 'news';
  });
  if (newsItems.length > 0) {
    const newsTitles = newsItems.map(n => `NEWS: ${n.title}`).join(" +++ ");
    textParts.push(newsTitles);
  }

  // 3. Suche alle Event-Titel mit Datum raus
  const eventItems = playlist.filter(m => {
    const tab = tabs.find(t => t.name === m.tabName);
    return tab?.type === 'event';
  });
  if (eventItems.length > 0) {
    const eventTitles = eventItems.map(e => {
      const date = e.eventDate ? new Date(e.eventDate).toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit'}) : "";
      return `TERMIN: ${date} ${e.title}`;
    }).join(" +++ ");
    textParts.push(eventTitles);
  }

  // Alles mit dem roten +++ verbinden
  return textParts.filter(p => p && p.trim() !== "").join(" +++ ");
}, [branding.globalTicker, playlist, tabs]);

  const performSync = async () => {
    try {
      const response = await fetch(`http://localhost:5195/api/player/sync/${screenConfig.monitorId}`);
      if (!response.ok) throw new Error("Server-Sync fehlgeschlagen");
      const data = await response.json();
      const names = data.buttonNames ? data.buttonNames.split(',') : [];
      const types = data.buttonTypes ? data.buttonTypes.split(',') : [];
      const combinedTabs = names.map((name: string, i: number) => ({ name: name.trim(), type: types[i] || 'image' }))
                                .filter((tab: { name: string; }) => tab.name !== "");
      combinedTabs.sort((a: { name: string; }, b: { name: string; }) => {
        if (a.name.toLowerCase() === 'allgemein') return -1;
        if (b.name.toLowerCase() === 'allgemein') return 1;
        return 0;
      });
      setTabs(combinedTabs);
      localStorage.setItem('citysync_tabs_cache', JSON.stringify(combinedTabs));
      setBranding({ municipalityName: data.municipalityName, logoBase64: data.logoBase64, globalTicker: data.globalTicker });
      localStorage.setItem('citysync_branding_cache', JSON.stringify(data));
      for (const item of data.media) {
        const stored = await db.content.get(item.id);
        if (!stored) {
          const fileFetch = await fetch(`http://localhost:5195${item.url}`);
          const blob = await fileFetch.blob();
          await db.content.put({ ...item, blob, title: item.title || "",content:item.content || "", docNumber: item.docNumber || "", category: item.category || "",eventDate: item.eventDate || "", eventTime: item.eventTime || "" });
        }
      }
      const allLocalIds = await db.content.toCollection().primaryKeys();
      const serverIds = data.media.map((m: any) => m.id);
      await db.content.bulkDelete(allLocalIds.filter(id => !serverIds.includes(id as number)));
      await loadFromBunker();
    } catch (err) {
      console.error("Sync-Fehler:", err);
      await loadFromBunker();
    }
  };

  useEffect(() => {
    const currentItems = playlist.filter(m => m.tabName === activeTab);
    if (currentItems.length > 1) {
      const currentMedia = currentItems[currentIndex] || currentItems[0];
      slideshowTimerRef.current = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % currentItems.length);
      }, currentMedia.displayMs);
    }
    return () => { if (slideshowTimerRef.current) clearTimeout(slideshowTimerRef.current); };
  }, [currentIndex, activeTab, playlist]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    const cachedBranding = localStorage.getItem('citysync_branding_cache');
    if (cachedBranding) setBranding(JSON.parse(cachedBranding));
    const cachedTabs = localStorage.getItem('citysync_tabs_cache');
    if (cachedTabs) setTabs(JSON.parse(cachedTabs));
    if (!activeTab) setActiveTab('Allgemein');
    loadFromBunker().then(() => performSync());
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!screenConfig?.monitorId) return;
    const connection = new signalR.HubConnectionBuilder().withUrl("http://localhost:5195/playerHub").withAutomaticReconnect().build();
    connection.start().then(() => connection.invoke("RegisterPlayer", screenConfig.monitorId)).catch(err => console.error(err));
    connection.on("UpdateContent", () => performSync());
    connection.on("FactoryReset", () => { localStorage.removeItem('citysync_player_config'); window.location.reload(); });
    return () => { connection.stop(); };
  }, [screenConfig?.monitorId]);

  const getTabIcon = (name: string, tabType: string, isActive: boolean) => {
    const color = isActive ? '#ffffff' : '#3A7D5E';
    if (name.toLowerCase() === 'allgemein') return <Home size={20} color={color} />;
    switch (tabType) {
      case 'news': return <Newspaper size={20} color={color} />;
      case 'event': return <Calendar size={20} color={color} />;
      case 'document': return <FileText size={20} color={color} />;
      default: return <LayoutGrid size={20} color={color} />;
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#f4f6f8', color: '#333', display: 'flex', flexDirection: 'column', overflow: 'hidden', margin: 0, padding: 0, fontFamily: "'Segoe UI', Roboto, sans-serif" }}>
      
      {/* HEADER */}
      <header style={{ height: '60px', backgroundColor: '#3A7D5E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ height: '42px', width: '42px', backgroundColor: '#fff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {branding.logoBase64 ? <img src={branding.logoBase64} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '3px' }} alt="Logo" /> : <Shield size={24} color="#3A7D5E" />}
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, margin: 0 }}>{branding.municipalityName}</h1>
        </div>
        <div style={{ textAlign: 'right' }}>
           <div style={{ fontSize: '24px', fontWeight: 700 }}>{time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
           <div style={{ fontSize: '13px', opacity: 0.8 }}>{time.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' })}</div>
        </div>
      </header>

      <main style={{ height: 'calc(100vh - 100px)', display: 'flex' }}>
        
        {/* SIDEBAR - VERTIKAL GESTRECKT */}
        <nav style={{ 
          width: '180px', 
          backgroundColor: '#ffffff', 
          borderRight: '1px solid #e2e8f0', 
          padding: '20px 10px', // Mehr Padding oben/unten
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px', // Größerer Abstand zwischen den Buttons
          boxShadow: '2px 0 5px rgba(0,0,0,0.02)' 
        }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1.5px', marginBottom: '8px', paddingLeft: '8px', textTransform: 'uppercase' }}>
            Menü
          </div>

          {tabs.map((tab, i) => (
            <div 
              key={i} 
              onClick={() => { setActiveTab(tab.name); setCurrentIndex(0); }} 
              style={{ 
                padding: '14px 12px', // DEUTLICH HÖHER (vorher 8px)
                backgroundColor: activeTab === tab.name ? '#3A7D5E' : 'transparent', 
                color: activeTab === tab.name ? '#ffffff' : '#475569', 
                borderRadius: '12px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                fontWeight: activeTab === tab.name ? 700 : 500, 
                fontSize: '15px', 
                cursor: 'pointer', 
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: activeTab === tab.name ? '0 4px 12px rgba(58, 125, 94, 0.2)' : 'none'
              }}
            >
              {getTabIcon(tab.name, tab.type, activeTab === tab.name)}
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tab.name.toLowerCase() === 'allgemein' ? 'Startseite' : tab.name}
              </span>
            </div>
          ))}
          
          {/* WETTER WIDGET - HÖHER & PRÄSENTER */}
          <div style={{ 
            marginTop: 'auto', 
            backgroundColor: '#f8fafc', 
            borderRadius: '16px', 
            padding: '20px 15px', // Mehr vertikales Padding
            border: '1px solid #e2e8f0', 
            display: 'flex', 
            flexDirection: 'column', // Text unter das Icon oder nebeneinander mit mehr Platz
            alignItems: 'center',
            gap: '8px',
            textAlign: 'center'
          }}>
            <CloudSun size={34} color="#f59e0b" strokeWidth={2} />
            <div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#1e293b' }}>14°C</div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Bewölkt</div>
            </div>
          </div>
        </nav>

        {/* CONTENT BEREICH */}
        <section style={{ flex: 1, padding: '15px', backgroundColor: '#f0f4f8', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, backgroundColor: '#fff', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 25px rgba(0,0,0,0.06)', position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {renderMainContent()}
          </div>
        </section>
      </main>

      {/* FOOTER */}
      {/* FOOTER MIT DYNAMISCHEM INHALT */}
<footer style={{ 
  height: '40px', 
  backgroundColor: '#ffffff', 
  borderTop: '1px solid #e0e4e8', 
  display: 'flex', 
  alignItems: 'center', 
  overflow: 'hidden' 
}}>
  <div style={{ 
    backgroundColor: '#D32F2F', 
    color: '#fff', 
    height: '100%', 
    padding: '0 20px', 
    display: 'flex', 
    alignItems: 'center', 
    fontWeight: 700, 
    fontSize: '14px', 
    zIndex: 2,
    boxShadow: '5px 0 15px rgba(0,0,0,0.2)'
  }}>
    AKTUELL
  </div>
  
  <div style={{ flex: 1, position: 'relative', height: '100%' }}>
    <div style={{ 
      position: 'absolute', 
      whiteSpace: 'nowrap', 
      height: '100%', 
      display: 'flex', 
      alignItems: 'center', 
      fontSize: '18px', // Etwas größer für bessere Lesbarkeit
      fontWeight: 600,
      color: '#334155', 
      // Die Geschwindigkeit passt sich nun ein bisschen der Textlänge an
      animation: `ticker ${Math.max(30, dynamicTickerText.length / 5)}s linear infinite` 
    }}>
      <span style={{ color: '#D32F2F', marginRight: '15px' }}>+++</span>
      {dynamicTickerText}
      <span style={{ color: '#D32F2F', marginLeft: '15px' }}>+++</span>
    </div>
  </div>
</footer>

      <style>{`
        @keyframes ticker { 0% { transform: translateX(100vw); } 100% { transform: translateX(-100%); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};
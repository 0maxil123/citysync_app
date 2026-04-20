import React, { useState, useEffect, useRef } from 'react';
import { Building, Save, Image as ImageIcon, Sun, Moon, Clock, HardDrive, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SettingsProps {
  globalTheme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
}

export const SettingsView = ({ globalTheme, onThemeChange }: SettingsProps) => {
  
  // Alte States
  const [defaultDuration, setDefaultDuration] = useState(12);
  const [autoDeleteYears, setAutoDeleteYears] = useState(3);
  const [nightlyRestartTime, setNightlyRestartTime] = useState("03:00");
  const [isSaved, setIsSaved] = useState(false);
  
  // NEUE States für Branding
  const [municipalityName, setMunicipalityName] = useState("Stadtgemeinde Völkermarkt");
  const [logoBase64, setLogoBase64] = useState("");
  const [globalTicker, setGlobalTicker] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user, hasPermission } = useAuth();

  // Daten vom Server laden
  useEffect(() => {
    fetch(`http://localhost:5195/api/settings?userId=${user?.id}`)
      .then(res => res.json())
      .then(data => {
        if (data) {
          setDefaultDuration(data.defaultDuration || 12);
          setAutoDeleteYears(data.autoDeleteYears || 3);
          setNightlyRestartTime(data.nightlyRestartTime || "03:00");
          
          // NEU: Branding Daten laden
          setMunicipalityName(data.municipalityName || "Stadtgemeinde Völkermarkt");
          setLogoBase64(data.logoBase64 || "");
          setGlobalTicker(data.globalTicker || "");
        }
      })
      .catch(err => console.error("Fehler beim Laden:", err));
  }, [user?.id]);

  // Bild hochladen & in Base64 umwandeln
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setLogoBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Daten an den Server schicken
  const handleSave = async () => {
    const payload = {
      userId: user?.id?.toString(),
      theme: globalTheme, 
      defaultDuration: defaultDuration,
      autoDeleteYears: autoDeleteYears,
      nightlyRestartTime: nightlyRestartTime,
      
      // NEU: Branding Daten mitschicken
      municipalityName: municipalityName,
      logoBase64: logoBase64,
      globalTicker: globalTicker
    };

    try {
      const response = await fetch("http://localhost:5195/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000); // Nach 3 Sek. wieder normaler Button
      }
    } catch (error) {
      console.error("Fehler beim Speichern:", error);
    }
  };

  const isDark = globalTheme === 'dark';
  const colors = {
    background: isDark ? '#121212' : '#f3f4f6',      
    card: isDark ? '#1e1e1e' : '#ffffff',            
    text: isDark ? '#ffffff' : '#111827',            
    textMuted: isDark ? '#888888' : '#6b7280',       
    border: isDark ? '#333333' : '#e5e7eb',          
    inputField: isDark ? '#111111' : '#f9fafb',      
    primary: '#8a6ce0',                              
    success: '#10b981',                              
  };

  return (
    <div style={{ color: colors.text, backgroundColor: colors.background, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'background-color 0.3s ease, color 0.3s ease' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '40px 40px 24px 40px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0, transition: 'border-color 0.3s ease' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 400, margin: 0, marginBottom: '8px' }}>System Einstellungen</h1>
          <p style={{ color: colors.textMuted, margin: 0, fontSize: '14px', transition: 'color 0.3s ease' }}>Branding und globale Konfigurationen.</p>
        </div>
        
        <button 
          onClick={handleSave} 
          disabled={!hasPermission('settings.manage')}
          style={{ 
            backgroundColor: hasPermission('settings.manage') ? (isSaved ? '#059669' : colors.success) : colors.textMuted, 
            border: 'none', 
            color: '#fff', 
            padding: '12px 24px', 
            borderRadius: '12px', 
            cursor: hasPermission('settings.manage') ? 'pointer' : 'not-allowed', 
            display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, 
            boxShadow: hasPermission('settings.manage') ? '0 4px 12px rgba(16, 185, 129, 0.2)' : 'none', 
            transition: 'all 0.3s ease'
          }}
        >
          {isSaved ? <CheckCircle size={18} /> : <Save size={18} />} 
          {hasPermission('settings.manage') ? (isSaved ? 'Gespeichert!' : 'Einstellungen speichern') : 'Keine Berechtigung'}
        </button>
      </div>

      {/* INHALTSBEREICH */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px 40px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          
          {/* KARTE 1: BRANDING */}
          <div style={{ backgroundColor: colors.card, borderRadius: '16px', border: `1px solid ${colors.border}`, padding: '32px', transition: 'all 0.3s ease', boxShadow: isDark ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <Building color={colors.primary} size={24} />
              <h2 style={{ margin: 0, fontSize: '18px' }}>Branding & Identität</h2>
            </div>
            
            {/* EINGABE: GEMEINDENAME */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: colors.textMuted, fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>KUNDENNAME / GEMEINDE</label>
              <input 
                type="text" 
                value={municipalityName}
                onChange={(e) => setMunicipalityName(e.target.value)}
                disabled={!hasPermission('settings.manage')} 
                style={{ width: '100%', padding: '14px', background: colors.inputField, border: `1px solid ${colors.border}`, borderRadius: '12px', color: colors.text, outline: 'none', transition: 'all 0.3s ease' }} 
              />
            </div>

            {/* EINGABE: WAPPEN */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: colors.textMuted, fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>GEMEINDE-WAPPEN / LOGO</label>
              <div 
                onClick={() => hasPermission('settings.manage') && fileInputRef.current?.click()}
                style={{ width: '100%', height: '150px', background: colors.inputField, border: `2px dashed ${colors.border}`, borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: hasPermission('settings.manage') ? 'pointer' : 'not-allowed', color: colors.textMuted, transition: 'all 0.3s ease' }}
              >
                {logoBase64 ? (
                  <img src={logoBase64} alt="Wappen" style={{ maxHeight: '80%', maxWidth: '80%', objectFit: 'contain' }} />
                ) : (
                  <>
                    <ImageIcon size={32} style={{ marginBottom: '8px' }} />
                    <span style={{ fontSize: '13px' }}>Klicken zum Hochladen</span>
                  </>
                )}
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                accept="image/*" 
                style={{ display: 'none' }} 
              />
            </div>

            {/* EINGABE: GLOBALER TICKER */}
            

            <div>
              <label style={{ display: 'block', color: colors.textMuted, fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>ERSCHEINUNGSBILD (THEME)</label>
              <div style={{ display: 'flex', gap: '8px', background: colors.inputField, padding: '8px', borderRadius: '14px', border: `1px solid ${colors.border}`, transition: 'all 0.3s ease' }}>
                <button
                  onClick={() => onThemeChange('light')}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: !isDark ? '#ffffff' : 'transparent', color: !isDark ? '#000000' : colors.textMuted, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: !isDark ? '0 2px 8px rgba(0,0,0,0.1)' : 'none' }}
                >
                  <Sun size={18} /> Hell
                </button>
                <button
                  onClick={() => onThemeChange('dark')}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: isDark ? '#2a2a2a' : 'transparent', color: isDark ? '#ffffff' : colors.textMuted, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.2)' : 'none' }}
                >
                  <Moon size={18} /> Dunkel
                </button>
              </div>
            </div>
          </div>

          {/* KARTE 2: WIEDERGABE-STANDARDS */}
          <div style={{ backgroundColor: colors.card, borderRadius: '16px', border: `1px solid ${colors.border}`, padding: '32px', transition: 'all 0.3s ease', boxShadow: isDark ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <Clock color="#f59e0b" size={24} />
              <h2 style={{ margin: 0, fontSize: '18px' }}>Standard-Wiedergabe</h2>
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: colors.textMuted, fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>ANZEIGEDAUER PRO BILD/SEITE</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input 
                  disabled={!hasPermission('settings.manage')}
                  type="number" 
                  value={defaultDuration} 
                  onChange={(e) => setDefaultDuration(Number(e.target.value))} 
                  min={1} 
                  style={{ width: '80px', padding: '14px', background: colors.inputField, border: `1px solid ${colors.border}`, borderRadius: '12px', color: colors.text, outline: 'none', textAlign: 'center', transition: 'all 0.3s ease' }} 
                />
                <span style={{ color: colors.textMuted, fontSize: '14px' }}>Sekunden</span>
              </div>
              <p style={{ color: colors.textMuted, fontSize: '12px', marginTop: '8px', lineHeight: '1.4' }}>Dieser Wert wird automatisch vorausgewählt, wenn neue Bilder oder PDFs hochgeladen werden.</p>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: colors.textMuted, fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>ÜBERGANGSEFFEKT</label>
              <select disabled={!hasPermission('settings.manage')} style={{ width: '100%', padding: '14px', background: colors.inputField, border: `1px solid ${colors.border}`, borderRadius: '12px', color: colors.text, outline: 'none', transition: 'all 0.3s ease' }}>
                <option>Weich überblenden (Fade)</option>
                <option>Hart umschalten (None)</option>
              </select>
            </div>
          </div>

          {/* KARTE 3: WARTUNG & ARCHIV */}
          <div style={{ gridColumn: '1 / -1', backgroundColor: colors.card, borderRadius: '16px', border: `1px solid ${colors.border}`, padding: '32px', transition: 'all 0.3s ease', boxShadow: isDark ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <HardDrive color="#ef4444" size={24} />
              <h2 style={{ margin: 0, fontSize: '18px' }}>Wartung & Archiv</h2>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
              <div>
                <label style={{ display: 'block', color: colors.textMuted, fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>ARCHIVIERTE DATEIEN ENDGÜLTIG LÖSCHEN</label>
                <select 
                  disabled={!hasPermission('settings.manage')}
                  value={autoDeleteYears} 
                  onChange={(e) => setAutoDeleteYears(Number(e.target.value))} 
                  style={{ width: '100%', padding: '14px', background: colors.inputField, border: `1px solid ${colors.border}`, borderRadius: '12px', color: colors.text, outline: 'none', transition: 'all 0.3s ease' }}
                >
                  <option value={1}>Nach 1 Jahr</option>
                  <option value={3}>Nach 3 Jahren</option>
                  <option value={5}>Nach 5 Jahren</option>
                  <option value={10}>Nach 10 Jahren</option>
                  <option value={99}>Nie löschen</option>
                </select>
                <p style={{ color: colors.textMuted, fontSize: '12px', marginTop: '8px', lineHeight: '1.4' }}>Hinweis: Abgelaufene Medien werden sofort entfernt. Dies betrifft nur das Compliance-Archiv der Gemeinde.</p>
              </div>

              <div>
                <label style={{ display: 'block', color: colors.textMuted, fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>NÄCHTLICHER AUTO-NEUSTART</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input 
                    disabled={!hasPermission('settings.manage')}
                    type="time" 
                    value={nightlyRestartTime} 
                    onChange={(e) => setNightlyRestartTime(e.target.value)} 
                    style={{ padding: '14px', background: colors.inputField, border: `1px solid ${colors.border}`, borderRadius: '12px', color: colors.text, outline: 'none', colorScheme: isDark ? 'dark' : 'light', transition: 'all 0.3s ease' }} 
                  />
                  <span style={{ color: colors.textMuted, fontSize: '14px' }}>Uhr</span>
                </div>
                <p style={{ color: colors.textMuted, fontSize: '12px', marginTop: '8px', lineHeight: '1.4' }}>Startet alle Player-Bildschirme automatisch neu, um Arbeitsspeicher zu leeren und Hänger zu vermeiden.</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
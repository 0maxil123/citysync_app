import { Monitor, Settings, Power, Wifi, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
// NEU: Wir fügen globalTheme zu den Props hinzu (Standard ist 'dark')
export const ScreenCard = ({ name, ip, status, contentType, resolution, onEdit, globalTheme = 'dark' }: any) => {
  const statusConfig = {
    online: { color: '#4caf50', label: 'Online' },
    standby: { color: '#ff9800', label: 'Standby' },
    offline: { color: '#f44336', label: 'Offline' }
  };
  const config = statusConfig[status as keyof typeof statusConfig] || { color: '#888', label: 'Unbekannt' };
  const { hasPermission } = useAuth();  
  // NEU: Unsere dynamischen Farben für die Kachel
  const isDark = globalTheme === 'dark';
  const colors = {
    bg: isDark ? 'rgb(45, 45, 45)' : '#ffffff',
    textMain: isDark ? '#ffffff' : '#111827',
    textSub: isDark ? '#aaaaaa' : '#6b7280',
    border: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.08)',
    shadow: isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 4px 15px rgba(0,0,0,0.05)',
    badgeBg: isDark ? '#333333' : '#f3f4f6',
    hoverBg: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
    statusBg: `${config.color}15` // Ein sehr transparenter Hauch der Status-Farbe (sieht in Hell & Dunkel super aus)
  };

  return (
    <div style={{ 
      backgroundColor: colors.bg, 
      padding: '24px', 
      borderRadius: '12px', 
      display: 'flex', 
      alignItems: 'center', 
      marginBottom: '16px',
      border: `1px solid ${colors.border}`,
      boxShadow: colors.shadow,
      position: 'relative',
      transition: 'all 0.3s ease', // Weicher Übergang beim Theme-Wechsel
    }}>
      
      {/* Linker Bereich: Icon */}
      <div style={{ marginRight: '10px', color: colors.textMain, opacity: 0.9, padding: '15px' }}>
        <Monitor size={42} strokeWidth={1.2} />
      </div>

      {/* Mittlerer Bereich: Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        
        {/* Header: Name & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px', fontWeight: 600, color: colors.textMain, letterSpacing: '-0.5px', transition: 'color 0.3s ease' }}>
            {name}
          </span>
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '6px', 
            backgroundColor: colors.statusBg, padding: '4px 12px', 
            borderRadius: '20px', border: `1px solid ${config.color}33` 
          }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: config.color }} />
            <span style={{ color: config.color, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
              {config.label}
            </span>
          </div>
        </div>
        
        {/* Sub-Info: IP & Wifi & Auflösung */}
        <div style={{ color: colors.textSub, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', transition: 'color 0.3s ease' }}>
          IP: <span style={{ color: colors.textSub }}>{ip}</span>
          <Wifi size={14} style={{ opacity: 0.5, marginLeft: '4px' }} />
          {/* Auflösung */}
          {resolution && (
             <span style={{ marginLeft: '8px', fontSize: '12px', backgroundColor: colors.badgeBg, padding: '2px 6px', borderRadius: '4px', transition: 'background-color 0.3s ease' }}>
               {resolution}
             </span>
          )}
        </div>

        {/* Status-Leiste: Aktueller Inhalt */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: colors.textSub, fontSize: '14px', paddingTop: '4px', transition: 'color 0.3s ease' }}>
          <Play size={14} fill={colors.textSub} color="transparent" />
          <span>Aktuell: <span style={{ color: colors.textMain, fontWeight: 500, transition: 'color 0.3s ease' }}>{contentType || "Kein Inhalt"}</span></span>
        </div>
      </div>

      {/* Rechter Bereich: Die Action-Column */}
      {hasPermission('screens.manage') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '24px', borderLeft: `1px solid ${colors.border}`, alignItems: 'center', transition: 'border-color 0.3s ease' }}>
          
          {/* Power Button */}
          <button 
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', borderRadius: '8px', transition: 'all 0.2s', color: '#f44336', opacity: 0.7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(244, 67, 54, 0.1)'; e.currentTarget.style.opacity = '1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.opacity = '0.7'; }}
            title="Monitor neu starten / ausschalten"
          >
            <Power size={20} />
          </button>

          {/* Settings Button */}
          <button 
            onClick={onEdit} 
            style={{ background: 'none', border: 'none', color: colors.textSub, cursor: 'pointer', padding: '5px', borderRadius: '8px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = colors.textMain; e.currentTarget.style.backgroundColor = colors.hoverBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = colors.textSub; e.currentTarget.style.backgroundColor = 'transparent'; }}
            title="Monitor konfigurieren"
          >
            <Settings size={20} /> 
          </button>
        </div>
      )}

    </div>
  );
};
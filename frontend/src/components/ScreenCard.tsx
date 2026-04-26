import { Monitor, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const ScreenCard = ({ name, ip, status, contentType, resolution, onEdit, globalTheme = 'dark' }: any) => {
  const statusConfig = {
    online: { color: '#4caf50', label: 'Online' },
    standby: { color: '#ff9800', label: 'Standby' },
    offline: { color: '#f44336', label: 'Offline' }
  };
  const config = statusConfig[status as keyof typeof statusConfig] || { color: '#888', label: 'Unbekannt' };
  const { hasPermission } = useAuth();  

  const isDark = globalTheme === 'dark';
  const colors = {
    bg: isDark ? 'rgb(45, 45, 45)' : '#ffffff',
    textMain: isDark ? '#ffffff' : '#111827',
    textSub: isDark ? '#aaaaaa' : '#6b7280',
    border: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.08)',
    shadow: isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 4px 15px rgba(0,0,0,0.05)',
    badgeBg: isDark ? '#333333' : '#f3f4f6',
    hoverBg: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
    statusBg: `${config.color}15` 
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
      transition: 'all 0.3s ease',
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
        
        {/* Sub-Info: IP & Auflösung */}
        <div style={{ color: colors.textSub, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', transition: 'color 0.3s ease' }}>
          <span style={{ fontSize: '12px', backgroundColor: colors.badgeBg, padding: '2px 6px', borderRadius: '4px', transition: 'background-color 0.3s ease' }}>
            IP: {ip}
          </span>
          {resolution && (
             <span style={{ fontSize: '12px', backgroundColor: colors.badgeBg, padding: '2px 6px', borderRadius: '4px', transition: 'background-color 0.3s ease' }}>
               Res: {resolution}
             </span>
          )}
        </div>
      </div>

      {/* Rechter Bereich: Nur noch EIN Action-Button */}
      {hasPermission('screens.manage') && (
        <div style={{ display: 'flex', paddingLeft: '24px', borderLeft: `1px solid ${colors.border}`, alignItems: 'center', transition: 'border-color 0.3s ease', height: '100%' }}>
          <button 
            onClick={onEdit} 
            style={{ background: colors.badgeBg, border: `1px solid ${colors.border}`, color: colors.textMain, cursor: 'pointer', padding: '12px', borderRadius: '50%', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.hoverBg; e.currentTarget.style.transform = 'rotate(30deg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = colors.badgeBg; e.currentTarget.style.transform = 'rotate(0deg)'; }}
            title="Details & Steuerung öffnen"
          >
            <Settings size={22} /> 
          </button>
        </div>
      )}

    </div>
  );
};
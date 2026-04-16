import { Monitor, Settings, Power, Wifi, Play } from 'lucide-react';

export const ScreenCard = ({ name, ip, status, contentType, resolution, onEdit }: any) => {
  const statusConfig = {
    online: { color: '#4caf50', label: 'Online' },
    standby: { color: '#ff9800', label: 'Standby' },
    offline: { color: '#f44336', label: 'Offline' }
  };
  const config = statusConfig[status as keyof typeof statusConfig] || { color: '#888', label: 'Unbekannt' };

  return (
    <div style={{ 
      backgroundColor: 'rgb(45, 45, 45)', // Ein Tick dunkler für mehr Tiefe
      padding: '24px 24px 24px 24px', 
      borderRadius: '12px', 
      display: 'flex', 
      alignItems: 'center', 
      marginBottom: '16px',
      border: '1px solid rgba(255,255,255,0.03)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      position: 'relative',
      transition: 'transform 0.2s ease',
    }}>
      
      {/* Linker Bereich: Icon */}
      <div style={{ 
        marginRight: '10px', 
        color: '#fff', 
        opacity: 0.9,
        backgroundColor: 'rgb(45,45,45)',
        padding: '15px',
        borderRadius: '12px'
      }}>
        <Monitor size={42} strokeWidth={1.2} />
      </div>

      {/* Mittlerer Bereich: Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        
        {/* Header: Name & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px', fontWeight: 600, color: '#fff', letterSpacing: '-0.5px' }}>
            {name}
          </span>
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '6px', 
            backgroundColor: 'rgba(255,255,255,0.03)', padding: '4px 12px', 
            borderRadius: '20px', border: `1px solid ${config.color}33` 
          }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: config.color }} />
            <span style={{ color: config.color, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
              {config.label}
            </span>
          </div>
        </div>
        
        {/* Sub-Info: IP & Wifi & Auflösung */}
        <div style={{ color: '#777', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          IP: <span style={{ color: '#aaa' }}>{ip}</span>
          <Wifi size={14} style={{ opacity: 0.5, marginLeft: '4px' }} />
          {/* NEU: Auflösung anzeigen, falls vorhanden */}
          {resolution && (
             <span style={{ marginLeft: '8px', fontSize: '12px', backgroundColor: '#333', padding: '2px 6px', borderRadius: '4px' }}>
               {resolution}
             </span>
          )}
        </div>

        {/* Status-Leiste: Aktueller Inhalt */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px', 
          color: '#888', 
          fontSize: '14px',
          paddingTop: '4px'
        }}>
          <Play size={14} fill="#555" color="transparent" />
          <span>Aktuell: <span style={{ color: '#eee', fontWeight: 500 }}>{contentType || "Kein Inhalt"}</span></span>
        </div>
      </div>

      {/* Rechter Bereich: Die Action-Column */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px', 
        paddingLeft: '24px', 
        borderLeft: '1px solid rgba(255,255,255,0.05)',
        alignItems: 'center' 
      }}>
        {/* Power Button */}
        <button 
          style={{ 
            background: 'none',
            border: 'none',
            cursor: 'pointer', 
            padding: '5px',
            borderRadius: '8px',
            transition: 'all 0.2s',
            color: '#f44336',
            opacity: 0.7,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(244, 67, 54, 0.1)';
            e.currentTarget.style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.opacity = '0.7';
          }}
        >
          <Power size={20} />
        </button>

        {/* Settings Button */}
        <button 
          onClick={onEdit} 
          style={{ 
            background: 'none', 
            border: 'none', 
            color: '#888', 
            cursor: 'pointer', 
            padding: '5px',
            borderRadius: '8px',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => {
             e.currentTarget.style.color = '#fff';
             e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
          }}
          onMouseLeave={(e) => {
             e.currentTarget.style.color = '#888';
             e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Settings size={20} /> 
        </button>
      </div>

    </div>
  );
};
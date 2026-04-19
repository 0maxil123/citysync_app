import { useState, useEffect } from 'react'
import { DashboardView } from './components/DashboardView'
import { ScheduleView } from './components/ScheduleView';
import { ScreenManagementView } from './components/ScreenManagementView';
import { Archive } from './components/Archive';
import { UserManagementView } from './components/UserManagementView';
import { SettingsView } from './components/SettingsView';
import { LoginView } from './components/LoginView'; 
import { AuthProvider, useAuth } from './context/AuthContext'; 
import { Users, Settings, LogOut, User as UserIcon } from 'lucide-react';

const DashboardIcon = () => (
  <div style={{ width: '20px', height: '15px', border: '2px solid currentColor', borderRadius: '3px', marginRight: '10px' }}></div>
);

// --- TEIL 1: DER INHALT DER APP (LOGIK) ---
function AppContent() {
  const { user, logout, hasPermission } = useAuth(); // hasPermission hinzugefügt
  
  const [aktiveSeite, setAktiveSeite] = useState<string>('dashboard');
  const [isServerOnline, setIsServerOnline] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const BACKEND_URL = 'http://localhost:5195';

  useEffect(() => {
    if (!user) return; 
    fetch(`${BACKEND_URL}/api/settings`)
      .then(res => res.json())
      .then(data => {
        if (data && data.theme) setTheme(data.theme);
      })
      .catch(err => console.error("Fehler beim Laden:", err));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const checkServerStatus = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/dashboard`);
        setIsServerOnline(response.ok);
      } catch (error) {
        setIsServerOnline(false);
      }
    };
    checkServerStatus();
    const intervalId = setInterval(checkServerStatus, 5000);
    return () => clearInterval(intervalId);
  }, [user]);

  if (!user) {
    return <LoginView />;
  }

  const navigationsPunkte = [
    { id: 'dashboard', text: 'Dashboard', icon: <DashboardIcon /> },
    { id: 'schedule', text: 'Schedule', icon: '📅' },
    { id: 'screenmanagement', text: 'Screen Management', icon: '⚙️' },
    { id: 'archive', text: 'Archive', icon: '📦' },
  ];

  // System-Punkte filtern: Nur Admins sehen "Benutzer & Rechte"
  const systemPunkte = [
    ...(hasPermission('users.manage') ? [{ id: 'users', text: 'Benutzer & Rechte', icon: <Users size={18} /> }] : []),
    { id: 'settings', text: 'Einstellungen', icon: <Settings size={18} /> },
  ];
  
  const isDark = theme === 'dark';
  const sidebarBg = isDark ? '#222222' : '#ffffff';
  const sidebarBorder = isDark ? '#333333' : '#e5e7eb';
  const textMuted = isDark ? '#aaaaaa' : '#6b7280';
  const textActive = isDark ? '#ffffff' : '#111827';
  const btnHover = isDark ? '#333333' : '#f3f4f6';

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* SIDEBAR */}
      <div style={{ 
        width: '240px', backgroundColor: sidebarBg, padding: '20px', 
        borderRight: `1px solid ${sidebarBorder}`, display: 'flex', flexDirection: 'column', 
        transition: 'all 0.3s ease', zIndex: 50,
        boxShadow: isDark ? '10px 0 30px rgba(0,0,0,0.5)' : '10px 0 30px rgba(0,0,0,0.05)'
      }}>
        <div style={{ color: textActive, fontWeight: 'bold', fontSize: '24px', marginBottom: '40px', textAlign: 'center' }}>CitySync</div>

        <div style={{ width: '100%' }}>
          {navigationsPunkte.map(punkt => (
            <button
              key={punkt.id}
              onClick={() => setAktiveSeite(punkt.id)}
              style={{
                width: '100%', padding: '12px',
                backgroundColor: aktiveSeite === punkt.id ? btnHover : 'transparent',
                color: aktiveSeite === punkt.id ? textActive : textMuted,
                border: 'none', borderRadius: '10px', textAlign: 'left', cursor: 'pointer',
                marginBottom: '4px', fontSize: '15px', display: 'flex', gap: '10px', alignItems: 'center',
                transition: 'all 0.2s'
              }}
            >
              <span>{punkt.icon}</span> {punkt.text}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 'auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          {/* KOMPAKTE USER-INFO (JETZT UNTEN) */}
          <div style={{ 
            padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px', 
            borderTop: `1px solid ${sidebarBorder}`, paddingTop: '10px', marginBottom: '0px', paddingBottom: '3px'
          }}>
            <div style={{ 
              width: '32px', height: '32px', borderRadius: '8px', 
              background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a6ce0', flexShrink: 0 
            }}>
              <UserIcon size={18} />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: textActive, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
              <div style={{ fontSize: '11px', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{user.role}</div>
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${sidebarBorder}`, paddingTop: '8px' }}>
            {systemPunkte.map(punkt => (
              <button
                key={punkt.id}
                onClick={() => setAktiveSeite(punkt.id)}
                style={{
                  width: '100%', padding: '10px 12px',
                  backgroundColor: aktiveSeite === punkt.id ? btnHover : 'transparent',
                  color: aktiveSeite === punkt.id ? textActive : textMuted,
                  border: 'none', borderRadius: '10px', textAlign: 'left', cursor: 'pointer',
                  marginBottom: '4px', fontSize: '14px', display: 'flex', gap: '10px', alignItems: 'center',
                }}
              >
                {punkt.icon} {punkt.text}
              </button>
            ))}
            
            <button
                onClick={logout}
                style={{
                  width: '100%', padding: '10px 12px',
                  backgroundColor: 'transparent',
                  color: '#ef4444',
                  border: 'none', borderRadius: '10px', textAlign: 'left', cursor: 'pointer',
                  marginTop: '4px', fontSize: '14px', display: 'flex', gap: '10px', alignItems: 'center',
                }}
              >
                <LogOut size={18} /> Abmelden
            </button>
          </div>

          {!isServerOnline && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, backgroundColor: 'rgba(244, 67, 54, 0.1)', color: '#f44336', border: '1px solid rgba(244, 67, 54, 0.2)' }}>
              Keine Verbindung!
            </div>
          )}
        </div>
      </div>

      {/* INHALT */}
      <div style={{ flex: 1, overflowY: 'auto', backgroundColor: isDark ? '#1a1a1a' : '#f9fafb', transition: 'background-color 0.3s ease' }}>
        {aktiveSeite === 'dashboard' && <DashboardView globalTheme={theme} />}
        {aktiveSeite === 'schedule' && <ScheduleView globalTheme={theme} />}
        {aktiveSeite === 'screenmanagement' && <ScreenManagementView globalTheme={theme} />}
        {aktiveSeite === 'archive' && <Archive globalTheme={theme} />}
        {aktiveSeite === 'users' && <UserManagementView globalTheme={theme} />}
        {aktiveSeite === 'settings' && <SettingsView globalTheme={theme} onThemeChange={setTheme} />}
      </div>

      <style>{`@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }`}</style>
    </div>
  );
}

// --- TEIL 2: DER HAUPT-WRAPPER ---
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
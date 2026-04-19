import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, ShieldAlert, MoreVertical, Search, Loader2,Edit3, CheckSquare, Square,Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
interface UserManagementProp {
  globalTheme: 'dark' | 'light'
}

export const UserManagementView = ({ globalTheme }: UserManagementProp) => {
  // --- STATES ---
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const {user, hasPermission} = useAuth();

  // States für das Bearbeiten-Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState(3); // Default Rolle
  
  // Modal & Form States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState(2); // 2 = Redakteur
  // --- NOTIFICATION STATE ---
  const [notification, setNotification] = useState<{ msg: string, type: 'success' | 'error' | 'info' } | null>(null);

  // Hilfsfunktion zum Anzeigen
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000); // Verschwindet nach 4 Sek.
  };

  const BACKEND_URL = "http://localhost:5195";

  // Definition aller verfügbaren Rechte im System
  const allPermissions = [
    { key: 'screens.view', label: 'Monitore & Status sehen' },
    { key: 'screens.manage', label: 'Monitore verwalten' },
    { key: 'media.view', label: 'Inhalte ansehen' },
    { key: 'media.upload', label: 'Inhalte hochladen' },
    { key: 'media.publish', label: 'Live schalten' },
    { key: 'media.delete', label: 'Inhalte löschen' },
    { key: 'users.manage', label: 'Benutzer verwalten' },
  ];
  // 1. Modal mit Daten füllen und öffnen
  const handleEditClick = (userItem: any) => {
    setEditingUserId(userItem.id);
    setEditName(userItem.name);
    setEditEmail(userItem.email);
    // Wir finden die ID der Rolle anhand des Namens (oder du hast die ID schon im Objekt)
    const roleObj = roles.find(r => r.name === userItem.role);
    setEditRole(roleObj ? roleObj.id : 3);
    
    setOpenUserMenuId(null); // Menü schließen
    setIsEditModalOpen(true);
  };

  // 2. Änderungen an C# schicken
  const handleUpdateUser = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/users/${editingUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id?.toString(), // Der "Türsteher"-Key
          name: editName,
          email: editEmail,
          roleId: editRole
        })
      });

      if (response.ok) {
        showToast("Benutzer erfolgreich aktualisiert!");
        setIsEditModalOpen(false);
        fetchUsers(); // Liste neu laden
      } else {
        showToast("Fehler beim Aktualisieren.");
      }
    } catch (error) {
      showToast("Serverfehler beim Update.");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    await Promise.all([fetchUsers(), fetchRoles()]);
    setIsLoading(false);
  };


  const fetchUsers = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/users?userId=${user?.id}`);
      if (response.ok) setUsers(await response.json());
    } catch (error) { console.error("Fehler beim Laden der Benutzer:", error); }
  };

  const fetchRoles = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/users/roles-with-permissions?userId=${user?.id}`);
      if (response.ok) setRoles(await response.json());
    } catch (error) { console.error("Fehler beim Laden der Rollen:", error); }
  };

  const handleCreateUser = async () => {
    if (!newUserName || !newUserEmail || !newUserPassword) {
      showToast(`Bitte alle Felder ausfüllen!`);
      return;
    }
    try {
      const response = await fetch(`${BACKEND_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id?.toString(), // <--- HIER: userId hinzugefügt
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          roleId: newUserRole
        })
      });
      if (!response.ok) throw new Error("Fehler beim Speichern");
      setIsAddModalOpen(false);
      setNewUserName(''); setNewUserEmail(''); setNewUserPassword('');
      fetchUsers();
      showToast(`Benutzer erfolgreich erstellt!`);
    } catch (error) { 
      showToast("Fehler beim Anlegen des Benutzers."); 
    }
  };

  const [newRoleName, setNewRoleName] = useState('');
  
  const handleCreateRole = async () => {
    if (!newRoleName) return;
    // <--- HIER: ?userId=... an die URL angehängt
    await fetch(`${BACKEND_URL}/api/users/roles?userId=${user?.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRoleName)
    });
    setNewRoleName('');
    fetchRoles(); 
  };
  const handleDeleteRole = async (roleId: number, roleName: string) => {
    try {
      // <--- HIER: ?userId=... an die URL angehängt
      const response = await fetch(`${BACKEND_URL}/api/users/roles/${roleId}?userId=${user?.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchRoles(); // Liste neu laden
        showToast(`Rolle "${roleName}" gelöscht.`);
      } else {
        const errorMsg = await response.text();
        showToast(errorMsg || "Löschen fehlgeschlagen. Ist die Rolle noch Benutzern zugewiesen?");
      }
    } catch (error) {
      console.error("Fehler beim Löschen:", error);
    }
  };

  const togglePermission = async (roleId: number, permKey: string) => {
    const role = roles.find(r => r.id === roleId);
    if (!role || role.name === 'Administrator') return;

    // 1. OPTIMISTISCHES UPDATE
    const newPermissions = role.permissions.includes(permKey)
      ? role.permissions.filter((p: string) => p !== permKey)
      : [...role.permissions, permKey];

    setRoles(prevRoles => prevRoles.map(r => 
      r.id === roleId ? { ...r, permissions: newPermissions } : r
    ));

    // 2. BACKEND UPDATE
    try {
      const response = await fetch(`${BACKEND_URL}/api/users/update-role-permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user?.id?.toString(), // <--- HIER: userId hinzugefügt
          roleId, 
          permissions: newPermissions 
        })
      });

      if (!response.ok) {
        throw new Error("Server hat das Update abgelehnt");
      }
      console.log("Rechte erfolgreich in DB gespeichert");
    } catch (error) {
      console.error("Fehler beim Speichern:", error);
      showToast("Konnte Rechte nicht speichern. Hast du die Berechtigung?");
      fetchRoles(); // Falls es schiefging: Hol die alten Daten zurück
    }
  };
  // Speichert die ID des Users, dessen Menü gerade offen ist
  const [openUserMenuId, setOpenUserMenuId] = useState<number | null>(null);

  // Die Funktion zum Löschen
  const handleDeleteUser = async (targetUserId: number, targetUserName: string) => {
    // 1. Selbstschutz: Man darf sich nicht selbst löschen!
    if (targetUserId === user?.id) {
      showToast("Du kannst dich nicht selbst löschen!");
      setOpenUserMenuId(null);
      return;
    }

    // 2. Sicherheitsabfrage
    if (!window.confirm(`Möchtest du den Benutzer "${targetUserName}" wirklich löschen?`)) {
      setOpenUserMenuId(null);
      return;
    }

    // 3. Ab an den Server
    try {
      const response = await fetch(`${BACKEND_URL}/api/users/${targetUserId}?userId=${user?.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showToast(`Benutzer "${targetUserName}" wurde gelöscht.`);
        fetchUsers(); // Liste neu laden
      } else {
        const errorMsg = await response.text();
        showToast(errorMsg || "Löschen fehlgeschlagen.");
      }
    } catch (error) {
      showToast("Fehler bei der Server-Kommunikation.");
    } finally {
      setOpenUserMenuId(null);
    }
  };

  // --- FARB-LOGIK ---
  const isDark = globalTheme === 'dark';
  const colors = {
    background: isDark ? '#121212' : '#f3f4f6',
    card: isDark ? '#1e1e1e' : '#ffffff',
    inputBg: isDark ? '#111111' : '#f9fafb',
    textMain: isDark ? '#ffffff' : '#111827',
    textSub: isDark ? '#888888' : '#6b7280',
    textMuted: isDark ? '#666666' : '#9ca3af',
    border: isDark ? '#333333' : '#e5e7eb',
    borderLight: isDark ? '#222222' : '#f3f4f6',
    primary: '#8a6ce0',
    primaryHover: '#7a5bc7',
    avatarBg: isDark ? '#2a2a2a' : '#f3f4f6',
    modalOverlay: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)',
    btnCancel: isDark ? '#2a2a2a' : '#e5e7eb',
  };

  return (
    <div style={{ color: colors.textMain, backgroundColor: colors.background, minHeight: '100vh', padding: '40px', transition: 'all 0.3s ease' }}>
      
      {/* HEADER & TABS */}
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 400, margin: '0 0 24px 0' }}>Benutzer & Rechte</h1>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ display: 'flex', gap: '32px' }}>
            <button 
              onClick={() => setActiveTab('users')} 
              style={{ padding: '12px 0', background: 'none', border: 'none', color: activeTab === 'users' ? colors.primary : colors.textSub, borderBottom: activeTab === 'users' ? `2px solid ${colors.primary}` : 'none', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
            >
              Benutzerliste
            </button>
            <button 
              onClick={() => setActiveTab('roles')} 
              style={{ padding: '12px 0', background: 'none', border: 'none', color: activeTab === 'roles' ? colors.primary : colors.textSub, borderBottom: activeTab === 'roles' ? `2px solid ${colors.primary}` : 'none', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
            >
              Rollen & Rechte
            </button>
          </div>

          {activeTab === 'users' && hasPermission('users.manage') && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              style={{ 
                backgroundColor: colors.primary, border: 'none', color: '#fff', 
                padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', 
                display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, 
                marginBottom: '8px' 
              }}
            >
              <UserPlus size={18} /> Benutzer erstellen
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '100px' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: colors.primary, margin: '0 auto' }} />
        </div>
      ) : activeTab === 'users' ? (
        /* BENUTZERLISTE */
        <div style={{ backgroundColor: colors.card, borderRadius: '16px', border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: `1px solid ${colors.border}`, display: 'flex', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: colors.inputBg, padding: '10px 16px', borderRadius: '8px', flex: 1, border: `1px solid ${colors.border}` }}>
              <Search size={18} color={colors.textSub} />
              <input type="text" placeholder="Suchen..." style={{ background: 'transparent', border: 'none', color: colors.textMain, outline: 'none', width: '100%' }} />
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.border}`, color: colors.textSub, fontSize: '12px' }}>
                <th style={{ padding: '16px 24px' }}>BENUTZER</th>
                <th style={{ padding: '16px 24px' }}>ROLLE</th>
                <th style={{ padding: '16px 24px' }}>LETZTER LOGIN</th>
                <th style={{ padding: '16px 24px', textAlign: 'right' }}>AKTIONEN</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: colors.avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.primary, fontWeight: 'bold' }}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: colors.textMain }}>{user.name}</div>
                        <div style={{ color: colors.textMuted, fontSize: '12px' }}>{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, backgroundColor: user.role === 'Administrator' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(138, 108, 224, 0.1)', color: user.role === 'Administrator' ? '#ef4444' : colors.primary }}>
                      {user.role}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', color: colors.textSub, fontSize: '13px' }}>{user.lastLogin}</td>
                  <td style={{ padding: '16px 24px', textAlign: 'right', position: 'relative' }}>
                    {hasPermission('users.manage') ? (
                      <>
                        <button 
                          onClick={() => setOpenUserMenuId(openUserMenuId === user.id ? null : user.id)}
                          style={{ 
                            background: 'transparent', 
                            border: 'none', 
                            color: colors.textSub, 
                            cursor: 'pointer', 
                            padding: '8px', 
                            borderRadius: '50%', 
                            transition: 'background 0.2s',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.avatarBg}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <MoreVertical size={18} />
                        </button>

                        {/* DROP-DOWN MENÜ */}
                        {openUserMenuId === user.id && (
                          <>
                            {/* Overlay zum Schließen beim Klick daneben */}
                            <div 
                              onClick={() => setOpenUserMenuId(null)} 
                              style={{ position: 'fixed', inset: 0, zIndex: 90 }} 
                            />

                            <div style={{ 
                              position: 'absolute', 
                              right: '45px',    // Etwas weiter weg vom Rand
                              bottom: '10px',   // <--- KLAPPT JETZT NACH OBEN AUF
                              backgroundColor: colors.card, 
                              border: `1px solid ${colors.border}`, 
                              borderRadius: '12px', 
                              boxShadow: isDark ? '0 15px 35px rgba(0,0,0,0.5)' : '0 10px 25px rgba(0,0,0,0.1)', 
                              zIndex: 1000, 
                              minWidth: '160px', 
                              overflow: 'hidden' 
                            }}>
                              {/* BEARBEITEN */}
                              <button 
                                onClick={() => { handleEditClick(user)}} 
                                style={{ 
                                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%', 
                                  padding: '12px 16px', background: 'transparent', border: 'none', 
                                  borderBottom: `1px solid ${colors.borderLight}`, 
                                  color: colors.textMain, cursor: 'pointer', textAlign: 'left', fontSize: '13px' 
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.inputBg}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <Edit3 size={14} /> Bearbeiten
                              </button>
                              
                              {/* LÖSCHEN */}
                              <button 
                                onClick={() => handleDeleteUser(user.id, user.name)} 
                                style={{ 
                                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%', 
                                  padding: '12px 16px', background: 'transparent', border: 'none', 
                                  color: '#ef4444', cursor: 'pointer', textAlign: 'left', fontSize: '13px' 
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <Trash2 size={14} /> Löschen
                              </button>
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <div style={{ color: colors.textMuted, opacity: 0.3 }}><MoreVertical size={18} /></div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* ROLLEN & RECHTE MATRIX */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px',alignItems: 'stretch' }}>
          
          {roles.length == 0 ? (
            <div style={{ color: colors.textSub, textAlign: 'center', gridColumn: '1 / -1', padding: '40px' }}>
              Keine Rollen in der Datenbank gefunden. Bitte Backend prüfen.
            </div>
            
          ) : (
          roles.map(role => (
            <div key={role.id} style={{ backgroundColor: colors.card, borderRadius: '20px', padding: '24px', border: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column' }}>
              
              {/* HEADER-BEREICH MIT LÖSCH-OPTION */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {role.name === 'Administrator' ? <ShieldAlert color="#ef4444" size={20} /> : <Shield color={colors.primary} size={20} />}
                  <h3 style={{ margin: 0, fontSize: '18px', color: colors.textMain }}>{role.name}</h3>
                </div>

                {/* LÖSCH-SYMBOL: Erscheint nur bei IDs > 3 (also nicht bei Admin, Redakteur, Techniker) */}
                {role.id > 3 && (
                  <button 
                    onClick={() => handleDeleteRole(role.id, role.name)}
                    style={{ 
                      background: 'none', border: 'none', color: colors.textMuted, 
                      cursor: 'pointer', padding: '6px', borderRadius: '8px', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s' 
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = colors.textMuted; e.currentTarget.style.backgroundColor = 'transparent'; }}
                    title="Rolle löschen"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {allPermissions.map(perm => {
                  const hasPerm = role.permissions.includes(perm.key);
                  const isAdmin = role.name === 'Administrator';
                  
                  // NEU: Darf dieser User die Matrix überhaupt bearbeiten?
                  const canEditRoles = hasPermission('users.manage'); 

                  return (
                    <div 
                      key={perm.key} 
                      // NEU: Nur klicken lassen, wenn KEIN Admin-Tab UND Rechte vorhanden sind
                      onClick={() => !isAdmin && canEditRoles && togglePermission(role.id, perm.key)}
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '10px',
                        background: hasPerm && !isAdmin ? 'rgba(138, 108, 224, 0.05)' : colors.inputBg,
                        // NEU: Cursor anpassen
                        cursor: (isAdmin || !canEditRoles) ? 'default' : 'pointer',
                        border: `1px solid ${hasPerm && !isAdmin ? colors.primary : 'transparent'}`,
                        opacity: isAdmin ? 0.6 : 1,
                        transition: 'all 0.2s'
                      }}
                    >
                      {hasPerm || isAdmin ? <CheckSquare size={18} color={isAdmin ? colors.textMuted : colors.primary} /> : <Square size={18} color={colors.textSub} />}
                      <span style={{ fontSize: '14px', color: hasPerm ? colors.textMain : colors.textSub }}>{perm.label}</span>
                    </div>
                  );
                })}
              </div>
              {role.name === 'Administrator' && (
                <p style={{ fontSize: '11px', color: colors.textMuted, marginTop: '16px', fontStyle: 'italic' }}>
                  Administratoren besitzen systembedingt alle Berechtigungen.
                </p>
              )}
              
            </div>
            
          ))
        
        )}
      
        {hasPermission('users.manage') && (
          <div style={{ 
            backgroundColor: colors.card, borderRadius: '20px', padding: '24px', 
            border: `2px dashed ${colors.border}`, display: 'flex', flexDirection: 'column', 
            justifyContent: 'center', alignItems: 'center', gap: '16px', minHeight: '400px' 
          }}>
            <Shield size={32} color={colors.textMuted} />
            <div style={{ textAlign: 'center', width: '100%' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Neue Rolle</h3>
              <input 
                type="text" 
                value={newRoleName} 
                onChange={e => setNewRoleName(e.target.value)}
                placeholder="Name der Rolle..."
                style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: colors.inputBg, color: colors.textMain, width: '100%', outline: 'none' }}
              />
            </div>
            <button 
              onClick={handleCreateRole}
              style={{ backgroundColor: colors.primary, color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, width: '100%' }}
            >
              Erstellen
            </button>
          </div>
        )}
      </div>
        
      )}

      {/* MODAL (Bleibt gleich) */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: colors.modalOverlay, backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: colors.card, padding: '32px', borderRadius: '24px', border: `1px solid ${colors.border}`, width: '400px' }}>
            <h3 style={{ margin: '0 0 24px 0', color: colors.textMain }}>Neuer Benutzer</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} style={{ padding: '12px', background: colors.inputBg, border: `1px solid ${colors.border}`, borderRadius: '10px', color: colors.textMain }} placeholder="Name" />
              <input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} style={{ padding: '12px', background: colors.inputBg, border: `1px solid ${colors.border}`, borderRadius: '10px', color: colors.textMain }} placeholder="E-Mail" />
              <input type="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} style={{ padding: '12px', background: colors.inputBg, border: `1px solid ${colors.border}`, borderRadius: '10px', color: colors.textMain }} placeholder="Passwort" />
              
              <select 
                value={newUserRole} 
                onChange={e => setNewUserRole(Number(e.target.value))} 
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  background: colors.inputBg, 
                  border: `1px solid ${colors.border}`, 
                  borderRadius: '10px', 
                  color: colors.textMain,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {roles.map(role => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setIsAddModalOpen(false)} style={{ flex: 1, padding: '12px', background: colors.btnCancel, border: 'none', borderRadius: '10px', color: colors.textMain, cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={handleCreateUser} style={{ flex: 1, padding: '12px', background: colors.primary, border: 'none', borderRadius: '10px', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Speichern</button>
            </div>
          </div>
        </div>
      )}
      {/* TOAST BENACHRICHTIGUNG */}
      {notification && (
        <div style={{
          position: 'fixed',
          bottom: '30px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          backgroundColor: notification.type === 'error' ? '#ef4444' : (notification.type === 'success' ? '#10b981' : colors.primary),
          color: '#fff',
          padding: '12px 24px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          animation: 'slideUp 0.3s ease-out'
        }}>
          {notification.type === 'success' && <CheckSquare size={18} />}
          {notification.type === 'error' && <ShieldAlert size={18} />}
          <span style={{ fontWeight: 600, fontSize: '14px' }}>{notification.msg}</span>
          
          <button onClick={() => setNotification(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', marginLeft: '10px' }}>✕</button>
        </div>
      )}

      {/* Animation für den Toast */}
      <style>{`
        @keyframes slideUp {
          from { transform: translate(-50%, 100px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
      `}</style>
      {isEditModalOpen && (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: colors.modalOverlay, zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}>
        <div style={{ backgroundColor: colors.card, width: '100%', maxWidth: '450px', borderRadius: '20px', border: `1px solid ${colors.border}`, padding: '32px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
          <h2 style={{ margin: '0 0 24px 0', color: colors.textMain, fontSize: '20px' }}>Benutzer bearbeiten</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', color: colors.textSub, fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>NAME</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: '100%', padding: '12px', background: colors.inputBg, border: `1px solid ${colors.border}`, borderRadius: '10px', color: colors.textMain, outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: colors.textSub, fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>E-MAIL</label>
              <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} style={{ width: '100%', padding: '12px', background: colors.inputBg, border: `1px solid ${colors.border}`, borderRadius: '10px', color: colors.textMain, outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: colors.textSub, fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>ROLLE ZUWEISEN</label>
              <select value={editRole} onChange={(e) => setEditRole(Number(e.target.value))} style={{ width: '100%', padding: '12px', background: colors.inputBg, border: `1px solid ${colors.border}`, borderRadius: '10px', color: colors.textMain, outline: 'none', cursor: 'pointer' }}>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button onClick={() => setIsEditModalOpen(false)} style={{ flex: 1, padding: '12px', background: colors.btnCancel, color: colors.textMain, border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={handleUpdateUser} style={{ flex: 1, padding: '12px', background: colors.primary, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>Speichern</button>
            </div>
          </div>
        </div>
      </div>
    )}
    </div>
    
  );
};  
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

// Das beschreibt, wie ein User in unserem System aussieht
interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  permissions: string[]; // z.B. ["media.upload", "screens.view"]
}

interface AuthContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  // 1. Beim Starten der App schauen wir, ob wir schon eingeloggt sind (LocalStorage)
  useEffect(() => {
    const savedUser = localStorage.getItem('citysync_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // 2. Login-Funktion (Speichert den User im State und im Browser)
  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('citysync_user', JSON.stringify(userData));
  };

  // 3. Logout-Funktion (Löscht den User)
  const logout = () => {
    setUser(null);
    localStorage.removeItem('citysync_user');
  };

  // 4. DIE WICHTIGSTE FUNKTION: Prüfen, ob der User ein bestimmtes Recht hat
  const hasPermission = (permission: string) => {
    if (!user) return false;
    return user.permissions.includes(permission);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hilfs-Hook, damit wir das überall leicht nutzen können
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth muss innerhalb eines AuthProviders verwendet werden');
  }
  return context;
};
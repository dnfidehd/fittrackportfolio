import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Member } from '../types';
import { api } from '../services/api';

interface AppContextType {
  user: Member | null;
  setUser: React.Dispatch<React.SetStateAction<Member | null>>;
  login: (token: string, userData: any) => void;
  logout: () => void;
  salesUpdateTrigger: number;
  triggerSalesRefetch: () => void;
  isInitializing: boolean;
  isDarkMode: boolean;
  toggleTheme: () => void;
  refreshUser: () => Promise<void>;
  switchGym: (gymId: number) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Member | null>(null);
  const [salesUpdateTrigger, setSalesUpdateTrigger] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);

  // 다크 모드 상태 (기본값: 저장된 값 또는 시스템 설정)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  // 다크 모드 적용 Effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/api/members/me');
      const freshUser = res.data;
      setUser(freshUser);
      localStorage.setItem('user', JSON.stringify(freshUser));
    } catch (error) {
      console.error("Failed to refresh user data", error);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      // ✅ [수정] storedUser가 "undefined"라는 문자열이면 무시하도록 예외 처리 추가
      if (token && storedUser && storedUser !== "undefined") {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);

          // 토큰 유효성 검사 및 최신 유저 정보(역할 등) 동기화
          const res = await api.get('/api/members/me');
          setUser(res.data);
          localStorage.setItem('user', JSON.stringify(res.data));
        } catch (error) {
          console.log("세션 정보가 깨졌거나 만료되었습니다. 로그아웃 처리합니다.");
          // 잘못된 정보 싹 지우기
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      } else {
        // 토큰이 없거나 정보가 이상하면 확실히 비우기
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }

      setIsInitializing(false);
    };

    initializeAuth();
  }, []);

  const login = (token: string, userData: any) => {
    localStorage.setItem('token', token);
    // ✅ [안전장치] userData가 없으면 저장하지 않음
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  };

  const switchGym = async (gymId: number) => {
    try {
      const res = await api.post('/api/auth/switch-gym', { gym_id: gymId });
      login(res.data.access_token, null);
      await refreshUser();
      window.location.reload(); // 새 정보로 UI 초기화
    } catch (error) {
      console.error('체육관 전환 실패', error);
      throw error;
    }
  };

  const triggerSalesRefetch = () => {
    setSalesUpdateTrigger(prev => prev + 1);
  };

  return (
    <AppContext.Provider value={{
      user,
      setUser,
      login,
      logout,
      salesUpdateTrigger,
      triggerSalesRefetch,
      isInitializing,
      isDarkMode,
      toggleTheme,
      refreshUser,
      switchGym
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
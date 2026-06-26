// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { backendApi, User } from '../services/backendMock';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  signup: (email: string, password: string, name: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // [AUTH-08, 09] 앱 구동 초기 시점 세션 만료 및 자동 로그인 자동 체크
    const currentUser = backendApi.getCurrentUser();
    const sessionCreatedAt = localStorage.getItem('yak_session_created_at');

    if (currentUser && sessionCreatedAt) {
      const now = Date.now();
      const sessionAge = now - parseInt(sessionCreatedAt, 10);
      const EXPIRE_TIME = 60 * 60 * 1000; // 1시간 가이드 스펙

      if (sessionAge > EXPIRE_TIME) {
        backendApi.logout();
        setUser(null);
        toast.error('[AUTH-09] 세션 토큰이 만료되었습니다. 다시 로그인해 주세요.');
      } else {
        setUser(currentUser);
        // AUTH-12: 백그라운드 구동에 따른 주기적 토큰 리프레시 시뮬레이션
        const renewedToken = `fcm_renew_${Math.random().toString(36).substring(5)}`;
        backendApi.saveOrUpdateFcmToken(currentUser.email, renewedToken);
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await backendApi.login(email, password);
      if (res.success && res.user) {
        setUser(res.user);

        // AUTH-11, 14: 로그인 성공에 따른 신규 디바이스 푸시 세션 토큰 DB 동기화
        const initialToken = `fcm_init_${Math.random().toString(36).substring(5)}`;
        const fcmRes = await backendApi.saveOrUpdateFcmToken(res.user.email, initialToken);
        if (!fcmRes.success) {
          toast.error('[AUTH-14] 오류 표시: 유저 로그인은 완료되었으나 FCM 토큰 DB 저장에 실패했습니다.');
        }
      }
      return res;
    } catch (err: any) {
      toast.error(err.message || '[AUTH-15] 인증 서버 연결 실패: 서버가 다운되었습니다.');
      return { success: false, message: 'SERVER_DOWN' };
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    try {
      return await backendApi.signup(email, password, name);
    } catch (err: any) {
      toast.error(err.message || '[AUTH-15] 서버 내부 장애로 회원가입 처리가 실패했습니다.');
      return { success: false, message: 'SERVER_DOWN' };
    }
  };

  const logout = async () => {
    if (user) {
      await backendApi.logout(user.email);
    } else {
      await backendApi.logout();
    }
    setUser(null);
    toast.info('[AUTH-10] 안전하게 로그아웃 되었습니다.');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth는 AuthProvider 안에서만 사용되어야 합니다.');
  return context;
}
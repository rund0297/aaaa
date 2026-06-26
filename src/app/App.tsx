// src/app/App.tsx
import { useState, useEffect } from 'react';
// 🌟 원래 프로젝트 환경에 맞게 react-router 경로를 올바르게 복구했습니다.
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { LoginPage } from './components/LoginPage';
import { DashboardPage } from './components/DashboardPage';
import { MedicineCabinetPage } from './components/MedicineCabinetPage';
import { PharmacyMapPage } from './components/PharmacyMapPage';
import { ProfilePage } from './components/ProfilePage';
import { BottomNav } from './components/BottomNav';
import { Toaster } from 'sonner';

import { auth, isMockMode } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [syncTrigger, setSyncTrigger] = useState(0);

  const refreshData = () => setSyncTrigger(prev => prev + 1);

  useEffect(() => {
    if (isMockMode) {
      const localSession = localStorage.getItem('yak_map_logged_in');
      const savedUser = localStorage.getItem('yak_mock_user_id');
      const sessionCreatedAt = localStorage.getItem('yak_session_created_at');

      if (localSession === 'true' && savedUser) {
        if (sessionCreatedAt) {
          const now = Date.now();
          const sessionAge = now - parseInt(sessionCreatedAt, 10);
          const EXPIRE_LIMIT = 60 * 60 * 1000;
          
          if (sessionAge > EXPIRE_LIMIT) {
            handleLogoutAction();
            setLoading(false);
            return;
          }
        }
        setUserId(savedUser);
        setIsAuthenticated(true);
      }
      setLoading(false);
    } else {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          setUserId(user.uid);
          setIsAuthenticated(true);
        } else {
          setUserId('');
          setIsAuthenticated(false);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, []);

  const handleLogoutAction = () => {
    if (isMockMode) {
      localStorage.removeItem('yak_map_logged_in');
      localStorage.removeItem('yak_mock_user_id');
      localStorage.removeItem('yak_session_user_data');
      localStorage.removeItem('yak_session_created_at');
    } else {
      auth.signOut();
    }
    setUserId('');
    setIsAuthenticated(false);
  };

  if (loading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-white">
        <div className="size-9 border-4 border-[#E12756] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 font-bold text-sm mt-4">데이터 격리 동기화 중...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors closeButton />
      <div className="size-full min-h-screen bg-[#FDFDFF] flex flex-col">
        {!isAuthenticated ? (
          <LoginPage onLogin={(uid) => {
            setUserId(uid);
            setIsAuthenticated(true);
            refreshData(); 
          }} />
        ) : (
          <>
            <div className="flex-1 overflow-y-auto pb-24">
              <Routes>
                <Route path="/" element={<Navigate to="/profile" replace />} />
                
                <Route path="/dashboard" element={<DashboardPage key={`dash_u_${userId}_${syncTrigger}`} userId={userId} onUpdate={refreshData} />} />
                <Route path="/cabinet" element={<MedicineCabinetPage key={`cab_u_${userId}_${syncTrigger}`} userId={userId} onUpdate={refreshData} />} />
                <Route path="/map" element={<PharmacyMapPage />} />
                <Route path="/profile" element={<ProfilePage key={`prof_u_${userId}_${syncTrigger}`} onLogout={handleLogoutAction} />} />
                
                <Route path="*" element={<Navigate to="/profile" replace />} />
              </Routes>
            </div>
            <div className="fixed bottom-0 left-0 right-0 z-50">
              <BottomNav />
            </div>
          </>
        )}
      </div>
    </BrowserRouter>
  );
}
// src/pages/AuthPage.tsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Mail, Lock, User, LogOut, CheckCircle2 } from 'lucide-react';

export function AuthPage() {
  const { user, login, signup, logout } = useAuth();
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      return toast.error('이메일과 비밀번호를 채워주세요.');
    }

    if (isLoginMode) {
      const res = await login(email, password);
      if (res.success) {
        toast.success('로그인에 성공했습니다! 메인으로 이동합니다.');
      } else {
        toast.error(res.message || '로그인 실패');
      }
    } else {
      if (!name) return toast.error('이름을 입력해 주세요.');
      const res = await signup(email, password, name);
      if (res.success) {
        toast.success(res.message);
        setIsLoginMode(true); // 가입 성공 시 로그인 모드로 전환
        setPassword('');
      } else {
        toast.error(res.message);
      }
    }
  };

  if (user) {
    return (
      <div className="w-full min-h-screen bg-gray-50 flex items-center justify-center p-4 max-w-md mx-auto">
        <div className="w-full bg-white p-8 rounded-[32px] text-center shadow-sm border border-gray-100">
          <div className="size-16 bg-teal-50 text-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="size-8" />
          </div>
          <h3 className="text-xl font-extrabold text-gray-900">{user.name}님 환영합니다</h3>
          <p className="text-xs text-gray-400 mt-1">{user.email}</p>
          <div className="bg-slate-50 p-4 rounded-2xl text-left text-xs text-slate-500 my-5 leading-relaxed">
            ✨ 이제 <strong>'내 약 보관함'</strong> 탭에서 복용할 의약품을 자유롭게 관리하고, <strong>'홈'</strong> 탭에서 오늘의 복용률을 실시간으로 추적할 수 있습니다.
          </div>
          <button onClick={logout} className="w-full bg-gray-900 text-white py-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
            <LogOut className="size-4" /> 로그아웃
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gray-50 flex items-center justify-center p-4 max-w-md mx-auto">
      <div className="w-full bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
        <h2 className="text-xl font-black text-gray-900 text-center mb-6">
          {isLoginMode ? '스마트 알약 케어 로그인' : '새로운 계정 만들기'}
        </h2>

        <form onSubmit={handleFormSubmit} className="space-y-3">
          {!isLoginMode && (
            <div className="flex items-center gap-2 border bg-gray-50 p-3 rounded-xl border-gray-100">
              <User className="size-4 text-gray-400" />
              <input type="text" placeholder="이름 입력" value={name} onChange={e => setName(e.target.value)} className="w-full bg-transparent text-xs outline-none text-gray-800" />
            </div>
          )}
          <div className="flex items-center gap-2 border bg-gray-50 p-3 rounded-xl border-gray-100">
            <Mail className="size-4 text-gray-400" />
            <input type="email" placeholder="이메일 주소" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-transparent text-xs outline-none text-gray-800" />
          </div>
          <div className="flex items-center gap-2 border bg-gray-50 p-3 rounded-xl border-gray-100">
            <Lock className="size-4 text-gray-400" />
            <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-transparent text-xs outline-none text-gray-800" />
          </div>

          <button type="submit" className="w-full bg-[#E12756] text-white py-3.5 rounded-xl text-xs font-bold mt-2 active:scale-[0.98] transition-transform shadow-sm">
            {isLoginMode ? '로그인하기' : '회원가입 완료'}
          </button>
        </form>

        <div className="text-center mt-5">
          <button onClick={() => setIsLoginMode(!isLoginMode)} className="text-xs text-[#E12756] font-bold hover:underline">
            {isLoginMode ? '처음이신가요? 회원가입 하러가기' : '이미 계정이 있으신가요? 로그인하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
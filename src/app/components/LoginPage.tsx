import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, fetchSignInMethodsForEmail } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';

export function LoginPage({ onLogin }: { onLogin: (uid: string) => void }) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');

  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      return toast.error('이메일 주소를 입력해 주세요.');
    }

    if (!password || password.includes(' ')) {
      return toast.error('비밀번호에 공백을 포함할 수 없습니다.');
    }
    if (password.length < 8) {
      return toast.error('안전을 위해 비밀번호는 최소 8자 이상이어야 합니다.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return toast.error('올바른 이메일 형식이 아닙니다.');
    }

    try {
      if (isLoginMode) {
        // 🔥 [로그인 모드 실행]
        try {
          const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
          const uid = userCredential.user.uid;
          
          localStorage.setItem('yak_map_logged_in', 'true');
          localStorage.setItem('yak_mock_user_id', uid);
          localStorage.setItem('yak_session_created_at', String(Date.now()));
          
          toast.success(`반갑습니다! 로그인이 완료되었습니다.`);
          onLogin(uid);
        } catch (loginError: any) {
          const errCode = loginError.code;
          
          if (errCode === 'auth/invalid-credential' || errCode === 'auth/wrong-password') {
            try {
              const methods = await fetchSignInMethodsForEmail(auth, trimmedEmail);
              if (methods && methods.length > 0) {
                return toast.error('이미 존재하는 회원 계정입니다. 비밀번호를 다시 확인해 주세요.');
              }
            } catch (fetchError: any) {
              console.log("계정 조회 제한 또는 API 오류:", fetchError.code);
            }
            return toast.error('이미 가입된 계정의 비밀번호가 틀렸거나, 등록되지 않은 이메일입니다.');
          }
          
          if (errCode === 'auth/api-key-not-valid') {
            return toast.error('프로젝트의 Firebase API Key 설정이 올바르지 않습니다. 환경 변수를 확인해 주세요.');
          }
          
          toast.error(`로그인 실패: ${loginError.message}`);
        }
      } else {
        // 🔥 [회원가입 모드]
        if (!name.trim()) {
          return toast.error('사용자 이름을 입력해 주세요.');
        }
        if (password !== confirmPassword) {
          return toast.error('비밀번호 확인이 일치하지 않습니다. 다시 확인해 주세요.');
        }
        if (!agreeTerms || !agreePrivacy) {
          return toast.error('필수 이용약관 및 개인정보 처리방침에 모두 동의하셔야 가입이 가능합니다.');
        }

        const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        const uid = userCredential.user.uid;

        await setDoc(doc(db, 'users', uid), {
          id: uid,
          email: trimmedEmail,
          name: name.trim(),
          joinedAt: new Date().toISOString().split('T')[0]
        });

        localStorage.setItem('yak_map_logged_in', 'true');
        localStorage.setItem('yak_mock_user_id', uid);
        localStorage.setItem('yak_session_created_at', String(Date.now()));

        toast.success(`[가입 완료] ${name}님의 계정이 클라우드 DB에 생성되었습니다!`);
        onLogin(uid);
      }
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('이미 가입되어 존재하는 이메일 계정입니다. 로그인 페이지를 이용해 주세요.');
      } else if (error.code === 'auth/api-key-not-valid') {
        toast.error('Firebase API Key가 만료되었거나 잘못되었습니다. firebase.ts 파일을 수정해 주세요.');
      } else {
        toast.error(`인증 처리 오류: ${error.message}`);
      }
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#FDFDFF] px-6 flex flex-col justify-center max-w-md mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">약맵 (YakMap)</h1>
        <p className="text-xs text-gray-400 mt-1.5">클라우드 NoSQL 데이터베이스 회원 동기화 인증 시스템</p>
      </div>

      <form onSubmit={handleAuthSubmit} className="space-y-3.5">
        {!isLoginMode && (
          <input 
            type="text" 
            placeholder="이름" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-xs outline-none focus:border-[#E12756] transition-all" 
          />
        )}
        
        <input 
          type="email" 
          placeholder="이메일 주소" 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-xs outline-none focus:border-[#E12756] transition-all" 
        />
        
        <input 
          type="password" 
          placeholder={isLoginMode ? "비밀번호" : "비밀번호 (8자 이상, 공백 불가)"}
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-xs outline-none focus:border-[#E12756] transition-all" 
        />

        {!isLoginMode && (
          <input 
            type="password" 
            placeholder="비밀번호 확인" 
            value={confirmPassword} 
            onChange={e => setConfirmPassword(e.target.value)} 
            className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-xs outline-none focus:border-[#E12756] transition-all" 
          />
        )}

        {!isLoginMode && (
          <div className="pt-2 pb-1 px-1 space-y-2.5">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="terms"
                checked={agreeTerms}
                onChange={e => setAgreeTerms(e.target.checked)}
                className="rounded text-[#E12756] focus:ring-[#E12756] size-3.5"
              />
              <label htmlFor="terms" className="text-[11px] text-gray-500 font-medium cursor-pointer">
                (필수) <span className="underline">서비스 이용약관</span>에 동의합니다.
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="privacy"
                checked={agreePrivacy}
                onChange={e => setAgreePrivacy(e.target.checked)}
                className="rounded text-[#E12756] focus:ring-[#E12756] size-3.5"
              />
              <label htmlFor="privacy" className="text-[11px] text-gray-500 font-medium cursor-pointer">
                (필수) <span className="underline">개인정보 처리방침 및 수집 이용</span>에 동의합니다.
              </label>
            </div>
          </div>
        )}
        
        <button type="submit" className="w-full bg-[#E12756] text-white py-4 rounded-2xl font-black text-xs shadow-md shadow-rose-100 active:scale-[0.98] transition-all">
          {isLoginMode ? '로그인하기' : '가입 완료하기'}
        </button>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => {
              setIsLoginMode(!isLoginMode);
              setAgreeTerms(false);
              setAgreePrivacy(false);
            }}
            className="text-[11px] text-gray-400 hover:text-gray-600 font-medium underline"
          >
            {isLoginMode ? '아직 계정이 없으신가요? 회원가입하기' : '이미 계정이 있으신가요? 로그인하기'}
          </button>
        </div>
      </form>
    </div>
  );
}
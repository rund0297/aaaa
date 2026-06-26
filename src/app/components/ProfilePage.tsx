// src/app/components/ProfilePage.tsx
import { useState, useEffect } from 'react';
import { User, Mail, Calendar, LogOut, ShieldCheck } from 'lucide-react';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  joinedAt: string;
}

export function ProfilePage({ onLogout }: { onLogout: () => void }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadFirestoreUserProfile() {
      // 1. Firebase Auth의 현재 로그인된 유저 ID 혹은 백업 세션 UID 확보
      const currentUid = auth.currentUser?.uid || localStorage.getItem('yak_mock_user_id') || '';
      
      if (!currentUid) {
        setIsLoading(false);
        return;
      }

      try {
        // 2. Firestore의 'users' 컬렉션에서 해당 UID 고유 문서 단건 조회
        const userDocRef = doc(db, 'users', currentUid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          // 데이터가 없을 때를 대비한 안전 가드 폴백
          setProfile({
            id: currentUid,
            email: auth.currentUser?.email || "알 수 없는 계정",
            name: "미등록 사용자",
            joinedAt: "2026-01-01"
          });
        }
      } catch (error) {
        console.error("프로필 로드 에러", error);
        toast.error("데이터베이스에서 회원 프로필을 가져오지 못했습니다.");
      } finally {
        setIsLoading(false);
      }
    }

    loadFirestoreUserProfile();
  }, []);

  const handleLogoutClick = () => {
    if (!confirm("정말 로그아웃 하시겠습니까?")) return;
    
    // 로컬 세션 일괄 클리어
    localStorage.removeItem('yak_map_logged_in');
    localStorage.removeItem('yak_mock_user_id');
    localStorage.removeItem('yak_session_created_at');
    
    auth.signOut();
    toast.success("안전하게 로그아웃 되었습니다.");
    onLogout();
  };

  if (isLoading) {
    return (
      <div className="text-center py-20 min-h-screen flex flex-col justify-center bg-gray-50">
        <div className="size-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-gray-400 mt-2">안전 프로필 세션 조회 중...</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gray-50 p-5 pb-24 max-w-md mx-auto flex flex-col justify-between">
      <div className="space-y-6">
        <h2 className="text-xl font-black text-gray-900 flex items-center gap-1.5 pt-2">
          <User className="size-5 text-gray-800" /> 내 프로필 정보
        </h2>

        {/* 프로필 카드 섹션 (Firestore 데이터 연동 뷰) */}
        <div className="bg-white p-6 rounded-[28px] border border-gray-100 shadow-xs space-y-5 animate-in fade-in duration-150">
          <div className="flex items-center gap-4 border-b border-gray-50 pb-4">
            <div className="size-12 bg-gradient-to-tr from-[#E12756] to-[#FF5E88] rounded-2xl flex items-center justify-center text-white font-black text-base shadow-sm shadow-rose-100">
              {profile?.name ? profile.name.slice(0, 2) : "유저"}
            </div>
            <div>
              <h3 className="font-black text-gray-800 text-base">{profile?.name}</h3>
              <p className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-bold inline-flex items-center gap-1 mt-1">
                <ShieldCheck className="size-3" /> Firestore 동기화 회원
              </p>
            </div>
          </div>

          <div className="space-y-3.5 pt-1">
            <div className="flex items-center gap-2.5 text-xs text-gray-500">
              <Mail className="size-4 text-gray-400" />
              <div>
                <p className="text-[10px] text-gray-400 font-bold">이메일 계정</p>
                <p className="font-bold text-gray-700 mt-0.5">{profile?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-xs text-gray-500">
              <Calendar className="size-4 text-gray-400" />
              <div>
                <p className="text-[10px] text-gray-400 font-bold">서비스 가입일자</p>
                <p className="font-bold text-gray-700 mt-0.5">{profile?.joinedAt}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button 
        onClick={handleLogoutClick}
        className="w-full bg-white border border-gray-200 text-gray-500 py-4 rounded-[22px] font-bold text-xs flex items-center justify-center gap-2 shadow-2xs hover:bg-gray-50 active:scale-[0.99] transition-all"
      >
        <LogOut className="size-4 text-gray-400" /> 내 계정 로그아웃
      </button>
    </div>
  );
}
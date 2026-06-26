// src/services/backendMock.ts

export interface Medicine {
  id: string;
  name: string;
  type: string;
  currentCount: number;
  totalCount: number;
  dosageTime: string;
  dosageAmount: string;
  isTaken: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  joinedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

const KEYS = {
  USERS_DB: 'yak_local_users_db',
  MEDS_PREFIX: 'pills_cabinet_user_',
  SESSION_USER: 'yak_session_user_data',
  SESSION_UID: 'yak_mock_user_id',
  SESSION_TIME: 'yak_session_created_at'
};

// 🔑 [수리 핵심 가드] 컴포넌트가 userId를 안 주거나 꼬여도, 현재 세션의 실제 로그인 유저 ID를 강제 추출
const getAbsoluteActiveUid = (passedId?: string): string => {
  const currentSessionUid = localStorage.getItem(KEYS.SESSION_UID);
  return passedId || currentSessionUid || 'guest_fallback_user';
};

// 🔑 [수리 핵심] 초기 기본 약 데이터를 완전히 빈 배열([])로 변경하여 계정별 격리를 보장
const loadUserMeds = (userId: string): Medicine[] => {
  const targetUid = getAbsoluteActiveUid(userId);
  const localData = localStorage.getItem(KEYS.MEDS_PREFIX + targetUid);
  
  if (!localData) {
    // 다른 계정에 약이 복사되는 결함을 막기 위해 최초 가입/로그인 시 빈 보관함으로 설정
    const emptyCabinet: Medicine[] = [];
    localStorage.setItem(KEYS.MEDS_PREFIX + targetUid, JSON.stringify(emptyCabinet));
    return emptyCabinet;
  }
  return JSON.parse(localData);
};

export const backendApi = {
  checkServerHealth: () => {
    if (localStorage.getItem('sim_auth_server_down') === 'true') {
      throw new Error("AUTH-15: 인증 서버 내부 장애가 발생했습니다. (서버 다운)");
    }
  },

  getCurrentUser: (): User | null => {
    const saved = localStorage.getItem(KEYS.SESSION_USER);
    return saved ? JSON.parse(saved) : null;
  },

  login: async (email: string, password: string): Promise<{ success: boolean; user?: User; message?: string }> => {
    backendApi.checkServerHealth();
    const users = JSON.parse(localStorage.getItem(KEYS.USERS_DB) || '[]');
    const found = users.find((u: any) => u.email === email && u.password === password);

    if (found) {
      const userData: User = { id: found.id, email: found.email, name: found.name };
      localStorage.setItem(KEYS.SESSION_USER, JSON.stringify(userData));
      localStorage.setItem(KEYS.SESSION_UID, found.id);
      localStorage.setItem(KEYS.SESSION_TIME, Date.now().toString());
      return { success: true, user: userData };
    }
    return { success: false, message: "이메일 또는 비밀번호가 일치하지 않습니다." };
  },

  signup: async (email: string, password: string, name: string): Promise<{ success: boolean; message: string }> => {
    backendApi.checkServerHealth();
    const users = JSON.parse(localStorage.getItem(KEYS.USERS_DB) || '[]');
    
    if (users.some((u: any) => u.email === email)) {
      return { success: false, message: '이미 가입된 이메일 계정입니다.' };
    }

    const mockId = 'user_mock_' + Date.now();
    const today = new Date().toISOString().split('T')[0];
    users.push({ id: mockId, email, password, name, joinedAt: today });
    localStorage.setItem(KEYS.USERS_DB, JSON.stringify(users));

    return { success: true, message: '회원가입이 완료되었습니다!' };
  },

  logout: async (email?: string): Promise<void> => {
    if (email) {
      localStorage.removeItem(`db_user_fcm_${email}`);
    }
    localStorage.removeItem(KEYS.SESSION_USER);
    localStorage.removeItem(KEYS.SESSION_UID);
    localStorage.removeItem(KEYS.SESSION_TIME);
    localStorage.removeItem('yak_map_logged_in');
  },

  saveOrUpdateFcmToken: async (email: string, token: string): Promise<{ success: boolean }> => {
    if (localStorage.getItem('sim_fcm_save_fail') === 'true') {
      return { success: false };
    }
    localStorage.setItem(`db_user_fcm_${email}`, token);
    return { success: true };
  },

  getUserProfile: async (userId: string): Promise<UserProfile | null> => {
    const targetUid = getAbsoluteActiveUid(userId);
    const users = JSON.parse(localStorage.getItem(KEYS.USERS_DB) || '[]');
    const found = users.find((u: any) => u.id === targetUid);
    if (found) {
      return { id: found.id, email: found.email, name: found.name, joinedAt: found.joinedAt || '2026-01-01' };
    }
    return { id: targetUid, email: 'user@email.com', name: '스마트 케어 회원', joinedAt: '2026-01-01' };
  },

  /** 🔑 [보관함 데이터 조회] 어떠한 상황에서도 현재 액티브 유저 공간만 격리 조회 */
  getMedicines: async (userId?: string): Promise<Medicine[]> => {
    return loadUserMeds(getAbsoluteActiveUid(userId));
  },

  /** 🔑 [약 추가 API] */
  addMedicine: async (userId: string, med: Omit<Medicine, 'id' | 'isTaken'>): Promise<Medicine[]> => {
    const targetUid = getAbsoluteActiveUid(userId);
    const meds = loadUserMeds(targetUid);
    const newMed: Medicine = { ...med, id: 'med_' + Date.now(), isTaken: false };
    meds.push(newMed);
    localStorage.setItem(KEYS.MEDS_PREFIX + targetUid, JSON.stringify(meds));
    return meds;
  },

  /** 🔑 [약 삭제 API] */
  deleteMedicine: async (userId: string, id: string): Promise<Medicine[]> => {
    const targetUid = getAbsoluteActiveUid(userId);
    let meds = loadUserMeds(targetUid);
    meds = meds.filter(m => m.id !== id);
    localStorage.setItem(KEYS.MEDS_PREFIX + targetUid, JSON.stringify(meds));
    return meds;
  },

  /** 🔑 [대시보드 토글 API] */
  toggleIdentifyTaken: async (userId: string, id: string): Promise<Medicine[]> => {
    const targetUid = getAbsoluteActiveUid(userId);
    const meds = loadUserMeds(targetUid);
    const target = meds.find(m => m.id === id);
    if (target) {
      target.isTaken = !target.isTaken;
      if (target.isTaken) {
        if (target.currentCount > 0) target.currentCount -= 1;
      } else {
        if (target.currentCount < target.totalCount) target.currentCount += 1;
      }
    }
    localStorage.setItem(KEYS.MEDS_PREFIX + targetUid, JSON.stringify(meds));
    return meds;
  }
};
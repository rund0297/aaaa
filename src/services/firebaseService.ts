// src/services/firebaseService.ts
import { db } from '../app/firebase'; 
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc, 
  doc, 
  setDoc,
  updateDoc, // 💡 수량 업데이트를 위해 추가
  orderBy
} from 'firebase/firestore';

export interface Medicine {
  id: string;
  name: string;
  durationDays: number;
  dosageCount: string;
  takeFrequency: string;
  registeredAt: string;
  userId: string;
  totalQuantity: number; 
  startDate?: string;
  endDate?: string;
  medType?: string;
}

export interface IntakeLog {
  medicineName?: string;
  lastIntakeDate: string; 
  nextIntakeTime: number;
  checked?: boolean;
}

/**
 * 🔑 1. 로그인한 유저의 약 보관함 데이터 조회
 */
export const getUserMedicines = async (userId: string): Promise<Medicine[]> => {
  if (!userId) return [];
  try {
    const q = query(
      collection(db, 'medicines'), 
      where('userId', '==', userId),
      orderBy('registeredAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Medicine[];
  } catch (error) {
    const q = query(collection(db, 'medicines'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Medicine[];
    return data.sort((a, b) => b.registeredAt.localeCompare(a.registeredAt));
  }
};

/**
 * 🔑 2. 새 알약 보관함 등록
 */
export const addMedicineToDb = async (
  userId: string, 
  med: { 
    name: string; 
    durationDays: number; 
    dosageCount: string; 
    takeFrequency: string;
    startDate: string;
    endDate: string;
    totalQuantity: number;
    medType: string;
  }
): Promise<void> => {
  if (!userId) return;
  await addDoc(collection(db, 'medicines'), {
    ...med,
    userId,
    registeredAt: new Date().toISOString()
  });
};

/**
 * 🔑 2-1. 복용 체크 시 파이어베이스 상의 약 잔여 재고 수량을 직접 차감 업데이트 (💡 추가됨)
 */
export const updateMedicineQuantity = async (medicineId: string, nextQuantity: number): Promise<void> => {
  if (!medicineId) return;
  const medRef = doc(db, 'medicines', medicineId);
  await updateDoc(medRef, {
    totalQuantity: nextQuantity
  });
};

/**
 * 🔑 3. 보관함 알약 제거
 */
export const deleteMedicineFromDb = async (medicineId: string): Promise<void> => {
  if (!medicineId) return;
  await deleteDoc(doc(db, 'medicines', medicineId));
};

/**
 * 🔑 4. 대시보드 복용 체크 로그 저장 및 업데이트
 */
export const saveIntakeLog = async (
  userId: string, 
  medicineId: string, 
  log: IntakeLog
): Promise<void> => {
  if (!userId || !medicineId) return;
  const logRef = doc(db, 'intake_logs', `${userId}_${medicineId}`);
  await setDoc(logRef, {
    userId,
    medicineId,
    ...log
  }, { merge: true });
};

/**
 * 🔑 5. 대시보드 복용 체크 기록 일괄 로드
 */
export const getIntakeLogs = async (userId: string): Promise<Record<string, IntakeLog>> => {
  if (!userId) return {};
  const q = query(collection(db, 'intake_logs'), where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  
  const logs: Record<string, IntakeLog> = {};
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    logs[data.medicineId] = {
      lastIntakeDate: data.lastIntakeDate || "",
      nextIntakeTime: data.nextIntakeTime || 0
    };
  });
  return logs;
};
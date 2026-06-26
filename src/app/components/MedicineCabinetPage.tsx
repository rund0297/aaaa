// src/app/components/MedicineCabinetPage.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Clock, Pill } from "lucide-react";
import { AddMedicineModal } from './AddMedicineModal';
import { getUserMedicines, deleteMedicineFromDb, Medicine } from '../../services/firebaseService';
import { toast } from 'sonner';

interface MedicineCabinetPageProps {
  userId: string;
  onUpdate?: () => void;
}

export function MedicineCabinetPage({ userId, onUpdate }: MedicineCabinetPageProps) {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isFirstCabinetLoad = useRef(true);

  const loadCabinetData = async (silent = false) => {
    if (!userId) {
      setMedicines([]);
      setIsLoading(false);
      return;
    }
    if (!silent) setIsLoading(true);
    try {
      const data = await getUserMedicines(userId);
      setMedicines(data);
    } catch (error) {
      console.error("데이터베이스 보관함 호출 오류", error);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isFirstCabinetLoad.current) {
      loadCabinetData(false);
      isFirstCabinetLoad.current = false;
    } else {
      loadCabinetData(true);
    }
  }, [userId]);

  const handleDeleteMedicine = async (id: string) => {
    if (!confirm("해당 의약품을 보관함 데이터베이스에서 삭제하시겠습니까?")) return;
    
    // 🚀 화면에서 즉시 먼저 없애서 지연시간을 제로로 만듭니다.
    const originalMeds = [...medicines];
    setMedicines(prev => prev.filter(med => med.id !== id));
    toast.success("약품이 성공적으로 제거되었습니다.");

    try {
      await deleteMedicineFromDb(id);
      if (onUpdate) onUpdate();
    } catch (error) {
      // 에러 발생 시에만 롤백
      setMedicines(originalMeds);
      toast.error("삭제하는 도중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#FDFDFF] px-5 pt-6 pb-24">
      <div className="mb-6">
        <h1 className="text-xl font-black text-gray-900">내 약 보관함</h1>
        <p className="text-xs text-gray-400 mt-1">등록된 의약품은 클라우드 계정에 동기화되어 안전하게 보관됩니다.</p>
      </div>

      <button 
        onClick={() => setIsOpen(true)}
        className="w-full py-4 bg-gradient-to-r from-[#E12756] to-[#FF4E7A] text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-md shadow-rose-100"
      >
        <Plus className="size-4" strokeWidth={3} /> 새로운 복용 약품 추가하기
      </button>

      <div className="mt-6 space-y-3.5">
        {isLoading ? (
          <div className="text-center py-10">
            <div className="size-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-gray-400 mt-2">보관함 계정 격리 데이터 조회 중...</p>
          </div>
        ) : medicines.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-100 bg-gray-50/50 rounded-2xl">
            <Pill className="size-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400 font-bold">현재 등록된 복용 약품이 없습니다.</p>
            <p className="text-[10px] text-gray-300 mt-0.5">상단 버튼을 눌러 첫 약을 등록하세요.</p>
          </div>
        ) : (
          medicines.map((med) => {
            return (
              <div 
                key={med.id} 
                className="w-full p-4.5 bg-white border border-gray-100 hover:border-gray-200 rounded-2xl flex items-center justify-between transition-all shadow-2xs animate-in fade-in duration-100"
              >
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold text-gray-800">{med.name}</h3>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500 flex-wrap">
                    <span className="text-[#E12756] bg-rose-50/70 px-2 py-0.5 rounded-md font-bold">
                      1회 {med.dosageCount || '1정'}
                    </span>
                    <span className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-md font-medium text-gray-600">
                      <Clock className="size-3 text-gray-400" /> {med.takeFrequency || '하루 3회'}
                    </span>
                  </div>
                </div>
                
                <button 
                  onClick={() => handleDeleteMedicine(med.id)} 
                  className="p-2 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                  title="삭제하기"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {isOpen && (
        <AddMedicineModal 
          userId={userId}
          onClose={() => setIsOpen(false)} 
          currentCabinetItems={medicines.map(m => ({ name: m.name, registeredAt: m.registeredAt, durationDays: m.durationDays }))}
          onAddMedicine={() => {
            loadCabinetData(true); // 추가 후 백그라운드 새로고침
          }}
        />
      )}
    </div>
  );
}
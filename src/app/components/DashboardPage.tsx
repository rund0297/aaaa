// src/app/components/DashboardPage.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Circle, Clock, AlertCircle, Bell, ShoppingBag, Layers, CheckSquare, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getUserMedicines, getIntakeLogs, saveIntakeLog, updateMedicineQuantity, Medicine, IntakeLog } from '../../services/firebaseService';

interface DashboardPageProps {
  userId: string;
  onUpdate?: () => void;
}

interface TimeSlotItem {
  id: string; 
  medicine: Medicine;
  timeSlot: string;
  isPastOrEqual: boolean; 
  isChecked: boolean;
  minutesAhead: number;
}

export function DashboardPage({ userId, onUpdate }: DashboardPageProps) {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [intakeLogs, setIntakeLogs] = useState<Record<string, IntakeLog>>({});
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  const [checkedSlotIds, setCheckedSlotIds] = useState<string[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<string[]>([]);
  const [timeSlotList, setTimeSlotList] = useState<TimeSlotItem[]>([]);
  const [currentDateStr, setCurrentDateStr] = useState<string>('');
  
  const isFirstLoad = useRef(true);

  const loadDashboardData = async () => {
    if (!userId) return;
    try {
      setIsInitialLoading(true);
      
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      setCurrentDateStr(todayStr);

      const meds = await getUserMedicines(userId);
      const logs = await getIntakeLogs(userId);
      
      setMedicines(meds);
      setIntakeLogs(logs);
      
      const savedCheckedIds: string[] = [];

      meds.forEach(med => {
        const rawLogData = logs[med.id]?.lastIntakeDate || "";
        const timeSlots = med.takeFrequency?.match(/([0-1][0-9]|2[0-3]):[0-5][0-9]/g) || ['09:00'];
        
        timeSlots.forEach(slotTime => {
          const slotId = `${med.id}_${slotTime}`;
          const logSlotKey = `${todayStr}_${slotTime}`;
          
          if (rawLogData.includes(logSlotKey)) {
            savedCheckedIds.push(slotId);
          }
        });
      });

      setCheckedSlotIds(savedCheckedIds);
      buildTimelineScheduler(meds, savedCheckedIds, todayStr);
    } catch (error) {
      console.error("대시보드 데이터 동기화 실패", error);
    } finally {
      setIsInitialLoading(false);
    }
  };

  const buildTimelineScheduler = (meds: Medicine[], currentCheckedIds: string[], targetDateStr: string) => {
    const now = new Date();
    const todayStr = targetDateStr || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentDeviceTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const calculatedSlots: TimeSlotItem[] = [];
    const currentUrgentAlerts: string[] = [];

    meds.forEach(med => {
      if (med.startDate && med.endDate) {
        if (todayStr < med.startDate || todayStr > med.endDate) return;
      }

      const timeSlots = med.takeFrequency?.match(/([0-1][0-9]|2[0-3]):[0-5][0-9]/g) || ['09:00'];

      timeSlots.forEach(slotTime => {
        const slotId = `${med.id}_${slotTime}`;
        const isPastOrEqual = currentDeviceTime >= slotTime;
        const isChecked = currentCheckedIds.includes(slotId);

        const [slotH, slotM] = slotTime.split(':').map(Number);
        const slotMinutesTotal = slotH * 60 + slotM;
        const currentMinutesTotal = now.getHours() * 60 + now.getMinutes();
        const minutesAhead = slotMinutesTotal - currentMinutesTotal;

        if (isPastOrEqual && !isChecked && (med.totalQuantity || 0) > 0) {
          currentUrgentAlerts.push(`${med.name} (${slotTime})`);
        }

        calculatedSlots.push({
          id: slotId,
          medicine: med,
          timeSlot: slotTime,
          isPastOrEqual,
          isChecked,
          minutesAhead: minutesAhead > 0 ? minutesAhead : 0
        });
      });
    });

    calculatedSlots.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
    setTimeSlotList(calculatedSlots);
    setActiveAlerts(currentUrgentAlerts);
  };

  // 하루 단위 리스트 갱신 인터벌 엔진
  useEffect(() => {
    const dateTrackerInterval = setInterval(() => {
      const checkNow = new Date();
      const checkTodayStr = `${checkNow.getFullYear()}-${String(checkNow.getMonth() + 1).padStart(2, '0')}-${String(checkNow.getDate()).padStart(2, '0')}`;
      
      if (currentDateStr && currentDateStr !== checkTodayStr) {
        loadDashboardData();
      }
    }, 60000);

    return () => clearInterval(dateTrackerInterval);
  }, [currentDateStr, userId]);

  useEffect(() => {
    if (medicines.length > 0) {
      buildTimelineScheduler(medicines, checkedSlotIds, currentDateStr);
    }
  }, [checkedSlotIds, medicines, currentDateStr]);

  useEffect(() => {
    if (isFirstLoad.current) {
      loadDashboardData();
      isFirstLoad.current = false;
    }
  }, [userId]);

  const formatAheadTimeText = (minutes: number): string => {
    if (minutes < 60) return `${minutes}분 앞`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}시간 ${mins}분 앞` : `${hours}시간 앞`;
  };

  // 💊 복용 체크 제어 핸들러 (파이어베이스 실시간 재고 반영)
  const handleSlotCheckToggle = async (slot: TimeSlotItem) => {
    if (!userId) return;
    
    if (checkedSlotIds.includes(slot.id) || slot.isChecked) {
      return toast.error("[중복 복용 제한] 이미 오늘 복용 완료 처리가 기록되어 있습니다.");
    }

    const dosageNum = parseInt(slot.medicine.dosageCount?.replace(/[^0-9]/g, '') || '1') || 1;
    if (!slot.medicine.totalQuantity || slot.medicine.totalQuantity < dosageNum) {
      return toast.error(`[수량 부족] 남은 약의 개수가 부족합니다. (재고: ${slot.medicine.totalQuantity || 0}개)`);
    }

    const now = new Date();
    const todayStr = currentDateStr || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const logSlotKey = `${todayStr}_${slot.timeSlot}`;
    const nextRemainingQty = Math.max(0, slot.medicine.totalQuantity - dosageNum);

    // 0초 반응형 선반영 UI 업데이트
    setCheckedSlotIds(prev => [...prev, slot.id]);
    setMedicines(prevMeds => 
      prevMeds.map(m => m.id === slot.medicine.id ? { ...m, totalQuantity: nextRemainingQty } : m)
    );

    try {
      const currentLogData = intakeLogs[slot.medicine.id]?.lastIntakeDate || "";
      const updatedLogString = currentLogData ? `${currentLogData},${logSlotKey}` : logSlotKey;

      // 1단계: 복용 타임스탬프 로그 저장
      await saveIntakeLog(userId, slot.medicine.id, {
        medicineName: slot.medicine.name,
        lastIntakeDate: updatedLogString,
        nextIntakeTime: Date.now()
      });

      // 2단계: 💡 [추가] 파이어베이스 medicines 문서 안의 실제 재고 수량(totalQuantity) 영구 차감 적용
      await updateMedicineQuantity(slot.medicine.id, nextRemainingQty);

      if (slot.minutesAhead > 0) {
        const aheadText = formatAheadTimeText(slot.minutesAhead);
        toast.success(`🟢 [미리 복용 완료] 예상 시간보다 ${aheadText} 일찍 복용 처리를 완료했습니다. (${slot.medicine.name})`);
      } else {
        toast.success(`💊 [정상 복용 완료] 오늘의 복용 처리를 안전하게 완료했습니다.`);
      }

      if (onUpdate) onUpdate();
    } catch (err) {
      // 실패 시 롤백 복구
      setCheckedSlotIds(prev => prev.filter(id => id !== slot.id));
      setMedicines(prevMeds => 
        prevMeds.map(m => m.id === slot.medicine.id ? { ...m, totalQuantity: slot.medicine.totalQuantity } : m)
      );
      toast.error("데이터베이스 통신 중 오류가 발생했습니다.");
    }
  };

  const totalDosesCount = timeSlotList.length;
  const completedDosesCount = timeSlotList.filter(s => s.isChecked).length;
  const urgentRefillCount = medicines.filter(med => {
    const timeSlots = med.takeFrequency?.match(/([0-1][0-9]|2[0-3]):[0-5][0-9]/g) || ['09:00'];
    const dosageNum = parseInt(med.dosageCount?.replace(/[^0-9]/g, '') || '1') || 1;
    return (med.totalQuantity || 0) <= (timeSlots.length * dosageNum);
  }).length;

  if (isInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-3">
        <div className="size-8 border-4 border-[#E12756] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-gray-400 font-medium">대시보드 데이터를 동기화 중입니다...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 📊 통계 영역 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-center">
          <Layers className="size-4 text-gray-400 mx-auto mb-1" />
          <p className="text-[9px] text-gray-400 font-bold">오늘의 약</p>
          <p className="text-xs font-black text-gray-800 mt-0.5">{totalDosesCount}회</p>
        </div>
        <div className="p-3.5 bg-rose-50/60 border border-rose-100 rounded-2xl text-center">
          <CheckSquare className="size-4 text-[#E12756] mx-auto mb-1" />
          <p className="text-[9px] text-rose-400 font-bold">복용 완료</p>
          <p className="text-xs font-black text-[#E12756] mt-0.5">{completedDosesCount}회</p>
        </div>
        <div className="p-3.5 bg-amber-50/70 border border-amber-100 rounded-2xl text-center">
          <ShoppingBag className="size-4 text-amber-600 mx-auto mb-1" />
          <p className="text-[9px] text-amber-500 font-bold">재구매 필요</p>
          <p className="text-xs font-black text-amber-700 mt-0.5">{urgentRefillCount}종</p>
        </div>
      </div>

      {/* 🔔 경고 알람 배너 */}
      {activeAlerts.length > 0 && (
        <div className="p-4 bg-gradient-to-r from-amber-500 to-rose-600 rounded-2xl text-white shadow-md space-y-2">
          <div className="flex items-center gap-2">
            <Bell className="size-4 animate-bounce" />
            <h4 className="text-xs font-black">⚠️ 미복용 의약품 경고 알람</h4>
          </div>
          <div className="text-[10px] text-rose-50 font-medium space-y-1 pl-1">
            {activeAlerts.map((text, i) => (
              <p key={i}>• {text}: 복용 시간이 이미 경과했습니다! 지금 체크를 진행해 주세요.</p>
            ))}
          </div>
        </div>
      )}

      {/* 📋 타임라인 리스트 보드 */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-black text-gray-800 pl-1 flex items-center gap-1">
          <Clock className="size-3.5 text-gray-400" /> 오늘 복용 타임라인 리스트
        </h3>

        {timeSlotList.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-gray-200 rounded-3xl bg-gray-50/50">
            <AlertCircle className="size-6 text-gray-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-gray-400">현재 일정에 등록된 복용 시간표가 없습니다.</p>
          </div>
        ) : (
          timeSlotList.map((slot) => {
            const parsedTimeSlots = slot.medicine.takeFrequency?.match(/([0-1][0-9]|2[0-3]):[0-5][0-9]/g) || ['09:00'];
            const dosageNum = parseInt(slot.medicine.dosageCount?.replace(/[^0-9]/g, '') || '1') || 1;
            const dailyDosage = parsedTimeSlots.length * dosageNum;
            const isNeedRefill = (slot.medicine.totalQuantity || 0) <= dailyDosage;

            const isMissed = slot.isPastOrEqual && !slot.isChecked;
            const isEarlyChecked = slot.isChecked && slot.minutesAhead > 0;

            return (
              <div 
                key={slot.id}
                onClick={() => handleSlotCheckToggle(slot)}
                className={`p-4 rounded-2xl border transition-all duration-150 flex items-center justify-between ${
                  isEarlyChecked
                    ? 'bg-[#BCEE82] border-[#A3D968] font-medium shadow-2xs cursor-pointer' 
                    : slot.isChecked
                      ? 'bg-rose-50/40 border-rose-100 opacity-70 select-none' 
                      : isMissed
                        ? 'bg-amber-50/50 border-amber-200 hover:border-amber-300 shadow-2xs cursor-pointer' 
                        : 'bg-white border-gray-100 hover:border-gray-200 shadow-2xs cursor-pointer' 
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div>
                    {isEarlyChecked ? (
                      <CheckCircle2 className="size-5 text-emerald-600 shrink-0" /> 
                    ) : slot.isChecked ? (
                      <CheckCircle2 className="size-5 text-[#E12756] shrink-0" /> 
                    ) : isMissed ? (
                      <AlertTriangle className="size-5 text-amber-500 shrink-0" /> 
                    ) : (
                      <Circle className="size-5 text-gray-300 hover:text-rose-400 shrink-0" /> 
                    )}
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                        isEarlyChecked 
                          ? 'bg-emerald-600 text-white' 
                          : isMissed 
                            ? 'bg-amber-100 text-amber-700' 
                            : 'bg-gray-100 text-gray-400'
                      }`}>
                        {slot.timeSlot}
                      </span>
                      <h3 className={`text-xs font-bold ${slot.isChecked ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {slot.medicine.name}
                      </h3>
                      
                      {!slot.isChecked && slot.minutesAhead > 0 && (
                        <span className="text-[8px] bg-sky-50 text-sky-600 border border-sky-100 font-extrabold px-1.5 py-0.5 rounded">
                          {formatAheadTimeText(slot.minutesAhead)}
                        </span>
                      )}

                      {isNeedRefill && (slot.medicine.totalQuantity || 0) > 0 && (
                        <span className="text-[8px] bg-amber-500 text-white font-black px-1.5 py-0.5 rounded">
                          ⚠️ 재구매 필요
                        </span>
                      )}
                    </div>
                    
                    <p className={`text-[10px] font-medium ${isEarlyChecked ? 'text-emerald-800' : 'text-gray-400'}`}>
                      1회 규격: {slot.medicine.dosageCount || '1정'} · 잔여 재고: {slot.medicine.totalQuantity ?? 0}개
                    </p>
                  </div>
                </div>

                <div className="shrink-0 pl-2">
                  {isEarlyChecked ? (
                    <span className="text-[9px] font-black text-emerald-700 bg-white/80 border border-emerald-200 px-2.5 py-1 rounded-xl">미리 완료</span>
                  ) : slot.isChecked ? (
                    <span className="text-[9px] font-black text-rose-500 bg-white border border-rose-100 px-2.5 py-1 rounded-xl">복용완료</span>
                  ) : isMissed ? (
                    <span className="text-[9px] font-black text-white bg-amber-500 px-2.5 py-1 rounded-xl">확인 요망</span>
                  ) : (
                    <span className="text-[9px] font-black text-white bg-[#E12756] px-2.5 py-1 rounded-xl shadow-xs cursor-pointer">미리 복용</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
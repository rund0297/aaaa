import { useState } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import { motion } from 'motion/react';

interface Medicine {
  id: string;
  name: string;
  category: string;
  remaining: number;
  total: number;
  color: string;
}

interface EditMedicineModalProps {
  medicine: Medicine;
  onSave: (updates: Partial<Medicine>) => void;
  onCancel: () => void;
}

export function EditMedicineModal({ medicine, onSave, onCancel }: EditMedicineModalProps) {
  const [name, setName] = useState(medicine.name);
  const [category, setCategory] = useState(medicine.category);
  const [remaining, setRemaining] = useState(medicine.remaining);
  const [total, setTotal] = useState(medicine.total);
  const [dosageTimes, setDosageTimes] = useState(['아침', '저녁']);
  const [dailyFrequency, setDailyFrequency] = useState('2회');

  const handleSave = () => {
    onSave({
      name,
      category,
      remaining,
      total
    });
  };

  const removeDosageTime = (index: number) => {
    setDosageTimes(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[8px]">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white rounded-t-[48px] p-6 w-full max-w-md shadow-[0_-8px_32px_rgba(0,0,0,0.15)] max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl text-gray-900" style={{ fontWeight: 900 }}>약 정보 수정</h3>
          <button
            onClick={onCancel}
            className="size-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors active:scale-95"
          >
            <X className="size-5 text-gray-600" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Medicine Name */}
          <div>
            <label className="block text-sm text-gray-700 mb-2" style={{ fontWeight: 600 }}>
              약품명
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-5 py-[18px] bg-gray-50 rounded-[20px] border border-gray-200 outline-none focus:ring-2 focus:ring-[#F43F5E]/30 focus:border-[#F43F5E] focus:shadow-[0_0_0_3px_rgba(244,63,94,0.1)] transition-all"
              placeholder="약품명 입력"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm text-gray-700 mb-2" style={{ fontWeight: 600 }}>
              카테고리
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-5 py-[18px] bg-gray-50 rounded-[20px] border border-gray-200 outline-none focus:ring-2 focus:ring-[#F43F5E]/30 focus:border-[#F43F5E] focus:shadow-[0_0_0_3px_rgba(244,63,94,0.1)] transition-all"
              placeholder="예: 진통제, 영양제"
            />
          </div>

          {/* Daily Frequency */}
          <div>
            <label className="block text-sm text-gray-700 mb-2" style={{ fontWeight: 600 }}>
              복용 횟수
            </label>
            <select
              value={dailyFrequency}
              onChange={(e) => setDailyFrequency(e.target.value)}
              className="w-full px-5 py-[18px] bg-gray-50 rounded-[20px] border border-gray-200 outline-none focus:ring-2 focus:ring-[#F43F5E]/30 focus:border-[#F43F5E] focus:shadow-[0_0_0_3px_rgba(244,63,94,0.1)] transition-all"
            >
              <option value="1회">1회</option>
              <option value="2회">2회</option>
              <option value="3회">3회</option>
              <option value="4회">4회</option>
            </select>
          </div>

          {/* Dosage Times */}
          <div>
            <label className="block text-sm text-gray-700 mb-2" style={{ fontWeight: 600 }}>
              복용 시간
            </label>
            <div className="flex flex-wrap gap-2">
              {dosageTimes.map((time, index) => (
                <div
                  key={index}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#F43F5E]/10 text-[#F43F5E] rounded-full"
                  style={{ fontWeight: 600 }}
                >
                  <span>{time}</span>
                  <button
                    onClick={() => removeDosageTime(index)}
                    className="size-4 rounded-full bg-[#F43F5E]/20 hover:bg-[#F43F5E]/30 flex items-center justify-center transition-colors"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Pill Counter */}
          <div>
            <label className="block text-sm text-gray-700 mb-2" style={{ fontWeight: 600 }}>
              남은 수량
            </label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setRemaining(Math.max(0, remaining - 1))}
                className="size-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-200 active:scale-95 transition-all"
              >
                <Minus className="size-5" strokeWidth={2.5} />
              </button>
              <div className="flex-1 text-center">
                <div className="text-4xl text-gray-900" style={{ fontWeight: 900 }}>{remaining}</div>
                <div className="text-sm text-gray-500">/ {total}개</div>
              </div>
              <button
                onClick={() => setRemaining(Math.min(total, remaining + 1))}
                className="size-12 bg-[#F43F5E] rounded-full flex items-center justify-center text-white hover:bg-[#e11d48] active:scale-95 transition-all shadow-lg"
              >
                <Plus className="size-5" strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* Total Pills */}
          <div>
            <label className="block text-sm text-gray-700 mb-2" style={{ fontWeight: 600 }}>
              전체 수량
            </label>
            <input
              type="number"
              value={total}
              onChange={(e) => setTotal(parseInt(e.target.value) || 0)}
              className="w-full px-5 py-[18px] bg-gray-50 rounded-[20px] border border-gray-200 outline-none focus:ring-2 focus:ring-[#F43F5E]/30 focus:border-[#F43F5E] focus:shadow-[0_0_0_3px_rgba(244,63,94,0.1)] transition-all"
              placeholder="전체 수량"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 space-y-3">
          <button
            onClick={handleSave}
            className="w-full bg-gradient-to-r from-[#F43F5E] to-[#e11d48] text-white py-4 rounded-[24px] shadow-[0_4px_20px_rgba(244,63,94,0.3)] hover:shadow-[0_8px_32px_rgba(244,63,94,0.4)] transition-all active:scale-95"
            style={{ fontWeight: 900 }}
          >
            변경사항 저장
          </button>
          <button
            onClick={onCancel}
            className="w-full bg-gray-100 text-gray-700 py-4 rounded-[24px] hover:bg-gray-200 transition-all active:scale-95"
            style={{ fontWeight: 700 }}
          >
            취소
          </button>
        </div>
      </motion.div>
    </div>
  );
}

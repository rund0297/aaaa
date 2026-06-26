import { X } from 'lucide-react';

interface InfoModalProps {
  content: string;
  onClose: () => void;
}

export function InfoModal({ content, onClose }: InfoModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <div className="bg-white/95 backdrop-blur-[20px] rounded-[48px] p-6 max-w-md w-full shadow-[0_8px_32px_rgba(0,0,0,0.15),inset_0_1px_2px_rgba(255,255,255,0.5)] border border-white/10">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-xl text-gray-900" style={{ fontWeight: 900 }}>복용 정보</h3>
          <button
            onClick={onClose}
            className="size-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors active:scale-95"
          >
            <X className="size-5 text-gray-600" />
          </button>
        </div>
        <p className="text-gray-700 leading-relaxed text-sm">{content}</p>
        <button
          onClick={onClose}
          className="w-full mt-6 bg-gradient-to-r from-[#F43F5E] to-[#e11d48] text-white py-3 rounded-[24px] shadow-[0_4px_16px_rgba(244,63,94,0.3)] hover:shadow-[0_6px_24px_rgba(244,63,94,0.4)] transition-all active:scale-95"
          style={{ fontWeight: 700 }}
        >
          확인
        </button>
      </div>
    </div>
  );
}

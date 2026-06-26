import { X } from 'lucide-react';

interface InfoModalProps {
  content: string;
  onClose: () => void;
}

export function InfoModal({ content, onClose }: InfoModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[3px] flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-xs rounded-[28px] p-6 shadow-xl relative animate-in scale-in-95 duration-150">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="size-5" />
        </button>
        <h3 className="text-gray-900 text-base font-black mb-3">약품 복용 가이드</h3>
        <p className="text-gray-600 text-sm leading-relaxed font-medium">{content}</p>
      </div>
    </div>
  );
}
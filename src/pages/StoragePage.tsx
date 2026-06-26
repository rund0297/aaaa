import { useState, useEffect } from 'react';
import { Star, MapPin, Phone, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { backendApi, Pharmacy } from '../services/backendMock';

export function StoragePage() {
  const [savedItems, setSavedItems] = useState<Pharmacy[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadStorageData = async () => {
    setIsLoading(true);
    const data = await backendApi.getStorageItems();
    setSavedItems(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadStorageData();
  }, []);

  const handleRemove = async (pharmacy: Pharmacy) => {
    await backendApi.toggleStorageItem(pharmacy);
    toast.info('보관함에서 삭제되었습니다.');
    loadStorageData(); // 상태 새로고침
  };

  return (
    <div className="w-full min-h-screen bg-gray-50 p-4 pb-24 max-w-md mx-auto">
      <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
        <Star className="size-5 text-amber-400" fill="#FBBF24" /> 내 저장 보관함
      </h2>

      {isLoading ? (
        <div className="text-center py-12 text-sm text-gray-400">보관된 약국 로드 중...</div>
      ) : savedItems.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed text-sm text-gray-400">
          보관함에 저장된 장소가 없습니다.<br />홈 화면에서 별표를 눌러 추가해보세요!
        </div>
      ) : (
        <div className="grid gap-3">
          {savedItems.map((item) => (
            <div key={item.id} className="bg-white p-4 rounded-2xl border flex items-center justify-between shadow-sm">
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md">저장됨</span>
                <h3 className="font-bold text-gray-900 text-base mt-1 truncate">{item.name}</h3>
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 truncate">
                  <MapPin className="size-3 text-gray-400 shrink-0" /> {item.address}
                </p>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                <a href={`tel:${item.phone}`} className="p-2 bg-gray-50 rounded-xl border text-gray-600"><Phone className="size-4" /></a>
                <button onClick={() => handleRemove(item)} className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100"><Trash2 className="size-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
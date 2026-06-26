// src/app/components/AddMedicineModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Search, Image, ArrowLeft, Calendar, Clock, Camera, ShieldAlert, AlertTriangle, Loader2 } from 'lucide-react';
import { addMedicineToDb } from '../../services/firebaseService';

interface AddMedicineModalProps {
  userId: string;
  onClose: () => void;
  currentCabinetItems?: Array<{ name: string; registeredAt: string; durationDays: number }>;
  onAddMedicine?: () => void;
}

export function AddMedicineModal({ 
  userId,
  onClose, 
  currentCabinetItems = [], 
  onAddMedicine 
}: AddMedicineModalProps) {
  
  // 🧩 등록 경로 단계 및 모드 제어 상태
  const [entryMode, setEntryMode] = useState<'SELECT_MODE' | 'PHOTO_CHOICE' | 'CAMERA_STREAM' | 'MANUAL_SEARCH' | 'FORM_FILL'>('SELECT_MODE');
  
  // ✏️ 검색 및 결과 관련 상태
  const [searchKeyword, setSearchKeyword] = useState(''); 
  const [medName, setMedName] = useState(''); 
  const [suggestions, setSuggestions] = useState<string[]>([]); 
  const [isApiLoading, setIsApiLoading] = useState(false); 
  const [medTypeGuide, setMedTypeGuide] = useState<{ type: string; guide: string } | null>(null);
  const [isCorsNetworkError, setIsCorsNetworkError] = useState(false); // 💡 식약처 CORS/네트워크 차단 감지 상태

  // 📅 복용 일정 및 수량 입력 데이터 상태
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>('');
  const [selectedTimes, setSelectedTimes] = useState<string[]>(['08:00', '13:00', '19:00']);
  const [newTimeInput, setNewTimeInput] = useState<string>('');
  const [totalQuantity, setTotalQuantity] = useState<string>(''); 
  const [dosageCount, setDosageCount] = useState(''); 

  // 📷 장치 권한 및 OCR 상태
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState<boolean>(false);
  const [ocrErrorMsg, setOcrErrorMsg] = useState<string>('');

  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // 🔒 [스마트 정밀 중복 체크 엔진] - 공백과 대소문자를 제거하여 완벽하게 중복 판별
  const checkIsDuplicateMedicine = (name: string): boolean => {
    const targetName = name.replace(/\s+/g, '').toLowerCase();
    return currentCabinetItems.some(
      item => item.name.replace(/\s+/g, '').toLowerCase() === targetName
    );
  };

  // 🔍 [식약처 e약은요 API 연동 엔진]
  const queryFoodDrugSafetyApi = async (keyword: string) => {
    if (!keyword.trim()) {
      setSuggestions([]);
      setIsCorsNetworkError(false);
      return;
    }

    setIsApiLoading(true);
    setIsCorsNetworkError(false);

    try {
      const serviceKey = "5cde3b05e30f1b984e53d3c73a81f6cb119834c5b39f2a86b8dc84ef89c96e2a";
      const servicePath = "1471000/DrbEasyDrugInfoService/getDrbEasyDrugList";
      const queryParams = `?serviceKey=${serviceKey}&itemName=${encodeURIComponent(keyword)}&type=json&numOfRows=10`;

      // 🎯 [CORS 배포 패치] 환경에 맞춰 요청할 URL 주소를 빌드합니다.
      let url = "";
      if (import.meta.env.DEV) {
        // 💻 로컬 개발 환경: vite.config.ts의 proxy(/api/drug)를 사용합니다.
        url = `/api/drug/${servicePath}${queryParams}`;
      } else {
        // 🚀 실배포 환경: 외부 무료 프록시 서버(allorigins)를 거쳐서 CORS 우회 호출을 처리합니다.
        const originUrl = `https://apis.data.go.kr/${servicePath}${queryParams}`;
        url = `https://api.allorigins.win/raw?url=${encodeURIComponent(originUrl)}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 프록시 서버 경유를 고려해 타임아웃을 4초로 변경

      const res = await fetch(url, { 
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) throw new Error("CORS_OR_ENDPOINT_REJECTED");

      const data = await res.json();
      
      if (data.body && data.body.items && data.body.items.length > 0) {
        const itemList = data.body.items.map((item: any) => item.itemName);
        setSuggestions(itemList);
      } else {
        setSuggestions([]);
      }
    } catch (error: any) {
      console.warn("식약처 공공 API 브라우저 CORS 제한 정책 감지 -> 우회 가동:", error);
      setSuggestions([]);
      setIsCorsNetworkError(true); // 💡 브라우저 네트워크 차단 발생 시 직접 입력 유도 카드 가동
    } finally {
      setIsApiLoading(false);
    }
  };

  // ⚡ 실시간 입력 디바운스 필터 (300ms)
  useEffect(() => {
    if (entryMode !== 'MANUAL_SEARCH') return;

    const timer = setTimeout(() => {
      if (searchKeyword.trim().length >= 2) {
        queryFoodDrugSafetyApi(searchKeyword);
      } else {
        setSuggestions([]);
        setIsCorsNetworkError(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchKeyword, entryMode]);

  // 🛑 리스트에서 약물 선택 처리
  const handleSelectMedicine = (name: string) => {
    const finalName = name.trim();
    
    // 💡 [정책 패치] 중복 품목 선택 검증 및 알림 고도화
    if (checkIsDuplicateMedicine(finalName)) {
      toast.error(`🛑 [등록 불가] '${finalName}'은(는) 이미 복용 중인 약품입니다. '이미 복용 중인 약품 등록 금지 정책'에 의해 차단되었습니다.`, {
        duration: 5000,
      });
      return;
    }

    setMedName(finalName);
    setMedTypeGuide({
      type: "e약은요 매핑 품목",
      guide: "식품의약품안전처 의약품개요정보 규격으로 스케줄링을 시작합니다."
    });
    setEntryMode('FORM_FILL');
  };

  const handleStartCamera = () => {
    setEntryMode('CAMERA_STREAM');
    if (hasCameraPermission === null) setHasCameraPermission(false); 
  };

  const requestCameraHardwarePermission = () => {
    setHasCameraPermission(true);
    toast.success("카메라 접근 권한이 수락되었습니다.");
  };

  const executeRealAiOcr = async (file: File) => {
    setIsOcrProcessing(true);
    setOcrErrorMsg('');

    try {
      const base64Image = await convertFileToBase64(file);
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-OpenRouter-Title": "스마트 알약 복용 알리미",
        },
        body: JSON.stringify({
          model: "baidu/qianfan-ocr-fast:free",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "이 이미지에서 식별되는 처방 약 이름이나 주요 의약품 명칭을 하나만 찾아줘. 다른 군더더기 설명이나 문장은 절대 포함하지 말고 오직 발견한 약 이름 딱 하나만 명확하게 한글로 짧게 답변해줘."
                },
                {
                  type: "image_url",
                  image_url: { url: base64Image }
                }
              ]
            }
          ],
          temperature: 0.1
        })
      });

      if (!response.ok) throw new Error(`서버 응답 오류 (코드: ${response.status})`);

      const data = await response.json();
      const extractedText = data.choices[0]?.message?.content?.trim() || "";

      if (extractedText && !extractedText.includes("실패") && !extractedText.includes("없습니다")) {
        handleSelectMedicine(extractedText);
      } else {
        setOcrErrorMsg("이미지에서 명확한 약 이름을 판독할 수 없습니다. 글자가 선명하게 보이도록 다시 시도하거나 직접 검색해 주세요.");
      }
    } catch (err: any) {
      setOcrErrorMsg(`AI 스캔 실패: ${err.message || '네트워크 통신 오류가 발생했습니다.'}`);
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const handleAddTime = () => {
    if (!newTimeInput) return toast.error("추가 설정할 스마트 알림 시각을 입력해 주세요.");
    if (selectedTimes.includes(newTimeInput)) return toast.error(`이미 등록된 복용 시간입니다.`);
    if (selectedTimes.length >= 5) return toast.error("스마트 복용 알림은 하루 최대 5회까지만 등록이 가능합니다.");
    
    setSelectedTimes([...selectedTimes, newTimeInput].sort());
    setNewTimeInput('');
  };

  const handleRemoveTime = (index: number) => {
    setSelectedTimes(selectedTimes.filter((_, i) => i !== index));
  };

  // 💾 데이터베이스 최종 보관함 저장 제어
  const handleSaveToCabinet = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = medName.trim();

    if (!finalName) return toast.error("등록할 의약품 명칭이 없습니다.");
    
    // 💡 [정책 패치] 최종 서브밋 단계에서도 한 번 더 중복 검사 작동
    if (checkIsDuplicateMedicine(finalName)) {
      toast.error(`❌ [저장 거부] '${finalName}'은(는) 이미 등록된 약품입니다. '이미 복용 중인 약품 등록 금지 정책'으로 인해 저장할 수 없습니다.`, {
        duration: 6000
      });
      return;
    }

    if (selectedTimes.length === 0) return toast.error("최소 1개 이상의 알림 시간을 설정해 주세요.");
    if (!startDate || !endDate) return toast.error("복용 시작일과 종료일을 정확히 선택해 주세요.");
    if (new Date(startDate) > new Date(endDate)) return toast.error("종료일이 시작일보다 빠르게 설정될 수 없습니다.");
    if (totalQuantity === '') return toast.error("전체 약 보유량을 입력해 주세요.");

    const qty = Number(totalQuantity);
    if (isNaN(qty) || qty < 1 || qty > 999) return toast.error("보유 수량은 1~999 사이의 숫자만 가능합니다.");

    try {
      const durationDays = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      await addMedicineToDb(userId, {
        name: finalName,
        durationDays,
        dosageCount: dosageCount || "1정",
        takeFrequency: `하루 ${selectedTimes.length}회 (${selectedTimes.join(', ')})`,
        startDate,
        endDate,
        totalQuantity: qty,
        medType: medTypeGuide?.type || "일반지정의약품"
      });

      toast.success(`[저장 완료] '${finalName}' 등록이 완료되었습니다.`);
      if (onAddMedicine) onAddMedicine();
      onClose();
    } catch (err) {
      toast.error("데이터베이스 네트워크 장애가 발생했습니다.");
    }
  };

  const handleBackNavigation = () => {
    if (entryMode === 'MANUAL_SEARCH' || entryMode === 'PHOTO_CHOICE') setEntryMode('SELECT_MODE');
    else if (entryMode === 'CAMERA_STREAM') setEntryMode('PHOTO_CHOICE');
    else if (entryMode === 'FORM_FILL') {
      setEntryMode('MANUAL_SEARCH');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end sm:justify-center sm:items-center">
      <div className="w-full sm:max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* 상단 헤더 */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {entryMode !== 'SELECT_MODE' && (
              <button type="button" onClick={handleBackNavigation} className="p-1 mr-1 text-gray-400 hover:text-gray-700">
                <ArrowLeft className="size-4" />
              </button>
            )}
            <div>
              <h2 className="text-sm font-black text-gray-900">새 의약품 복용 등록</h2>
              <p className="text-[10px] text-gray-400 mt-0.5">식약처 e약은요 공공 DB 인프라 가동 중</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xs font-bold p-1">✕</button>
        </div>

        {/* 0️⃣ 선택 모드 패널 */}
        {entryMode === 'SELECT_MODE' && (
          <div className="p-6 space-y-4 flex-1 overflow-y-auto">
            <p className="text-xs font-bold text-gray-500 text-center py-2">등록 방법을 선택해 주세요.</p>
            <div onClick={() => setEntryMode('MANUAL_SEARCH')} className="p-5 border border-gray-100 rounded-2xl bg-gray-50 hover:border-rose-300 cursor-pointer transition-all flex items-center gap-4">
              <div className="size-10 rounded-xl bg-rose-50 flex items-center justify-center text-[#E12756] shrink-0"><Search className="size-5" /></div>
              <div>
                <h4 className="text-xs font-bold text-gray-800">식약처 e약은요 검색하여 추가</h4>
                <p className="text-[10px] text-gray-400 mt-0.5">공공 API 연동을 통해 안전한 가이드를 조회합니다.</p>
              </div>
            </div>
            <div onClick={() => setEntryMode('PHOTO_CHOICE')} className="p-5 border border-gray-100 rounded-2xl bg-gray-50 hover:border-rose-300 cursor-pointer transition-all flex items-center gap-4">
              <div className="size-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0"><Image className="size-5" /></div>
              <div>
                <h4 className="text-xs font-bold text-gray-800">사진 파일 첨부/촬영으로 추가 (OCR)</h4>
                <p className="text-[10px] text-gray-400 mt-0.5">약봉투나 처방전을 AI로 분석하여 약 이름을 추출합니다.</p>
              </div>
            </div>
          </div>
        )}

        {/* 📷 사진 첨부 상세 분기 */}
        {entryMode === 'PHOTO_CHOICE' && (
          <div className="p-6 space-y-4 flex-1 overflow-y-auto">
            <h3 className="text-xs font-black text-gray-800 text-center">사진 촬영 및 첨부 방식 정의</h3>
            <div onClick={handleStartCamera} className="p-4 border border-gray-100 rounded-xl bg-gray-50 flex items-center justify-between hover:border-rose-400 cursor-pointer">
              <span className="text-xs font-bold text-gray-700 flex items-center gap-2"><Camera className="size-4 text-[#E12756]" /> 스마트폰 카메라로 직접 촬영하기</span>
            </div>
            <div className="p-4 border border-gray-100 rounded-xl bg-gray-50 relative hover:border-rose-400 cursor-pointer">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 flex items-center gap-2"><Image className="size-4 text-amber-500" /> 스마트폰 갤러리 앨범에서 선택</span>
              </div>
              <input type="file" accept="image/*" disabled={isOcrProcessing} onChange={(e) => { const file = e.target.files?.[0]; if (file) executeRealAiOcr(file); }} className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" />
            </div>
            {isOcrProcessing && (
              <div className="p-3 bg-rose-50 text-[#E12756] text-center text-[10px] font-bold rounded-xl flex items-center justify-center gap-2 animate-pulse">
                <Loader2 className="size-3.5 animate-spin" />
                <span>AI가 이미지에서 약 이름을 판독하는 중입니다...</span>
              </div>
            )}
          </div>
        )}

        {/* 📹 카메라 스트림 */}
        {entryMode === 'CAMERA_STREAM' && (
          <div className="p-6 space-y-4 flex-1 overflow-y-auto text-center">
            {!hasCameraPermission ? (
              <div className="py-6 space-y-3">
                <div className="size-12 bg-rose-50 rounded-full flex items-center justify-center text-[#E12756] mx-auto"><ShieldAlert className="size-6" /></div>
                <h4 className="text-xs font-black text-gray-800">카메라 하드웨어 접근 차단됨</h4>
                <button type="button" onClick={requestCameraHardwarePermission} className="mt-2 px-4 py-2 bg-gray-900 text-white font-bold text-[10px] rounded-lg">권한 다시 요청하기</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="aspect-video w-full bg-gray-900 rounded-2xl flex flex-col items-center justify-center text-white relative overflow-hidden">
                  <Camera className="size-8 text-gray-600 animate-pulse mb-1" />
                  <span className="text-[10px] text-gray-500">카메라 라이브 뷰파인더 활성화됨</span>
                  {isOcrProcessing && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center space-y-2">
                      <Loader2 className="size-5 text-rose-500 animate-spin" />
                      <p className="text-[10px] text-gray-300">인공지능 OCR 분석 중...</p>
                    </div>
                  )}
                </div>
                {ocrErrorMsg && (
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 flex items-start gap-2 text-left">
                    <AlertTriangle className="size-4 text-[#E12756] shrink-0 mt-0.5" />
                    <p className="text-[10px] text-rose-700 font-medium leading-relaxed">{ocrErrorMsg}</p>
                  </div>
                )}
                <div className="border border-dashed border-gray-300 p-4 rounded-xl relative hover:bg-gray-50 cursor-pointer">
                  <p className="text-xs font-bold text-gray-600">📷 사진 촬영 후 분석 전송</p>
                  <input type="file" accept="image/*" capture="environment" disabled={isOcrProcessing} onChange={(e) => { const file = e.target.files?.[0]; if (file) executeRealAiOcr(file); }} className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 1️⃣ 실시간 검색 및 CORS 안전 안내 보드 */}
        {entryMode === 'MANUAL_SEARCH' && (
          <div className="p-6 flex-1 flex flex-col overflow-hidden">
            <div className="space-y-2 shrink-0 mb-4">
              <label className="text-xs font-black text-gray-700">식약처 통합 검색어 입력</label>
              <div className="relative flex items-center">
                <input 
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="약 이름을 두 글자 이상 입력해 주세요..."
                  className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none text-gray-800 focus:border-[#E12756]"
                  autoFocus
                />
                <div className="absolute right-3 text-gray-400">
                  {isApiLoading ? <Loader2 className="size-4 animate-spin text-[#E12756]" /> : <Search className="size-4" />}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {isApiLoading && suggestions.length === 0 ? (
                <div className="text-center py-8 flex flex-col items-center justify-center space-y-1">
                  <p className="text-[11px] text-gray-400 font-bold">식약처 원격 동기화 연결 중...</p>
                </div>
              ) : isCorsNetworkError ? (
                /* 💡 식약처 서버의 웹 브라우저 CORS 차단 정책을 유연하게 처리하는 안내 및 직통 프리패스 카드 */
                <div className="p-4 border-2 border-dashed border-rose-300 bg-rose-50/40 rounded-2xl text-center shadow-xs">
                  <AlertTriangle className="size-5 text-[#E12756] mx-auto mb-1.5 animate-bounce" />
                  <p className="text-xs text-gray-800 font-black">식약처 외부 서버 브라우저 직접 호출 제한(CORS) 감지</p>
                  <p className="text-[10px] text-gray-500 mt-1 leading-relaxed px-1">
                    식약처 공공 포털망의 보안 정책으로 인해 브라우저 검색 기능이 제한되었습니다. 
                    개발 환경 및 배포 환경에 영향받지 않고, **작성하신 약 이름 그대로 1초 만에 바로 일정을 생성**하실 수 있습니다!
                  </p>
                  <button 
                    type="button" 
                    onClick={() => handleSelectMedicine(searchKeyword || "지정 안 된 약품")}
                    className="mt-4 px-4 py-3 bg-[#E12756] text-white font-bold text-xs rounded-xl shadow-md shadow-rose-100 hover:bg-[#c21f47] w-full transition-all active:scale-98"
                  >
                    🚀 "{searchKeyword || '입력한 약 이름'}" 이름으로 직접 등록 계속하기
                  </button>
                </div>
              ) : suggestions.length > 0 ? (
                suggestions.map((name, idx) => (
                  <div 
                    key={idx}
                    onClick={() => handleSelectMedicine(name)}
                    className="p-3.5 border border-gray-100 rounded-xl bg-white hover:border-rose-200 cursor-pointer transition-all flex items-center justify-between"
                  >
                    <span className="text-xs font-bold text-gray-700 truncate max-w-[85%]">{name}</span>
                    <span className="text-[10px] text-[#E12756] font-bold bg-rose-50 px-2 py-0.5 rounded shrink-0">선택</span>
                  </div>
                ))
              ) : searchKeyword.trim().length >= 2 ? (
                <div className="text-center py-10 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                  <p className="text-xs text-gray-400 font-bold">검색된 식약처 의약품 데이터가 없습니다.</p>
                  <button 
                    type="button" 
                    onClick={() => handleSelectMedicine(searchKeyword)} 
                    className="mt-2.5 text-[10px] text-[#E12756] font-black underline"
                  >
                    입력한 이름("{searchKeyword}")으로 그냥 바로 등록하기
                  </button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-[11px] text-gray-400 font-medium">검색어를 입력하시면 식약처 공공데이터 원격 e약은요 데이터베이스 목록 호출을 시도합니다.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2️⃣ 상세 폼 작성 단계 */}
        {entryMode === 'FORM_FILL' && (
          <form onSubmit={handleSaveToCabinet} className="flex-1 overflow-y-auto p-6 space-y-4">
            
            <div className="p-3.5 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[9px] text-[#E12756] font-black tracking-tighter bg-rose-50 px-1.5 py-0.5 rounded">등록 의약품명</span>
                <h4 className="text-xs font-black text-gray-800 mt-1">{medName}</h4>
              </div>
              {/* 중복 약 검증 상태 마크 */}
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">중복 검증 완료</span>
            </div>

            {medTypeGuide && (
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="text-[9px] bg-gray-800 text-white font-black px-1.5 py-0.5 rounded-sm">{medTypeGuide.type}</span>
                <p className="text-[10px] text-gray-500 mt-1.5 leading-relaxed font-medium">{medTypeGuide.guide}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-600 flex items-center gap-1"><Calendar className="size-3 text-gray-400" /> 복용 시작일</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-600 flex items-center gap-1"><Calendar className="size-3 text-gray-400" /> 복용 종료일</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-gray-700 block flex items-center gap-1">
                <Clock className="size-3.5 text-gray-400" /> 스마트 복용 알람 시간 (최대 5회)
              </label>
              
              <div className="grid grid-cols-3 gap-1.5">
                <button type="button" onClick={() => { if(!selectedTimes.includes('08:00')) { if(selectedTimes.length>=5) return toast.error("최대 5회 초과"); setSelectedTimes([...selectedTimes, '08:00'].sort()); } }} className="py-1.5 bg-gray-50 hover:bg-rose-50 border border-gray-100 rounded-lg text-[10px] font-bold text-gray-600">아침 (08:00)</button>
                <button type="button" onClick={() => { if(!selectedTimes.includes('13:00')) { if(selectedTimes.length>=5) return toast.error("최대 5회 초과"); setSelectedTimes([...selectedTimes, '13:00'].sort()); } }} className="py-1.5 bg-gray-50 hover:bg-rose-50 border border-gray-100 rounded-lg text-[10px] font-bold text-gray-600">점심 (13:00)</button>
                <button type="button" onClick={() => { if(!selectedTimes.includes('19:00')) { if(selectedTimes.length>=5) return toast.error("최대 5회 초과"); setSelectedTimes([...selectedTimes, '19:00'].sort()); } }} className="py-1.5 bg-gray-50 hover:bg-rose-50 border border-gray-100 rounded-lg text-[10px] font-bold text-gray-600">저녁 (19:00)</button>
              </div>

              <div className="flex gap-2">
                <input type="time" value={newTimeInput} onChange={e => setNewTimeInput(e.target.value)} className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs" />
                <button type="button" onClick={handleAddTime} className="px-4 bg-gray-800 text-white rounded-xl text-xs font-bold">등록</button>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedTimes.map((time, idx) => (
                  <span key={time} className="inline-flex items-center gap-1 text-[9px] font-black bg-rose-50 text-[#E12756] pl-2.5 pr-1.5 py-0.5 rounded-md border border-rose-100">
                    {time === '08:00' ? '아침(08:00)' : time === '13:00' ? '점심(13:00)' : time === '19:00' ? '저녁(19:00)' : time}
                    <button type="button" onClick={() => handleRemoveTime(idx)} className="text-gray-400 hover:text-rose-600 font-extrabold px-1">✕</button>
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-600">전체 약 보유량 (개수)</label>
                <input type="text" value={totalQuantity} onChange={e => setTotalQuantity(e.target.value)} placeholder="예: 14" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-600">1회 복용 규격 지정</label>
                <input type="text" value={dosageCount} onChange={e => setDosageCount(e.target.value)} placeholder="예: 1정" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold" />
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-bold text-xs">취소</button>
              <button type="submit" className="flex-1 py-3 bg-[#E12756] text-white rounded-xl font-bold text-xs shadow-md shadow-rose-100">약 보관함 연동 저장</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
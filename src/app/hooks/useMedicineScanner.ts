// src/app/hooks/useMedicineScanner.ts
import { useState } from 'react';
import { toast } from 'sonner';

// 1. image_79fa1a.png 기준 우측 결과 상태 타입 정의
export type ScanStatusState =
  | '선명한 약 봉투' | '처방전 이미지' | '초점 불량' | '반사 심함' | '조도 낮음' | '촬영 취소' | '권한 거부'
  | '정상 약 이름' | '유사 약 이름' | '잘못된 약 이름'
  | '정상 응답' | '응답 없음' | '응답 지연' | '시간 초과'
  | '일반약' | '전문약' | 'API 데이터 누락'
  | '일반약 판별 완료' | '전문약 판별 완료' | '전체 플로우';

export function useMedicineScanner() {
  const [scanStatus, setScanStatus] = useState<ScanStatusState | null>(null);
  const [detectedMedicine, setDetectedMedicine] = useState<string>('');

  /**
   * 📸 [1단계] 카메라 및 OCR 진입 조건 핸들러
   */
  const handleOcrStage = (trigger: 'SUCCESS' | 'PRESCRIPTION' | 'BLUR' | 'REFLECT' | 'DARK' | 'CANCEL' | 'DENIED') => {
    switch (trigger) {
      case 'SUCCESS':
        setScanStatus('선명한 약 봉투');
        toast.success("이미지가 선명하게 인식되었습니다.");
        break;
      case 'PRESCRIPTION':
        setScanStatus('처방전 이미지');
        toast.info("처방전 양식을 감지했습니다.");
        break;
      case 'BLUR':
        setScanStatus('초점 불량');
        toast.error("이미지가 흐립니다. 다시 촬영해 주세요.");
        break;
      case 'REFLECT':
        setScanStatus('반사 심함');
        toast.error("빛 반사가 심해 글자를 읽을 수 없습니다.");
        break;
      case 'DARK':
        setScanStatus('조도 낮음');
        toast.warning("주변 환경이 너무 어둡습니다. 밝은 곳에서 촬영해 주세요.");
        break;
      case 'CANCEL':
        setScanStatus('촬영 취소');
        toast.dismiss();
        break;
      case 'DENIED':
        setScanStatus('권한 거부');
        toast.error("카메라 권한이 거부되어 촬영을 시작할 수 없습니다.");
        break;
    }
  };

  /**
   * 텍스트 매칭 및 식약처 API 가드 통합 엔진
   */
  const processMedicineDiscovery = async (ocrText: string) => {
    if (!ocrText.trim()) {
      handleOcrStage('CANCEL');
      return;
    }

    // API 타임아웃 인터셉터 설정 레이어
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 7000); // 7초 타임아웃 가드

    try {
      // 가상 지연 테스트 및 상태 트래킹 트리거 (3초 이상 걸릴 시)
      const delayCheck = setTimeout(() => {
        setScanStatus('응답 지연');
        toast.loading("식약처 서버 응답이 지연되고 있습니다...", { id: 'api-status' });
      }, 3000);

      // 📡 [2단계] 식약처 API 통신망 가동
      const response = await fetch(`/api/kfda/drug?name=${encodeURIComponent(ocrText)}`, {
        signal: controller.signal
      });
      
      clearTimeout(delayCheck);
      clearTimeout(timeoutId);
      toast.dismiss('api-status');

      if (!response.ok) {
        setScanStatus('응답 없음');
        toast.error("식약처 API 서버 내부 장애가 발생했습니다.");
        return;
      }

      const data = await response.json();
      setScanStatus('정상 응답');

      // 🔍 [3단계] 이름 매칭 조건 검사 플로우
      if (!data.items || data.items.length === 0) {
        setScanStatus('잘못된 약 이름');
        toast.error("존재하지 않는 약 이름입니다. 수동 입력을 진행해 주세요.");
        return;
      }

      const matchedDrug = data.items[0];
      setDetectedMedicine(matchedDrug.itemName);

      if (matchedDrug.itemName === ocrText) {
        setScanStatus('정상 약 이름');
      } else {
        setScanStatus('유사 약 이름');
        toast.info(`오타가 교정되었습니다: ${matchedDrug.itemName}`);
      }

      // 💊 [4단계] 일반약 / 전문약 등급 판별 매핑 플로우
      if (!matchedDrug.etcOtcName) {
        setScanStatus('API 데이터 누락');
        toast.warning("의약품 분류 정보가 식약처 데이터에 누락되어 있습니다.");
        return;
      }

      const isOtc = matchedDrug.etcOtcName.includes('일반');
      const isEtc = matchedDrug.etcOtcName.includes('전문');

      if (isOtc) {
        setScanStatus('일반약');
        // 최종 플로우 가이드 진입
        finalizeScanFlow('OTC');
      } else if (isEtc) {
        setScanStatus('전문약');
        // 최종 플로우 가이드 진입
        finalizeScanFlow('ETC');
      }

    } catch (error: any) {
      clearTimeout(timeoutId);
      toast.dismiss('api-status');
      
      if (error.name === 'AbortError') {
        setScanStatus('시간 초과');
        toast.error("식약처 연결 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.");
      } else {
        setScanStatus('응답 없음');
        toast.error("네트워크 장애로 시스템이 원활하지 않습니다.");
      }
    }
  };

  /**
   * 🏁 [5단계] 구매 가이드 연동 및 전체 플로우 클로저
   */
  const finalizeScanFlow = (type: 'OTC' | 'ETC') => {
    if (type === 'OTC') {
      setScanStatus('일반약 판별 완료');
      // 여기에 일반약 가이드 페이지 전환 혹은 상태창 팝업 로직 배치
    } else {
      setScanStatus('전문약 판별 완료');
      // 여기에 전문약 처방전 가이드 로직 배치
    }

    // 최종 파이프라인 동기화 마감
    setTimeout(() => {
      setScanStatus('전체 플로우');
      toast.success("의약품 등록 분석 플로우가 성공적으로 완료되었습니다.");
    }, 500);
  };

  return {
    scanStatus,
    detectedMedicine,
    handleOcrStage,
    processMedicineDiscovery
  };
}
// src/app/components/PharmacyMapPage.tsx
import { useState, useEffect, useRef } from 'react';
import { Phone, Navigation, Search, Compass, MapPin, PhoneCall, ShieldAlert, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export function PharmacyMapPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  
  // 📍 서버에서 불러온 전체 장소 원본 보관 스테이트 및 액티브 탭 상태 스테이트
  const [allPlaces, setAllPlaces] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'pharmacy' | 'convenience'>('all');

  const [isGpsTracking, setIsGpsTracking] = useState<boolean>(false);
  const [isBrowserDenied, setIsBrowserDenied] = useState<boolean>(false);
  // 📍 지도를 움직였을 때 주변에 약국/상점이 없는 상태를 저장하는 스테이트
  const [isNoResultsNearby, setIsNoResultsNearby] = useState<boolean>(false);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const kakaoMapInstance = useRef<any>(null);
  
  const myLocationMarkerRef = useRef<any>(null); 
  const pharmacyMarkersRef = useRef<any[]>([]); 
  const currentOverlayRef = useRef<any>(null); 

  const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null);

  const DEFAULT_LAT = 37.498095;
  const DEFAULT_LNG = 127.027610;
  
  // 🎯 엄격하게 제한할 탐색 반경 거리 (1000 = 1km)
  const MAX_RADIUS_METER = 1000;

  // 🛠️ [백화 방어 가드] 카카오 객체가 메모리에 안착했는지 0.1초 단위로 안전 체크 후 진입
  useEffect(() => {
    const deferLoad = () => {
      if (window.kakao && window.kakao.maps) {
        // v3 스크립트가 안전하게 로드 완료될 때까지 보장하는 공식 메서드 바인딩
        window.kakao.maps.load(() => {
          initBaseMap();
        });
      } else {
        setTimeout(deferLoad, 100);
      }
    };
    deferLoad();
  }, []);

  // 🌟 원본 장소 데이터(allPlaces)나 선택한 탭(activeTab)이 변경될 때 마커와 리스트를 동기화하는 핵심 이펙트 가드
  useEffect(() => {
    if (!kakaoMapInstance.current || !window.kakao || !window.kakao.maps) return;

    // 1. 기존에 지도에 렌더링된 마커 및 오버레이 흔적 청소
    pharmacyMarkersRef.current.forEach(marker => marker.setMap(null));
    pharmacyMarkersRef.current = [];
    if (currentOverlayRef.current) currentOverlayRef.current.setMap(null);

    // 2. 현재 활성화된 탭 기준으로 데이터 필터링 가동 후 🌟최대 20개로만 엄격히 고정(slice)🌟
    const filtered = allPlaces
      .filter(place => {
        if (activeTab === 'all') return true;
        return place.type === activeTab;
      })
      .slice(0, 20); // 👈 여기서 리스트와 지도 마커 개수를 최대 20개로 고정합니다.

    setPharmacies(filtered);

    // 3. 필터링된 20개의 결과물만 지도 위에 마커로 드로잉
    filtered.forEach(item => {
      const marker = new window.kakao.maps.Marker({
        position: new window.kakao.maps.LatLng(item.lat, item.lng),
        title: item.name,
        map: kakaoMapInstance.current
      });

      window.kakao.maps.event.addListener(marker, 'click', () => {
        openCustomOverlay(marker, item);
      });

      pharmacyMarkersRef.current.push(marker);
    });
  }, [allPlaces, activeTab]);

  const initBaseMap = () => {
    if (!mapRef.current || !window.kakao || !window.kakao.maps) return;

    const options = {
      center: new window.kakao.maps.LatLng(DEFAULT_LAT, DEFAULT_LNG),
      level: 3
    };

    // 지도를 안전하게 인스턴스화
    const map = new window.kakao.maps.Map(mapRef.current, options);
    kakaoMapInstance.current = map;

    // 📍 [핵심 기능] 사용자가 지도를 드래그하여 이동을 끝냈을 때 실시간 재검색 이벤트 등록
    window.kakao.maps.event.addListener(map, 'dragend', () => {
      handleMapRegionChange();
    });

    // 📍 [핵심 기능] 지도를 확대하거나 축소했을 때도 새로운 중심점 기준 재검색 이벤트 등록
    window.kakao.maps.event.addListener(map, 'zoom_changed', () => {
      handleMapRegionChange();
    });

    // ✨ [추가 피처] 지도 클릭 시 사용자가 원하는 위치로 '내 위치(기준점)'를 강제 변경하는 클릭 이벤트 바인딩
    window.kakao.maps.event.addListener(map, 'click', (mouseEvent: any) => {
      const latLng = mouseEvent.getLatLng();
      const clickedLat = latLng.getLat();
      const clickedLng = latLng.getLng();
      
      // 수동 위치 지정을 위해 실시간 자동 GPS 트래킹 배너는 OFF 상태로 자연스럽게 전환
      setIsGpsTracking(false);
      applyTargetCoords(clickedLat, clickedLng, "📍 선택하신 지점으로 내 위치(기준점)가 재설정되었습니다.");
    });

    // 최초 로드 시 기본 위치 설정
    loadDefaultLocation(true);

    // 🚀 [백화 방지] 지도 레이아웃이 브라우저에 안착한 뒤 위치를 찍도록 0.3초 미세 딜레이 가드 추가
    setTimeout(() => {
      startGpsTracking();
    }, 300);
  };

  // 📍 지도의 앵글이나 위치가 바뀔 때 현재 지도의 정중앙 좌표를 추출하여 검색을 트리거하는 래퍼 함수
  const handleMapRegionChange = () => {
    if (!kakaoMapInstance.current) return;
    
    // 현재 화면 중앙의 위도(Lat), 경도(Lng)를 실시간 추출
    const centerLatLng = kakaoMapInstance.current.getCenter();
    const lat = centerLatLng.getLat();
    const lng = centerLatLng.getLng();
    
    // 추출한 새 위치 좌표 주변 검색 수행
    searchPharmaciesByCoords(lat, lng);
  };

  const handleGpsToggle = () => {
    if (isGpsTracking) {
      setIsGpsTracking(false);
      loadDefaultLocation(false);
      toast.info("실시간 위치 추적을 켰습니다. 기본 위치로 복원합니다.");
    } else {
      startGpsTracking();
    }
  };

  // 📡 브라우저 GPS 탐색 결합부
  const startGpsTracking = () => {
    if (!navigator.geolocation) {
      toast.error("이 브라우저는 GPS 기능을 지원하지 않아 IP 추적으로 우회합니다.");
      fetchLocationByIP();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsBrowserDenied(false);
        setIsGpsTracking(true);

        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        applyTargetCoords(lat, lng, "🎯 기기 GPS 기반 내 위치가 동기화되었습니다.");
      },
      (error) => {
        console.warn("GPS 호출 실패로 IP Geolocation 백업 로직을 가동합니다.");
        fetchLocationByIP();
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
    );
  };

  // 🌐 사용자의 인터넷 망 IP 주소를 정밀 추적하여 좌표를 세팅하는 백업 허브
  const fetchLocationByIP = async () => {
    try {
      const response = await fetch("https://ipapi.co/json/");
      const data = await response.json();

      if (data && data.latitude && data.longitude) {
        setIsBrowserDenied(false);
        setIsGpsTracking(true);

        const lat = data.latitude;
        const lng = data.longitude;
        const cityName = data.city ? ` (${data.city})` : "";

        applyTargetCoords(lat, lng, `🌐 현재 접속 IP 주소 기반 위치${cityName}가 반영되었습니다.`);
      } else {
        throw new Error("위치 값 누락");
      }
    } catch (err) {
      setIsGpsTracking(false);
      setIsBrowserDenied(true);
      toast.error("위치 권한 차단 및 IP 식별 실패로 강남역 기본 좌표로 대체됩니다.");
      loadDefaultLocation(true);
    }
  };

  // 📍 GPS / IP / 지도 클릭 좌표를 가공하여 지도에 내 마커를 찍어주는 통합 유틸리티
  const applyTargetCoords = (lat: number, lng: number, successMessage: string) => {
    if (!kakaoMapInstance.current || !window.kakao || !window.kakao.maps) return;

    const moveLatLng = new window.kakao.maps.LatLng(lat, lng);
    setMyCoords({ lat, lng });

    // 중심점을 부드럽게 스크롤링
    kakaoMapInstance.current.panTo(moveLatLng);

    // 기존 내 위치 마커 청소
    if (myLocationMarkerRef.current) myLocationMarkerRef.current.setMap(null);

    // ✨ 약국 핀과 명확히 구분되도록 '카카오 공식 별 모양 마커'로 고유 처리
    const markerImageSrc = "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png"; 
    const imageSize = new window.kakao.maps.Size(24, 35); 
    const markerImage = new window.kakao.maps.MarkerImage(markerImageSrc, imageSize);

    myLocationMarkerRef.current = new window.kakao.maps.Marker({
      position: moveLatLng,
      title: "내 현재 위치",
      image: markerImage,
      map: kakaoMapInstance.current
    });

    searchPharmaciesByCoords(lat, lng);
    toast.success(successMessage);
  };

  const loadDefaultLocation = (isSilent = false) => {
    setMyCoords(null);
    if (myLocationMarkerRef.current) {
      myLocationMarkerRef.current.setMap(null);
      myLocationMarkerRef.current = null;
    }
    
    if (!kakaoMapInstance.current || !window.kakao || !window.kakao.maps) return;

    const defaultLatLng = new window.kakao.maps.LatLng(DEFAULT_LAT, DEFAULT_LNG);
    kakaoMapInstance.current.panTo(defaultLatLng);
    searchPharmaciesByCoords(DEFAULT_LAT, DEFAULT_LNG);

    if (!isSilent && currentOverlayRef.current) {
      currentOverlayRef.current.setMap(null);
    }
  };

  // 🌟 약국(PM9)과 편의점(CS2) 카테고리를 멀티 페이지 호출 방식으로 병합
  const searchPharmaciesByCoords = (lat: number, lng: number) => {
    if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) return;
    const ps = new window.kakao.maps.services.Places();
    
    if (currentOverlayRef.current) currentOverlayRef.current.setMap(null);

    let combinedList: any[] = [];
    let completedQueries = 0;
    const expectedQueries = 4; // 약국 2개 페이지 + 편의점 2개 페이지

    const handleCallback = (data: any, status: any, type: 'pharmacy' | 'convenience') => {
      completedQueries++;
      if (status === window.kakao.maps.services.Status.OK && data) {
        const formatted = data
          .map((place: any) => ({
            id: place.id,
            name: place.place_name,
            distance: place.distance ? `${place.distance}m` : '위치 파악중',
            rawDistance: place.distance ? parseInt(place.distance, 10) : 99999,
            address: place.road_address_name || place.address_name,
            phone: place.phone || "전화번호 미등록",
            lat: parseFloat(place.y),
            lng: parseFloat(place.x),
            type: type
          }))
          .filter((place: any) => place.rawDistance <= MAX_RADIUS_METER);

        combinedList = [...combinedList, ...formatted];
      }

      if (completedQueries === expectedQueries) {
        // ID 중복 유니크 가드 제거
        const uniqueMap = new Map();
        combinedList.forEach(item => uniqueMap.set(item.id, item));
        const finalArray = Array.from(uniqueMap.values());

        finalArray.sort((a, b) => a.rawDistance - b.rawDistance);
        setAllPlaces(finalArray);
        setIsNoResultsNearby(finalArray.length === 0);
      }
    };

    const searchOptions1 = {
      location: new window.kakao.maps.LatLng(lat, lng),
      radius: MAX_RADIUS_METER,
      size: 15,
      sort: window.kakao.maps.services.SortBy.DISTANCE,
      page: 1
    };
    const searchOptions2 = { ...searchOptions1, page: 2 };

    // 약국 호출
    ps.categorySearch('PM9', (data, status) => handleCallback(data, status, 'pharmacy'), searchOptions1);
    ps.categorySearch('PM9', (data, status) => handleCallback(data, status, 'pharmacy'), searchOptions2);

    // 편의점 호출
    ps.categorySearch('CS2', (data, status) => handleCallback(data, status, 'convenience'), searchOptions1);
    ps.categorySearch('CS2', (data, status) => handleCallback(data, status, 'convenience'), searchOptions2);
  };

  // 텍스트 키워드 검색 시 처리 핸들러
  const handleLocationSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return toast.error("검색어를 입력해 주세요.");

    if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) return;
    const ps = new window.kakao.maps.services.Places();

    ps.keywordSearch(searchQuery, (data: any, status: any) => {
      if (status === window.kakao.maps.services.Status.OK) {
        setIsNoResultsNearby(false);
        const firstResult = data[0];
        const lat = parseFloat(firstResult.y);
        const lng = parseFloat(firstResult.x);
        kakaoMapInstance.current.setCenter(new window.kakao.maps.LatLng(lat, lng));

        const formatted = data.map((place: any) => {
          const isConvenience = place.category_group_code === 'CS2' || place.place_name.includes('편의점');
          return {
            id: place.id,
            name: place.place_name,
            distance: place.distance ? `${place.distance}m` : '위치 파악중',
            rawDistance: place.distance ? parseInt(place.distance, 10) : 0,
            address: place.road_address_name || place.address_name,
            phone: place.phone || "전화번호 미등록",
            lat: parseFloat(place.y),
            lng: parseFloat(place.x),
            type: isConvenience ? 'convenience' : 'pharmacy'
          };
        });

        setAllPlaces(formatted);
      } else if (status === window.kakao.maps.services.Status.ZERO_RESULT) {
        setIsNoResultsNearby(true);
        setAllPlaces([]);
        toast.error("검색 결과가 존재하지 않습니다.");
      }
    });
  };

  const openCustomOverlay = (marker: any, pharmacy: any) => {
    if (!window.kakao || !window.kakao.maps) return;
    if (currentOverlayRef.current) currentOverlayRef.current.setMap(null);

    const content = document.createElement('div');
    content.className = "bg-white p-3.5 rounded-2xl shadow-xl border border-gray-100 flex flex-col gap-1.5 relative min-w-[200px] -translate-y-2";
    
    const typeLabel = pharmacy.type === 'pharmacy' 
      ? `<span style="background-color:#FFF1F2; color:#E12756; font-size:9px; font-weight:bold; padding:2px 5px; border-radius:4px; margin-left:4px;">약국</span>`
      : `<span style="background-color:#ECFDF5; color:#059669; font-size:9px; font-weight:bold; padding:2px 5px; border-radius:4px; margin-left:4px;">편의점</span>`;

    content.innerHTML = `
      <div class="pr-5">
        <h5 class="text-xs font-black text-gray-800 flex items-center">${pharmacy.name}${typeLabel}</h5>
        <p class="text-[10px] text-gray-400 mt-0.5" style="white-space: normal; word-break: break-all;">${pharmacy.address}</p>
        <p class="text-[10px] text-emerald-600 font-bold mt-0.5">📞 ${pharmacy.phone}</p>
      </div>
      <div class="flex gap-1 mt-1">
        <button id="overlay-nav-btn" class="flex-1 bg-[#E12756] text-white text-[10px] font-bold py-1.5 rounded-lg text-center transition-all active:scale-95">
          📍 공식 길찾기
        </button>
      </div>
      <button id="overlay-close-btn" class="absolute top-2 right-2 text-gray-400 hover:text-gray-600">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    `;

    const overlay = new window.kakao.maps.CustomOverlay({
      content: content,
      position: marker.getPosition(),
      xAnchor: 0.5,
      yAnchor: 1.1
    });

    overlay.setMap(kakaoMapInstance.current);
    currentOverlayRef.current = overlay;

    setTimeout(() => {
      const closeBtn = document.getElementById('overlay-close-btn');
      if (closeBtn) closeBtn.onclick = () => overlay.setMap(null);

      const navBtn = document.getElementById('overlay-nav-btn');
      if (navBtn) navBtn.onclick = () => navigateToKakaoMap(pharmacy);
    }, 50);
  };

  const navigateToKakaoMap = (pharmacy: any) => {
    const sLat = myCoords ? myCoords.lat : '';
    const sLng = myCoords ? myCoords.lng : '';
    const url = `https://map.kakao.com/link/to/${encodeURIComponent(pharmacy.name)},${pharmacy.lat},${pharmacy.lng}/from/${encodeURIComponent('내 위치')},${sLat},${sLng}`;
    window.open(url, '_blank');
  };

  const panToPharmacyAndOpenInfo = (pharmacy: any) => {
    if (kakaoMapInstance.current && window.kakao && window.kakao.maps) {
      const targetLatLng = new window.kakao.maps.LatLng(pharmacy.lat, pharmacy.lng);
      kakaoMapInstance.current.panTo(targetLatLng);

      const matchedMarker = pharmacyMarkersRef.current.find(m => m.getTitle() === pharmacy.name);
      if (matchedMarker) {
        openCustomOverlay(matchedMarker, pharmacy);
      }
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-16 max-w-md mx-auto flex flex-col bg-gray-50 overflow-hidden">
      
      {/* 고정 상단 검색 폼 */}
      <form onSubmit={handleLocationSearch} className="p-4 bg-white border-b border-gray-100 shadow-sm flex items-center gap-2 shrink-0 z-10">
        <div className="flex flex-1 items-center gap-2 bg-gray-50 px-3 py-2.5 rounded-xl border border-gray-100">
          <Search className="size-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="이름 또는 지역 검색 (예: 강남역 편의점)" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs outline-none text-gray-800"
          />
        </div>
        <button type="submit" className="bg-[#E12756] text-white text-xs font-bold px-3 py-2.5 rounded-xl active:scale-95 transition-all shrink-0">
          검색
        </button>
      </form>

      {/* 지도 영역 비율 고정 */}
      <div className="w-full h-[38%] bg-slate-100 relative shrink-0 border-b border-gray-200">
        <div ref={mapRef} className="w-full h-full" id="map" />
        
        {/* 안내 문구 가이드 툴팁 배너 */}
        <div className="absolute top-3 left-3 z-20 bg-black/60 backdrop-blur-sm text-white text-[8px] px-2 py-1 rounded-md pointer-events-none">
          💡 지도의 원하는 곳을 클릭하면 출발지(내위치)가 변경됩니다.
        </div>

        <button 
          type="button"
          onClick={handleGpsToggle}
          className={`absolute bottom-3 right-3 z-20 p-2.5 rounded-xl shadow-md border active:scale-95 transition-all flex items-center gap-1.5 ${
            isGpsTracking 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-600 font-bold' 
              : 'bg-white border-gray-200 text-gray-400'
          }`}
        >
          <Compass className={`size-4 ${isGpsTracking ? 'animate-spin-slow' : ''}`} />
          <span className="text-[9px]">
            {isGpsTracking ? '위치 동기화 ON' : '위치 동기화 OFF'}
          </span>
        </button>
      </div>

      {/* 하단 구매처 리스트 바디 */}
      <div className="flex-1 min-h-0 bg-white rounded-t-[32px] -mt-4 shadow-xl z-20 flex flex-col overflow-hidden">
        <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto my-3 shrink-0" />
        
        {/* 옵션 탭 필터 스위처 */}
        <div className="px-4 mb-3 shrink-0">
          <div className="bg-gray-100/80 p-1 rounded-2xl flex items-center justify-between gap-1 border border-gray-200/40">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`flex-1 text-center py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'all' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              전체
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pharmacy')}
              className={`flex-1 text-center py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'pharmacy' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              약국
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('convenience')}
              className={`flex-1 text-center py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'convenience' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              편의점
            </button>
          </div>
        </div>

        {/* 권한 차단 안내 배너 */}
        {isBrowserDenied && (
          <div className="mx-4 mb-2 p-2 bg-rose-50 rounded-xl flex items-center gap-2 text-rose-600 text-[10px] shrink-0 border border-rose-100">
            <ShieldAlert className="size-3.5 text-rose-400 shrink-0" />
            <span>위치 권한 및 IP 분석이 제한되었습니다. 상단 검색 창을 이용해 주세요.</span>
          </div>
        )}

        {/* 엄격한 반경 처리 경고 패널 안내 배너 */}
        {isNoResultsNearby && (
          <div className="mx-4 mb-2 p-3 bg-amber-50 rounded-2xl flex items-center gap-2 text-amber-700 text-[10px] shrink-0 border border-amber-100">
            <AlertCircle className="size-4 text-amber-500 shrink-0" />
            <div className="flex flex-col">
              <span className="font-bold">현재 위치 반경 1km 이내에 해당하는 판매점이 없습니다.</span>
              <span className="text-[9px] text-amber-600/80 mt-0.5">지도의 다른 곳을 클릭해 내 위치를 변경하거나 지도를 드래그해 보세요.</span>
            </div>
          </div>
        )}

        {/* 상점 개수 안내 타이틀 (pharmacies.length가 이미 최대 20개로 제한되므로 정확하게 일치함) */}
        <div className="px-4 pb-2 shrink-0">
          <h3 className="text-[11px] font-bold text-gray-400">
            1km 이내 상점 안내 ({pharmacies.length}곳)
          </h3>
        </div>
        
        {/* 내부 스크롤 바디 */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2.5 scrollbar-thin">
          {pharmacies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <AlertCircle className="size-8 text-gray-300 mb-2" />
              <p className="text-xs font-bold text-gray-400">반경 1km 내에 조회 결과가 없습니다.</p>
              <p className="text-[10px] text-gray-400 mt-1">지도의 다른 구역을 클릭하여 기준점을 바꿔보세요.</p>
            </div>
          ) : (
            pharmacies.map((pharmacy) => (
              <div 
                key={pharmacy.id}
                onClick={() => panToPharmacyAndOpenInfo(pharmacy)}
                className="p-3.5 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col gap-2 cursor-pointer hover:border-rose-200 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1 max-w-[75%]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-gray-800 text-xs truncate max-w-[150px]">{pharmacy.name}</h4>
                      
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-bold shrink-0 ${
                        pharmacy.type === 'pharmacy' 
                          ? 'bg-rose-50 text-rose-600' 
                          : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {pharmacy.type === 'pharmacy' ? '약국' : '편의점'}
                      </span>

                      <span className="text-[9px] font-black text-rose-500 shrink-0">{pharmacy.distance}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 truncate">
                      <MapPin className="size-3 text-gray-300 inline mr-0.5" /> {pharmacy.address}
                    </p>
                    <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                      <Phone className="size-3 text-emerald-400" /> {pharmacy.phone}
                    </p>
                  </div>

                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={() => navigateToKakaoMap(pharmacy)} 
                      className="size-8 bg-rose-500 text-white rounded-xl flex items-center justify-center shadow-sm shrink-0 hover:bg-rose-600 transition-all"
                    >
                      <Navigation className="size-3.5 fill-current" />
                    </button>
                    <a 
                      href={pharmacy.phone !== "전화번호 미등록" ? `tel:${pharmacy.phone}` : undefined}
                      onClick={(e) => pharmacy.phone === "전화번호 미등록" && (e.preventDefault(), toast.error("전화번호가 등록되지 않은 장소입니다."))}
                      className={`size-8 border rounded-xl flex items-center justify-center hover:bg-emerald-100 transition-all shrink-0 ${
                        pharmacy.phone !== "전화번호 미등록" ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      }`}
                    >
                      <PhoneCall className="size-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
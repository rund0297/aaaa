import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// 🌟 [핵심] 인증(Auth)과 데이터베이스(Firestore) 기능을 쓸 수 있게 추가합니다!
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDuxznxGA2BG4RtkEoe8imTNdhHquRo4eo",
  authDomain: "yack-898f4.firebaseapp.com",
  projectId: "yack-898f4",
  storageBucket: "yack-898f4.firebasestorage.app",
  messagingSenderId: "20453618186",
  appId: "1:20453618186:web:68e54a873191aaf826e5f3",
  measurementId: "G-1448ZH2EKC"
};

// 파이어베이스 초기화
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// 🌟 App.tsx와 로그인 컴포넌트들이 사용할 수 있도록 외부로 내보내줍니다!
export const auth = getAuth(app);
export const db = getFirestore(app);

// 목 데이터(가짜 모드)를 쓰고 계시다면 아래 설정도 유지해 줍니다.
// 만약 가짜 모드가 필요 없다면 false로 바꾸시면 됩니다.
export const isMockMode = false;
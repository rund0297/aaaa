// vite.config.ts
import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  // 💻 로컬 개발 모드(development)인지 확인합니다.
  const isDev = mode === 'development';

  return {
    base: "/aaaa/", 

    plugins: [
      figmaAssetResolver(),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    assetsInclude: ['**/*.svg', '**/*.csv'],
    
    // 🎯 [핵심 해결] 전역 변수(define)를 통해 전역 환경 주소를 컴파일 시점에 고정합니다.
    define: {
      __API_DRUG_URL__: isDev 
        ? JSON.stringify('/api/drug') // 로컬 개발 시에는 Proxy 경로 사용
        : JSON.stringify('https://api.allorigins.win/raw?url=https://apis.data.go.kr') // 배포 시에는 CORS 우회 주소로 자동 고정
    },

    server: {
      proxy: {
        '/api/drug': {
          target: 'https://apis.data.go.kr',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/drug/, '')
        }
      }
    },
  };
});
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

export default defineConfig({
  // 👈 GitHub Pages 배포를 위한 기준 경로를 추가했습니다.
  base: "/aaaa/", 

  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
  
  server: {
    proxy: {
      // 💡 브라우저가 /api/drug로 시작하는 주소로 요청하면 Vite가 가로챕니다.
      '/api/drug': {
        target: 'https://apis.data.go.kr', // 진짜 가야 할 식약처 서버 주소
        changeOrigin: true,
        // 주소 앞부분의 /api/drug를 지우고 식약처 주소 뒤에 붙여줍니다.
        rewrite: (path) => path.replace(/^\/api\/drug/, '')
      }
    }
  },
})
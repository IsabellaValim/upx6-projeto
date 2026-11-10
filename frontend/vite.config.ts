import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Em dev, o Vite sobe em :5173 e estas rotas são repassadas para a API
// (dotnet run em :5151). Substitui o antigo localStorage "estudae:api":
// agora o front sempre fala na mesma origem e o proxy resolve em dev.
// /conteudo cobre as imagens das questões, servidas do banco pela API.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5151',
      '/conteudo': 'http://localhost:5151',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})

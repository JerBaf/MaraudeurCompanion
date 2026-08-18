import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Le site est publié sur https://jerbaf.github.io/MaraudeurCompanion/
// donc toutes les URL d'assets doivent être préfixées par le nom du repo.
export default defineConfig({
  base: '/MaraudeurCompanion/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})

import { defineConfig } from 'vitest/config'

// Config séparée de `vite.config.ts` à dessein : vitest embarque sa propre copie
// de Vite, et mélanger les deux fait diverger les types du plugin React.
//
// Les tests du domaine (`src/domain`) tournent en environnement Node : c'est du
// TypeScript pur, sans React ni Firebase. Les tests de rendu déclarent
// `@vitest-environment jsdom` en tête de fichier.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    setupFiles: ['src/test-setup.ts'],
  },
})

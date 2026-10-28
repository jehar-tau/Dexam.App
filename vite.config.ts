import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Separate stable dependencies for cache reuse without changing route loading or guards.
        strictExecutionOrder: true,
        codeSplitting: {
          groups: [
            {
              name: 'react-runtime',
              test: /node_modules\/(?:react|react-dom|scheduler|react-router|react-router-dom)\//,
              priority: 30,
            },
            { name: 'supabase-client', test: /node_modules\/@supabase\//, priority: 20 },
            { name: 'shared-libraries', test: /node_modules\//, priority: 10 },
            // The test-series product (pages, exam window, bank client) is its own cacheable chunk.
            {
              name: 'test-series',
              test: /src\/(?:pages\/tests|features\/testSeries|app\/student)\//,
              priority: 5,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: [
      'src/**/*.test.{ts,tsx}',
      'scripts/staging/**/*.test.mjs',
      'scripts/assessment/**/*.test.ts',
    ],
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/test/**'],
    },
  },
})

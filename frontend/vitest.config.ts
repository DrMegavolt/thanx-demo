import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      clearMocks: true,
      restoreMocks: true,
      unstubGlobals: true,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/main.tsx',
          'src/**/*.d.ts',
          'src/**/*.test.{ts,tsx}',
          'src/test/**',
        ],
        reporter: ['text', 'html', 'lcov', 'json-summary'],
        thresholds: { lines: 90, statements: 90, functions: 90, branches: 80 },
      },
    },
  }),
)

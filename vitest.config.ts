import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

// Default env is node (fast) for pure lib/ logic; component tests opt into jsdom
// per-file via `// @vitest-environment jsdom`. The @ alias mirrors tsconfig so
// component tests can import '@/lib/...'.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'components/**/*.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
    // MUI/emotion ship .mjs that directory-import react-transition-group, which
    // Node's ESM resolver rejects; inlining lets vite transform + resolve them.
    server: { deps: { inline: [/@mui/, /@emotion/, /react-transition-group/] } },
  },
  resolve: {
    alias: { '@': resolve(root) },
  },
});

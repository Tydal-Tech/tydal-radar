import { defineConfig } from 'vitest/config';

// Unit tests target the pure logic in lib/ (no DOM/network needed), so the node
// environment keeps them fast. Component/integration tests can add jsdom later.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});

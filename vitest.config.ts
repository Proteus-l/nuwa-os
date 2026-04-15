import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',
    include: ['packages/*/__tests__/**/*.test.ts'],
    globals: true,
  },
});

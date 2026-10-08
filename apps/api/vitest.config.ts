import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const swcPlugin = swc.vite({
  module: { type: 'es6' },
  jsc: {
    target: 'es2023',
    keepClassNames: true,
    parser: {
      syntax: 'typescript',
      decorators: true,
    },
    transform: {
      legacyDecorator: true,
      decoratorMetadata: true,
    },
  },
});

export default defineConfig({
  plugins: [swcPlugin],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['./test/setup.ts'],
  },
});

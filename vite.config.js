import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        deepdrishti: resolve(root, 'deepdrishti.html'),
        accesco: resolve(root, 'accesco.html'),
      },
    },
  },
});

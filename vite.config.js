import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const srcDir = fileURLToPath(new URL('./src/', import.meta.url));

export default defineConfig({
  root: 'react',
  // react/index.html is the entry, but the source lives in ../src.
  // Map /src/* back to the project-level src directory.
  resolve: {
    alias: [{ find: /^\/src\//, replacement: srcDir }]
  },
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    fs: { allow: ['..'] },
    proxy: {
      '/api': { target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3000' },
      '/health': { target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3000' }
    }
  }
});

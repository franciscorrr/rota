import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// `base: './'` generates relative paths: dist/ works when served from any folder.
export default defineConfig({
  base: './',
  plugins: [vue()],
  server: { port: 8080 },
});

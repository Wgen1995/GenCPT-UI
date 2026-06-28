/// <reference types="vitest/config" />
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: process.env.WORKBENCH_API_TARGET ?? 'http://127.0.0.1:7090',
        changeOrigin: true
      }
    }
  },
  test: {
    environment: 'jsdom'
  }
});
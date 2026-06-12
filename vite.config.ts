import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // GitHub Pages 部署在 /<repo>/ 子路径下,由 CI 注入;本地保持 /
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
});

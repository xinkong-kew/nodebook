import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// 前端独立运行（Vite 开发服务器）
// 通过代理把 /api 请求转发到后端服务，前后端代码彻底分离
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      // 笔记同目录下的图片由后端提供
      '/note-assets': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
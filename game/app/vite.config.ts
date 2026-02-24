import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

 // 添加以下 server 配置
  server: {
    host: '0.0.0.0',  // 允许外部访问（手机连接需要）
    port: 5173,
    strictPort: true,  // 端口被占用时不自动切换
  },
});

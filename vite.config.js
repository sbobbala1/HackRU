import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: Number(process.env.VITRA_WEB_PORT || 5173),
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.VITRA_API_PORT || 8000}`,
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, ''),
      },
    },
  },
});

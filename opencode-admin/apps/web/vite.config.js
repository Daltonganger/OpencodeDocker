import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
    base: '/manage/',
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 3000,
        proxy: {
            '/manage/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                rewrite: function (path) { return path.replace(/^\/manage/, ''); },
            },
        },
    },
});

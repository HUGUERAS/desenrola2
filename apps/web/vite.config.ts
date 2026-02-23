import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/ - RESTART TRIGGER 1
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 3000,
        host: true,
        proxy: {
            '/api': {
                target: 'http://localhost:8010',
                changeOrigin: true,
                secure: false,
            },
        },
    },
    test: {
        include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
        exclude: ['tests/**'],
    },
});

import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    plugins: [
        react() as PluginOption,
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['pwa-192x192.svg', 'pwa-512x512.svg'],
            manifest: {
                name: 'VerbumDigital - Priest',
                short_name: 'VD Priest',
                description: 'Gestione streaming per sacerdoti',
                theme_color: '#0f172a',
                background_color: '#0f172a',
                display: 'standalone',
                orientation: 'portrait',
                start_url: '/',
                scope: '/',
                icons: [
                    { src: 'pwa-192x192.svg', sizes: '192x192', type: 'image/svg+xml' },
                    { src: 'pwa-512x512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
                ],
            },
        }) as PluginOption,
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@shared': path.resolve(__dirname, '../shared'),
        },
    },
    server: {
        port: 3001,
    },
});

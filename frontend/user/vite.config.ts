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
                name: 'VerbumDigital - Radio Parrocchiale',
                short_name: 'VD Radio',
                description: 'Ascolta le trasmissioni della tua parrocchia',
                theme_color: '#0f172a',
                background_color: '#0f172a',
                display: 'standalone',
                orientation: 'portrait',
                start_url: '/',
                scope: '/',
                categories: ['music', 'entertainment'],
                icons: [
                    { src: 'pwa-192x192.svg', sizes: '192x192', type: 'image/svg+xml' },
                    { src: 'pwa-512x512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
                ],
            },
            workbox: {
                // Runtime caching strategies
                runtimeCaching: [
                    {
                        // API calls — network first with fallback to cache
                        urlPattern: /\/api\/v1\/.*/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'api-cache',
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 300, // 5 min
                            },
                            networkTimeoutSeconds: 10,
                        },
                    },
                    {
                        // Google Fonts CSS
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'google-fonts-stylesheets',
                        },
                    },
                    {
                        // Google Fonts files
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-webfonts',
                            expiration: {
                                maxEntries: 30,
                                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                            },
                        },
                    },
                    {
                        // Static assets (images, etc.)
                        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'images-cache',
                            expiration: {
                                maxEntries: 60,
                                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                            },
                        },
                    },
                ],
                // Precache app shell (auto-detected by VitePWA)
                globPatterns: ['**/*.{js,css,html,svg}'],
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
        port: 3002,
    },
});

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['asset/icon/TierlistIcon.png', 'asset/icon/HomepageLogo.png'],
            manifest: {
                name: 'JKT48 Tierlist',
                short_name: 'JKT48 Tierlist',
                description: 'Aplikasi web interaktif untuk membuat tierlist member JKT48. Seret dan lepas foto member untuk menyusun peringkat favoritmu.',
                theme_color: '#1a1a2e',
                background_color: '#1a1a2e',
                display: 'standalone',
                scope: '/',
                start_url: '/',
                orientation: 'portrait',
                lang: 'id',
                icons: [
                    {
                        src: '/asset/icon/TierlistIcon.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any maskable'
                    },
                    {
                        src: '/asset/icon/TierlistIcon.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ],
                screenshots: [
                    {
                        src: '/asset/icon/HomepageLogo.png',
                        sizes: '512x512',
                        type: 'image/png',
                        form_factor: 'wide'
                    }
                ],
                categories: ['entertainment', 'lifestyle'],
                shortcuts: [
                    {
                        name: 'Member Tierlist',
                        short_name: 'Member',
                        description: 'Buat tierlist member JKT48',
                        url: '/',
                        icons: [{ src: '/asset/icon/TierlistIcon.png', sizes: '192x192' }]
                    }
                ]
            },
            workbox: {
                // Cache the app shell and routes
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
                // Don't cache large asset directories (member images) — they'd blow up the cache
                globIgnores: [
                    'asset/member_active/**',
                    'asset/exmember/**',
                    'asset/Setlist/**',
                    'asset/SSRamadan/**',
                    'asset/SPV_MV/**',
                ],
                runtimeCaching: [
                    {
                        // Cache member images with a cache-first strategy
                        urlPattern: /\/asset\/(member_active|exmember|Setlist|SSRamadan|SPV_MV)\//,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'jkt48-images',
                            expiration: {
                                maxEntries: 500,
                                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                    {
                        // Cache the rest of /asset/ (icons, etc.) with stale-while-revalidate
                        urlPattern: /\/asset\//,
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'jkt48-static-assets',
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                            },
                        },
                    },
                ],
            },
            devOptions: {
                // Disable SW in dev to avoid interfering with HMR
                enabled: false,
            },
        }),
    ],
    build: {
        outDir: 'dist'
    }
})
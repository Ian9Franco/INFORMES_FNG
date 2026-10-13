import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
export default defineConfig({ plugins: [react(), VitePWA({ registerType: 'autoUpdate', manifest: { name: 'Informes FNG', short_name: 'FNG Ads', start_url: '/', display: 'standalone', theme_color: '#101a2e', background_color: '#101a2e', icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }] } })] })
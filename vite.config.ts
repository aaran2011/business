import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4600,
    // Bind to every interface, not just loopback, so a phone on the same
    // Wi-Fi can open http://<this-mac's-ip>:4600 and actually join a game.
    host: true,
  },
})

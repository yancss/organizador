import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow dev server to be accessed from LAN IPs without CORS warnings
  allowedDevOrigins: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.1.162:3000',
  ],
}

export default nextConfig

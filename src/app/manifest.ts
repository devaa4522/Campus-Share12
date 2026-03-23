import type { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Campus Share',
    short_name: 'Campus Share',
    description: 'The exclusive decentralized marketplace for university students.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f9fb',
    theme_color: '#000a1e',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}

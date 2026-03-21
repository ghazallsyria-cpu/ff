import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'مدرسة الرفعة النموذجية',
  description: 'نظام إدارة مدرسة الرفعة النموذجية',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="font-arabic bg-gray-50 text-gray-900">{children}</body>
    </html>
  )
}
// PWA: تم إضافة manifest و service worker في app/layout.tsx
// أضف هذا في <head>:
// <link rel="manifest" href="/manifest.json" />
// <meta name="theme-color" content="#1e3a8a" />
// <script> if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js') } </script>

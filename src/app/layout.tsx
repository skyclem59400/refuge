import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'Optimus',
  description: 'Gestion intelligente - Factures, clients & etablissements',
  icons: {
    icon: '/favicon-32x32.png',
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'Optimus',
    description: 'Gestion intelligente - Factures, clients & etablissements',
    images: [{ url: '/logo.png', width: 376, height: 370 }],
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var t = localStorage.getItem('theme');
            if (t) {
              document.documentElement.classList.remove('dark', 'light');
              document.documentElement.classList.add(t);
            }
          })();
        `}} />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              className: 'toast-themed',
              style: {
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}

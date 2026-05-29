import type { Metadata } from 'next'
import { Baloo_2, Fraunces } from 'next/font/google'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

// Typographie alignée sur la charte SDA :
//  - Baloo 2 pour le corps (sans serif chaleureux, lisible en dark mode)
//  - Fraunces pour les titres .h-display (serif éditorial, sur la marque)
const baloo = Baloo_2({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-baloo',
  display: 'swap',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
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
      <body className={`${baloo.variable} ${fraunces.variable} font-sans antialiased`}>
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

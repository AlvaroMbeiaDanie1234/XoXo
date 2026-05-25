import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Poppins } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/toaster'
import SecurityProvider from '@/components/SecurityProvider'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });
const _poppins = Poppins({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-poppins'
});

export const metadata: Metadata = {
  title: 'XoXo - Plataforma de Conteúdo Premium | OPrivado',
  description: 'XoXo é a plataforma de conteúdo premium mais exclusiva. Acesse vídeos, fotos e artigos exclusivos dos melhores criadores. Junte-se ao OPrivado agora!',
  keywords: 'xoxo, oprivado, conteúdo premium, vídeos exclusivos, fotos exclusivas, criadores de conteúdo, plataforma de conteúdo, conteúdo adulto, assinatura premium',
  authors: [{ name: 'XoXo' }],
  creator: 'XoXo',
  publisher: 'XoXo',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://xoxo.com',
    title: 'XoXo - Plataforma de Conteúdo Premium | OPrivado',
    description: 'XoXo é a plataforma de conteúdo premium mais exclusiva. Acesse vídeos, fotos e artigos exclusivos dos melhores criadores.',
    siteName: 'XoXo',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'XoXo - Plataforma de Conteúdo Premium',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'XoXo - Plataforma de Conteúdo Premium | OPrivado',
    description: 'XoXo é a plataforma de conteúdo premium mais exclusiva. Acesse vídeos, fotos e artigos exclusivos dos melhores criadores.',
    images: ['/og-image.png'],
    creator: '@xoxo',
  },
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#000000',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className="bg-background" suppressHydrationWarning>
      <body className={`font-sans antialiased ${_poppins.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <SecurityProvider />
          {children}
          <Toaster />
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </ThemeProvider>
      </body>
    </html>
  )
}

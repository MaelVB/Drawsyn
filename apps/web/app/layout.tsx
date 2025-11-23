import type { Metadata } from 'next';
import { ColorSchemeScript } from '@mantine/core';
import { Providers } from '@/components/providers';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/carousel/styles.css';
import './globals.css';
import EffectsOverlay from '@/components/EffectsOverlay';

export const metadata: Metadata = {
  title: 'Drawsyn - Real-time Team Drawing Game',
  description: 'Real-time drawing battles with teams and special effects'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
      </head>
      <body style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Providers>
          <Header />
          <main style={{ flex: 1 }}>
            {children}
          </main>
          <Footer />
        </Providers>
        <EffectsOverlay />
      </body>
    </html>
  );
}

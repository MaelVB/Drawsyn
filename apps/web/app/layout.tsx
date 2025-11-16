import type { Metadata } from 'next';
import { ColorSchemeScript } from '@mantine/core';
import { Providers } from '@/components/providers';
import Header from '@/components/Header';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './globals.css';
import EffectsOverlay from '@/components/EffectsOverlay';

export const metadata: Metadata = {
  title: 'Drawsyn - Realtime Drawing Game',
  description: 'Skribbl.io inspired realtime drawing battles built with Nest and Next.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
      </head>
      <body>
        <Providers>
          <Header />
          {children}
        </Providers>
        <EffectsOverlay />
      </body>
    </html>
  );
}

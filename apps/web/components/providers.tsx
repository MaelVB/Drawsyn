'use client';

import { MantineProvider } from '@mantine/core';
import { ReactNode } from 'react';

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <MantineProvider defaultColorScheme="dark" withCssVariables>
      {children}
    </MantineProvider>
  );
}

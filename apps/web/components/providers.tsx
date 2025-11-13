'use client';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ReactNode, useEffect } from 'react';

import { useAuthStore } from '@/stores/auth-store';

type ProvidersProps = {
  children: ReactNode;
};

function AuthInitializer() {
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return null;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <MantineProvider defaultColorScheme="dark" withCssVariables>
      <Notifications position="bottom-right" />
      <AuthInitializer />
      {children}
    </MantineProvider>
  );
}

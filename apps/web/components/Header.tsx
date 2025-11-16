"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Group, Text, Button } from '@mantine/core';

import { useAuthStore } from '@/stores/auth-store';

export default function Header() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  const inGame = pathname?.startsWith('/game/');

  // Masquer totalement le header lorsqu'on est dans une page de game (y compris lobby pré-game)
  if (inGame) return null;

  return (
    <Group justify="space-between" px="xl" py="md" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
      <Link href={{ pathname: '/' }} style={{ textDecoration: 'none' }}>
        <Text fw={700}>Drawsyn</Text>
      </Link>
      {user && (
        <Button component={Link} href="/account">
          Mon compte
        </Button>
      )}
    </Group>
  );
}

"use client";

import { useMemo, useState } from 'react';
import { Button, Card, Group, NumberInput, Stack, Text, Title, Alert } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

import { getSocket } from '@/lib/socket';
import type { RoomState } from '@/stores/game-store';

interface Props {
  room: RoomState;
}

export default function LobbySettings({ room }: Props) {
  const [maxPlayers, setMaxPlayers] = useState<number | ''>(room.maxPlayers);
  const [roundDuration, setRoundDuration] = useState<number | ''>(room.roundDuration);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const canStart = useMemo(() => {
    const connected = Object.values(room.players).filter((p) => p.connected).length;
    return connected >= 2 && room.status === 'lobby';
  }, [room]);

  const hasChanges = useMemo(() => {
    return (
      (typeof maxPlayers === 'number' && maxPlayers !== room.maxPlayers) ||
      (typeof roundDuration === 'number' && roundDuration !== room.roundDuration)
    );
  }, [maxPlayers, roundDuration, room.maxPlayers, room.roundDuration]);

  const handleSave = () => {
    setError(undefined);
    setLoading(true);
    const payload: any = {};
    if (typeof maxPlayers === 'number') payload.maxPlayers = maxPlayers;
    if (typeof roundDuration === 'number') payload.roundDuration = roundDuration;

    getSocket().emit('room:update', payload);
    setTimeout(() => setLoading(false), 300); // optimiste
  };

  const handleStart = () => {
    setError(undefined);
    setLoading(true);
    getSocket().emit('game:start');
    setTimeout(() => setLoading(false), 300);
  };

  return (
    <Card withBorder padding="lg" radius="md" style={{ width: 720 }}>
      <Stack gap="md">
        <Title order={4}>Paramètres de la partie</Title>
        <Group grow>
          <NumberInput
            label="Joueurs maximum"
            min={2}
            max={12}
            value={maxPlayers}
            onChange={(v) => setMaxPlayers(typeof v === 'number' ? v : '')}
          />
          <NumberInput
            label="Durée d'une manche (s)"
            min={30}
            max={240}
            value={roundDuration}
            onChange={(v) => setRoundDuration(typeof v === 'number' ? v : '')}
          />
        </Group>
        {error && (
          <Alert icon={<IconInfoCircle size={16} />} color="red">
            {error}
          </Alert>
        )}
        <Group justify="space-between">
          <Button variant="default" onClick={handleSave} disabled={!hasChanges} loading={loading}>
            Enregistrer
          </Button>
          <Button onClick={handleStart} disabled={!canStart} loading={loading}>
            Démarrer la partie
          </Button>
        </Group>
        {!canStart && (
          <Text size="sm" c="dimmed">
            En attente des joueurs... Au moins 2 joueurs connectés sont requis pour démarrer.
          </Text>
        )}
      </Stack>
    </Card>
  );
}

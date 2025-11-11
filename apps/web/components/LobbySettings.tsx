"use client";

import { useMemo, useState } from 'react';
import { Button, Card, Group, NumberInput, Stack, Text, Title, Alert, Divider } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

import { getSocket } from '@/lib/socket';
import type { RoomState } from '@/stores/game-store';

interface Props {
  room: RoomState;
}

export default function LobbySettings({ room }: Props) {
  const [maxPlayers, setMaxPlayers] = useState<number | ''>(room.maxPlayers);
  const [roundDuration, setRoundDuration] = useState<number | ''>(room.roundDuration);
  const [totalRounds, setTotalRounds] = useState<number | ''>(room.totalRounds ?? 3);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const canStart = useMemo(() => {
    const connected = Object.values(room.players).filter((p) => p.connected).length;
    return connected >= 2 && room.status === 'lobby';
  }, [room]);

  const hasChanges = useMemo(() => {
    return (
      (typeof maxPlayers === 'number' && maxPlayers !== room.maxPlayers) ||
      (typeof roundDuration === 'number' && roundDuration !== room.roundDuration) ||
      (typeof totalRounds === 'number' && totalRounds !== (room.totalRounds ?? 3))
    );
  }, [maxPlayers, roundDuration, totalRounds, room.maxPlayers, room.roundDuration, room.totalRounds]);

  const handleSave = () => {
    setError(undefined);
    setLoading(true);
    const payload: any = {};
    if (typeof maxPlayers === 'number') payload.maxPlayers = maxPlayers;
  if (typeof roundDuration === 'number') payload.roundDuration = roundDuration;
  if (typeof totalRounds === 'number') payload.totalRounds = totalRounds;

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
    <Card withBorder padding="md" radius="md" style={{ width: 720 }}>
      <Title order={4} ta="center">Paramètres de la partie</Title>
      <Divider my="md" />
      <Stack gap="md">
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
          <NumberInput
            label="Rounds"
            min={1}
            max={20}
            value={totalRounds}
            onChange={(v) => setTotalRounds(typeof v === 'number' ? v : '')}
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

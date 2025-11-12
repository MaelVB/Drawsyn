"use client";

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Group, NumberInput, Stack, Text, Title, Alert, Divider, Badge, TextInput, ActionIcon, Flex, Box } from '@mantine/core';
import { IconInfoCircle, IconCrown, IconCopy, IconCheck } from '@tabler/icons-react';

import { getSocket } from '@/lib/socket';
import type { RoomState } from '@/stores/game-store';
import { useGameStore } from '@/stores/game-store';

interface Props {
  room: RoomState;
}

export default function LobbySettings({ room }: Props) {
  const playerId = useGameStore((state) => state.playerId);
  const [maxPlayers, setMaxPlayers] = useState<number | ''>(room.maxPlayers);
  const [roundDuration, setRoundDuration] = useState<number | ''>(room.roundDuration);
  const [totalRounds, setTotalRounds] = useState<number | ''>(room.totalRounds ?? 3);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Générer l'URL de la room
  const roomUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/game/${room.id}`;
  }, [room.id]);

  // Synchroniser les valeurs locales avec les changements de la room
  useEffect(() => {
    setMaxPlayers(room.maxPlayers);
    setRoundDuration(room.roundDuration);
    setTotalRounds(room.totalRounds ?? 3);
  }, [room.maxPlayers, room.roundDuration, room.totalRounds]);

  const isHost = useMemo(() => {
    return room.hostId === playerId;
  }, [room.hostId, playerId]);

  const hostPlayer = useMemo(() => {
    return room.hostId ? room.players[room.hostId] : undefined;
  }, [room.hostId, room.players]);

  const canStart = useMemo(() => {
    const connected = Object.values(room.players).filter((p) => p.connected).length;
    return connected >= 2 && room.status === 'lobby' && isHost;
  }, [room, isHost]);

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

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erreur lors de la copie:', err);
    }
  };

  return (
    <Card withBorder padding="md" radius="md" style={{ width: 720 }}>
      <Flex justify="space-between" align="center" mb="sm">
        {/* Hôte à gauche */}
        <Box style={{ minWidth: 150 }}>
          {hostPlayer && (
            <Badge
              size="lg"
              variant="light"
              leftSection={<IconCrown size={14} />}
              color={isHost ? "yellow" : "gray"}
            >
              Hôte : {hostPlayer.name}
            </Badge>
          )}
        </Box>

        {/* Titre au centre */}
        <Title order={4} style={{ textAlign: 'center' }}>
          Paramètres de la partie
        </Title>

        {/* Bouton unique copier URL (texte + icône à droite) */}
        <Button
          variant="light"
          color={copied ? "green" : "blue"}
          onClick={handleCopyUrl}
          size="sm"
          rightSection={copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
          style={{ minWidth: 150 }}
          title="Copier le lien de la room"
        >
          Copier URL
        </Button>
      </Flex>
      <Divider my="md" />
      <Stack gap="md">
        {!isHost && (
          <Alert icon={<IconInfoCircle size={16} />} color="blue">
            Seul l'hôte peut modifier les paramètres et démarrer la partie.
          </Alert>
        )}
        <Group grow>
          <NumberInput
            label="Joueurs maximum"
            min={2}
            max={12}
            value={maxPlayers}
            onChange={(v) => setMaxPlayers(typeof v === 'number' ? v : '')}
            disabled={!isHost}
          />
          <NumberInput
            label="Durée d'une manche (en secondes)"
            min={30}
            max={240}
            value={roundDuration}
            onChange={(v) => setRoundDuration(typeof v === 'number' ? v : '')}
            disabled={!isHost}
          />
          <NumberInput
            label="Rounds"
            min={1}
            max={20}
            value={totalRounds}
            onChange={(v) => setTotalRounds(typeof v === 'number' ? v : '')}
            disabled={!isHost}
          />
        </Group>
        {error && (
          <Alert icon={<IconInfoCircle size={16} />} color="red">
            {error}
          </Alert>
        )}
        <Group justify="space-between">
          <Button variant="default" onClick={handleSave} disabled={!hasChanges || !isHost} loading={loading}>
            Enregistrer
          </Button>
          <Button onClick={handleStart} disabled={!canStart} loading={loading}>
            Démarrer la partie
          </Button>
        </Group>
        {!isHost && (
          <Text size="sm" c="dimmed">
            En attente que l'hôte lance la partie...
          </Text>
        )}
        {isHost && Object.values(room.players).filter((p) => p.connected).length < 2 && (
          <Text size="sm" c="dimmed">
            En attente des joueurs... Au moins 2 joueurs connectés sont requis pour démarrer.
          </Text>
        )}
      </Stack>
    </Card>
  );
}

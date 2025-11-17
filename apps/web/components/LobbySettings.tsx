"use client";

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Group, NumberInput, Stack, Text, Title, Alert, Divider, Badge, Flex, Box, Checkbox } from '@mantine/core';
import { IconInfoCircle, IconCrown, IconCopy, IconCheck } from '@tabler/icons-react';

import { getSocket } from '@/lib/socket';
import type { RoomState } from '@/stores/game-store';
import { useGameStore } from '@/stores/game-store';

interface Props {
  room: RoomState;
}

export default function LobbySettings({ room }: Props) {
  const playerId = useGameStore((state) => state.playerId);
  // maxPlayers supprimé du panneau lobby (capacité auto par équipes)
  const [roundDuration, setRoundDuration] = useState<number | ''>(room.roundDuration);
  const [unlimited, setUnlimited] = useState<boolean>(room.roundDuration === 0);
  const [totalRounds, setTotalRounds] = useState<number | ''>(room.totalRounds ?? 3);
  const [teamCount, setTeamCount] = useState<number | ''>(room.teamCount ?? 2);
  const [teamSize, setTeamSize] = useState<number | ''>(room.teamSize ?? 2);
  const [itemsFree, setItemsFree] = useState<boolean>(room.itemsFree ?? false);
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
    setRoundDuration(room.roundDuration);
    setTotalRounds(room.totalRounds ?? 3);
    setTeamCount(room.teamCount ?? 2);
    setTeamSize(room.teamSize ?? 2);
    setUnlimited(room.roundDuration === 0);
    setItemsFree(room.itemsFree ?? false);
  }, [room.maxPlayers, room.roundDuration, room.totalRounds, room.teamCount, room.teamSize, room.itemsFree]);

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
      (typeof roundDuration === 'number' && roundDuration !== room.roundDuration) ||
      (unlimited !== (room.roundDuration === 0)) ||
      (typeof totalRounds === 'number' && totalRounds !== (room.totalRounds ?? 3)) ||
      (typeof teamCount === 'number' && teamCount !== (room.teamCount ?? 2)) ||
      (typeof teamSize === 'number' && teamSize !== (room.teamSize ?? 2)) ||
      (itemsFree !== (room.itemsFree ?? false))
    );
  }, [roundDuration, totalRounds, teamCount, teamSize, room.roundDuration, room.totalRounds, room.teamCount, room.teamSize, unlimited, itemsFree, room.itemsFree]);

  const handleSave = () => {
    setError(undefined);
    setLoading(true);
  const payload: any = {};
  // Si mode illimité sélectionné, envoyer 0 explicitement
  if (unlimited) payload.roundDuration = 0;
  else if (typeof roundDuration === 'number') payload.roundDuration = roundDuration;
    if (typeof totalRounds === 'number') payload.totalRounds = totalRounds;
    if (typeof teamCount === 'number') payload.teamCount = teamCount;
  if (typeof teamSize === 'number') payload.teamSize = teamSize;
  payload.itemsFree = itemsFree;

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
          <Flex align="flex-end" gap="md">
            <NumberInput
              label="Durée d'une manche (en s)"
              min={30}
              max={240}
              value={roundDuration}
              onChange={(v) => setRoundDuration(typeof v === 'number' ? v : '')}
              disabled={!isHost || unlimited}
            />
            <Checkbox label="Temps illimité" checked={unlimited} onChange={(e) => setUnlimited(e.currentTarget.checked)} disabled={!isHost} style={{ display: "block", transform: "translateY(-8px)" }} />
          </Flex>
          <NumberInput
            label="Rounds"
            min={1}
            max={20}
            value={totalRounds}
            onChange={(v) => setTotalRounds(typeof v === 'number' ? v : '')}
            disabled={!isHost}
          />
        </Group>
        <Group grow>
          <NumberInput
            label="Nombre d'équipes"
            min={2}
            max={6}
            value={teamCount}
            onChange={(v) => setTeamCount(typeof v === 'number' ? v : '')}
            disabled={!isHost}
          />
          <NumberInput
            label="Nombre de joueurs par équipe"
            min={1}
            max={12}
            value={teamSize}
            onChange={(v) => setTeamSize(typeof v === 'number' ? v : '')}
            disabled={!isHost}
          />
        </Group>
        <Group>
          <Checkbox
            label="Items gratuits"
            checked={itemsFree}
            onChange={(e) => setItemsFree(e.currentTarget.checked)}
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

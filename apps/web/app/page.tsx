'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  Group,
  NumberInput,
  Stack,
  Text,
  TextInput,
  Title
} from '@mantine/core';

import { getSocket } from '@/lib/socket';
import { useGameStore } from '@/stores/game-store';
import type { RoomState } from '@/stores/game-store';

export default function LobbyPage() {
  const router = useRouter();
  const { rooms, setRooms } = useGameStore((state) => ({
    rooms: state.rooms,
    setRooms: state.setRooms
  }));
  const [roomName, setRoomName] = useState('Salon détendu');
  const [maxPlayers, setMaxPlayers] = useState<number | ''>(6);
  const [roundDuration, setRoundDuration] = useState<number | ''>(90);

  useEffect(() => {
    const socket = getSocket();
    const handleRooms = (payload: RoomState[]) => setRooms(payload);
    const handleCreated = (payload: { id: string }) => {
      router.push(`/game/${payload.id}`);
    };
    socket.on('room:list', handleRooms);
    socket.on('room:created', handleCreated);
    socket.emit('room:list');
    return () => {
      socket.off('room:list', handleRooms);
      socket.off('room:created', handleCreated);
    };
  }, [router, setRooms]);

  const canCreate = useMemo(
    () => Boolean(roomName.trim()) && !!maxPlayers && !!roundDuration,
    [roomName, maxPlayers, roundDuration]
  );

  const handleCreateRoom = () => {
    if (!canCreate) return;
    const socket = getSocket();
    socket.emit('room:create', {
      name: roomName,
      maxPlayers,
      roundDuration
    });
  };

  return (
    <Stack gap="xl" maw={960} mx="auto" p="xl">
      <Stack gap={4}>
        <Title order={1}>Drawsyn Lobby</Title>
        <Text c="dimmed">
          Rejoignez une salle existante ou créez-en une nouvelle pour défier vos amis.
        </Text>
      </Stack>

      <Card withBorder padding="lg" radius="md">
        <Stack>
          <Title order={3}>Créer une salle</Title>
          <TextInput
            label="Nom de la salle"
            value={roomName}
            onChange={(event) => setRoomName(event.currentTarget.value)}
            placeholder="Nom de votre salle"
          />
          <Group grow>
            <NumberInput
              label="Joueurs maximum"
              min={2}
              max={12}
              value={maxPlayers}
              onChange={setMaxPlayers}
            />
            <NumberInput
              label="Durée d'une manche (secondes)"
              min={30}
              max={240}
              value={roundDuration}
              onChange={setRoundDuration}
            />
          </Group>
          <Button onClick={handleCreateRoom} disabled={!canCreate} variant="light">
            Créer
          </Button>
        </Stack>
      </Card>

      <Stack>
        <Group justify="space-between">
          <Title order={3}>Salles publiques</Title>
          <Button variant="subtle" onClick={() => getSocket().emit('room:list')}>
            Rafraîchir
          </Button>
        </Group>

        {rooms.length === 0 ? (
          <Card withBorder padding="lg" radius="md">
            <Text>Aucune salle pour le moment. Créez-en une !</Text>
          </Card>
        ) : (
          rooms.map((room) => (
            <Card key={room.id} withBorder padding="lg" radius="md">
              <Group justify="space-between" align="center">
                <div>
                  <Text fw={600}>{room.name}</Text>
                  <Text c="dimmed" fz="sm">
                    {Object.keys(room.players).length} / {room.maxPlayers} joueurs · {room.roundDuration}
                    s par manche
                  </Text>
                </div>
                <Button
                  onClick={() => router.push(`/game/${room.id}`)}
                  variant="gradient"
                  gradient={{ from: 'indigo', to: 'cyan' }}
                >
                  Rejoindre
                </Button>
              </Group>
            </Card>
          ))
        )}
      </Stack>
    </Stack>
  );
}

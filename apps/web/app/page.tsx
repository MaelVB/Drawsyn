'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Anchor,
  Button,
  Card,
  Group,
  NumberInput,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

import { getSocket } from '@/lib/socket';
import { login, register } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useGameStore } from '@/stores/game-store';
import type { RoomState } from '@/stores/game-store';

export default function LobbyPage() {
  const router = useRouter();
  const { user, token, setAuth, clearAuth } = useAuthStore((state) => ({
    user: state.user,
    token: state.token,
    setAuth: state.setAuth,
    clearAuth: state.clearAuth
  }));
  const { rooms, setRooms } = useGameStore((state) => ({
    rooms: state.rooms,
    setRooms: state.setRooms
  }));
  const [roomName, setRoomName] = useState('Salon détendu');
  const [maxPlayers, setMaxPlayers] = useState<number | ''>(6);
  const [roundDuration, setRoundDuration] = useState<number | ''>(90);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | undefined>();
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket();
    const handleRooms = (payload: RoomState[]) => setRooms(payload);
    const handleCreated = (payload: { id: string }) => {
      router.push(`/game/${payload.id}`);
    };
    const handleAuthError = (payload: { message?: string }) => {
      setAuthError(payload.message ?? 'Session expirée, veuillez vous reconnecter.');
      clearAuth();
    };
    socket.on('room:list', handleRooms);
    socket.on('room:created', handleCreated);
    socket.on('auth:error', handleAuthError);
    socket.emit('room:list');
    return () => {
      socket.off('room:list', handleRooms);
      socket.off('room:created', handleCreated);
      socket.off('auth:error', handleAuthError);
    };
  }, [clearAuth, router, setRooms, token]);

  useEffect(() => {
    if (!token) {
      setRooms([]);
    }
  }, [setRooms, token]);

  const canCreate = useMemo(
    () => Boolean(roomName.trim()) && !!maxPlayers && !!roundDuration && Boolean(user),
    [roomName, maxPlayers, roundDuration, user]
  );

  const handleCreateRoom = () => {
    if (!user) {
      setAuthError('Connectez-vous pour créer une salle.');
      return;
    }
    if (!canCreate) return;
    const socket = getSocket();
    socket.emit('room:create', {
      name: roomName,
      maxPlayers,
      roundDuration
    });
  };

  const handleJoinRoom = (roomId: string) => {
    if (!user) {
      setAuthError('Connectez-vous pour rejoindre une salle.');
      return;
    }
    router.push(`/game/${roomId}`);
  };

  const handleAuthSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      setAuthError('Remplissez le formulaire.');
      return;
    }

    setAuthLoading(true);
    setAuthError(undefined);
    try {
      const payload =
        authMode === 'login'
          ? await login(username.trim(), password)
          : await register(username.trim(), password);
      setAuth(payload);
      setUsername('');
      setPassword('');
    } catch (error) {
      setAuthError((error as Error).message);
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <Stack gap="xl" maw={960} mx="auto" p="xl">
      <Stack gap={4}>
        <Title order={1}>Drawsyn Lobby</Title>
        <Text c="dimmed">
          Rejoignez une salle existante ou créez-en une nouvelle pour défier vos amis.
        </Text>
      </Stack>

      <Group align="stretch" gap="xl" wrap="wrap">
        {!user ? (
          <Card withBorder padding="lg" radius="md" style={{ flex: '1 1 320px' }}>
            <Stack>
              <Group justify="space-between" align="center">
                <Title order={3}>{authMode === 'login' ? 'Connexion' : 'Inscription'}</Title>
                <Anchor
                  component="button"
                  type="button"
                  size="sm"
                  onClick={() => {
                    setAuthMode((mode) => (mode === 'login' ? 'register' : 'login'));
                    setAuthError(undefined);
                  }}
                >
                  {authMode === 'login' ? "Créer un compte" : 'Déjà inscrit ?'}
                </Anchor>
              </Group>
              <TextInput
                label="Nom d'utilisateur"
                placeholder="Votre pseudo"
                value={username}
                onChange={(event) => setUsername(event.currentTarget.value)}
                autoComplete="username"
              />
              <PasswordInput
                label="Mot de passe"
                placeholder="Votre mot de passe"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
              />
              <Button onClick={handleAuthSubmit} loading={authLoading} variant="light">
                {authMode === 'login' ? 'Se connecter' : "S'inscrire"}
              </Button>
              {authError && (
                <Alert icon={<IconInfoCircle size={16} />} color="red" title="Oops">
                  {authError}
                </Alert>
              )}
            </Stack>
          </Card>
        ) : (
          <Card withBorder padding="lg" radius="md" style={{ flex: '1 1 320px' }}>
            <Stack>
              <Title order={3}>Bonjour {user.username}</Title>
              <Text c="dimmed">Vous êtes connecté. Vous pouvez créer ou rejoindre une partie.</Text>
              <Button variant="subtle" onClick={clearAuth} color="red">
                Se déconnecter
              </Button>
            </Stack>
          </Card>
        )}

        <Card withBorder padding="lg" radius="md" style={{ flex: '1 1 420px' }}>
          <Stack>
            <Title order={3}>Créer une salle</Title>
            <TextInput
              label="Nom de la salle"
              value={roomName}
              onChange={(event) => setRoomName(event.currentTarget.value)}
              placeholder="Nom de votre salle"
              disabled={!user}
            />
            <Group grow>
              <NumberInput
                label="Joueurs maximum"
                min={2}
                max={12}
                value={maxPlayers}
                onChange={setMaxPlayers}
                disabled={!user}
              />
              <NumberInput
                label="Durée d'une manche (secondes)"
                min={30}
                max={240}
                value={roundDuration}
                onChange={setRoundDuration}
                disabled={!user}
              />
            </Group>
            <Button onClick={handleCreateRoom} disabled={!canCreate} variant="light">
              Créer
            </Button>
            {!user && (
              <Text size="sm" c="dimmed">
                Connectez-vous pour créer une salle.
              </Text>
            )}
          </Stack>
        </Card>
      </Group>

      <Stack>
        <Group justify="space-between">
          <Title order={3}>Salles publiques</Title>
          <Button
            variant="subtle"
            onClick={() => token && getSocket().emit('room:list')}
            disabled={!token}
          >
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
                  onClick={() => handleJoinRoom(room.id)}
                  disabled={!user}
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

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
  const { user, token, hydrated, setAuth, clearAuth } = useAuthStore((state) => ({
    user: state.user,
    token: state.token,
    hydrated: state.hydrated,
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
  const [pseudo, setPseudo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | undefined>();
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    // Attendre que l'hydratation soit complète et qu'on ait un token
    if (!hydrated || !token) {
      console.log('[Page] Pas encore hydraté ou pas de token');
      return;
    }
    
    const socket = getSocket();
    console.log('[Page] Configuration des listeners, socket.connected:', socket.connected);
    
    const handleRooms = (payload: RoomState[]) => {
      console.log('[Page] Liste des rooms reçue:', payload.length, 'rooms');
      setRooms(payload);
    };
    
    const handleCreated = (payload: { id: string }) => {
      console.log('[Page] Room créée:', payload.id);
      router.push(`/game/${payload.id}`);
    };
    
    const handleAuthError = (payload: { message?: string }) => {
      console.error('[Page] ⚠️ Erreur d\'authentification reçue:', payload);
      console.log('[Page] Socket connecté ?', socket.connected);
      console.log('[Page] Socket ID:', socket.id);
      
      // Afficher l'erreur mais NE PAS vider l'auth immédiatement
      // Il peut s'agir d'une reconnexion temporaire
      setAuthError(payload.message ?? 'Erreur d\'authentification');
      
      // Attendre 2 secondes pour voir si la connexion se rétablit
      setTimeout(() => {
        if (!socket.connected) {
          console.log('[Page] Socket toujours déconnecté après 2s, nettoyage de l\'auth');
          clearAuth();
        } else {
          console.log('[Page] Socket reconnecté, conservation de l\'auth');
          setAuthError(undefined);
        }
      }, 2000);
    };
    
    const handleConnect = () => {
      console.log('[Page] ✅ Socket connecté - attente de room:list du serveur');
      // Le serveur envoie automatiquement room:list après handleConnection
      // Pas besoin de le demander explicitement ici
    };
    
    // Installer les listeners
    socket.on('connect', handleConnect);
    socket.on('room:list', handleRooms);
    socket.on('room:created', handleCreated);
    socket.on('auth:error', handleAuthError);
    
    // Si déjà connecté, le serveur a déjà envoyé room:list
    if (socket.connected) {
      console.log('[Page] Socket déjà connecté');
    }
    
    return () => {
      console.log('[Page] Nettoyage des listeners');
      socket.off('connect', handleConnect);
      socket.off('room:list', handleRooms);
      socket.off('room:created', handleCreated);
      socket.off('auth:error', handleAuthError);
    };
  }, [clearAuth, router, setRooms, token, hydrated]);

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
    if (authMode === 'register') {
      if (!pseudo.trim() || !email.trim() || !password.trim()) {
        setAuthError('Remplissez tous les champs.');
        return;
      }
    } else {
      if (!email.trim() || !password.trim()) {
        setAuthError('Remplissez tous les champs.');
        return;
      }
    }

    setAuthLoading(true);
    setAuthError(undefined);
    try {
      console.log('[Auth] Tentative de', authMode === 'login' ? 'connexion' : 'inscription');
      const payload =
        authMode === 'login'
          ? await login(email.trim(), password)
          : await register(pseudo.trim(), email.trim(), password);
      console.log('[Auth] Authentification réussie:', payload.user);
      setAuth(payload);
      setPseudo('');
      setEmail('');
      setPassword('');
    } catch (error) {
      console.error('[Auth] Erreur:', error);
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
              {authMode === 'register' && (
                <TextInput
                  label="Pseudo"
                  placeholder="Votre pseudo"
                  value={pseudo}
                  onChange={(event) => setPseudo(event.currentTarget.value)}
                  autoComplete="username"
                />
              )}
              {authMode === 'register' && (
                <TextInput
                  label="Adresse email"
                  placeholder="votre@email.com"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  autoComplete="email"
                />
              )}
              {authMode === 'login' && (
                <TextInput
                  label="Email ou pseudo"
                  placeholder="votre@email.com ou votre pseudo"
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  autoComplete="username"
                />
              )}
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
              <Title order={3}>Bonjour {user.pseudo}</Title>
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
                onChange={(v) => setMaxPlayers(typeof v === 'number' ? v : '')}
                disabled={!user}
              />
              <NumberInput
                label="Durée d'une manche (en secondes)"
                min={30}
                max={240}
                value={roundDuration}
                onChange={(v) => setRoundDuration(typeof v === 'number' ? v : '')}
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

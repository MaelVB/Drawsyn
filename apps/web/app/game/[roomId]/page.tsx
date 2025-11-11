'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
  ColorPicker,
  Slider,
  SegmentedControl,
  Box,
  Modal,
  PasswordInput,
  Tabs,
  Divider
} from '@mantine/core';
import { IconInfoCircle, IconBrush, IconPencil, IconBucket } from '@tabler/icons-react';
import LobbySettings from '@/components/LobbySettings';

import { getSocket } from '@/lib/socket';
import { register, login } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useGameStore } from '@/stores/game-store';

interface GuessMessage {
  playerId: string;
  text: string;
}

interface RoundWordPayload {
  word: string;
}

export default function GameRoomPage() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const roomId = params?.roomId;
  const { user, hydrated } = useAuthStore((state) => ({
    user: state.user,
    hydrated: state.hydrated
  }));
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentStroke = useRef<{ x: number; y: number; t: number }[]>([]);
  const hasJoinedRoomRef = useRef(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);

  const { currentRoom, playerId, round, setCurrentRoom, setPlayerId, setRound, updateRoundRemaining } = useGameStore(
    (state) => ({
      currentRoom: state.currentRoom,
      playerId: state.playerId,
      round: state.round,
      setCurrentRoom: state.setCurrentRoom,
      setPlayerId: state.setPlayerId,
      setRound: state.setRound,
      updateRoundRemaining: state.updateRoundRemaining
    })
  );

  const [word, setWord] = useState<string | undefined>();
  const [guesses, setGuesses] = useState<GuessMessage[]>([]);
  const [guessText, setGuessText] = useState('');
  const [error, setError] = useState<string | undefined>();
  
  // États pour les outils de dessin
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(4);
  const [brushType, setBrushType] = useState<'brush' | 'pencil' | 'bucket'>('brush');

  // États pour la modal d'authentification
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authPseudo, setAuthPseudo] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | undefined>();
  const [authLoading, setAuthLoading] = useState(false);

  const isDrawer = useMemo(() => round && playerId ? round.drawerId === playerId : false, [round, playerId]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const drawPoints = useCallback((points: { x: number; y: number }[], color: string, size: number = 4, type: 'brush' | 'pencil' | 'bucket' = 'brush') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    
    if (type === 'pencil') {
      // Crayon pixelisé - pas d'antialiasing
      ctx.imageSmoothingEnabled = false;
      ctx.lineJoin = 'miter';
      ctx.lineCap = 'square';
    } else {
      // Pinceau classique - lisse
      ctx.imageSmoothingEnabled = true;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
    }
    
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();
  }, []);

  useEffect(() => {
    // N'installer les listeners que si l'utilisateur est authentifié
    if (!hydrated || !user) {
      console.log('[GameRoom] Attente de l\'hydratation...', { hydrated, user: !!user });
      return;
    }

    const socket = getSocket();
    console.log('[GameRoom] 🎬 Installation des listeners, socket.connected:', socket.connected, 'socket.id:', socket.id);

    const handleRoomJoined = (payload: { room: any; playerId: string }) => {
      console.log('[GameRoom] ✅ Salle rejointe avec succès:', payload.room.name);

      setCurrentRoom(payload.room);
      setPlayerId(payload.playerId);
      setError(undefined); // Effacer toute erreur d'auth précédente
      setIsJoiningRoom(false);
      
      // Effacer le canvas seulement si aucun round en cours (lobby)
      // Si un round est en cours, on va recevoir round:started qui synchronisera l'état
      if (!payload.room.round) {
        console.log('[GameRoom] Pas de round en cours - canvas effacé');
        clearCanvas();
      } else {
        console.log('[GameRoom] Round en cours - canvas conservé (sera synchronisé)');
      }
    };

    const handleRoomState = (payload: any) => {
      console.log('[GameRoom] 🔄 Mise à jour de l\'état de la room:', payload.name, '- Joueurs:', Object.values(payload.players).map((p: any) => `${p.name}(${p.connected ? '✓' : '✗'})`).join(', '));
      setCurrentRoom(payload);
    };

    const handleRoundStarted = (payload: any) => {
      console.log('[GameRoom] 🎨 Round started - drawerId:', payload.drawerId);
      
      setRound({
        drawerId: payload.drawerId,
        roundEndsAt: payload.roundEndsAt,
        revealed: payload.revealed
      });
      setWord(undefined);
      
      // Ne PAS effacer le canvas ici - il sera effacé uniquement lors de round:ended
      // Cela permet de conserver le dessin lors d'un F5
    };

    const handleRoundWord = (payload: RoundWordPayload) => {
      setWord(payload.word);
    };

    const handleRoundEnded = (payload: any) => {
      setRound(undefined);
      setWord(undefined);
      if (payload.room) {
        setCurrentRoom(payload.room);
      }
      if (payload.reason === 'all-guessed' || payload.word) {
        setGuesses((messages) => [
          ...messages,
          {
            playerId: 'system',
            text: `Mot: ${payload.word} — fin de manche (${payload.reason === 'timeout' ? 'temps écoulé' : 'tout le monde a trouvé'})`
          }
        ]);
      }
      clearCanvas();
    };

    const handleTimerTick = (payload: { remaining: number }) => {
      updateRoundRemaining(payload.remaining);
    };

    const handleGuessCorrect = (payload: { playerId: string; word: string }) => {
      setGuesses((messages) => [
        ...messages,
        {
          playerId: payload.playerId,
          text: `a trouvé le mot !`
        }
      ]);
    };

    const handleGuessSubmitted = (payload: GuessMessage) => {
      setGuesses((messages) => [...messages, payload]);
    };

    const handleRoundCancelled = () => {
      setRound(undefined);
      setWord(undefined);
      setGuesses((messages) => [
        ...messages,
        {
          playerId: 'system',
          text: "Le dessinateur a quitté la partie. Nouvelle manche bientôt."
        }
      ]);
      clearCanvas();
    };

    const handleRoomError = (payload: { message: string }) => {
      console.error('[GameRoom] ❌ Erreur room:', payload.message);
      setError(payload.message);
      setIsJoiningRoom(false);
      
      // Si la room n'existe plus, retourner au lobby
      if (payload.message.includes('not found') || payload.message.includes('existe plus')) {
        console.log('[GameRoom] Room introuvable, retour au lobby');
        setTimeout(() => router.replace('/'), 2000);
      }
    };

    const handleRoomClosed = () => {
      setError("La salle n'existe plus");
      setCurrentRoom(undefined);
      setRound(undefined);
      router.replace('/');
    };

    const handleDrawSegment = (payload: { points: { x: number; y: number }[], color?: string, size?: number, type?: 'brush' | 'pencil' | 'bucket' }) => {
      drawPoints(payload.points, payload.color || '#4dabf7', payload.size || 4, payload.type || 'brush');
    };
    
    const handleDrawFill = (payload: { color: string }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = payload.color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const handleAuthError = (payload: { message?: string }) => {
      console.error('[GameRoom] ⚠️ Erreur d\'authentification reçue:', payload);
      
      // Ignorer les erreurs d'auth pendant qu'on essaie de rejoindre
      // (probablement dues à l'ancien socket pendant le F5)
      if (isJoiningRoom) {
        console.log('[GameRoom] Erreur d\'auth ignorée - reconnexion en cours');
        return;
      }
      
      const socket = getSocket();
      console.log('[GameRoom] Socket.connected:', socket.connected, '- Socket.id:', socket.id);
      
      // Attendre un peu pour voir si c'est juste une reconnexion
      setTimeout(() => {
        if (!socket.connected) {
          console.log('[GameRoom] Socket toujours déconnecté après 1s - affichage de l\'erreur');
          setError(payload.message ?? 'Authentification requise');
          // Ne pas vider l'auth immédiatement, laisser l'utilisateur réessayer
        } else {
          console.log('[GameRoom] Socket reconnecté - erreur ignorée');
        }
      }, 1000);
    };

    const handleConnect = () => {
      console.log('[GameRoom] 🔌 Socket connecté, attente de la validation auth par le serveur...');
      // Ne PAS émettre room:join ici - attendre room:list du serveur
      // qui indique que l'authentification est validée
    };

    const handleRoomList = () => {
      console.log('[GameRoom] ✅ room:list reçu - authentification validée par le serveur');
      // Rejoindre la room seulement UNE FOIS
      if (!hasJoinedRoomRef.current && !currentRoom) {
        console.log('[GameRoom] Émission de room:join pour roomId:', roomId);
        hasJoinedRoomRef.current = true;
        setIsJoiningRoom(true);
        socket.emit('room:join', { roomId });
      } else {
        console.log('[GameRoom] room:join déjà émis, ignoré');
      }
    };

    const handleDisconnect = (reason: string) => {
      console.warn('[GameRoom] 🔌 Socket déconnecté:', reason);
      setIsJoiningRoom(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('room:list', handleRoomList);
    socket.on('room:joined', handleRoomJoined);
    socket.on('room:state', handleRoomState);
    socket.on('round:started', handleRoundStarted);
    socket.on('round:word', handleRoundWord);
    socket.on('round:ended', handleRoundEnded);
    socket.on('round:cancelled', handleRoundCancelled);
    socket.on('guess:submitted', handleGuessSubmitted);
  socket.on('room:error', handleRoomError);
    socket.on('room:closed', handleRoomClosed);
    socket.on('draw:segment', handleDrawSegment);
    socket.on('draw:fill', handleDrawFill);
    socket.on('auth:error', handleAuthError);
  socket.on('timer:tick', handleTimerTick);
  socket.on('guess:correct', handleGuessCorrect);

    // Si le socket est déjà connecté au moment du montage
    console.log('[GameRoom] 🔍 Vérification état socket:', {
      connected: socket.connected,
      id: socket.id,
      auth: socket.auth,
      roomId,
      timestamp: new Date().toISOString()
    });
    
    if (socket.connected) {
      console.log('[GameRoom] 🚀 Socket déjà connecté au montage');
      // Demander explicitement room:list pour déclencher le flux d'authentification
      socket.emit('room:list');
    } else {
      console.log('[GameRoom] ⏳ Socket pas encore connecté, attente de l\'événement connect...');
    }

    return () => {
      console.log('[GameRoom] Nettoyage des listeners');
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('room:list', handleRoomList);
      socket.off('room:joined', handleRoomJoined);
      socket.off('room:state', handleRoomState);
      socket.off('round:started', handleRoundStarted);
      socket.off('round:word', handleRoundWord);
      socket.off('round:ended', handleRoundEnded);
      socket.off('round:cancelled', handleRoundCancelled);
      socket.off('guess:submitted', handleGuessSubmitted);
      socket.off('room:error', handleRoomError);
      socket.off('room:closed', handleRoomClosed);
      socket.off('draw:segment', handleDrawSegment);
      socket.off('draw:fill', handleDrawFill);
  socket.off('auth:error', handleAuthError);
  socket.off('timer:tick', handleTimerTick);
  socket.off('guess:correct', handleGuessCorrect);
      hasJoinedRoomRef.current = false;
    };
  }, [clearAuth, clearCanvas, drawPoints, roomId, router, setCurrentRoom, setPlayerId, setRound, user, hydrated, isJoiningRoom]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Gérer le seau (remplissage)
    if (brushType === 'bucket') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Remplissage simple de tout le canvas
      ctx.fillStyle = brushColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Émettre l'action de remplissage
      if (roomId) {
        getSocket().emit('draw:fill', { roomId, color: brushColor });
      }
      return;
    }
    
    currentStroke.current = [{ x, y, t: Date.now() }];
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || currentStroke.current.length === 0 || brushType === 'bucket') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const point = { x, y, t: Date.now() };
    const updated = [...currentStroke.current, point];
    currentStroke.current = updated;
    
    // Dessiner localement avec les paramètres choisis
    drawPoints(updated.slice(-2), brushColor, brushSize, brushType);
    
    // Émettre en temps réel les points aux autres joueurs
    if (roomId) {
      const socket = getSocket();
      socket.emit('draw:segment', { 
        roomId, 
        points: updated.slice(-2),
        color: brushColor,
        size: brushSize,
        type: brushType
      });
    }
  };

  const handlePointerUp = () => {
    if (!isDrawer || currentStroke.current.length === 0 || !roomId) return;
    // Réinitialiser le trait en cours (plus besoin d'envoyer ici car déjà envoyé en temps réel)
    currentStroke.current = [];
  };

  const handleSubmitGuess = () => {
    if (!guessText.trim() || !roomId) return;
    getSocket().emit('guess:submit', { roomId, text: guessText });
    setGuesses((messages) => [
      ...messages,
      {
        playerId: playerId ?? 'self',
        text: guessText.trim()
      }
    ]);
    setGuessText('');
  };

  useEffect(() => {
    clearCanvas();
  }, [clearCanvas]);

  const handleLeaveRoom = () => {
    getSocket().emit('room:leave');
    setCurrentRoom(undefined);
    setRound(undefined);
    setIsJoiningRoom(false);
    router.push('/');
  };

  const setAuth = useAuthStore((state) => state.setAuth);

  // Afficher la modal d'authentification si pas connecté
  useEffect(() => {
    if (!hydrated) return;
    
    if (!user) {
      console.log('[GameRoom] 🔑 Pas d\'utilisateur, affichage de la modal de connexion');
      setShowAuthModal(true);
    }
  }, [hydrated, user]);

  const handleAuth = async () => {
    setAuthError(undefined);
    setAuthLoading(true);

    try {
      if (authMode === 'register') {
        if (!authPseudo || !authEmail || !authPassword) {
          setAuthError('Tous les champs sont requis');
          setAuthLoading(false);
          return;
        }
  const response = await register(authPseudo, authEmail, authPassword);
        console.log('[GameRoom] ✅ Compte créé:', authPseudo);
        setAuth(response);
        setShowAuthModal(false);
      } else {
        if (!authEmail || !authPassword) {
          setAuthError('Email/pseudo et mot de passe requis');
          setAuthLoading(false);
          return;
        }
  const response = await login(authEmail, authPassword);
        console.log('[GameRoom] ✅ Connecté:', response.user.pseudo);
        setAuth(response);
        setShowAuthModal(false);
      }
    } catch (error: any) {
      console.error('[GameRoom] ❌ Erreur auth:', error);
      setAuthError(error.response?.data?.message || error.message || 'Erreur de connexion');
    } finally {
      setAuthLoading(false);
    }
  };

  if (!roomId || !hydrated) {
    return null;
  }

  return (
    <>
      {/* Modal d'authentification */}
      <Modal
        opened={showAuthModal}
        onClose={() => {}}
        title="Connexion requise"
        closeOnClickOutside={false}
        closeOnEscape={false}
        withCloseButton={false}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Vous devez être connecté pour rejoindre cette partie
          </Text>

          <Tabs value={authMode} onChange={(value) => setAuthMode(value as 'login' | 'register')}>
            <Tabs.List grow>
              <Tabs.Tab value="login">Connexion</Tabs.Tab>
              <Tabs.Tab value="register">Inscription</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="login" pt="md">
              <Stack gap="sm">
                <TextInput
                  label="Email ou Pseudo"
                  placeholder="votre@email.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                />
                <PasswordInput
                  label="Mot de passe"
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                />
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="register" pt="md">
              <Stack gap="sm">
                <TextInput
                  label="Pseudo"
                  placeholder="VotrePseudo"
                  value={authPseudo}
                  onChange={(e) => setAuthPseudo(e.currentTarget.value)}
                />
                <TextInput
                  label="Email"
                  placeholder="votre@email.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.currentTarget.value)}
                />
                <PasswordInput
                  label="Mot de passe"
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                />
              </Stack>
            </Tabs.Panel>
          </Tabs>

          {authError && (
            <Alert color="red" icon={<IconInfoCircle size={16} />}>
              {authError}
            </Alert>
          )}

          <Group grow>
            <Button
              variant="default"
              onClick={() => router.push('/')}
            >
              Retour
            </Button>
            <Button
              onClick={handleAuth}
              loading={authLoading}
            >
              {authMode === 'login' ? 'Se connecter' : "S'inscrire"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Contenu de la room */}
      {user && (
    <Stack p="lg" gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>{currentRoom?.name ?? 'Salle de jeu'}</Title>
          <Text c="dimmed">
            {currentRoom?.currentRound === currentRoom?.totalRounds && !round
              ? 'Jeu terminé'
              : round
                ? 'Manche en cours'
                : 'En attente'}
          </Text>
        </div>
        <Button variant="subtle" onClick={handleLeaveRoom}>
          Quitter
        </Button>
      </Group>

      {error && (
        <Alert icon={<IconInfoCircle size={16} />} color="red" title="Oops">
          {error}
        </Alert>
      )}

      <Group align="flex-start" justify="center" gap="lg" wrap="nowrap">
        {/* Colonne de gauche - Joueurs */}
        <Card withBorder padding="md" radius="md" style={{ width: 250, flexShrink: 0 }}>
          <Title order={4} ta="center">Joueurs</Title>
          <Divider my="md" />
          <Stack gap={8} mt="sm">
            {currentRoom &&
              Object.values(currentRoom.players).map((player) => (
                <Group key={player.id} justify="space-between" opacity={player.connected ? 1 : 0.5}>
                  <Group gap={4} align="center">
                    <Text size="sm" fw={playerId === player.id ? 700 : 500}>{player.name}</Text>
                    {round?.drawerId === player.id && <IconBrush size={16} style={{ display: "block", transform: "translateY(1px)" }} />}
                    {!player.connected && <Text size="xs" c="dimmed">(déconnecté)</Text>}
                  </Group>
                  <Stack gap={4} align="flex-end">
                    <Badge variant={playerId === player.id ? 'filled' : 'light'} size="sm">
                      {player.score} pts
                    </Badge>
                  </Stack>
                </Group>
              ))}
          </Stack>
        </Card>

        {/* Centre - Zone dynamique: Canvas ou Lobby Settings */}
        <Stack gap="sm" style={{ flexShrink: 0 }}>
          {round ? (
            <>
              <Card withBorder padding="md" radius="md">
                <Group justify="space-between" align="flex-start" p="lg" >
                  <Text>
                    {`Round ${currentRoom.currentRound}/${currentRoom.totalRounds}`}
                  </Text>
                  {(word || round?.revealed) && (
                    <Text size="24px" fw={700} ta="center" style={{ letterSpacing: "0.2em" }}>
                      {word ? `${word}` : round?.revealed}
                    </Text>
                  )}
                  <Text>{Math.max(0, Math.round((round.roundEndsAt - Date.now()) / 1000))}s</Text>
                </Group>
                <Divider my="md" />
                <canvas
                  ref={canvasRef}
                  width={720}
                  height={480}
                  style={{ touchAction: 'none', borderRadius: 12, cursor: brushType === 'bucket' ? 'pointer' : 'crosshair', backgroundColor: 'white' }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                />
              </Card>
              {isDrawer && (
                <Card withBorder padding="md" radius="md" style={{ width: 720 }}>
                  <Group justify="space-between" align="flex-start">
                    <Box>
                      <Text size="sm" fw={500} mb="xs">Couleur</Text>
                      <ColorPicker 
                        value={brushColor} 
                        onChange={setBrushColor}
                        format="hex"
                        swatches={['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080']}
                      />
                    </Box>
                    <Box style={{ width: 200 }}>
                      <Text size="sm" fw={500} mb="xs">Taille: {brushSize}px</Text>
                      <Slider 
                        value={brushSize}
                        onChange={setBrushSize}
                        min={1}
                        max={24}
                        step={1}
                        marks={[
                          { value: 1, label: '1' },
                          { value: 12, label: '12' },
                          { value: 24, label: '24' }
                        ]}
                      />
                    </Box>
                    <Box>
                      <Text size="sm" fw={500} mb="xs">Type d'outil</Text>
                      <SegmentedControl
                        value={brushType}
                        onChange={(value) => setBrushType(value as 'brush' | 'pencil' | 'bucket')}
                        data={[
                          { 
                            value: 'brush', 
                            label: (
                              <Group gap={4} justify="center">
                                <IconBrush size={16} />
                                <span>Pinceau</span>
                              </Group>
                            )
                          },
                          { 
                            value: 'pencil', 
                            label: (
                              <Group gap={4} justify="center">
                                <IconPencil size={16} />
                                <span>Crayon</span>
                              </Group>
                            )
                          },
                          { 
                            value: 'bucket', 
                            label: (
                              <Group gap={4} justify="center">
                                <IconBucket size={16} />
                                <span>Seau</span>
                              </Group>
                            )
                          }
                        ]}
                      />
                    </Box>
                  </Group>
                </Card>
              )}
            </>
          ) : (
            currentRoom && currentRoom.status === 'lobby' && (
              <LobbySettings room={currentRoom} />
            )
          )}
        </Stack>

        {/* Colonne de droite - Discussion */}
        <Card withBorder padding="md" radius="md" style={{ width: 300, flexShrink: 0 }}>
          <Title order={4} ta="center">{round ? 'Propositions' : 'Lobby & Chat'}</Title>
          <Divider my="md" />
          <Stack gap={6} mt="sm" style={{ maxHeight: 400, overflowY: 'auto' }}>
            {guesses.map((message, index) => (
              <Text key={index} size="sm">
                <strong>
                  {message.playerId === 'system'
                    ? 'Système'
                    : message.playerId === playerId || message.playerId === 'self'
                      ? 'Vous'
                      : currentRoom?.players[message.playerId]?.name ?? '???'}
                  :
                </strong>{' '}
                {message.text}
              </Text>
            ))}
          </Stack>
          <Group mt="md" gap="xs">
            <TextInput
              value={guessText}
              onChange={(event) => setGuessText(event.currentTarget.value)}
              placeholder={round ? 'Votre proposition' : 'Message (la partie n\'a pas commencé)'}
              flex={1}
              disabled={isDrawer || !round}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && round) {
                  event.preventDefault();
                  handleSubmitGuess();
                }
              }}
            />
            <Button onClick={handleSubmitGuess} disabled={isDrawer || !guessText.trim() || !round}>
              Envoyer
            </Button>
          </Group>
        </Card>
      </Group>
    </Stack>
      )}
    </>
  );
}

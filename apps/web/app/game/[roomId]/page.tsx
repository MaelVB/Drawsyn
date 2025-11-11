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
  Box
} from '@mantine/core';
import { IconInfoCircle, IconBrush, IconPencil, IconBucket } from '@tabler/icons-react';

import { getSocket } from '@/lib/socket';
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
  const isMountedRef = useRef(false);

  const { currentRoom, playerId, round, setCurrentRoom, setPlayerId, setRound } = useGameStore(
    (state) => ({
      currentRoom: state.currentRoom,
      playerId: state.playerId,
      round: state.round,
      setCurrentRoom: state.setCurrentRoom,
      setPlayerId: state.setPlayerId,
      setRound: state.setRound
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

  const isDrawer = useMemo(() => round && playerId ? round.drawerId === playerId : false, [round, playerId]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#1a1b1e';
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
    const socket = getSocket();

    const handleRoomJoined = (payload: { room: any; playerId: string }) => {
      setCurrentRoom(payload.room);
      setPlayerId(payload.playerId);
      setError(undefined);
    };

    const handleRoomState = (payload: any) => {
      setCurrentRoom(payload);
    };

    const handleRoundStarted = (payload: any) => {
      setRound({
        drawerId: payload.drawerId,
        roundEndsAt: payload.roundEndsAt,
        revealed: payload.revealed
      });
      setWord(undefined);
      clearCanvas();
      setGuesses([]);
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
      setGuesses((messages) => [
        ...messages,
        {
          playerId: payload.winnerId,
          text: `a trouvé le mot ${payload.word}`
        }
      ]);
      clearCanvas();
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
      setError(payload.message);
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
      setError(payload.message ?? 'Authentification requise');
      clearAuth();
      router.replace('/');
    };

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

    if (!isMountedRef.current && user) {
      socket.emit('room:join', { roomId });
      isMountedRef.current = true;
    }

    return () => {
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
    };
  }, [clearAuth, clearCanvas, drawPoints, roomId, router, setCurrentRoom, setPlayerId, setRound, user]);

  useEffect(() => {
    if (user && roomId && !isMountedRef.current) {
      getSocket().emit('room:join', { roomId });
      isMountedRef.current = true;
    }
  }, [roomId, user]);

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
    router.push('/');
  };

  useEffect(() => {
    if (hydrated && !user) {
      router.replace('/');
    }
  }, [hydrated, router, user]);

  if (!roomId || !hydrated) {
    return null;
  }

  if (!user) {
    return null;
  }

  return (
    <Stack p="lg" gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>{currentRoom?.name ?? 'Salle de jeu'}</Title>
          <Text c="dimmed">Manche {round ? 'en cours' : 'en attente'} · {word ? `Mot: ${word}` : round?.revealed}</Text>
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
          <Title order={4}>Joueurs</Title>
          <Stack gap={8} mt="sm">
            {currentRoom &&
              Object.values(currentRoom.players).map((player) => (
                <Group key={player.id} justify="space-between">
                  <Text size="sm">{player.name}</Text>
                  <Stack gap={4}>
                    {round?.drawerId === player.id && <Badge color="violet" size="xs">Dessine</Badge>}
                    <Badge variant={playerId === player.id ? 'filled' : 'light'} size="sm">
                      {player.score} pts
                    </Badge>
                  </Stack>
                </Group>
              ))}
          </Stack>
        </Card>

        {/* Centre - Zone de dessin */}
        <Stack gap="sm" style={{ flexShrink: 0 }}>
          <Card withBorder padding="sm" radius="md">
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
          
          {/* Panneau d'outils */}
          {isDrawer && (
            <Card withBorder padding="md" radius="md" style={{ width: 720 }}>
              <Group justify="space-between" align="flex-start">
                {/* Couleurs */}
                <Box>
                  <Text size="sm" fw={500} mb="xs">Couleur</Text>
                  <ColorPicker 
                    value={brushColor} 
                    onChange={setBrushColor}
                    format="hex"
                    swatches={['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080']}
                  />
                </Box>
                
                {/* Taille du pinceau */}
                <Box style={{ width: 200 }}>
                  <Text size="sm" fw={500} mb="xs">Taille: {brushSize}px</Text>
                  <Slider 
                    value={brushSize}
                    onChange={setBrushSize}
                    min={1}
                    max={50}
                    step={1}
                    marks={[
                      { value: 1, label: '1' },
                      { value: 25, label: '25' },
                      { value: 50, label: '50' }
                    ]}
                  />
                </Box>
                
                {/* Type de pinceau */}
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
        </Stack>

        {/* Colonne de droite - Discussion */}
        <Card withBorder padding="md" radius="md" style={{ width: 300, flexShrink: 0 }}>
          <Title order={4}>Propositions</Title>
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
              placeholder="Votre proposition"
              flex={1}
              disabled={isDrawer}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleSubmitGuess();
                }
              }}
            />
            <Button onClick={handleSubmitGuess} disabled={isDrawer || !guessText.trim()}>
              Envoyer
            </Button>
          </Group>
        </Card>
      </Group>
    </Stack>
  );
}

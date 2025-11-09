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
  Title
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

import { getSocket } from '@/lib/socket';
import { useGameStore } from '@/stores/game-store';

interface GuessMessage {
  playerId: string;
  text: string;
}

interface RoundWordPayload {
  word: string;
}

function usePlayerName() {
  const [name, setName] = useState<string | undefined>();

  useEffect(() => {
    const saved = localStorage.getItem('drawsyn:name');
    if (saved) {
      setName(saved);
    }
  }, []);

  const update = (value: string) => {
    localStorage.setItem('drawsyn:name', value);
    setName(value);
  };

  return { name, setName: update };
}

export default function GameRoomPage() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const roomId = params?.roomId;
  const { name, setName } = usePlayerName();
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

  const isDrawer = useMemo(() => round && playerId ? round.drawerId === playerId : false, [round, playerId]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#1a1b1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const drawPoints = useCallback((points: { x: number; y: number }[], color: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
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

    const handleDrawSegment = (points: { x: number; y: number }[]) => {
      drawPoints(points, '#4dabf7');
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

    if (!isMountedRef.current && name) {
      socket.emit('room:join', { roomId, name });
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
    };
  }, [clearCanvas, drawPoints, name, roomId, router, setCurrentRoom, setPlayerId, setRound]);

  useEffect(() => {
    if (name && roomId && !isMountedRef.current) {
      getSocket().emit('room:join', { roomId, name });
      isMountedRef.current = true;
    }
  }, [name, roomId]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    currentStroke.current = [{ x, y, t: Date.now() }];
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || currentStroke.current.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const point = { x, y, t: Date.now() };
    const updated = [...currentStroke.current, point];
    currentStroke.current = updated;
    drawPoints(updated.slice(-2), '#82c91e');
  };

  const handlePointerUp = () => {
    if (!isDrawer || currentStroke.current.length === 0 || !roomId) return;
    const socket = getSocket();
    socket.emit('draw:segment', { roomId, points: currentStroke.current });
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

  if (!roomId) {
    return null;
  }

  if (!name) {
    return (
      <Stack maw={640} mx="auto" p="xl">
        <Title order={2}>Choisissez un pseudo</Title>
        <TextInput
          placeholder="Votre pseudo"
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <Button onClick={() => name && getSocket().emit('room:join', { roomId, name })}>
          Rejoindre la partie
        </Button>
      </Stack>
    );
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

      <Group align="flex-start" gap="lg">
        <Card withBorder padding="sm" radius="md">
          <canvas
            ref={canvasRef}
            width={720}
            height={480}
            style={{ touchAction: 'none', borderRadius: 12, backgroundColor: '#1a1b1e' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        </Card>

        <Stack gap="md" style={{ flex: 1 }}>
          <Card withBorder padding="md" radius="md">
            <Title order={4}>Joueurs</Title>
            <Stack gap={8} mt="sm">
              {currentRoom &&
                Object.values(currentRoom.players).map((player) => (
                  <Group key={player.id} justify="space-between">
                    <Text>{player.name}</Text>
                    <Group gap={6}>
                      {round?.drawerId === player.id && <Badge color="violet">Dessine</Badge>}
                      <Badge variant={playerId === player.id ? 'filled' : 'light'}>
                        {player.score} pts
                      </Badge>
                    </Group>
                  </Group>
                ))}
            </Stack>
          </Card>

          <Card withBorder padding="md" radius="md">
            <Title order={4}>Discussion</Title>
            <Stack gap={6} mt="sm" style={{ maxHeight: 240, overflowY: 'auto' }}>
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
            <Group mt="md">
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
        </Stack>
      </Group>
    </Stack>
  );
}

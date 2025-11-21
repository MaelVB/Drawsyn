'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
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
  Divider,
  Flex,
  Paper,
  useComputedColorScheme
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle, IconBrush, IconEraser, IconBucket, IconConfetti, IconDeviceTv, IconEye, IconMessageOff, IconPencil, IconAd } from '@tabler/icons-react';
import PlayerTooltip, { ActiveEffect as PlayerActiveEffect } from '@/components/PlayerTooltip';
import LobbySettings from '@/components/LobbySettings';
import InventoryBar from '@/components/InventoryBar';
import CrtOverlay from '@/components/CrtOverlay';

import { getSocket } from '@/lib/socket';
import { register, login, sendPublicFriendRequest } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useGameStore } from '@/stores/game-store';
import type { PlayerState, PrimaryNotification, ItemId } from '@/stores/game-store';
import { useEffectsStore } from '@/stores/effects-store';

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
  const { user, token, hydrated } = useAuthStore((state) => ({
    user: state.user,
    token: state.token,
    hydrated: state.hydrated
  }));
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const centerCardRef = useRef<HTMLDivElement | null>(null);
  const currentStroke = useRef<{ x: number; y: number; t: number }[]>([]);
  const hasJoinedRoomRef = useRef(false);
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [rightPanelHeight, setRightPanelHeight] = useState<number | 'auto'>('auto');

  const {
    currentRoom,
    playerId,
    round,
    setCurrentRoom,
    setPlayerId,
  setRound,
  updateRoundRemaining,
  updateRoundRevealed,
    primaryNotification,
    setPrimaryNotification
  } = useGameStore(
    (state) => ({
      currentRoom: state.currentRoom,
      playerId: state.playerId,
      round: state.round,
      setCurrentRoom: state.setCurrentRoom,
      setPlayerId: state.setPlayerId,
  setRound: state.setRound,
  updateRoundRemaining: state.updateRoundRemaining,
  updateRoundRevealed: state.updateRoundRevealed,
      primaryNotification: state.primaryNotification,
      setPrimaryNotification: state.setPrimaryNotification
    })
  );

  const [word, setWord] = useState<string | undefined>();
  const [guesses, setGuesses] = useState<GuessMessage[]>([]);
  const [guessText, setGuessText] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [wordChoices, setWordChoices] = useState<string[] | null>(null);
  const [improvInstanceId, setImprovInstanceId] = useState<string | null>(null);
  const [improvWord, setImprovWord] = useState('');
  type ItemCategory = 'visual' | 'support' | 'block' | 'drawing';
  const [itemTargeting, setItemTargeting] = useState<{ instanceId: string; itemId: ItemId; category: ItemCategory } | null>(null);
  const [pendingItemConfirm, setPendingItemConfirm] = useState<{ instanceId: string; itemId: ItemId } | null>(null);
  const [earlyBirdReveal, setEarlyBirdReveal] = useState<string | null>(null);
  const [chatCooldown, setChatCooldown] = useState<number>(0);
  const [drawAssistUntil, setDrawAssistUntil] = useState<number | null>(null);
  const [adBreakState, setAdBreakState] = useState<{ open: boolean; until: number; twitchUrl?: string | null } | null>(null);
  // Equipes: suivi local des joueurs dont l'équipe est connue (en plus de la vôtre)
  const [knownTeamPlayerIds, setKnownTeamPlayerIds] = useState<Set<string>>(new Set());
  
  // Effets actifs sur les joueurs
  interface ActiveEffect {
    effectId: string;
    icon: React.ReactNode;
    expiresAt: number;
    color: string;
  }
  const [playerEffects, setPlayerEffects] = useState<Record<string, ActiveEffect[]>>({});
  
  const startHurry = useEffectsStore((s) => s.startHurry);
  const stopHurry = useEffectsStore((s) => s.stopHurry);
  const startPartyEffect = useEffectsStore((s) => s.startPartyEffect);
  const stopPartyEffect = useEffectsStore((s) => s.stopPartyEffect);
  const startCrtEffect = useEffectsStore((s) => s.startCrtEffect);
  const stopCrtEffect = useEffectsStore((s) => s.stopCrtEffect);
  
  // États pour les outils de dessin
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(8);
  const [brushType, setBrushType] = useState<'brush' | 'eraser' | 'bucket'>('brush');
  // Position du curseur personnalisé (en px relatifs au canvas, non scalés pour le dessin)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });

  // États pour la modal d'authentification
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authPseudo, setAuthPseudo] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | undefined>();
  const [authLoading, setAuthLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerState | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const colorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const altMessageBg = useMemo(() => (colorScheme === 'dark' ? 'var(--mantine-color-dark-5)' : 'var(--mantine-color-gray-2)'), [colorScheme]);
  const primaryNotificationAccent = useMemo(() => {
    if (!primaryNotification) return 'var(--mantine-color-blue-6)';
    switch (primaryNotification.variant) {
      case 'success':
        return 'var(--mantine-color-green-6)';
      case 'warning':
        return 'var(--mantine-color-yellow-5)';
      case 'danger':
        return 'var(--mantine-color-red-6)';
      default:
        return 'var(--mantine-color-blue-6)';
    }
  }, [primaryNotification]);

  const displayedWord = word ? word : (earlyBirdReveal ?? round?.revealed);

  const isDrawer = useMemo(() => round && playerId ? round.drawerId === playerId : false, [round, playerId]);
  const canDraw = useMemo(() => {
    if (isDrawer) return true;
    if (!drawAssistUntil) return false;
    return drawAssistUntil > Date.now();
  }, [isDrawer, drawAssistUntil]);
  // Team du joueur courant
  const viewerTeamId = useMemo(() => {
    if (!currentRoom || !playerId) return undefined;
    return currentRoom.players[playerId]?.teamId;
  }, [currentRoom, playerId]);
  // Index stable T1/T2/... par teamId présent dans la room
  const teamIndexById = useMemo(() => {
    if (!currentRoom?.players) return {} as Record<string, number>;
    const ids = Array.from(
      new Set(
        Object.values(currentRoom.players)
          .map((p: PlayerState) => p.teamId)
          .filter((t): t is string => Boolean(t))
      )
    ).sort();
    const map: Record<string, number> = {};
    ids.forEach((id, i) => (map[id] = i + 1));
    return map;
  }, [currentRoom]);
  const teamColors = ['blue', 'green', 'red', 'grape', 'teal', 'orange', 'violet', 'cyan', 'pink', 'lime'] as const;

  // Affiche la modal d'attente pour les non-dessinateurs quand le dessinateur choisit un mot
  const showWaitingForWordModal = useMemo(() => {
    if (!currentRoom || !playerId) return false;
    if (currentRoom.status !== 'choosing') return false;
    // Utiliser l'état global de la room pour identifier le dessinateur en phase de choix
    if (currentRoom.drawerOrder && typeof currentRoom.currentDrawerIndex === 'number') {
      const drawerId = currentRoom.drawerOrder[currentRoom.currentDrawerIndex] as string | undefined;
      return drawerId !== playerId;
    }
    // Par défaut, afficher aux non-dessinateurs
    return true;
  }, [currentRoom, playerId]);

  const handlePlayerClick = (player: PlayerState) => {
    if (!user) return;
    if (player.id === user.id) return; // pas de demande à soi-même
    setSelectedPlayer(player);
    setProfileModalOpen(true);
  };

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const drawPoints = useCallback((points: { x: number; y: number }[], color: string, size: number = 4, type: 'brush' | 'eraser' | 'bucket' = 'brush') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    // Paramètres communs
    ctx.lineWidth = size;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (type === 'eraser') {
      // Gomme: efface au lieu de dessiner
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
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
    ctx.restore();
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
      setEarlyBirdReveal(null);
      setDrawAssistUntil(null);
      setChatCooldown(0);
      setAdBreakState(null);
      // Fermer la modal de choix si ouverte (ex: usage d'Improvisation)
      setWordChoices(null);
      setImprovInstanceId(null);
      setImprovWord('');
      
      // Ne PAS effacer le canvas ici - il sera effacé uniquement lors de round:ended
      // Cela permet de conserver le dessin lors d'un F5
    };

    const handleRoundWord = (payload: RoundWordPayload) => {
      setWord(payload.word);
    };

    const handleRoundChoose = (payload: { options: string[] }) => {
      // Ne s'affiche que pour le dessinateur (événement privé)
      setWordChoices(payload.options);
    };

    const handleRoundEnded = (payload: any) => {
      // Si nous sommes le dessinateur, capturer le canvas AVANT effacement
      const wasDrawer = round && playerId && round.drawerId === playerId;
      if (wasDrawer && canvasRef.current) {
        try {
          const dataUrl = canvasRef.current.toDataURL('image/png');
          getSocket().emit('drawing:submit', {
            roomId,
            imageData: dataUrl,
            word: payload.word,
            turnIndex: payload.turnIndex
          });
        } catch (e) {
          console.error('[GameRoom] Erreur capture dessin:', e);
        }
      }
      setRound(undefined);
      setWord(undefined);
      setEarlyBirdReveal(null);
      setDrawAssistUntil(null);
      setChatCooldown(0);
      setAdBreakState(null);
      // Nettoyer tous les effets à la fin du round
      setPlayerEffects({});
      stopHurry();
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

    const handlePrimaryNotification = (payload: PrimaryNotification) => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
        notificationTimeoutRef.current = null;
      }
      setPrimaryNotification(payload);
      const duration = Math.max(1200, payload.durationMs ?? 3200);
      notificationTimeoutRef.current = setTimeout(() => {
        setPrimaryNotification(null);
        notificationTimeoutRef.current = null;
      }, duration);
    };

    const handleTimerTick = (payload: { remaining: number; revealed?: string }) => {
      updateRoundRemaining(payload.remaining);
      // Déclenche l'effet d'urgence pour les 5 dernières secondes
      if (payload.remaining > 0 && payload.remaining <= 5) {
        startHurry();
      } else {
        stopHurry();
      }
      // Mettre à jour les lettres révélées si présentes, sans dépendre d'un état potentiellement périmé
      if (payload.revealed) {
        updateRoundRevealed(payload.revealed);
      }
    };

    const handleGuessCorrect = (payload: { playerId: string; word: string; position?: number; earnedPoints?: number; newTimer?: number }) => {
      // Mettre à jour le timer si un nouveau temps est fourni
      if (payload.newTimer && round) {
        setRound({
          ...round,
          roundEndsAt: payload.newTimer
        });
      }
      
      // Afficher le message avec les points gagnés si disponibles
      const message = payload.earnedPoints 
        ? `a trouvé le mot ! (+${payload.earnedPoints} points)`
        : `a trouvé le mot !`;
      
      setGuesses((messages) => [
        ...messages,
        {
          playerId: payload.playerId,
          text: message
        }
      ]);
    };

    const handleGuessSubmitted = (payload: GuessMessage) => {
      setGuesses((messages) => [...messages, payload]);
    };

    const handleRoundCancelled = () => {
      setRound(undefined);
      setWord(undefined);
      stopHurry();
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

    const handleDrawSegment = (payload: { points: { x: number; y: number }[], color?: string, size?: number, type?: 'brush' | 'eraser' | 'bucket' }) => {
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

    const handleItemUsed = (payload: { itemId: string; playerId: string; targetId?: string }) => {
      const state = useGameStore.getState();
      const actorName = state.currentRoom?.players[payload.playerId]?.name ?? 'Un joueur';
      const targetName = payload.targetId ? state.currentRoom?.players[payload.targetId]?.name : undefined;
      const base = `${actorName} a utilisé ${payload.itemId}`;
      const message = targetName ? `${base} sur ${targetName}` : base;
      setGuesses((messages) => [
        ...messages,
        {
          playerId: 'system',
          text: message
        }
      ]);

      // Ajouter l'icône d'effet visible par tous les joueurs
      const targetPlayerId = payload.targetId || payload.playerId;
      
      // Mapper les items aux effets visuels
      const effectMapping: Record<string, { icon: React.ReactNode; color: string; duration: number }> = {
        'party_time': { icon: <IconConfetti size={14} />, color: 'pink', duration: 10000 },
        'crt': { icon: <IconDeviceTv size={14} />, color: 'cyan', duration: 15000 },
        'early_bird': { icon: <IconEye size={14} />, color: 'teal', duration: 3000 },
        'paralysis': { icon: <IconMessageOff size={14} />, color: 'yellow', duration: 10000 },
        'unsolicited_help': { icon: <IconPencil size={14} />, color: 'orange', duration: 15000 },
        'ad_break': { icon: <IconAd size={14} />, color: 'grape', duration: 10000 }
      };

      const effectConfig = effectMapping[payload.itemId];
      if (effectConfig && targetPlayerId) {
        setPlayerEffects((prev) => {
          const existing = prev[targetPlayerId] || [];
          const newEffect: ActiveEffect = {
            effectId: `${payload.itemId}-${Date.now()}`,
            icon: effectConfig.icon,
            expiresAt: Date.now() + effectConfig.duration,
            color: effectConfig.color
          };
          const updated = [...existing, newEffect].slice(-5);
          return { ...prev, [targetPlayerId]: updated };
        });
      }
    };

    // Révélation d'équipes: le serveur peut envoyer une liste de joueurs ou un teamId entier
    const handleTeamsRevealed = (payload: { playerIds?: string[]; teamId?: string }) => {
      setKnownTeamPlayerIds((prev) => {
        const next = new Set(prev);
        if (Array.isArray(payload.playerIds)) {
          payload.playerIds.forEach((id) => next.add(id));
        }
        if (payload.teamId) {
          const room = useGameStore.getState().currentRoom;
          if (room?.players) {
            Object.values(room.players).forEach((p: PlayerState) => {
              if (p.teamId === payload.teamId) next.add(p.id);
            });
          }
        }
        return next;
      });
    };

    const handleEffectPartyTime = (payload: { durationMs?: number; fromPlayerId?: string }) => {
      startPartyEffect(payload.durationMs ?? 10000);
      if (payload.fromPlayerId) {
        const state = useGameStore.getState();
        const fromName = payload.fromPlayerId === playerId
          ? 'Vous'
          : state.currentRoom?.players[payload.fromPlayerId]?.name ?? 'Un joueur';
        if (payload.fromPlayerId !== playerId) {
          notifications.show({
            title: 'Jour de fête',
            message: `${fromName} vous couvre de confettis !`,
            color: 'pink',
            position: 'bottom-right',
            autoClose: 3200
          });
        }
      }
    };

    const handleEffectCrt = (payload: { durationMs?: number; fromPlayerId?: string }) => {
      startCrtEffect(payload.durationMs ?? 15000);
      const state = useGameStore.getState();
      const actorId = payload.fromPlayerId;
      const actorName = actorId ? (actorId === playerId ? 'Vous' : state.currentRoom?.players[actorId]?.name ?? 'Un joueur') : 'Un joueur';
      const message = actorId && actorId === playerId
        ? 'Effet CRT activé sur votre écran.'
        : `${actorName} a activé un filtre CRT sur votre canvas.`;
      notifications.show({
        title: 'CRT',
        message,
        color: 'cyan',
        position: 'bottom-right',
        autoClose: 3600
      });
    };

    const handleEffectEarlyBird = (payload: { revealed: string }) => {
      setEarlyBirdReveal(payload.revealed);
      notifications.show({
        title: 'En avance',
        message: 'Une lettre a été révélée pour vous.',
        color: 'teal',
        position: 'bottom-right',
        autoClose: 2600
      });
    };

    const handleEffectParalysis = (payload: { durationMs?: number; fromPlayerId?: string }) => {
      const duration = Math.ceil((payload.durationMs ?? 10000) / 1000);
      setChatCooldown(duration);
      const state = useGameStore.getState();
      const actor = payload.fromPlayerId ? state.currentRoom?.players[payload.fromPlayerId]?.name : undefined;
      notifications.show({
        title: 'Paralysie',
        message: actor ? `${actor} a bloqué votre tchat pendant ${duration}s.` : `Tchat bloqué pendant ${duration}s.`,
        color: 'yellow',
        position: 'bottom-right',
        autoClose: 3200
      });
    };

    const handleEffectUnsolicitedHelp = (payload: { durationMs?: number }) => {
      const until = Date.now() + (payload.durationMs ?? 15000);
      setDrawAssistUntil(until);
      notifications.show({
        title: 'Aide non sollicitée',
        message: 'Vous pouvez dessiner temporairement !',
        color: 'orange',
        position: 'bottom-right',
        autoClose: 3200
      });
    };

    const handleEffectAdBreak = (payload: { durationMs?: number; twitchUrl?: string | null; fromPlayerId?: string }) => {
      const until = Date.now() + (payload.durationMs ?? 10000);
      setAdBreakState({ open: true, until, twitchUrl: payload.twitchUrl });
      const state = useGameStore.getState();
      const actor = payload.fromPlayerId ? state.currentRoom?.players[payload.fromPlayerId]?.name : undefined;
      notifications.show({
        title: 'Page de pub',
        message: actor ? `${actor} vous envoie une publicité.` : 'Une publicité est affichée.',
        color: 'grape',
        position: 'bottom-right',
        autoClose: 2800
      });
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
      // Sécurité: coupe les effets globaux
      stopHurry();
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('room:list', handleRoomList);
    socket.on('room:joined', handleRoomJoined);
    socket.on('room:state', handleRoomState);
    socket.on('round:started', handleRoundStarted);
    socket.on('round:word', handleRoundWord);
  socket.on('round:choose', handleRoundChoose);
    socket.on('round:ended', handleRoundEnded);
    socket.on('notification:primary', handlePrimaryNotification);
    socket.on('game:info', () => {
      // Réservé pour usage futur
    });
    socket.on('game:ended', (payload: { totalRounds: number; scores: any[]; drawings?: any[]; gameId?: string }) => {
      // Fusionner les scores dans currentRoom ou créer un état minimal s'il a disparu
      setCurrentRoom((prev) => {
        if (!prev) {
          const players = Object.fromEntries(
            (payload.scores || []).map((p: any) => [p.id, p])
          );
          return {
            id: 'final',
            name: 'Partie terminée',
            maxPlayers: Object.keys(players).length,
            roundDuration: 0,
            players,
            status: 'ended',
            createdAt: Date.now(),
            drawings: payload.drawings ?? [],
            totalRounds: payload.totalRounds,
            currentRound: payload.totalRounds
          } as any; // cast pour conserver compatibilité
        }
        const mergedPlayers = { ...prev.players };
        (payload.scores || []).forEach((p: any) => {
          if (mergedPlayers[p.id]) {
            mergedPlayers[p.id].score = p.score;
            mergedPlayers[p.id].connected = p.connected;
          } else {
            mergedPlayers[p.id] = p;
          }
        });
        return {
          ...prev,
          status: 'ended',
          drawings: payload.drawings ?? prev.drawings,
          players: mergedPlayers
        };
      });
      setGuesses((messages) => [
        ...messages,
        { playerId: 'system', text: 'La partie est terminée !' }
      ]);
    });
    socket.on('round:cancelled', handleRoundCancelled);
    socket.on('guess:submitted', handleGuessSubmitted);
  socket.on('room:error', handleRoomError);
    socket.on('room:closed', handleRoomClosed);
    socket.on('draw:segment', handleDrawSegment);
    socket.on('draw:fill', handleDrawFill);
    socket.on('auth:error', handleAuthError);
  socket.on('timer:tick', handleTimerTick);
  socket.on('guess:correct', handleGuessCorrect);
  socket.on('item:used', handleItemUsed);
  socket.on('teams:revealed', handleTeamsRevealed);
  socket.on('effect:party-time', handleEffectPartyTime);
  socket.on('effect:crt', handleEffectCrt);
    socket.on('effect:early-bird', handleEffectEarlyBird);
    socket.on('effect:paralysis', handleEffectParalysis);
    socket.on('effect:unsolicited-help', handleEffectUnsolicitedHelp);
    socket.on('effect:ad-break', handleEffectAdBreak);

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
  socket.off('round:choose', handleRoundChoose);
  socket.off('round:ended', handleRoundEnded);
      socket.off('notification:primary', handlePrimaryNotification);
  socket.off('game:info');
  socket.off('game:ended');
      socket.off('round:cancelled', handleRoundCancelled);
      socket.off('guess:submitted', handleGuessSubmitted);
      socket.off('room:error', handleRoomError);
      socket.off('room:closed', handleRoomClosed);
      socket.off('draw:segment', handleDrawSegment);
      socket.off('draw:fill', handleDrawFill);
  socket.off('auth:error', handleAuthError);
  socket.off('timer:tick', handleTimerTick);
  socket.off('guess:correct', handleGuessCorrect);
  socket.off('item:used', handleItemUsed);
  socket.off('teams:revealed', handleTeamsRevealed);
  socket.off('effect:party-time', handleEffectPartyTime);
  socket.off('effect:crt', handleEffectCrt);
      socket.off('effect:early-bird', handleEffectEarlyBird);
      socket.off('effect:paralysis', handleEffectParalysis);
      socket.off('effect:unsolicited-help', handleEffectUnsolicitedHelp);
      socket.off('effect:ad-break', handleEffectAdBreak);
      hasJoinedRoomRef.current = false;
    };
  }, [clearAuth, clearCanvas, drawPoints, roomId, router, setCurrentRoom, setPlayerId, setRound, user, hydrated, isJoiningRoom, startPartyEffect, startCrtEffect, playerId]);

  // Initialiser les équipes connues: au début, uniquement les membres de ma propre équipe
  useEffect(() => {
    if (!currentRoom?.players || !playerId) {
      setKnownTeamPlayerIds(new Set());
      return;
    }
    const myTeam = currentRoom.players[playerId]?.teamId;
    if (!myTeam) {
      setKnownTeamPlayerIds(new Set());
      return;
    }
    const initial = new Set<string>();
    Object.values(currentRoom.players).forEach((p: PlayerState) => {
      if (p.teamId === myTeam) initial.add(p.id);
    });
    setKnownTeamPlayerIds(initial);
  }, [currentRoom, playerId]);

  // Nettoyer les effets expirés
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setPlayerEffects((prev) => {
        const updated = { ...prev };
        let hasChanges = false;
        
        for (const playerId in updated) {
          const filtered = updated[playerId].filter(effect => effect.expiresAt > now);
          if (filtered.length !== updated[playerId].length) {
            hasChanges = true;
            if (filtered.length === 0) {
              delete updated[playerId];
            } else {
              updated[playerId] = filtered;
            }
          }
        }
        
        return hasChanges ? updated : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (chatCooldown <= 0) return;
    const interval = setInterval(() => {
      setChatCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [chatCooldown]);

  useEffect(() => {
    if (!adBreakState?.open) return;
    const tick = setInterval(() => {
      setAdBreakState((state) => {
        if (!state) return null;
        if (state.until <= Date.now()) return null;
        return state;
      });
    }, 500);
    const timeout = setTimeout(() => setAdBreakState(null), Math.max(0, (adBreakState.until ?? Date.now()) - Date.now()));
    return () => {
      clearInterval(tick);
      clearTimeout(timeout);
    };
  }, [adBreakState]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = event.currentTarget.width / rect.width;
    const scaleY = event.currentTarget.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    // Met à jour la position du curseur (non scalée) pour feedback immédiat
    setCursorPos({ x: event.clientX - rect.left, y: event.clientY - rect.top, visible: brushType !== 'bucket' });
    
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
    if (!canDraw) return;
    const rect = event.currentTarget.getBoundingClientRect();
    // Toujours mettre à jour la position du curseur (non scalée) tant que l'utilisateur est dessinateur
    if (brushType !== 'bucket') {
      setCursorPos({ x: event.clientX - rect.left, y: event.clientY - rect.top, visible: true });
    } else {
      // Pas de curseur personnalisé pour le seau
      setCursorPos((prev) => ({ ...prev, visible: false }));
    }

    // Si pas de trait en cours ou seau, ne pas dessiner mais garder le suivi du curseur
    if (currentStroke.current.length === 0 || brushType === 'bucket') return;

    const scaleX = event.currentTarget.width / rect.width;
    const scaleY = event.currentTarget.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    const point = { x, y, t: Date.now() };
    const updated = [...currentStroke.current, point];
    currentStroke.current = updated;

    drawPoints(updated.slice(-2), brushColor, brushSize, brushType);

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
    if (!canDraw) return;
    // Masque le curseur personnalisé quand le pointeur quitte / relâche (sera réaffiché au prochain mouvement)
    setCursorPos((prev) => ({ ...prev, visible: false }));
    if (currentStroke.current.length === 0 || !roomId) return;
    currentStroke.current = [];
  };

  // Synchroniser la hauteur du panneau de droite avec la carte centrale (canvas)
  useLayoutEffect(() => {
    const updateHeight = () => {
      if (centerCardRef.current) {
        setRightPanelHeight(centerCardRef.current.offsetHeight);
      } else {
        setRightPanelHeight('auto');
      }
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [round, word, guesses.length]);

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

  const handleBeginTargeting = useCallback((payload: { instanceId: string; itemId: ItemId; category: ItemCategory }) => {
    setItemTargeting(payload);
  }, []);

  const handleCancelTargeting = useCallback(() => {
    setItemTargeting(null);
  }, []);

  const handleConfirmItemUse = useCallback(() => {
    if (!pendingItemConfirm) return;
    const socket = getSocket();
    socket.emit('item:use', { instanceId: pendingItemConfirm.instanceId });
    const label = pendingItemConfirm.itemId === 'early_bird'
      ? 'En avance'
      : 'Aide non sollicitée';
    notifications.show({
      title: label,
      message: 'Item utilisé.',
      color: 'teal',
      position: 'bottom-right',
      autoClose: 2500
    });
    setPendingItemConfirm(null);
  }, [pendingItemConfirm]);

  const handleCancelConfirm = useCallback(() => setPendingItemConfirm(null), []);

  const handleTargetClick = useCallback((target: PlayerState) => {
    if (!itemTargeting) return;
    if (!playerId) {
      setItemTargeting(null);
      notifications.show({
        title: 'Item',
        message: 'Votre session a expiré, reconnectez-vous pour utiliser cet item.',
        color: 'red',
        position: 'bottom-right',
        autoClose: 3500
      });
      return;
    }
    if (!target.connected) {
      notifications.show({
        title: 'Item',
        message: `${target.name} est déconnecté, choisissez un autre joueur.`,
        color: 'yellow',
        position: 'bottom-right',
        autoClose: 2800
      });
      return;
    }
    if (target.id === playerId) {
      notifications.show({
        title: 'Item',
        message: 'Vous devez cibler un autre joueur.',
        color: 'yellow',
        position: 'bottom-right',
        autoClose: 2600
      });
      return;
    }

    const socket = getSocket();
    const { instanceId, itemId, category } = itemTargeting;
    if (itemId === 'party_time' || itemId === 'crt' || itemId === 'paralysis' || itemId === 'ad_break' || itemId === 'spy') {
      socket.emit('item:use', { instanceId, params: { targetId: target.id } });
      notifications.show({
        title: 'Item',
        message: `Vous avez utilisé l'item sur ${target.name}.`,
        color: 'teal',
        position: 'bottom-right',
        autoClose: 3500
      });
    } else {
      const color = category === 'visual' ? 'pink' : category === 'support' ? 'green' : category === 'block' ? 'yellow' : category === 'drawing' ? 'orange' : 'blue';
      notifications.show({
        title: 'Bientôt disponible',
        message: "L'utilisation de cet item n'est pas encore disponible.",
        color,
        position: 'bottom-right',
        autoClose: 3500
      });
    }
    setItemTargeting(null);
  }, [itemTargeting, playerId]);

  // Ciblage CRT fusionné dans handleTargetClick

  useEffect(() => {
    clearCanvas();
  }, [clearCanvas]);

  useEffect(() => {
    if (!itemTargeting) return;
    if (!currentRoom || !playerId) {
      setItemTargeting(null);
      return;
    }
    const hasOtherConnected = Object.values(currentRoom.players || {}).some(
      (p: PlayerState) => p.id !== playerId && p.connected
    );
    if (!hasOtherConnected) {
      setItemTargeting(null);
    }
  }, [itemTargeting, currentRoom, playerId]);

  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
        notificationTimeoutRef.current = null;
      }
      setPrimaryNotification(null);
    };
  }, [setPrimaryNotification]);

  const handleLeaveRoom = () => {
    getSocket().emit('room:leave');
    setCurrentRoom(undefined);
    setRound(undefined);
    setIsJoiningRoom(false);
    stopHurry(); // TODO : faire une fonction qui enelève tous les effets au lieu de faire une fonction par effet
    stopPartyEffect();
    stopCrtEffect();
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
      {/* Modal de choix du mot pour le dessinateur */}
      <Modal
        opened={!!wordChoices}
        onClose={() => {}}
        title={improvInstanceId ? 'Improvisation' : 'Choisissez un mot'}
        closeOnClickOutside={false}
        closeOnEscape={false}
        withCloseButton={false}
        centered
      >
        {improvInstanceId ? (
          <Stack gap="md">
            <Text size="sm" c="dimmed">Entrez un mot personnalisé (2-20 lettres). Utilisation de l'item Improvisation.</Text>
            <TextInput
              placeholder="Votre mot"
              value={improvWord}
              maxLength={20}
              onChange={(e) => setImprovWord(e.currentTarget.value.slice(0,20))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && improvWord.trim().length >= 2 && improvWord.trim().length <= 20) {
                  if (!improvInstanceId) return;
                  getSocket().emit('item:use', { instanceId: improvInstanceId, params: { word: improvWord.trim() } });
                }
              }}
            />
            <Group justify="space-between">
              <Button variant="default" onClick={() => { setImprovInstanceId(null); setImprovWord(''); }}>Retour</Button>
              <Button
                disabled={improvWord.trim().length < 2 || improvWord.trim().length > 20}
                onClick={() => {
                  if (!improvInstanceId) return;
                  getSocket().emit('item:use', { instanceId: improvInstanceId, params: { word: improvWord.trim() } });
                }}
              >
                Valider
              </Button>
            </Group>
          </Stack>
        ) : (
          <Stack gap="md">
            <Text size="sm" c="dimmed">Sélectionnez l'un des 3 mots, ou utilisez l'item Improvisation depuis votre inventaire.</Text>
            <Group grow>
              {wordChoices?.map((w) => (
                <Button key={w} onClick={() => {
                  if (!roomId) return;
                  getSocket().emit('round:word-chosen', { word: w });
                  setWordChoices(null);
                }}>
                  {w}
                </Button>
              ))}
            </Group>
          </Stack>
        )}
      </Modal>

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

      {/* Modal d'attente du choix du mot par le dessinateur */}
      <Modal
        opened={!!showWaitingForWordModal}
        onClose={() => {}}
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
        centered
      >
        <Text size="lg" ta="center">
          Le dessinateur est en train de choisir le prochain mot…
        </Text>
      </Modal>

  {primaryNotification && (
        <Box
          style={{
            position: 'fixed',
            top: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            pointerEvents: 'none'
          }}
        >
          <Paper
            shadow="xl"
            radius="xl"
            px="xl"
            py="sm"
            style={{
              background: colorScheme === 'dark' ? 'rgba(26, 27, 30, 0.92)' : 'rgba(255, 255, 255, 0.95)',
              border: `2px solid ${primaryNotificationAccent}`,
              color: colorScheme === 'dark' ? 'var(--mantine-color-gray-0)' : 'var(--mantine-color-dark-9)',
              textAlign: 'center',
              minWidth: 280,
              pointerEvents: 'none',
              boxShadow: `0 12px 30px rgba(0,0,0,0.2), 0 0 0 1px ${primaryNotificationAccent}`,
              letterSpacing: '0.12em',
              textTransform: 'uppercase'
            }}
          >
            <Text fw={700} size="lg">
              {primaryNotification.message}
            </Text>
          </Paper>
        </Box>
      )}

      {/* Contenu de la room */}
      {user && (
        <Stack p="lg" gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>{currentRoom?.name ?? 'Salle de jeu'}</Title>
          <Text c="dimmed">
            {(currentRoom?.currentRound ?? 0) >= (currentRoom?.totalRounds ?? 0) && !round
              ? 'Jeu terminé'
              : round
                ? `Manche en cours - Round ${currentRoom?.currentRound ?? 0}/${currentRoom?.totalRounds ?? 0}`
                : 'En attente'}
          </Text>
        </div>
        <Button variant="light" onClick={handleLeaveRoom}>
          Quitter
        </Button>
      </Group>

      {error && (
        <Alert icon={<IconInfoCircle size={16} />} color="red" title="Oops">
          {error}
        </Alert>
      )}

      <Modal
        opened={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        title={selectedPlayer ? `Profil de ${selectedPlayer.name}` : 'Profil joueur'}
      >
        {selectedPlayer && (
          <Stack>
            <Text size="sm" c="dimmed">
              Score actuel : {selectedPlayer.score} pts
            </Text>

            <Button
              disabled={!token || !user || selectedPlayer.id === user.id}
              onClick={async () => {
                if (!token || !user) return;
                try {
                  await sendPublicFriendRequest(token, selectedPlayer.id);
                  notifications.show({
                    title: 'Demande envoyée',
                    message:
                      "La demande d'ami a été créée ou est en attente de confirmation.",
                    color: 'blue'
                  });
                  setProfileModalOpen(false);
                } catch (e) {
                  notifications.show({
                    title: 'Erreur',
                    message: (e as Error).message,
                    color: 'red'
                  });
                }
              }}
            >
              Envoyer une demande de connexion
            </Button>
          </Stack>
        )}
      </Modal>
      <Group align="flex-start" justify="center" gap="lg" wrap="nowrap">
        {/* Colonne de gauche - Joueurs */}
        <Card withBorder padding="md" radius="md" style={{ width: 250, flexShrink: 0 }}>
          <Title order={4} ta="center">Joueurs</Title>
          <Text ta="center" size="sm" c="dimmed" mt={4}>
            {currentRoom?.connectedPlayers ?? 0} / {currentRoom?.maxPlayers ?? 0} connectés
          </Text>
          <Divider my="md" />
          <Stack gap={8}>
            {currentRoom?.players &&
              Object.values(currentRoom.players).map((player: PlayerState) => {
                const orderNumber = currentRoom.drawerOrder 
                  ? currentRoom.drawerOrder.indexOf(player.id) + 1 
                  : null;
                const canSelectTarget = Boolean(itemTargeting && player.id !== playerId && player.connected);
                const isSelectable = canSelectTarget;
                const outlineColor = itemTargeting?.category === 'visual'
                  ? 'var(--mantine-color-pink-5)'
                  : itemTargeting?.category === 'support'
                  ? 'var(--mantine-color-green-5)'
                  : itemTargeting?.category === 'block'
                  ? 'var(--mantine-color-yellow-5)'
                  : itemTargeting?.category === 'drawing'
                  ? 'var(--mantine-color-orange-5)'
                  : 'var(--mantine-color-blue-5)';
                const shadowColor = itemTargeting?.category === 'visual'
                  ? '0 0 0 2px rgba(255, 120, 203, 0.35)'
                  : itemTargeting?.category === 'support'
                  ? '0 0 0 2px rgba(34, 197, 94, 0.35)'
                  : itemTargeting?.category === 'block'
                  ? '0 0 0 2px rgba(250, 204, 21, 0.35)'
                  : itemTargeting?.category === 'drawing'
                  ? '0 0 0 2px rgba(255, 146, 43, 0.35)'
                  : '0 0 0 2px rgba(76, 110, 245, 0.35)';
                const effectsForPlayer: PlayerActiveEffect[] = (playerEffects[player.id] || []).map(e => ({...e}));
                const teamBadgeEl = (() => { // aperçu rapide dans la ligne (le tooltip aura sa propre logique)
                  const teamsEnabled = (currentRoom?.teamCount ?? 0) > 1;
                  if (!teamsEnabled) return null;
                  const tId = player.teamId;
                  const idx = tId ? teamIndexById[tId] : undefined;
                  const isKnown = Boolean(
                    tId && (
                      player.id === playerId ||
                      (viewerTeamId && tId === viewerTeamId) ||
                      knownTeamPlayerIds.has(player.id)
                    )
                  );
                  if (isKnown && idx) {
                    const color = teamColors[(idx - 1) % teamColors.length];
                    return <Badge size="sm" variant="filled" color={color}>T{idx}</Badge>;
                  }
                  return <Badge size="sm" variant="light" color="gray">?</Badge>;
                })();
                return (
                  <PlayerTooltip
                    key={player.id}
                    player={player}
                    room={currentRoom}
                    roundDrawerId={round?.drawerId}
                    effects={effectsForPlayer}
                    isSelf={player.id === playerId}
                    viewerTeamId={viewerTeamId}
                    knownTeamPlayerIds={knownTeamPlayerIds}
                    teamIndexById={teamIndexById}
                    teamColors={teamColors}
                    drawAssistUntil={drawAssistUntil}
                  >
                  <Stack gap="0px" align="center">
                    <Paper
                      bg={altMessageBg}
                      p={(() => {
                        const count = Object.keys(currentRoom?.players ?? {}).length;
                        if (count >= 1 && count <= 4) return '10px';
                        if (count >= 5 && count <= 6) return '8px';
                        if (count > 6) return '4px';
                        return '8px';
                      })()}
                      radius="md"
                      w="100%"
                      withBorder
                      style={{
                        cursor: isSelectable ? 'pointer' : 'default',
                        outline: isSelectable ? `2px solid ${outlineColor}` : 'none',
                        boxShadow: isSelectable ? shadowColor : '0 0 0 2px rgba(255, 255, 255, 0.35)',
                        transition: 'outline 60ms ease, box-shadow 60ms ease',
                        opacity: player.connected ? 1 : 0.5,
                        zIndex: 5
                      }}
                      onClick={() => {
                        if (canSelectTarget) return handleTargetClick(player);
                      }}
                    >
                      <Group justify="space-between" style={{ gap: 8 }}>
                        <Group gap={4} align="center">
                          {orderNumber && (
                            <Text size="sm" c="dimmed" fw={500}>{orderNumber}.</Text>
                          )}
                          <Text
                            size="sm"
                            fw={playerId === player.id ? 700 : 500}
                            style={{
                              textDecoration:
                                playerId && player.id !== playerId && currentRoom?.players[playerId]?.teamId && player.teamId && currentRoom?.players[playerId]?.teamId === player.teamId
                                  ? 'underline'
                                  : 'none',
                              cursor: user && player.id !== user.id ? 'pointer' : 'default',
                              maxWidth: 130,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'inline-block'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayerClick(player);
                            }}
                          >
                            {player.name}
                          </Text>
                          {!player.connected && <Text size="xs" c="dimmed">(déconnecté)</Text>}
                        </Group>

                        <Group gap={4} align="center">
                          {round?.drawerId === player.id && <IconBrush size={16} style={{ display: "block", transform: "translateY(1px)" }} />}
                          {player.id === playerId && drawAssistUntil && drawAssistUntil > Date.now() && round?.drawerId !== player.id && (
                            <Badge size="xs" color="orange" variant="light" style={{ display: "block", transform: "translateY(0.5px)" }}>Assist.</Badge>
                          )}
                          {currentRoom.hostId === player.id && (
                            <Badge size="xs" color="yellow" variant="light" style={{ display: "block", transform: "translateY(0.5px)" }}>Hôte</Badge>
                          )}
                        </Group>
                      </Group>
                    </Paper>
                    <Paper
                      bg={altMessageBg}
                      p="6px"
                      w="90%"
                      mb="6px"
                      styles={{
                        root: {
                          borderTopLeftRadius: 0,
                          borderTopRightRadius: 0,
                          borderBottomLeftRadius: "0.5rem",
                          borderBottomRightRadius: "0.5rem",
                          paddingTop: 7,
                          paddingBottom: 6,
                          paddingLeft: 6,
                          paddingRight: 6,
                          zIndex: 1
                        },
                      }}
                    >
                      <Flex>
                        <Group gap={4} align="center">
                          {/* Badge d'équipe aperçu rapide */}
                          {teamBadgeEl}
                          <Divider orientation="vertical" color='#424242' />
                        </Group>
                        <Group gap={4} align="center" flex={1} px={4}>
                          {/* Effets actifs (aperçu 3 max, sans timer) */}
                          {effectsForPlayer.slice(0, 3).map((effect) => (
                            <Badge
                              key={effect.effectId}
                              size="sm"
                              radius="sm"
                              variant="filled"
                              color={effect.color}
                              style={{
                                padding: '2px 4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Effet actif"
                            >
                              {effect.icon}
                            </Badge>
                          ))}
                        </Group>
                        <Group gap={4} align="center">
                          <Divider orientation="vertical" color='#424242' />
                          <Badge variant={'light'} size="sm">
                            {player.score} pts
                          </Badge>
                        </Group>
                      </Flex>
                    </Paper>
                  </Stack>
                  </PlayerTooltip>
                );
              })}
          </Stack>
        </Card>

        {/* Centre - Zone dynamique: Canvas ou Lobby Settings */}
        <Stack gap="sm" style={{ flexShrink: 0 }}>
          {currentRoom && currentRoom.status !== 'lobby' && currentRoom.status !== 'ended' ? (
            <>
              <Card withBorder padding="md" radius="md" ref={centerCardRef}>
                {/* En-tête de manche: mot centré, round à gauche, timer à droite sur la même ligne */}
                <Box style={{ position: 'relative', height: 40 }}>
                  {/* Gauche: Round */}
                  <Text
                    size="20px"
                    fw={700}
                    style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)' }}
                  >
                    {`${currentRoom?.currentRound ?? 0}/${currentRoom?.totalRounds ?? 0}`}
                  </Text>

                  {/* Centre: Mot à deviner, reste parfaitement centré */}
                  {displayedWord && (
                    <Text
                      size="24px"
                      fw={700}
                      ta="center"
                      style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', letterSpacing: '0.2em', whiteSpace: 'nowrap' }}
                    >
                      {displayedWord}
                    </Text>
                  )}

                  {/* Droite: Timer */}
                  <Text
                    size="20px"
                    fw={700}
                    style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' }}
                  >
                    {round ? (round.roundEndsAt ? `${Math.max(0, Math.round((round.roundEndsAt - Date.now()) / 1000))}s` : 'Illimité') : ''}
                  </Text>
                </Box>
                <Divider my="md" />
                <Box style={{ position: 'relative', display: 'inline-block' }}>
                  <canvas
                    ref={canvasRef}
                    width={720}
                    height={480}
                    style={{
                      touchAction: 'none',
                      borderRadius: 12,
                      cursor: canDraw ? (brushType === 'bucket' ? 'pointer' : 'none') : 'default',
                      backgroundColor: '#808080'
                    }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                  />
                  <CrtOverlay />
                  {canDraw && cursorPos.visible && brushType !== 'bucket' && (
                    <div
                      style={{
                        position: 'absolute',
                        left: cursorPos.x - brushSize / 2,
                        top: cursorPos.y - brushSize / 2,
                        width: brushSize,
                        height: brushSize,
                        borderRadius: '50%',
                        pointerEvents: 'none',
                        boxSizing: 'border-box',
                        // Pour les couleurs très claires, ajouter une bordure sombre
                        border: (() => {
                          if (brushType === 'eraser') return '1px solid #000';
                          const hex = brushColor.replace('#', '');
                          const r = parseInt(hex.substring(0, 2), 16);
                          const g = parseInt(hex.substring(2, 4), 16);
                          const b = parseInt(hex.substring(4, 6), 16);
                          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                          return luminance > 200 ? '1px solid #000' : '1px solid #fff';
                        })(),
                        background: brushType === 'eraser'
                          ? 'rgba(255,255,255,0.5)'
                          : `${brushColor}50`, // couleur avec légère transparence (hex + 50 ≈ ~31% alpha)
                        transform: 'translateZ(0)'
                        }}
                    />
                  )}
                </Box>
              </Card>
              {canDraw && (
                <Card withBorder padding="md" radius="md">
                  <Flex justify="center" gap="xl">
                    <Box>
                      <Text size="sm" fw={500} mb="xs">Couleur</Text>
                      <ColorPicker 
                        value={brushColor} 
                        onChange={setBrushColor}
                        format="hex"
                      />
                    </Box>
                    <Box style={{ width: 200 }}>
                      <Text size="sm" fw={500} mb="xs">Taille : {brushSize}px</Text>
                      <Slider
                        value={brushSize}
                        onChange={setBrushSize}
                        min={1}
                        max={20}
                        step={1}
                        marks={[
                          { value: 1, label: '1' },
                          { value: 4, label: '4' },
                          { value: 8, label: '8' },
                          { value: 12, label: '12' },
                          { value: 16, label: '16' },
                          { value: 20, label: '20' }
                        ]}
                      />
                      <Box mt="32px">
                        <Flex gap={4}>
                          {/* Colonne 1: Blanc, Gris, Noir */}
                          <Stack gap={4}>
                            <Box
                              onClick={() => setBrushColor('#FFFFFF')}
                              style={{
                                width: 24,
                                height: 24,
                                backgroundColor: '#FFFFFF',
                                border: '1px solid #ccc',
                                cursor: 'pointer',
                                borderRadius: 4
                              }}
                            />
                            <Box
                              onClick={() => setBrushColor('#808080')}
                              style={{
                                width: 24,
                                height: 24,
                                backgroundColor: '#808080',
                                cursor: 'pointer',
                                borderRadius: 4
                              }}
                            />
                            <Box
                              onClick={() => setBrushColor('#000000')}
                              style={{
                                width: 24,
                                height: 24,
                                backgroundColor: '#000000',
                                cursor: 'pointer',
                                borderRadius: 4
                              }}
                            />
                          </Stack>
                          {/* Colonne 2: Rouge */}
                          <Stack gap={4}>
                            <Box
                              onClick={() => setBrushColor('#FF0000')}
                              style={{
                                width: 24,
                                height: 24,
                                backgroundColor: '#FF0000',
                                cursor: 'pointer',
                                borderRadius: 4
                              }}
                            />
                            <Box
                              onClick={() => setBrushColor('#CC0000')}
                              style={{
                                width: 24,
                                height: 24,
                                backgroundColor: '#CC0000',
                                cursor: 'pointer',
                                borderRadius: 4
                              }}
                            />
                            <Box
                              onClick={() => setBrushColor('#8B0000')}
                              style={{
                                width: 24,
                                height: 24,
                                backgroundColor: '#8B0000',
                                cursor: 'pointer',
                                borderRadius: 4
                              }}
                            />
                          </Stack>
                          {/* Colonne 3: Vert */}
                          <Stack gap={4}>
                            <Box
                              onClick={() => setBrushColor('#00FF00')}
                              style={{
                                width: 24,
                                height: 24,
                                backgroundColor: '#00FF00',
                                cursor: 'pointer',
                                borderRadius: 4
                              }}
                            />
                            <Box
                              onClick={() => setBrushColor('#00CC00')}
                              style={{
                                width: 24,
                                height: 24,
                                backgroundColor: '#00CC00',
                                cursor: 'pointer',
                                borderRadius: 4
                              }}
                            />
                            <Box
                              onClick={() => setBrushColor('#006400')}
                              style={{
                                width: 24,
                                height: 24,
                                backgroundColor: '#006400',
                                cursor: 'pointer',
                                borderRadius: 4
                              }}
                            />
                          </Stack>
                          {/* Colonne 4: Bleu */}
                          <Stack gap={4}>
                            <Box
                              onClick={() => setBrushColor('#0000FF')}
                              style={{
                                width: 24,
                                height: 24,
                                backgroundColor: '#0000FF',
                                cursor: 'pointer',
                                borderRadius: 4
                              }}
                            />
                            <Box
                              onClick={() => setBrushColor('#0000CC')}
                              style={{
                                width: 24,
                                height: 24,
                                backgroundColor: '#0000CC',
                                cursor: 'pointer',
                                borderRadius: 4
                              }}
                            />
                            <Box
                              onClick={() => setBrushColor('#00008B')}
                              style={{
                                width: 24,
                                height: 24,
                                backgroundColor: '#00008B',
                                cursor: 'pointer',
                                borderRadius: 4
                              }}
                            />
                          </Stack>
                          {/* Colonne 5: Cyan */}
                          <Stack gap={4}>
                            <Box
                              onClick={() => setBrushColor('#00FFFF')}
                              style={{
                                width: 24,
                                height: 24,
                                backgroundColor: '#00FFFF',
                                cursor: 'pointer',
                                borderRadius: 4
                              }}
                            />
                            <Box
                              onClick={() => setBrushColor('#00CCCC')}
                              style={{
                                width: 24,
                                height: 24,
                                backgroundColor: '#00CCCC',
                                cursor: 'pointer',
                                borderRadius: 4
                              }}
                            />
                            <Box
                              onClick={() => setBrushColor('#008B8B')}
                              style={{
                                width: 24,
                                height: 24,
                                backgroundColor: '#008B8B',
                                cursor: 'pointer',
                                borderRadius: 4
                              }}
                            />
                          </Stack>
                          {/* Colonne 6: Magenta */}
                          <Stack gap={4}>
                            <Box
                              onClick={() => setBrushColor('#FF00FF')}
                              style={{
                                width: 24,
                                height: 24,
                                backgroundColor: '#FF00FF',
                                cursor: 'pointer',
                                borderRadius: 4
                              }}
                            />
                            <Box
                              onClick={() => setBrushColor('#CC00CC')}
                              style={{
                                width: 24,
                                height: 24,
                                backgroundColor: '#CC00CC',
                                cursor: 'pointer',
                                borderRadius: 4
                              }}
                            />
                            <Box
                              onClick={() => setBrushColor('#8B008B')}
                              style={{
                                width: 24,
                                height: 24,
                                backgroundColor: '#8B008B',
                                cursor: 'pointer',
                                borderRadius: 4
                              }}
                            />
                          </Stack>
                          {/* Colonne 7: Jaune */}
                          <Stack gap={4}>
                            <Box
                              onClick={() => setBrushColor('#FFFF00')}
                              style={{
                                width: 24,
                                height: 24,
                                backgroundColor: '#FFFF00',
                                cursor: 'pointer',
                                borderRadius: 4
                              }}
                            />
                            <Box
                              onClick={() => setBrushColor('#CCCC00')}
                              style={{
                                width: 24,
                                height: 24,
                                backgroundColor: '#CCCC00',
                                cursor: 'pointer',
                                borderRadius: 4
                              }}
                            />
                            <Box
                              onClick={() => setBrushColor('#8B8B00')}
                              style={{
                                width: 24,
                                height: 24,
                                backgroundColor: '#8B8B00',
                                cursor: 'pointer',
                                borderRadius: 4
                              }}
                            />
                          </Stack>
                        </Flex>
                      </Box>
                    </Box>
                    <Box>
                      <Text size="sm" fw={500} mb="xs">Type d'outil</Text>
                      <SegmentedControl
                        value={brushType}
                        onChange={(value) => setBrushType(value as 'brush' | 'eraser' | 'bucket')}
                        styles={{
                          root: {
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            width: '100%'
                          },
                          label: {
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 4,
                            lineHeight: 1.1,
                            paddingTop: 6,
                            paddingBottom: 6
                          },
                          control: {
                            height: 'auto',
                            width: '100%'
                          }
                        }}
                        data={[
                          { 
                            value: 'brush', 
                            label: (
                              <Stack gap={2} align="center" justify="center">
                                <IconBrush size={16} />
                                <Text size="xs">Pinceau</Text>
                              </Stack>
                            )
                          },
                          { 
                            value: 'eraser', 
                            label: (
                              <Stack gap={2} align="center" justify="center">
                                <IconEraser size={16} />
                                <Text size="xs">Gomme</Text>
                              </Stack>
                            )
                          },
                          { 
                            value: 'bucket', 
                            label: (
                              <Stack gap={2} align="center" justify="center">
                                <IconBucket size={16} />
                                <Text size="xs">Seau</Text>
                              </Stack>
                            )
                          }
                        ]}
                      />
                    </Box>
                  </Flex>
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
        <Card
          withBorder
          padding="md"
          radius="md"
          style={{
            width: 300,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            height: rightPanelHeight === 'auto' ? 'auto' : `${rightPanelHeight}px`
          }}
        >
          <Title order={4} ta="center">{round ? 'Propositions' : 'Tchat'}</Title>
          {round && (
            <>
              <Text ta="center" size="sm" c="dimmed" mt={4}>
                {(() => {
                  if (!currentRoom?.drawerOrder || !round?.drawerId) return '';
                  const idx = currentRoom.drawerOrder.findIndex((id: string) => id === round.drawerId);
                  return `Dessinateur : Joueur ${idx + 1} - ${currentRoom.players[round.drawerId]?.name ?? ''}`;
                })()}
              </Text>
            </>
          )}
          <Divider my="md" />
          <Stack gap={0} style={{ flex: 1, overflowY: 'auto' }}>
            {guesses.map((message, index) => (
              <Box
                key={index}
                p="xs"
                style={{
                  backgroundColor: index % 2 === 0 ? 'transparent' : altMessageBg,
                  borderRadius: 6
                }}
              >
                <Text size="sm">
                  <strong>
                    {message.playerId === 'system'
                      ? 'Système'
                      : message.playerId === playerId || message.playerId === 'self'
                        ? 'Vous'
                        : currentRoom?.players[message.playerId]?.name ?? '???'}
                    {' : '}
                  </strong>
                  {message.text}
                </Text>
              </Box>
            ))}
          </Stack>
          <Group mt="md" gap="xs">
            {chatCooldown > 0 ? (
              <Paper withBorder p="sm" radius="md" style={{ flex: 1, textAlign: 'center' }}>
                <Text fw={600}>Tchat bloqué : {chatCooldown}s</Text>
              </Paper>
            ) : (
              <>
                <TextInput
                  value={guessText}
                  onChange={(event) => setGuessText(event.currentTarget.value)}
                  placeholder={round ? 'Votre proposition' : 'Message (la partie n\'a pas commencé)'}
                  flex={1}
                  disabled={canDraw || !round}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && round) {
                      event.preventDefault();
                      handleSubmitGuess();
                    }
                  }}
                />
                <Button onClick={handleSubmitGuess} disabled={canDraw || !guessText.trim() || !round}>
                  Envoyer
                </Button>
              </>
            )}
          </Group>
        </Card>
      </Group>
      {/* Section finale: afficher les dessins à la fin du jeu */}
      {currentRoom?.status === 'ended' && currentRoom.drawings && currentRoom.drawings.length > 0 && (
        <Card withBorder padding="md" radius="md">
          <Title order={3} mb="md">Dessins de la partie</Title>
          <Group wrap="wrap" gap="md">
            {currentRoom.drawings.sort((a,b) => a.turnIndex - b.turnIndex).map(d => (
              <Stack key={d.turnIndex} gap={4} style={{ width: 180 }}>
                <Box
                  style={{
                    width: '100%',
                    aspectRatio: '3/2',
                    backgroundColor: '#444',
                    overflow: 'hidden',
                    borderRadius: 8,
                    border: '1px solid var(--mantine-color-gray-4)'
                  }}
                >
                  <img
                    src={d.imageData}
                    alt={d.word}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </Box>
                <Text size="sm" fw={600} ta="center">{d.word}</Text>
                <Text size="xs" c="dimmed" ta="center">par {currentRoom.players[d.drawerId]?.name || 'Inconnu'}</Text>
              </Stack>
            ))}
          </Group>
        </Card>
      )}
    </Stack>
      )}

      <Modal
        opened={!!pendingItemConfirm}
        onClose={handleCancelConfirm}
        title={pendingItemConfirm?.itemId === 'early_bird' ? "Utiliser 'En avance'" : "Utiliser 'Aide non sollicitée'"}
      >
        <Stack>
          <Text>
            {pendingItemConfirm?.itemId === 'early_bird'
              ? 'Révèle instantanément une lettre du mot pour vous. Confirmez-vous ?'
              : 'Vous pourrez dessiner pendant 15 secondes en plus du dessinateur actuel.'}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={handleCancelConfirm}>Annuler</Button>
            <Button onClick={handleConfirmItemUse} color="teal">Confirmer</Button>
          </Group>
        </Stack>
      </Modal>

      {adBreakState?.open && (
        <Modal opened={true} onClose={() => setAdBreakState(null)} withCloseButton={false} centered>
          <Stack align="center" gap="sm">
            <Title order={3}>Page de pub</Title>
            {adBreakState.twitchUrl ? (
              <Text size="sm">Regardez le stream : {adBreakState.twitchUrl}</Text>
            ) : (
              <Text size="sm">Une publicité s'affiche pendant quelques secondes...</Text>
            )}
            <Text c="dimmed" size="sm">Fermeture automatique à la fin du compte à rebours.</Text>
          </Stack>
        </Modal>
      )}

      {/* Barre d'inventaire fixe en bas */}
      <InventoryBar
        onRequestImprovisation={(instanceId) => {
          // N'autoriser que si la modal de choix est ouverte
          if (wordChoices) {
            setImprovInstanceId(instanceId);
            setImprovWord('');
          }
        }}
        onRequestTargeting={(payload) => handleBeginTargeting(payload as any)}
        onRequestConfirmUse={(payload) => setPendingItemConfirm(payload)}
        isTargeting={!!itemTargeting}
        activeTargetInstanceId={itemTargeting?.instanceId ?? null}
        activeTargetCategory={itemTargeting?.category}
        onCancelTargeting={handleCancelTargeting}
      />
    </>
  );
}

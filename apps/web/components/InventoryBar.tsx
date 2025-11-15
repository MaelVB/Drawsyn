'use client';

import { useEffect, useMemo, useState } from 'react';
import { Box, Group, Paper, UnstyledButton, Modal, Title, SimpleGrid, Text, Stack, Badge, Button, Tooltip } from '@mantine/core';
import { 
  IconPin, 
  IconPinFilled, 
  IconBuildingStore, 
  IconBubbleText,
  IconStopwatch,
  IconConfetti,
  IconBolt,
  IconBulbOff,
  IconBrain,
  IconSpy,
  IconCircleDashedMinus,
  IconGitCherryPick,
  IconDeviceTv,
  IconWriting,
  IconPaletteOff,
  IconStereoGlasses,
  IconBadgeAd,
  IconDiamonds,
  IconPhotoSquareRounded,
  IconMedicineSyrup
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { getSocket } from '@/lib/socket';
import { useGameStore } from '@/stores/game-store';
import type { PlayerItem, PlayerState } from '@/stores/game-store';

interface InventoryBarProps {
  onRequestImprovisation?: (instanceId: string) => void;
  onRequestPartyTime?: (instanceId: string) => void;
  isPartyTimeTargeting?: boolean;
  activePartyInstanceId?: string | null;
  onCancelPartyTime?: () => void;
  onRequestCRT?: (instanceId: string) => void;
  isCRTTargeting?: boolean;
  activeCRTInstanceId?: string | null;
  onCancelCRT?: () => void;
}

// Fonction helper pour obtenir l'icône d'un item
function getItemIcon(itemId: string, size: number = 24) {
  switch (itemId) {
    case 'party_time':
      return <IconConfetti size={size} />;
    case 'early_bird':
      return <IconStopwatch size={size} />;
    case 'paralysis':
      return <IconBolt size={size} />;
    case 'improvisation':
      return <IconBubbleText size={size} />;
    case 'crt':
      return <IconDeviceTv size={size} />;
    case 'unsolicited_help':
      return <IconWriting size={size} />;
    case 'noir_blanc':
      return <IconPaletteOff size={size} />;
    case 'blackout':
      return <IconBulbOff size={size} />;
    case 'ad_break':
      return <IconBadgeAd size={size} />;
    case 'minigame':
      return <IconDiamonds size={size} />;
    case 'amnesia':
      return <IconBrain size={size} />;
    case 'recent_memory':
      return <IconPhotoSquareRounded size={size} />;
    case 'unforgiving':
      return <IconCircleDashedMinus size={size} />;
    case 'roublard':
      return <IconGitCherryPick size={size} />;
    case 'heal':
      return <IconMedicineSyrup size={size} />;
    case 'spy':
      return <IconStereoGlasses size={size} />;
    case 'incognito':
      return <IconSpy size={size} />;
    default:
      return null;
  }
}

export default function InventoryBar({
  onRequestImprovisation,
  onRequestPartyTime,
  isPartyTimeTargeting,
  activePartyInstanceId,
  onCancelPartyTime,
  onRequestCRT,
  isCRTTargeting,
  activeCRTInstanceId,
  onCancelCRT
}: InventoryBarProps) {
  // isCompact = mode permanent (true = compact, false = ouvert)
  const [isCompact, setIsCompact] = useState(true);
  // isHovered = déplié temporairement au survol
  const [isHovered, setIsHovered] = useState(false);
  // Modal de la boutique
  const [isShopOpen, setIsShopOpen] = useState(false);

  const { currentRoom, playerId, itemsCatalog, setItemsCatalog } = useGameStore((s) => ({
    currentRoom: s.currentRoom,
    playerId: s.playerId,
    itemsCatalog: s.itemsCatalog,
    setItemsCatalog: s.setItemsCatalog
  }));

  const player = useMemo(() => (playerId && currentRoom ? currentRoom.players[playerId] : undefined), [currentRoom, playerId]);
  const inventory = player?.inventory ?? [];
  const score = player?.score ?? 0;
  const targetablePlayers = useMemo(() => {
    if (!currentRoom || !playerId) return 0;
    return Object.values(currentRoom.players || {}).filter((p: PlayerState) => p.id !== playerId && p.connected).length;
  }, [currentRoom, playerId]);
  const canUseTargeted = targetablePlayers > 0;
  // Est dessinateur: soit pendant une manche, soit pendant la phase de choix via drawerOrder/currentDrawerIndex
  const isDrawer = useMemo(() => {
    if (!playerId || !currentRoom) return false;
    if (currentRoom.round) return currentRoom.round.drawerId === playerId;
    if (currentRoom.status === 'choosing' && currentRoom.drawerOrder && typeof currentRoom.currentDrawerIndex === 'number') {
      const drawerId = currentRoom.drawerOrder[currentRoom.currentDrawerIndex] as string | undefined;
      return drawerId === playerId;
    }
    return false;
  }, [playerId, currentRoom]);

  // Charger la liste des items à l'ouverture de la boutique
  useEffect(() => {
    if (!isShopOpen) return;
    const socket = getSocket();
    const handleItems = (items: any[]) => setItemsCatalog(items);
    socket.emit('items:list');
    socket.on('items:list', handleItems);
    return () => {
      socket.off('items:list', handleItems);
    };
  }, [isShopOpen, setItemsCatalog]);

  // La barre est visible quand: pas compact OU (compact mais survolé)
  const shouldShowFull = !isCompact || isHovered;

  const buyDisabled = (cost: number) => score < cost;

  const canUseItem = (item: PlayerItem) => {
    switch (item.itemId) {
      case 'improvisation':
        return isDrawer && currentRoom?.status === 'choosing';
      case 'party_time':
        return canUseTargeted;
      case 'crt':
        return canUseTargeted;
      default:
        return false;
    }
  };

  const getDisabledReason = (item: PlayerItem) => {
    switch (item.itemId) {
      case 'improvisation':
        return "Non utilisable maintenant";
      case 'party_time':
        return canUseTargeted ? undefined : 'Aucun autre joueur connecté';
      case 'crt':
        return canUseTargeted ? undefined : 'Aucun autre joueur connecté';
      default:
        return 'Non utilisable maintenant';
    }
  };

  const handleBuy = (itemId: string) => {
    const socket = getSocket();
    socket.emit('shop:buy', { itemId });
    
    // Afficher une notification
    const item = itemsCatalog.find(x => x.id === itemId);
    if (item) {
      notifications.show({
        title: 'Achat réussi',
        message: `Vous avez acheté ${item.name} pour ${item.cost} pts`,
        color: 'green',
        position: 'bottom-right',
        autoClose: 3000,
      });
    }
  };

  const handleUseItem = (instanceId: string, itemId: string) => {
    if (itemId === 'improvisation') {
      // On délègue la capture du mot à la modal de choix (page), uniquement si elle est ouverte
      if (onRequestImprovisation && isDrawer && currentRoom?.status === 'choosing') {
        // Consommer côté serveur immédiatement pour retirer de l'inventaire
        getSocket().emit('item:init', { instanceId });
        onRequestImprovisation(instanceId);
      }
    } else if (itemId === 'party_time') {
      if (onRequestPartyTime) {
        setIsCompact(false);
        setIsHovered(false);
        onRequestPartyTime(instanceId);
      }
    } else if (itemId === 'crt') {
      if (onRequestCRT) {
        setIsCompact(false);
        setIsHovered(false);
        onRequestCRT(instanceId);
      }
    }
  };

  // Créer 7 emplacements visibles pour l'inventaire, remplis depuis la fin (dernier achat à droite)
  const visibleSlots = Array.from({ length: 7 }, (_, i) => i);
  const lastSeven = inventory.slice(-7);

  return (
    <>
      {/* Plus de modal Improvisation ici: gérée par la modal de choix dans la page */}

      {/* Modal de la boutique */}
      <Modal
        opened={isShopOpen}
        onClose={() => setIsShopOpen(false)}
        title={
          <Group justify="space-between" style={{ width: '100%' }}>
            <Badge>Score: {score}</Badge>
            <Title order={3} style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>Boutique</Title>
            <div style={{ width: 100 }} /> {/* Spacer pour équilibrer */}
          </Group>
        }
        size="auto"
        centered
      >
        <Stack gap="xs">
          <SimpleGrid cols={7} spacing="xs">
            {itemsCatalog.map((item) => (
              <Tooltip
                key={item.id}
                label={
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>{item.description}</div>
                    <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>{item.cost} pts</div>
                  </div>
                }
                position="top"
                withArrow
              >
                <UnstyledButton
                  onClick={() => !buyDisabled(item.cost) && handleBuy(item.id)}
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: '8px',
                    backgroundColor: 'var(--mantine-color-dark-5)',
                    border: '2px solid var(--mantine-color-dark-4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    cursor: buyDisabled(item.cost) ? 'not-allowed' : 'pointer',
                    opacity: buyDisabled(item.cost) ? 0.5 : 1,
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    if (!buyDisabled(item.cost)) {
                      e.currentTarget.style.borderColor = 'var(--mantine-color-blue-6)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--mantine-color-dark-4)';
                  }}
                >
                  <Box
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--mantine-color-gray-1)',
                      gap: 4
                    }}
                  >
                    {getItemIcon(item.id, 28)}
                    <div style={{ fontSize: 10, opacity: 0.8 }}>{item.cost} pts</div>
                  </Box>
                </UnstyledButton>
              </Tooltip>
            ))}
          </SimpleGrid>
        </Stack>
      </Modal>

      <Box
        onMouseEnter={() => isCompact && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: `translateX(-50%) translateY(${shouldShowFull ? '0' : 'calc(100% - 24px)'})`,
          zIndex: 1000,
          width: 'auto',
          transition: 'transform 0.3s ease-in-out'
        }}
      >

      {(isPartyTimeTargeting || isCRTTargeting) && (
        <Paper
          shadow="xl"
          radius="md"
          p="sm"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translate(-50%, -14px)',
            backgroundColor: 'var(--mantine-color-dark-6)',
            border: isCRTTargeting ? '1px solid var(--mantine-color-blue-5)' : '1px solid var(--mantine-color-pink-5)',
            boxShadow: isCRTTargeting ? '0 12px 28px rgba(76, 110, 245, 0.35)' : '0 12px 28px rgba(255, 120, 203, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            maxWidth: 360,
            width: 'max-content',
            zIndex: 1010
          }}
        >
          <Group gap="sm" align="center" wrap="nowrap" style={{ flex: 1 }}>
            {isCRTTargeting ? (
              <IconDeviceTv size={24} color="var(--mantine-color-blue-4)" />
            ) : (
              <IconConfetti size={24} color="var(--mantine-color-pink-4)" />
            )}
            <Stack gap={2} style={{ flex: 1 }}>
              <Text fw={600} size="sm">{isCRTTargeting ? 'CRT prêt' : 'Jour de fête prêt'}</Text>
              <Text size="xs" c="dimmed">Cliquez sur un joueur à gauche pour {isCRTTargeting ? 'appliquer le filtre CRT' : 'déclencher les confettis'}.</Text>
            </Stack>
          </Group>
          <Button
            variant="light"
            size="xs"
            color="gray"
            onClick={(event) => {
              event.stopPropagation();
              if (isCRTTargeting) onCancelCRT?.(); else onCancelPartyTime?.();
            }}
          >
            Annuler
          </Button>
        </Paper>
      )}

      {/* Barre d'inventaire fixe */}
      <Paper
        shadow="xl"
        p="xs"
        radius="md"
        style={{
          backgroundColor: 'var(--mantine-color-dark-6)',
          border: '2px solid var(--mantine-color-dark-4)',
          borderBottom: 'none',
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0
        }}
      >
        <Group gap="xs" wrap="nowrap">
          {/* Bouton pour mode compact/ouvert (pin) */}
          <UnstyledButton
            onClick={(e) => {
              e.stopPropagation();
              setIsCompact(!isCompact);
              if (isCompact) setIsHovered(false);
            }}
            style={{
              padding: '8px',
              borderRadius: '4px',
              backgroundColor: 'var(--mantine-color-dark-5)',
              border: '1px solid var(--mantine-color-dark-4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--mantine-color-dark-4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--mantine-color-dark-5)';
            }}
          >
            {isCompact ? (
              <IconPin size={20} color="var(--mantine-color-gray-4)" />
            ) : (
              <IconPinFilled size={20} color="var(--mantine-color-gray-4)" />
            )}
          </UnstyledButton>
          
          {/* 7 emplacements d'inventaire */}
          {visibleSlots.map((slotIndex, i) => {
            const item = lastSeven[slotIndex] as PlayerItem | undefined;
            const usable = item ? canUseItem(item) : false;
            const disabledReason = item && !usable ? getDisabledReason(item) : undefined;
            const itemDef = item ? itemsCatalog.find(x => x.id === item.itemId) : undefined;
            const isActivePartySelection = Boolean(isPartyTimeTargeting && item && activePartyInstanceId === item.instanceId);
            const content = item ? (
              <Box style={{ 
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--mantine-color-gray-1)'
              }}>
                {getItemIcon(item.itemId, 28)}
              </Box>
            ) : (
              <Box
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--mantine-color-dark-3)',
                  fontSize: '12px'
                }}
              >
                Vide
              </Box>
            );
            
            const button = (
              <UnstyledButton
                key={i}
                onClick={() => item && usable && handleUseItem(item.instanceId, item.itemId)}
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: '8px',
                  backgroundColor: isActivePartySelection ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-dark-5)',
                  border: `2px solid ${isActivePartySelection ? 'var(--mantine-color-pink-5)' : 'var(--mantine-color-dark-4)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s, box-shadow 0.2s',
                  cursor: item ? (usable ? 'pointer' : 'not-allowed') : 'default',
                  position: 'relative',
                  opacity: item && !usable ? 0.5 : 1,
                  boxShadow: isActivePartySelection ? '0 0 0 3px rgba(255, 120, 203, 0.35)' : undefined
                }}
                onMouseEnter={(e) => {
                  if (item) {
                    e.currentTarget.style.borderColor = isActivePartySelection ? 'var(--mantine-color-pink-5)' : 'var(--mantine-color-blue-6)';
                    if (usable) {
                      e.currentTarget.style.backgroundColor = 'var(--mantine-color-dark-4)';
                    }
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isActivePartySelection ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-dark-5)';
                  e.currentTarget.style.borderColor = isActivePartySelection ? 'var(--mantine-color-pink-5)' : 'var(--mantine-color-dark-4)';
                }}
              >
                {content}
              </UnstyledButton>
            );

            return item ? (
              <Tooltip
                key={i}
                label={
                  <div>
                    <div style={{ fontWeight: 700 }}>{itemDef?.name ?? item.itemId}</div>
                    {itemDef?.description && <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{itemDef.description}</div>}
                    {disabledReason && <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4, fontStyle: 'italic' }}>{disabledReason}</div>}
                  </div>
                }
                position="top"
                withArrow
              >
                {button}
              </Tooltip>
            ) : button;
          })}

          {/* Bouton pour ouvrir la boutique */}
          <UnstyledButton
            onClick={(e) => {
              e.stopPropagation();
              setIsShopOpen(true);
            }}
            style={{
              padding: '8px',
              borderRadius: '4px',
              backgroundColor: 'var(--mantine-color-dark-5)',
              border: '1px solid var(--mantine-color-dark-4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--mantine-color-dark-4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--mantine-color-dark-5)';
            }}
          >
            <IconBuildingStore 
              size={20} 
              color="var(--mantine-color-gray-4)" 
              fill={isShopOpen ? 'currentColor' : 'none'}
            />
          </UnstyledButton>
        </Group>
      </Paper>
      </Box>
    </>
  );
}

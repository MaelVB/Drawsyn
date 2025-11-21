import React, { useEffect, useState } from 'react';
import { Tooltip, Stack, Group, Badge, Text, useComputedColorScheme } from '@mantine/core';
import type { PlayerState, RoomState } from '@/stores/game-store';

export interface ActiveEffect {
  effectId: string;
  icon: React.ReactNode;
  expiresAt: number;
  color: string;
}

interface PlayerTooltipProps {
  player: PlayerState;
  room: RoomState;
  roundDrawerId?: string;
  effects: ActiveEffect[];
  isSelf: boolean;
  viewerTeamId?: string;
  knownTeamPlayerIds: Set<string>;
  teamIndexById: Record<string, number>;
  teamColors: readonly string[];
  drawAssistUntil?: number | null;
  children: React.ReactNode;
}

export const PlayerTooltip: React.FC<PlayerTooltipProps> = ({
  player,
  room,
  roundDrawerId,
  effects,
  isSelf,
  viewerTeamId,
  knownTeamPlayerIds,
  teamIndexById,
  teamColors,
  drawAssistUntil,
  children
}) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const colorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const isDrawer = roundDrawerId === player.id;
  const isAssistDrawer = !isDrawer && isSelf && drawAssistUntil && drawAssistUntil > Date.now();

  const teamBadgeEl = (() => {
    const teamsEnabled = (room?.teamCount ?? 0) > 1;
    if (!teamsEnabled) return null;
    const tId = player.teamId;
    const idx = tId ? teamIndexById[tId] : undefined;
    const isKnown = Boolean(
      tId && (
        player.id === room.hostId ||
        isSelf ||
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

  const hostBadgeEl = room.hostId === player.id ? (
    <Badge size="sm" color="yellow" variant="light">Hôte</Badge>
  ) : null;

  const drawerBadgeEl = isDrawer ? (
    <Badge size="sm" color="blue" variant="light">Dessinateur</Badge>
  ) : isAssistDrawer ? (
    <Badge size="sm" color="orange" variant="light">Assist. dessin</Badge>
  ) : null;

  const scoreBadgeEl = <Badge size="sm" variant="light">{player.score} pts</Badge>;

  return (
    <Tooltip
      withArrow
      arrowSize={8}
      position="top"
      multiline
      styles={{
        tooltip: {
          color: colorScheme === 'dark' ? 'var(--mantine-color-gray-0)' : 'var(--mantine-color-dark-9)',
          backgroundColor: colorScheme === 'dark' ? 'rgba(26,27,30,0.92)' : 'rgba(255,255,255,0.95)',
          boxShadow: colorScheme === 'dark'
            ? '0 4px 16px rgba(0,0,0,0.5)'
            : '0 4px 14px rgba(0,0,0,0.15)'
        }
      }}
      label={
        <Stack gap={4}>
          <Text size="sm" fw={600} style={{ lineHeight: 1.2 }}>
            {player.name}{' '}<Text component="span" size="xs" c="dimmed">({player.connected ? 'connecté' : 'déconnecté'})</Text>
          </Text>
          <Group gap={6} wrap="wrap">
            {teamBadgeEl}
            {drawerBadgeEl}
            {hostBadgeEl}
            {scoreBadgeEl}
          </Group>
          {effects.length > 0 && (
            <Group gap={4} wrap="wrap">
              {effects.slice(0, 5).map((effect) => {
                const remaining = Math.max(0, Math.round((effect.expiresAt - now) / 1000));
                return (
                  <Badge
                    key={effect.effectId}
                    size="sm"
                    radius="sm"
                    variant="filled"
                    color={effect.color}
                    style={{
                      padding: '2px 6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    {effect.icon}
                    <Text component="span" size="xs" fw={600}>{remaining}s</Text>
                  </Badge>
                );
              })}
            </Group>
          )}
        </Stack>
      }
    >
      <div>{children}</div>
    </Tooltip>
  );
};

export default PlayerTooltip;

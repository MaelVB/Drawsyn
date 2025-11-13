'use client';

import { useState } from 'react';
import { Box, Group, Paper, UnstyledButton, Transition } from '@mantine/core';
import { IconChevronUp, IconChevronDown } from '@tabler/icons-react';

interface InventorySlot {
  id: number;
  content?: React.ReactNode;
  isEmpty?: boolean;
}

interface InventoryBarProps {
  slots?: InventorySlot[];
  onSlotClick?: (slotId: number) => void;
}

export default function InventoryBar({ slots, onSlotClick }: InventoryBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Créer 7 emplacements par défaut si aucun n'est fourni
  const inventorySlots: InventorySlot[] = slots || Array.from({ length: 7 }, (_, i) => ({
    id: i + 1,
    isEmpty: true
  }));

  return (
    <Box
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        width: 'auto'
      }}
    >
      {/* Contenu étendu */}
      <Transition
        mounted={isExpanded}
        transition="slide-up"
        duration={300}
        timingFunction="ease"
      >
        {(styles) => (
          <Paper
            shadow="lg"
            p="md"
            mb="xs"
            radius="md"
            style={{
              ...styles,
              backgroundColor: 'var(--mantine-color-dark-7)',
              border: '2px solid var(--mantine-color-dark-4)'
            }}
          >
            <Box style={{ minHeight: 200, minWidth: 400 }}>
              {/* Contenu supplémentaire quand la barre est dépliée */}
              <div style={{ color: 'var(--mantine-color-gray-4)' }}>
                Informations détaillées de l'inventaire
              </div>
            </Box>
          </Paper>
        )}
      </Transition>

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
          {/* Bouton pour déplier/replier */}
          <UnstyledButton
            onClick={() => setIsExpanded(!isExpanded)}
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
            {isExpanded ? (
              <IconChevronDown size={20} color="var(--mantine-color-gray-4)" />
            ) : (
              <IconChevronUp size={20} color="var(--mantine-color-gray-4)" />
            )}
          </UnstyledButton>

          {/* Les 7 emplacements */}
          {inventorySlots.map((slot) => (
            <UnstyledButton
              key={slot.id}
              onClick={() => onSlotClick?.(slot.id)}
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
                cursor: 'pointer',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--mantine-color-dark-4)';
                e.currentTarget.style.borderColor = 'var(--mantine-color-blue-6)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--mantine-color-dark-5)';
                e.currentTarget.style.borderColor = 'var(--mantine-color-dark-4)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {slot.content || (
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
                  {slot.id}
                </Box>
              )}
            </UnstyledButton>
          ))}
        </Group>
      </Paper>
    </Box>
  );
}

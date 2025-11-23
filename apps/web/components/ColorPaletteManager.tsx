"use client";

import { useState } from 'react';
import { 
  Card, 
  Stack, 
  Button, 
  TextInput, 
  Group, 
  Box, 
  Text, 
  ActionIcon, 
  Modal, 
  ColorPicker,
  Radio,
  Badge,
  Flex,
  Tooltip
} from '@mantine/core';
import { IconTrash, IconPlus, IconEdit, IconPalette, IconCheck } from '@tabler/icons-react';

export interface ColorPalette {
  id: string;
  name: string;
  colors: string[];
}

interface ColorPaletteManagerProps {
  palettes: ColorPalette[];
  defaultPaletteId: string;
  onChange: (palettes: ColorPalette[], defaultPaletteId: string) => void;
}

export default function ColorPaletteManager({ palettes, defaultPaletteId, onChange }: ColorPaletteManagerProps) {
  const [editingPalette, setEditingPalette] = useState<ColorPalette | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newPaletteName, setNewPaletteName] = useState('');
  const [editingColors, setEditingColors] = useState<string[]>([]);
  const [currentColorPickerIndex, setCurrentColorPickerIndex] = useState<number | null>(null);
  const [colorPickerValue, setColorPickerValue] = useState('#000000');

  const handleCreatePalette = () => {
    if (!newPaletteName.trim()) return;
    
    const newPalette: ColorPalette = {
      id: `palette-${Date.now()}`,
      name: newPaletteName.trim(),
      colors: ['#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF']
    };
    
    onChange([...palettes, newPalette], defaultPaletteId);
    setNewPaletteName('');
    setIsCreating(false);
  };

  const handleDeletePalette = (paletteId: string) => {
    // Ne pas permettre de supprimer les palettes par défaut
    if (paletteId === 'rgbcmy' || paletteId === 'main') return;
    
    const newPalettes = palettes.filter(p => p.id !== paletteId);
    const newDefaultId = defaultPaletteId === paletteId ? 'main' : defaultPaletteId;
    onChange(newPalettes, newDefaultId);
  };

  const handleSetDefault = (paletteId: string) => {
    onChange(palettes, paletteId);
  };

  const handleEditPalette = (palette: ColorPalette) => {
    setEditingPalette(palette);
    setEditingColors([...palette.colors]);
  };

  const handleSaveEdit = () => {
    if (!editingPalette) return;
    
    const updatedPalettes = palettes.map(p => 
      p.id === editingPalette.id 
        ? { ...p, colors: editingColors }
        : p
    );
    
    onChange(updatedPalettes, defaultPaletteId);
    setEditingPalette(null);
    setEditingColors([]);
    setCurrentColorPickerIndex(null);
  };

  const handleAddColor = () => {
    if (editingColors.length < 30) {
      setEditingColors([...editingColors, '#808080']);
    }
  };

  const handleRemoveColor = (index: number) => {
    if (editingColors.length > 2) {
      setEditingColors(editingColors.filter((_, i) => i !== index));
    }
  };

  const handleColorChange = (index: number, color: string) => {
    const newColors = [...editingColors];
    newColors[index] = color;
    setEditingColors(newColors);
  };

  const openColorPicker = (index: number) => {
    setCurrentColorPickerIndex(index);
    setColorPickerValue(editingColors[index]);
  };

  const closeColorPicker = () => {
    setCurrentColorPickerIndex(null);
  };

  const applyColorFromPicker = () => {
    if (currentColorPickerIndex !== null) {
      handleColorChange(currentColorPickerIndex, colorPickerValue);
      closeColorPicker();
    }
  };

  return (
    <Stack gap="md">
      <Card withBorder padding="lg" radius="md">
        <Stack>
          <Group justify="space-between">
            <Text fw={600} size="lg">Mes palettes de couleurs</Text>
            <Button
              leftSection={<IconPlus size={16} />}
              variant="light"
              onClick={() => setIsCreating(true)}
            >
              Nouvelle palette
            </Button>
          </Group>

          {palettes.map((palette) => (
            <Card key={palette.id} withBorder padding="md" radius="sm">
              <Group justify="space-between" align="center">
                <Box flex={1}>
                  <Group gap="xs" mb="xs">
                    <Radio
                      checked={defaultPaletteId === palette.id}
                      onChange={() => handleSetDefault(palette.id)}
                      label={
                        <Group gap="xs">
                          <Text fw={500}>{palette.name}</Text>
                          {defaultPaletteId === palette.id && (
                            <Badge size="sm" color="green" leftSection={<IconCheck size={12} />}>
                              Par défaut
                            </Badge>
                          )}
                          {(palette.id === 'rgbcmy' || palette.id === 'main') && (
                            <Badge size="sm" color="blue">
                              Système
                            </Badge>
                          )}
                        </Group>
                      }
                    />
                  </Group>
                  
                  <Flex gap={4} wrap="wrap">
                    {palette.colors.map((color, idx) => (
                      <Tooltip key={idx} label={color} withArrow>
                        <Box
                          style={{
                            width: 24,
                            height: 24,
                            backgroundColor: color,
                            border: '1px solid #ccc',
                            borderRadius: 4,
                            cursor: 'pointer'
                          }}
                        />
                      </Tooltip>
                    ))}
                  </Flex>
                </Box>

                <Group gap="xs">
                  <ActionIcon
                    variant="light"
                    onClick={() => handleEditPalette(palette)}
                  >
                    <IconEdit size={16} />
                  </ActionIcon>
                  {palette.id !== 'rgbcmy' && palette.id !== 'main' && (
                    <ActionIcon
                      variant="light"
                      color="red"
                      onClick={() => handleDeletePalette(palette.id)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  )}
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      </Card>

      {/* Modal de création */}
      <Modal
        opened={isCreating}
        onClose={() => {
          setIsCreating(false);
          setNewPaletteName('');
        }}
        title="Créer une nouvelle palette"
        centered
      >
        <Stack>
          <TextInput
            label="Nom de la palette"
            placeholder="Ma palette personnalisée"
            value={newPaletteName}
            onChange={(e) => setNewPaletteName(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => {
              setIsCreating(false);
              setNewPaletteName('');
            }}>
              Annuler
            </Button>
            <Button onClick={handleCreatePalette} disabled={!newPaletteName.trim()}>
              Créer
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal d'édition */}
      <Modal
        opened={!!editingPalette}
        onClose={() => {
          setEditingPalette(null);
          setEditingColors([]);
          setCurrentColorPickerIndex(null);
        }}
        title={`Modifier la palette : ${editingPalette?.name}`}
        centered
        size="lg"
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Cliquez sur une couleur pour la modifier, ou ajoutez-en de nouvelles.
          </Text>
          
          <Flex gap={8} wrap="wrap">
            {editingColors.map((color, idx) => (
              <Box key={idx} pos="relative">
                <Box
                  onClick={() => openColorPicker(idx)}
                  style={{
                    width: 48,
                    height: 48,
                    backgroundColor: color,
                    border: currentColorPickerIndex === idx ? '3px solid #228be6' : '2px solid #ccc',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'border 0.2s'
                  }}
                />
                {editingColors.length > 2 && (
                  <ActionIcon
                    size="xs"
                    color="red"
                    variant="filled"
                    pos="absolute"
                    top={-8}
                    right={-8}
                    onClick={() => handleRemoveColor(idx)}
                    style={{ zIndex: 10 }}
                  >
                    <IconTrash size={12} />
                  </ActionIcon>
                )}
              </Box>
            ))}
            
            {editingColors.length < 30 && (
              <Box
                onClick={handleAddColor}
                style={{
                  width: 48,
                  height: 48,
                  border: '2px dashed #868e96',
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#868e96'
                }}
              >
                <IconPlus size={24} />
              </Box>
            )}
          </Flex>

          {currentColorPickerIndex !== null && (
            <Card withBorder padding="md">
              <Stack>
                <Text size="sm" fw={500}>Modifier la couleur</Text>
                <ColorPicker
                  value={colorPickerValue}
                  onChange={setColorPickerValue}
                  format="hex"
                  fullWidth
                />
                <Group gap="xs" justify="flex-end">
                  <Button size="xs" variant="light" onClick={closeColorPicker}>
                    Annuler
                  </Button>
                  <Button size="xs" onClick={applyColorFromPicker}>
                    Appliquer
                  </Button>
                </Group>
              </Stack>
            </Card>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => {
              setEditingPalette(null);
              setEditingColors([]);
              setCurrentColorPickerIndex(null);
            }}>
              Annuler
            </Button>
            <Button onClick={handleSaveEdit} leftSection={<IconPalette size={16} />}>
              Enregistrer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}


import { Stack, Box, Text } from '@mantine/core';
import { Carousel } from '@mantine/carousel';

interface DrawingRecord {
  turnIndex: number;
  drawerId: string;
  word: string;
  imageData: string;
  savedAt: number;
}
interface PlayerState {
  id: string;
  name: string;
}
type Players = Record<string, PlayerState>;

export default function DrawingsCarousel({ drawings, players }: { drawings: DrawingRecord[]; players: Players }) {
  if (!drawings.length) return null;
  const sorted = drawings.sort((a, b) => a.turnIndex - b.turnIndex);
  return (
    <Carousel slideSize="100%" height={260} withIndicators>
      {sorted.map((d) => (
        <Carousel.Slide key={d.turnIndex}>
          <Stack align="center" gap="xs">
            <Box style={{ width: 320, aspectRatio: '3/2', background: '#444', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--mantine-color-gray-4)' }}>
              <img src={d.imageData} alt={d.word} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </Box>
            <Text size="sm" ta="center">{players[d.drawerId]?.name || 'Inconnu'} - {d.word}</Text>
          </Stack>
        </Carousel.Slide>
      ))}
    </Carousel>
  );
}
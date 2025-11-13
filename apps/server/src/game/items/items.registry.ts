import { GameItemDef, ItemId } from '../types/game-state';

export const ITEMS: Record<ItemId, GameItemDef> = {
  improvisation: {
    id: 'improvisation',
    name: 'Improvisation',
    description: 'Permet au dessinateur de choisir manuellement le mot à faire deviner.',
    cost: 100
  }
};

export function listItems(): GameItemDef[] {
  return Object.values(ITEMS);
}

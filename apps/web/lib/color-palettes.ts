export interface ColorPalette {
  id: string;
  name: string;
  colors: string[];
}

/**
 * Palettes système disponibles par défaut pour tous les utilisateurs.
 * Ces palettes correspondent aux valeurs par défaut définies dans le schéma User côté backend.
 */
export const SYSTEM_PALETTES: Record<string, ColorPalette> = {
  rgbcmy: {
    id: 'rgbcmy',
    name: 'RGBCMY',
    colors: [
      '#FFFFFF', '#808080', '#000000',
      '#FF0000', '#CC0000', '#8B0000',
      '#00FF00', '#00CC00', '#006400',
      '#0000FF', '#0000CC', '#00008B',
      '#00FFFF', '#00CCCC', '#008B8B',
      '#FF00FF', '#CC00CC', '#8B008B',
      '#FFFF00', '#CCCC00', '#8B8B00',
    ]
  },
  main: {
    id: 'main',
    name: 'Main',
    colors: [
      '#FFFFFF', '#868e96', '#000000',
      '#fa5252', '#fcc2d7', '#cc5de8',
      '#845ef7', '#5c7cfa', '#339af0',
      '#22b8cf', '#20c997', '#51cf66',
      '#94d82d', '#ffd43b', '#ff922b',
    ]
  }
};

/**
 * Récupère une palette de couleurs en fonction de son ID.
 * Cherche d'abord dans les palettes utilisateur, puis dans les palettes système.
 * Retombe sur 'main' si aucune palette n'est trouvée.
 */
export function getPalette(
  paletteId: string | undefined,
  userPalettes: ColorPalette[] = []
): ColorPalette {
  const id = paletteId || 'main';
  
  // Chercher dans les palettes utilisateur
  const userPalette = userPalettes.find(p => p.id === id);
  if (userPalette) return userPalette;
  
  // Chercher dans les palettes système
  const systemPalette = SYSTEM_PALETTES[id];
  if (systemPalette) return systemPalette;
  
  // Fallback sur main
  return SYSTEM_PALETTES.main;
}

/**
 * Organise les couleurs d'une palette en colonnes de N éléments.
 * Utile pour afficher une grille de couleurs dans l'interface.
 */
export function organizePaletteIntoColumns(colors: string[], itemsPerColumn: number = 3): string[][] {
  const columns: string[][] = [];
  for (let i = 0; i < colors.length; i += itemsPerColumn) {
    columns.push(colors.slice(i, i + itemsPerColumn));
  }
  return columns;
}

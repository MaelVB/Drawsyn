import { GameItemDef, ItemId } from '../types/game-state';

export const ITEMS: Record<ItemId, GameItemDef> = {
  party_time: {
    id: 'party_time',
    name: 'Jour de fête',
    description: 'Envoie des confettis partout sur l\'écran d\'un joueur pendant 10s.',
    cost: 25
  },
  early_bird: {
    id: 'early_bird',
    name: 'En avance',
    description: 'Révèle instantanément une lettre du mot à deviner (au hasard).',
    cost: 50
  },
  paralysis: {
    id: 'paralysis',
    name: 'Paralysie',
    description: 'Empêche une personne d\'écrire dans le tchat pendant 20s.',
    cost: 75
  },
  improvisation: {
    id: 'improvisation',
    name: 'Improvisation',
    description: 'Permet au dessinateur de faire deviner un mot qu\'il entre lui-même.',
    cost: 100
  },
  noir_blanc: {
    id: 'noir_blanc',
    name: 'Noir&Blanc',
    description: 'Le dessinateur ne peut plus utiliser de couleur sur le reste de la manche.',
    cost: 200
  },
  crt: {
    id: 'crt',
    name: 'CRT',
    description: 'Un filtre CRT apparait par-dessus le canvas.',
    cost: 250
  },
  unsolicited_help: {
    id: 'unsolicited_help',
    name: 'Aide non sollicitée',
    description: 'Permet à celui qui active l\'item de pouvoir dessiner pendant 15s sur le canvas.',
    cost: 300
  },
  ad_break: {
    id: 'ad_break',
    name: 'Page de pub',
    description: 'Une pop-up apparait et le joueur doit regarder une pub pendant 10s. Si le joueur ciblé a renseigné l\'URL de son Twitch, son stream s\'affiche.',
    cost: 350
  },
  blackout: {
    id: 'blackout',
    name: 'Blackout',
    description: 'Affiche un écran noir sur le canvas jusqu\'à la fin de la manche, le joueur doit passer son curseur dessus pour révéler le dessin avec un effet lampe de poche.',
    cost: 400
  },
  minigame: {
    id: 'minigame',
    name: 'Mini-jeu',
    description: 'Un écran cache la zone de dessin et 5 formes apparaissent. Le joueur doit les colorier pour faire disparaitre l\'écran.',
    cost: 450
  },
  amnesia: {
    id: 'amnesia',
    name: 'Amnésie',
    description: 'Les traits du dessin disparaissent peu à peu.',
    cost: 500
  },
  recent_memory: {
    id: 'recent_memory',
    name: 'Mémoire récente',
    description: 'Un dessin aléatoire d\'une manche précédente apparait par-dessus la zone de dessin toutes les 10s durant la manche en cours. Ce dessin est gommable.',
    cost: 550
  },
  unforgiving: {
    id: 'unforgiving',
    name: 'Intraitable',
    description: 'Enlève des points pour chaque guess erroné sur la manche en cours.',
    cost: 600
  },
  roublard: {
    id: 'roublard',
    name: 'Roublard',
    description: 'Vole un item au hasard dans l\'inventaire d\'un autre joueur.',
    cost: 750
  },
  heal: {
    id: 'heal',
    name: 'Soin',
    description: 'Annule tous les effets négatifs en cours sur le joueur qui l\'utilise.',
    cost: 800
  },
  spy: {
    id: 'spy',
    name: 'Espion',
    description: 'Révèle les membres de l\'équipe d\'un joueur.',
    cost: 1000
  },
  incognito: {
    id: 'incognito',
    name: 'Incognito',
    description: 'Cache les stats du joueur qui l\'active jusqu\'à la fin de la partie.',
    cost: 1500
  }
};

export function listItems(): GameItemDef[] {
  return Object.values(ITEMS);
}

export interface GameSpace {
  id: number;
  name: string;
  type: 'property' | 'railroad' | 'utility' | 'tax' | 'chance' | 'chest' | 'corner';
  price?: number;
  rent?: number[];
  group?: string;
  color?: string;
}

export const BOARD_SPACES: GameSpace[] = [
  { id: 0, name: 'GO', type: 'corner' },
  { id: 1, name: 'Mumbai', type: 'property', group: 'brown', price: 60, rent: [2, 10, 30, 90, 160, 250], color: '#955436' },
  { id: 2, name: 'Community Chest', type: 'chest' },
  { id: 3, name: 'Kyoto', type: 'property', group: 'brown', price: 60, rent: [4, 20, 60, 180, 320, 450], color: '#955436' },
  { id: 4, name: 'Income Tax', type: 'tax', price: 200 },
  { id: 5, name: 'JFK Airport', type: 'railroad', price: 200 },
  { id: 6, name: 'Bangkok', type: 'property', group: 'light-blue', price: 100, rent: [6, 30, 90, 270, 400, 550], color: '#aae0fa' },
  { id: 7, name: 'Chance', type: 'chance' },
  { id: 8, name: 'Athens', type: 'property', group: 'light-blue', price: 100, rent: [6, 30, 90, 270, 400, 550], color: '#aae0fa' },
  { id: 9, name: 'Cairo', type: 'property', group: 'light-blue', price: 120, rent: [8, 40, 100, 300, 450, 600], color: '#aae0fa' },
  { id: 10, name: 'Just Visiting', type: 'corner' },
  { id: 11, name: 'Berlin', type: 'property', group: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], color: '#d93a96' },
  { id: 12, name: 'Electric Company', type: 'utility', price: 150 },
  { id: 13, name: 'Amsterdam', type: 'property', group: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], color: '#d93a96' },
  { id: 14, name: 'Rome', type: 'property', group: 'pink', price: 160, rent: [12, 60, 180, 500, 700, 900], color: '#d93a96' },
  { id: 15, name: 'Heathrow Airport', type: 'railroad', price: 200 },
  { id: 16, name: 'Barcelona', type: 'property', group: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], color: '#f7941d' },
  { id: 17, name: 'Community Chest', type: 'chest' },
  { id: 18, name: 'Lisbon', type: 'property', group: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], color: '#f7941d' },
  { id: 19, name: 'Seoul', type: 'property', group: 'orange', price: 200, rent: [16, 80, 220, 600, 800, 1000], color: '#f7941d' },
  { id: 20, name: 'Free Parking', type: 'corner' },
  { id: 21, name: 'Rio de Janeiro', type: 'property', group: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], color: '#ed1b24' },
  { id: 22, name: 'Chance', type: 'chance' },
  { id: 23, name: 'Mexico City', type: 'property', group: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], color: '#ed1b24' },
  { id: 24, name: 'Buenos Aires', type: 'property', group: 'red', price: 240, rent: [20, 100, 300, 750, 925, 1100], color: '#ed1b24' },
  { id: 25, name: 'Tokyo Station', type: 'railroad', price: 200 },
  { id: 26, name: 'Sydney', type: 'property', group: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], color: '#fef200' },
  { id: 27, name: 'Singapore', type: 'property', group: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], color: '#fef200' },
  { id: 28, name: 'Water Works', type: 'utility', price: 150 },
  { id: 29, name: 'Dubai', type: 'property', group: 'yellow', price: 280, rent: [24, 120, 360, 850, 1025, 1200], color: '#fef200' },
  { id: 30, name: 'Go To Jail', type: 'corner' },
  { id: 31, name: 'Paris', type: 'property', group: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], color: '#1fb25a' },
  { id: 32, name: 'London', type: 'property', group: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], color: '#1fb25a' },
  { id: 33, name: 'Community Chest', type: 'chest' },
  { id: 34, name: 'Tokyo', type: 'property', group: 'green', price: 320, rent: [28, 150, 450, 1000, 1200, 1400], color: '#1fb25a' },
  { id: 35, name: 'Gare du Nord', type: 'railroad', price: 200 },
  { id: 36, name: 'Chance', type: 'chance' },
  { id: 37, name: 'New York', type: 'property', group: 'dark-blue', price: 350, rent: [35, 175, 500, 1100, 1300, 1500], color: '#0072bb' },
  { id: 38, name: 'Luxury Tax', type: 'tax', price: 100 },
  { id: 39, name: 'Zurich', type: 'property', group: 'dark-blue', price: 400, rent: [50, 200, 600, 1400, 1700, 2000], color: '#0072bb' },
  // 40-199 Expansion
  ...Array.from({ length: 160 }, (_, i) => {
    const id = i + 40;
    const types: GameSpace['type'][] = ['property', 'property', 'property', 'chance', 'chest', 'railroad', 'tax'];
    const type = id % 10 === 0 ? 'corner' : types[id % types.length];
    const colors = ['#8B4513', '#87CEEB', '#FF69B4', '#FFA500', '#FF0000', '#FFFF00', '#008000', '#0000FF'];
    const color = colors[Math.floor(id / 20) % colors.length];
    
    if (type === 'corner') return { id, name: `Junction ${id/10}`, type: 'corner' } as GameSpace;
    if (type === 'tax') return { id, name: 'Global Tax', type: 'tax', price: 150 } as GameSpace;
    if (type === 'chance') return { id, name: 'Chance', type: 'chance' } as GameSpace;
    if (type === 'chest') return { id, name: 'Chest', type: 'chest' } as GameSpace;
    if (type === 'railroad') return { id, name: `Station ${id}`, type: 'railroad', price: 200 } as GameSpace;
    
    return {
      id,
      name: `City ${id}`,
      type: 'property',
      group: `Group ${Math.floor(id/10)}`,
      price: 100 + (Math.floor(id/10) * 20),
      rent: [10, 50, 150, 450, 600, 800],
      color
    } as GameSpace;
  })
];

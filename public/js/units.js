// units.js: the unit catalogue with base stats. sim.js scales HP and damage.
// r = body radius, proj = shot speed, splash = blast radius,
// charge = double first hit, poison = bite that keeps hurting.

export const CATS = [
  { id: 'army', name: 'Army' },
  { id: 'animals', name: 'Animals' },
  { id: 'mythical', name: 'Mythical' },
  { id: 'terrain', name: 'Terrain' },
];

export const UNITS = {
  soldier: { cat: 'army', name: 'Soldier', hp: 55, dmg: 7, range: 150, speed: 58, atk: 0.55, r: 11, proj: 430, col: '#ffd94d' },
  archer: { cat: 'army', name: 'Archer', hp: 42, dmg: 9, range: 195, speed: 56, atk: 0.95, r: 11, proj: 470, col: '#d9a066' },
  sniper: { cat: 'army', name: 'Sniper', hp: 35, dmg: 32, range: 285, speed: 48, atk: 1.7, r: 11, proj: 760, col: '#fff3b0' },
  cavalry: { cat: 'army', name: 'Cavalry', hp: 98, dmg: 13, range: 29, speed: 108, atk: 0.75, r: 13, charge: true },
  grenadier: { cat: 'army', name: 'Grenadier', hp: 60, dmg: 14, range: 230, speed: 50, atk: 1.3, r: 11, proj: 340, splash: 34, col: '#ffb84d' },
  rifleman: { cat: 'army', name: 'Rifleman', hp: 55, dmg: 8, range: 190, speed: 58, atk: 0.6, r: 11, proj: 480, col: '#ffe066' },
  marksman: { cat: 'army', name: 'Marksman', hp: 38, dmg: 30, range: 300, speed: 46, atk: 1.8, r: 11, proj: 780, col: '#fff7c2' },
  heavy: { cat: 'army', name: 'Heavy', hp: 120, dmg: 4, range: 170, speed: 36, atk: 0.18, r: 13, proj: 440, col: '#ffaa3c' },
  medic: { cat: 'army', name: 'Medic', hp: 50, dmg: 5, range: 150, speed: 60, atk: 0.7, r: 11, proj: 430, col: '#8fe3c4' },
  breacher: { cat: 'army', name: 'Breacher', hp: 80, dmg: 14, range: 70, speed: 56, atk: 0.8, r: 12, col: '#ff8a6b' },

  boar: { cat: 'animals', name: 'Boar', hp: 90, dmg: 11, range: 26, speed: 80, atk: 0.7, r: 12, charge: true },
  snake: { cat: 'animals', name: 'Snake', hp: 32, dmg: 5, range: 25, speed: 82, atk: 0.6, r: 10, poison: true },
  ant: { cat: 'animals', name: 'Ant', hp: 10, dmg: 3, range: 20, speed: 88, atk: 0.35, r: 7 },

  zombie: { cat: 'mythical', name: 'Zombie', hp: 98, dmg: 9, range: 25, speed: 32, atk: 0.8, r: 12 },
  mage: { cat: 'mythical', name: 'Mage', hp: 46, dmg: 16, range: 205, speed: 50, atk: 1.15, r: 11, proj: 420, splash: 30, col: '#c77dff' },
  dragon: { cat: 'mythical', name: 'Dragon', hp: 265, dmg: 17, range: 125, speed: 80, atk: 0.55, r: 18, fly: true, proj: 380, splash: 38, col: '#ff8c42' },

  wall: { cat: 'terrain', name: 'Wall', hp: 320, dmg: 0, r: 14, structure: true },
  mine: { cat: 'terrain', name: 'Mine', hp: 1, dmg: 62, r: 9, trap: true },
};

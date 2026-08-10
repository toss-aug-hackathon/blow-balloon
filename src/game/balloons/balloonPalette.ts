import type { BalloonPalette } from '../types';

export const BALLOON_PALETTES: BalloonPalette[] = [
  { id: 'coral', light: '#ffb1a7', base: '#ff6f75', dark: '#ba354f' },
  { id: 'peach', light: '#ffd49a', base: '#ff9d5c', dark: '#c65b39' },
  { id: 'lemon', light: '#fff3a6', base: '#ffd95c', dark: '#c58a2d' },
  { id: 'mint', light: '#b9f4db', base: '#62d9b0', dark: '#238f78' },
  { id: 'sky', light: '#b9e5ff', base: '#65b8ef', dark: '#3979b8' },
  { id: 'violet', light: '#d8c5ff', base: '#9878e8', dark: '#5e49a7' },
  { id: 'berry', light: '#ffc0df', base: '#ed78ad', dark: '#a83d79' },
];

export function getPalette(id: string): BalloonPalette {
  return (
    BALLOON_PALETTES.find((palette) => palette.id === id) ??
    BALLOON_PALETTES[0]!
  );
}

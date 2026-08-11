import type { BalloonPalette } from '../types';
import { APP_THEME } from '../../styles/theme';

export const BALLOON_PALETTES: BalloonPalette[] = [
  { id: 'coral', light: '#ffb3b2', base: APP_THEME.coral, dark: '#c84c59' },
  { id: 'peach', light: '#f6cf9f', base: '#e7a06b', dark: '#bd6c4e' },
  { id: 'lemon', light: '#f7e8a9', base: '#e3c86c', dark: '#ad8d43' },
  { id: 'mint', light: '#c5e4d6', base: '#80b8a9', dark: '#4e897e' },
  { id: 'sky', light: '#c6e3e4', base: '#82b6c3', dark: '#4e7f91' },
  { id: 'violet', light: '#d8d1dc', base: '#9b8fa8', dark: '#685d77' },
  { id: 'berry', light: '#e8bfd0', base: '#c8849e', dark: '#94566f' },
];

export function getPalette(id: string): BalloonPalette {
  return (
    BALLOON_PALETTES.find((palette) => palette.id === id) ??
    BALLOON_PALETTES[0]!
  );
}

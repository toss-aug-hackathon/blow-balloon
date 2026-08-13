export type AppEntry = 'home' | 'lung-test' | 'balloon-rush' | 'ranking';

const ENTRY_SEGMENTS = new Set<AppEntry>([
  'lung-test',
  'balloon-rush',
  'ranking',
]);

export function resolveAppEntry(pathname: string): AppEntry {
  const segments = pathname.split('/').filter(Boolean);
  const lastSegment = segments.at(-1);
  return lastSegment && ENTRY_SEGMENTS.has(lastSegment as AppEntry)
    ? lastSegment as AppEntry
    : 'home';
}

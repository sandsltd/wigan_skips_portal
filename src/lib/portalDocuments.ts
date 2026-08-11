export function isPortalDocumentVisible(value: unknown): boolean {
  if (value === false || value === 0) return false;
  if (typeof value === 'string') {
    return !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase());
  }
  return true;
}

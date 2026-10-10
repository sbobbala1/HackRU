export function readStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    if (fallback === null) return value && typeof value === 'object' ? value : null;
    if (Array.isArray(fallback)) return Array.isArray(value) ? value : fallback;
    return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
  } catch {return fallback;}
}

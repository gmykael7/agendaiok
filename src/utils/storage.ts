/** Cache inválido não impede a recuperação do snapshot autenticado da nuvem. */
export function readStoredArray<T>(key: string): T[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
  } catch {
    return [];
  }
}

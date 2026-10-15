/** Cache inválido não impede a recuperação do snapshot autenticado da nuvem. */
export function readStoredArray<T>(key: string): T[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
  } catch {
    return [];
  }
}

/**
 * Gravação com proteção contra estouro de cota (QuotaExceededError).
 * Se o navegador atingir o limite de 5MB, impede travamento da aplicação.
 */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`[storage] Limite de armazenamento local atingido para "${key}". Operando em memória.`, error);
    return false;
  }
}

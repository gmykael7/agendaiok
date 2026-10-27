/**
 * Data no fuso local do aparelho, no formato AAAA-MM-DD.
 * Não usar toISOString(): ele devolve a data em UTC, e para quem está no Brasil,
 * entre 21h e 24h, isso já é o dia seguinte.
 */
export const localDateKey = (date: Date = new Date(), timeZone?: string): string => {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date);
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      if (values.year && values.month && values.day) {
        return `${values.year}-${values.month}-${values.day}`;
      }
    } catch {
      // Fallback para fuso local se o identificador do fuso for inválido
    }
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

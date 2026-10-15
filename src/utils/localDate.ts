/**
 * Data no fuso local do aparelho, no formato AAAA-MM-DD.
 * Não usar toISOString(): ele devolve a data em UTC, e para quem está no Brasil,
 * entre 21h e 24h, isso já é o dia seguinte.
 */
export const localDateKey = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

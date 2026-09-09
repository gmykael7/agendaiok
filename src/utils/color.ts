export const normalizeHexColor = (value: string): string | null => {
  const raw = String(value || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    return raw.split('').map((char) => `${char}${char}`).join('');
  }
  return /^[0-9a-f]{6}$/i.test(raw) ? raw : null;
};

export const hexToRgb = (value: string): { r: number; g: number; b: number } | null => {
  const hex = normalizeHexColor(value);
  if (!hex) return null;
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
};

export const rgbToHex = (r: number, g: number, b: number): string => {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
};

export const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: h * 360, s, l };
};

export const hslToHex = (h: number, s: number, l: number): string => {
  const hNorm = ((h % 360) + 360) % 360 / 360;
  let r = 0;
  let g = 0;
  let b = 0;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      let tNorm = t;
      if (tNorm < 0) tNorm += 1;
      if (tNorm > 1) tNorm -= 1;
      if (tNorm < 1 / 6) return p + (q - p) * 6 * tNorm;
      if (tNorm < 1 / 2) return q;
      if (tNorm < 2 / 3) return p + (q - p) * (2 / 3 - tNorm) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, hNorm + 1 / 3);
    g = hue2rgb(p, q, hNorm);
    b = hue2rgb(p, q, hNorm - 1 / 3);
  }

  return rgbToHex(r * 255, g * 255, b * 255);
};

/** Ajusta o brilho de uma cor hexadecimal multiplicando seus canais RGB. */
export const adjustHexBrightness = (hex: string, factor: number): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
};

/** Deriva uma cor harmônica de destaque (accent) a partir da cor primária. */
export const deriveAccentColor = (primaryHex: string): string => {
  const rgb = hexToRgb(primaryHex);
  if (!rgb) return '#3b82f6';
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  // Desloca o tom suavemente em ~35 graus com saturação viva para compor gradientes
  const nextHue = (hsl.h + 35) % 360;
  const nextSat = Math.min(1, Math.max(0.65, hsl.s * 1.1));
  const nextLight = Math.min(0.7, Math.max(0.45, hsl.l));
  return hslToHex(nextHue, nextSat, nextLight);
};

const getRelativeLuminance = (backgroundColor: string): number | null => {
  const hex = normalizeHexColor(backgroundColor);
  if (!hex) return null;

  const channels = [0, 2, 4].map((index) => {
    const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

/** Identifica fundos claros para ativar o tratamento completo do tema. */
export const isLightColor = (backgroundColor: string): boolean =>
  (getRelativeLuminance(backgroundColor) ?? 0) >= 0.5;

/** Escolhe automaticamente texto claro ou escuro com o maior contraste WCAG. */
export const getReadableTextColor = (backgroundColor: string): '#ffffff' | '#07111f' => {
  const luminance = getRelativeLuminance(backgroundColor);
  if (luminance === null) return '#07111f';
  const contrastWithDark = (luminance + 0.05) / ((getRelativeLuminance('#07111f') ?? 0) + 0.05);
  const contrastWithWhite = 1.05 / (luminance + 0.05);

  return contrastWithDark >= contrastWithWhite ? '#07111f' : '#ffffff';
};

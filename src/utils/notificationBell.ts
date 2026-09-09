export type BellNotification = { id: string; read_at?: string };

export function unreadNotificationCount(notifications: readonly BellNotification[]) {
  return notifications.filter(n => !n.read_at).length;
}

export function bellCanAnimate(isOpening: boolean, unreadCount: number, open: boolean, reducedMotion: boolean, visible: boolean) {
  return isOpening && unreadCount > 0 && !open && !reducedMotion && visible;
}

export function bellKeyframes(frames: readonly { offset: number; value: number }[], transform: (value: number) => string, restingValue = 0): Keyframe[] {
  const result: Keyframe[] = frames.map(({ offset, value }) => ({ offset, transform: transform(value), easing: 'cubic-bezier(0.333, 0, 0.667, 1)' }));
  if (frames[0].offset > 0) result.unshift({ offset: 0, transform: transform(restingValue) });
  if (frames[frames.length - 1].offset < 1) result.push({ offset: 1, transform: transform(restingValue) });
  return result;
}

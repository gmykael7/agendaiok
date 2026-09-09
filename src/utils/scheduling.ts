import { BusinessClosurePeriod, Organization } from '../types';


export const getLocalDateKey = (date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const timeToMinutes = (timeStr?: string): number => {
  if (!timeStr) return 0;
  const [h, m] = String(timeStr).split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

export const isBreakEnabled = (org: Organization): boolean =>
  org.break_enabled === true && !!org.break_start && !!org.break_end && timeToMinutes(org.break_end) > timeToMinutes(org.break_start);

export const overlapsBusinessBreak = (
  startTime: string,
  durationMinutes: number,
  org: Organization,
): boolean => {
  if (!isBreakEnabled(org)) return false;
  const start = timeToMinutes(startTime);
  const end = start + Math.max(1, durationMinutes || 30);
  const breakStart = timeToMinutes(org.break_start);
  const breakEnd = timeToMinutes(org.break_end);
  return start < breakEnd && breakStart < end;
};

export const fitsBusinessHours = (
  startTime: string,
  durationMinutes: number,
  org: Organization,
): boolean => {
  const open = timeToMinutes(org.open_hour || '08:00');
  const close = timeToMinutes(org.close_hour || '20:00');
  const start = timeToMinutes(startTime);
  const end = start + Math.max(1, durationMinutes || 30);
  return start >= open && end <= close;
};

export const isBookableBusinessTime = (
  startTime: string,
  durationMinutes: number,
  org: Organization,
): boolean => fitsBusinessHours(startTime, durationMinutes, org) && !overlapsBusinessBreak(startTime, durationMinutes, org);

export const generateBusinessSlots = (
  org: Organization,
  durationMinutes = 30,
  stepMinutes = 30,
): string[] => {
  const open = timeToMinutes(org.open_hour || '08:00');
  const close = timeToMinutes(org.close_hour || '20:00');
  const duration = Math.max(1, durationMinutes || 30);
  const step = Math.max(5, stepMinutes || 30);
  const result: string[] = [];

  for (let minute = open; minute + duration <= close; minute += step) {
    const h = Math.floor(minute / 60).toString().padStart(2, '0');
    const m = (minute % 60).toString().padStart(2, '0');
    const time = `${h}:${m}`;
    if (isBookableBusinessTime(time, duration, org)) result.push(time);
  }

  return result;
};

export const getBusinessClosuresForDate = (org: Organization, dateStr: string): BusinessClosurePeriod[] =>
  (Array.isArray(org.closed_periods) ? org.closed_periods : [])
    .filter((period) => period && period.date === dateStr)
    .sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')));

export const isBusinessClosedAllDay = (org: Organization, dateStr: string): boolean =>
  getBusinessClosuresForDate(org, dateStr).some((period) => period.all_day === true);

export const overlapsBusinessClosure = (
  startTime: string,
  durationMinutes: number,
  dateStr: string,
  org: Organization,
): boolean => {
  const start = timeToMinutes(startTime);
  const end = start + Math.max(1, durationMinutes || 30);
  return getBusinessClosuresForDate(org, dateStr).some((period) => {
    if (period.all_day === true) return true;
    if (!period.start || !period.end) return false;
    const closureStart = timeToMinutes(period.start);
    const closureEnd = timeToMinutes(period.end);
    return closureEnd > closureStart && start < closureEnd && closureStart < end;
  });
};

export const getBusinessClosureAtTime = (
  org: Organization,
  dateStr: string,
  timeStr: string,
): BusinessClosurePeriod | undefined => {
  const minute = timeToMinutes(timeStr);
  return getBusinessClosuresForDate(org, dateStr).find((period) => {
    if (period.all_day === true) return true;
    if (!period.start || !period.end) return false;
    return minute >= timeToMinutes(period.start) && minute < timeToMinutes(period.end);
  });
};

export const isBookableBusinessDateTime = (
  startTime: string,
  durationMinutes: number,
  dateStr: string,
  org: Organization,
): boolean =>
  isBookableBusinessTime(startTime, durationMinutes, org) &&
  !overlapsBusinessClosure(startTime, durationMinutes, dateStr, org);

const REEFER_TIME_REGEX = /^\d+:[0-5]\d$/;

export function isValidReeferTime(value: string): boolean {
  return REEFER_TIME_REGEX.test(value.trim());
}

export function parseReeferMinutes(value: string): number | null {
  const trimmed = value.trim();
  if (!REEFER_TIME_REGEX.test(trimmed)) return null;
  const [hoursStr, minsStr] = trimmed.split(':');
  const hours = Number(hoursStr);
  const mins = Number(minsStr);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
  return hours * 60 + mins;
}

export function formatMinutesToHHMM(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return '0:00';
  const rounded = Math.round(totalMinutes);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return `${hours}:${String(mins).padStart(2, '0')}`;
}

export function diffReeferMinutes(startStr: string, endStr: string): number {
  const startMin = parseReeferMinutes(startStr);
  const endMin = parseReeferMinutes(endStr);
  if (startMin === null || endMin === null || endMin < startMin) return 0;
  return endMin - startMin;
}

export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || Number.isNaN(num)) return '—';
  return new Intl.NumberFormat('vi-VN').format(num);
}

export function formatDateVN(isoDate: string): string {
  if (!isoDate) return '—';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

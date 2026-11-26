import type {TrafficLevel} from '../types/karbala';

/**
 * Tier 2: Inspect async API errors from Google Maps JS SDK wrappers
 * for quota exhaustion and notify the root quota banner listener.
 */
export function checkAndDispatchQuotaError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : JSON.stringify(error ?? '');

  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? String((error as {status: unknown}).status)
      : '';

  const isQuotaError =
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('OVER_QUERY_LIMIT') ||
    message.includes('QuotaExceededError') ||
    message.includes('429') ||
    status === '429' ||
    status === 'RESOURCE_EXHAUSTED' ||
    status === 'OVER_QUERY_LIMIT';

  if (isQuotaError) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
  return isQuotaError;
}

export function classifyTrafficLevel(
  durationMillis: number,
  staticDurationMillis: number,
  speedPaths?: google.maps.routes.SpeedPath[]
): TrafficLevel {
  if (!durationMillis || !staticDurationMillis) {
    return 'unknown';
  }

  const ratio = durationMillis / staticDurationMillis;
  const delayMinutes = Math.round((durationMillis - staticDurationMillis) / 60000);

  const hasJamSegment =
    speedPaths?.some((segment) => segment.speed === 'TRAFFIC_JAM') ?? false;
  const hasSlowSegment =
    speedPaths?.some((segment) => segment.speed === 'SLOW') ?? false;

  if (ratio >= 1.35 || delayMinutes >= 6 || hasJamSegment) {
    return 'jam';
  }
  if (ratio >= 1.12 || delayMinutes >= 2 || hasSlowSegment) {
    return 'slow';
  }
  return 'normal';
}

export function formatArabicDistance(meters: number): string {
  if (!meters || meters <= 0) return '—';
  if (meters < 1000) {
    return `${Math.round(meters)} م`;
  }
  return `${(meters / 1000).toFixed(1)} كم`;
}

export function formatArabicDuration(millis: number): string {
  if (!millis || millis <= 0) return '—';
  const totalMinutes = Math.max(1, Math.round(millis / 60000));
  if (totalMinutes < 60) {
    return `${totalMinutes} دقيقة`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hours} س ${mins} د` : `${hours} ساعة`;
}

export function getTrafficMeta(level: TrafficLevel): {
  label: string;
  colorClass: string;
  borderClass: string;
  dotColor: string;
  strokeColor: string;
} {
  switch (level) {
    case 'normal':
      return {
        label: 'سالك بانسيابية',
        colorClass: 'text-emerald-800',
        borderClass: 'border-emerald-200 bg-emerald-50/70',
        dotColor: '#059669',
        strokeColor: '#059669',
      };
    case 'slow':
      return {
        label: 'حركة بطيئة',
        colorClass: 'text-amber-800',
        borderClass: 'border-amber-200 bg-amber-50/70',
        dotColor: '#D97706',
        strokeColor: '#D97706',
      };
    case 'jam':
      return {
        label: 'ازدحام مروري',
        colorClass: 'text-red-800',
        borderClass: 'border-red-200 bg-red-50/70',
        dotColor: '#DC2626',
        strokeColor: '#DC2626',
      };
    default:
      return {
        label: 'جاهز للفحص',
        colorClass: 'text-stone-600',
        borderClass: 'border-stone-200 bg-stone-50',
        dotColor: '#78716C',
        strokeColor: '#0F5132',
      };
  }
}

export function formatEstimatedArrivalClock(durationMillis: number): string {
  if (!durationMillis || durationMillis <= 0) return '—';
  const arrivalDate = new Date(Date.now() + durationMillis);
  try {
    return new Intl.DateTimeFormat('ar-IQ', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(arrivalDate);
  } catch {
    return arrivalDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

export function isPointInsideKarbala(point: {lat: number; lng: number}): boolean {
  return (
    point.lat >= 32.15 &&
    point.lat <= 32.85 &&
    point.lng >= 43.35 &&
    point.lng <= 44.45
  );
}

export function haversineMeters(
  a: {lat: number; lng: number},
  b: {lat: number; lng: number}
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}


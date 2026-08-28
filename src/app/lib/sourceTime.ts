/**
 * Source telemetry uses China civil time for legacy DATETIME values.  Keep
 * this contract independent of the browser/host timezone: an offset-less
 * value is always interpreted as UTC+08:00, while an offset-aware value keeps
 * the instant represented by its explicit offset.
 */
export const SOURCE_TIME_OFFSET_MINUTES = 8 * 60;
const SOURCE_TIME_OFFSET_MS = SOURCE_TIME_OFFSET_MINUTES * 60 * 1000;
const EXPLICIT_OFFSET = /(?:z|[+-]\d{2}:?\d{2})$/i;

function sourceText(value: string) {
  const text = value.trim();
  if (!text || EXPLICIT_OFFSET.test(text)) return text;

  // MySQL DATETIME values are normally `YYYY-MM-DD HH:mm:ss[.fraction]`.
  // Normalize the separator before adding the explicit source offset so the
  // ECMAScript parser never falls back to the host's local timezone.
  const normalized = text.replace(' ', 'T');
  return `${normalized}+08:00`;
}

/** Parse a telemetry timestamp into an instant using the source-time contract. */
export function parseSourceDate(value?: string | number | null): Date | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  const text = sourceText(String(value));
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function parseSourceDateMs(value?: string | number | null) {
  return parseSourceDate(value)?.getTime() ?? null;
}

function sourceParts(value: string | number | Date) {
  const millis = value instanceof Date ? value.getTime() : parseSourceDateMs(value);
  if (millis === null || !Number.isFinite(millis)) return null;
  // Add the fixed source offset and read UTC fields. This is deterministic even
  // when the browser is running in UTC, a DST zone, or another local timezone.
  const shifted = new Date(millis + SOURCE_TIME_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    millisecond: shifted.getUTCMilliseconds(),
  };
}

function pad(value: number, width = 2) {
  return String(value).padStart(width, '0');
}

/** Format an instant as source-civil `YYYY-MM-DD HH:mm:ss`. */
export function formatSourceDateTime(value?: string | number | Date | null) {
  if (value === undefined || value === null || value === '') return '';
  const parts = sourceParts(value);
  if (!parts) return '';
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

export function formatSourceTime(value?: string | number | Date | null) {
  const dateTime = formatSourceDateTime(value);
  return dateTime ? dateTime.slice(11, 19) : '';
}

export function formatSourceDate(value?: string | number | Date | null) {
  const dateTime = formatSourceDateTime(value);
  return dateTime ? dateTime.slice(0, 10) : '';
}

/**
 * Convert a source-civil value to the API's explicit offset form. Preserve
 * source fractional seconds when possible; this matters for same-second rows
 * whose ordering is completed by source_row_no.
 */
export function toSourceDateTimeOffset(value?: string | null) {
  const text = String(value || '').trim();
  if (!text) return undefined;
  if (EXPLICIT_OFFSET.test(text)) {
    const millis = parseSourceDateMs(text);
    return millis === null ? undefined : new Date(millis).toISOString();
  }

  const normalized = text.replace(' ', 'T');
  // Only append the offset for an ISO-like civil date. Returning undefined for
  // malformed input keeps the caller's existing validation behavior.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(normalized)) return undefined;
  const withSeconds = normalized.length === 16 ? `${normalized}:00` : normalized;
  return `${withSeconds}+08:00`;
}

/** Shift a timestamp while retaining source-civil formatting. */
export function shiftSourceTimestamp(value: string, deltaMs: number) {
  if (!value) return '';
  const millis = parseSourceDateMs(value);
  if (millis === null) return value;
  return formatSourceDateTime(millis + deltaMs) || value;
}


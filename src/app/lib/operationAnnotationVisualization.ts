import type { BlindReviewWindow } from './operationAnnotationContract';

export interface PolylinePoint { index: number; value: number; unit: string | null; }
export interface PolylineModel { segments: PolylinePoint[][]; missingIndexes: number[]; min: number; max: number; unit: string | null; }

/** Builds disconnected SVG segments: unavailable telemetry never gets interpolated. */
export function buildPolylineModel(review: BlindReviewWindow, signal: string): PolylineModel {
  const segments: PolylinePoint[][] = []; let current: PolylinePoint[] = []; const missingIndexes: number[] = [];
  let min = Number.POSITIVE_INFINITY; let max = Number.NEGATIVE_INFINITY; let unit: string | null = null;
  review.frames.forEach((frame, index) => {
    const observed = frame.signals[signal];
    if (!observed?.available || observed.value === null) {
      if (current.length) segments.push(current);
      current = []; missingIndexes.push(index); return;
    }
    current.push({ index, value: observed.value, unit: observed.unit });
    min = Math.min(min, observed.value); max = Math.max(max, observed.value); unit ??= observed.unit;
  });
  if (current.length) segments.push(current);
  return { segments, missingIndexes, min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 1, unit };
}

export function frameAtTimestamp(review: BlindReviewWindow, timestamp: string | null) {
  return timestamp ? review.frames.find((frame) => frame.timestamp === timestamp) ?? null : null;
}

export function transitionTimeline<T extends object>(frames: T[], timestamp: (frame: T) => string, fields: Array<keyof T>) {
  return frames.filter((frame, index) => index === 0 || fields.some((field) => frame[field] !== frames[index - 1][field]));
}

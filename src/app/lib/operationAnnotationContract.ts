export const MANUAL_OPERATION_KINDS = [
  'RotaryDrilling', 'SlideDrilling', 'Circulation', 'ReamingOrBackreaming', 'TrippingIn', 'TrippingOut',
  'Connection', 'StaticObservation', 'OtherMechanical', 'Unknown', 'InsufficientTelemetry',
] as const;
export const MANUAL_STRING_MOTIONS = ['Stationary', 'MovingTowardBottom', 'MovingAwayFromBottom', 'MixedOrReversal', 'Unknown', 'InsufficientTelemetry'] as const;
export const CONFIDENCE_VALUES = ['Certain', 'Probable', 'Ambiguous'] as const;
export const EVIDENCE_QUALITY_VALUES = ['Sufficient', 'Limited', 'Insufficient'] as const;

export type ManualOperationKind = typeof MANUAL_OPERATION_KINDS[number];
export type ManualStringMotion = typeof MANUAL_STRING_MOTIONS[number];
export type Confidence = typeof CONFIDENCE_VALUES[number];
export type EvidenceQuality = typeof EVIDENCE_QUALITY_VALUES[number];
export type AnnotationPhase = 'UNLABELED' | 'BLIND_LABELED' | 'REVEALED' | 'FINALIZED';

export interface AnnotationSignal { value: number | null; unit: string | null; available: boolean; }
export interface BlindTelemetryFrame { timestamp: string; signals: Record<string, AnnotationSignal>; }
export interface BlindReviewWindow { reviewId: string; eventKey: string; windowStart: string; windowEnd: string; frames: BlindTelemetryFrame[]; }
export interface BlindDataset { packVersion: string; sourceVersion: string; annotationVersion: string; randomSeed: number; reviewWindows: BlindReviewWindow[]; }
export interface OverlayFrame {
  timestamp: string; v1FineLabel: string; v1Kind: string; v1Category: string; controlCandidateFineLabel: string; controlConfirmedFineLabel: string | null;
  controlStatus: string; anchoredCandidateFineLabel: string; anchoredConfirmedFineLabel: string | null; anchoredStatus: string;
  recordedActcod: string | null; pumpGateStatus: string | null; controlMotion: string; anchoredMotion: string; anchoredMotionReason: string; motionConfirmationBasis: string;
  futureNetBitDepth5s: number | null; futureNetBitDepth8s: number | null; futureNetBitDepth10s: number | null; futureNetBitDepth15s: number | null;
  futureNetBitDepth30s: number | null; futureNetBitDepth60s: number | null;
}
export interface OverlayDataset { packVersion: string; sourceVersion: string; reviewWindows: Array<{ reviewId: string; frames: OverlayFrame[] }>; }

export interface ManualAnnotation {
  reviewId: string; annotatorId: string; eventKey: string; windowStart: string; windowEnd: string; segmentStart: string; segmentEnd: string;
  manualOperationKind: ManualOperationKind; manualOperationCategory: string; manualStringMotion: ManualStringMotion; confidence: Confidence; evidenceQuality: EvidenceQuality;
  transitionIntervalStart: string; transitionIntervalEnd: string; notes: string; createdAt: string; sourceVersion: string; annotationVersion: string;
  preRevealManualLabel: string; postRevealRevision: boolean; revisionReason: string;
}

export const ANNOTATION_CSV_HEADER = ['ReviewId', 'AnnotatorId', 'EventKey', 'WindowStart', 'WindowEnd', 'SegmentStart', 'SegmentEnd', 'ManualOperationKind', 'ManualOperationCategory', 'ManualStringMotion', 'Confidence', 'EvidenceQuality', 'TransitionIntervalStart', 'TransitionIntervalEnd', 'Notes', 'CreatedAt', 'SourceVersion', 'AnnotationVersion', 'PreRevealManualLabel', 'PostRevealRevision', 'RevisionReason'];

export function operationCategory(kind: ManualOperationKind) {
  if (kind === 'RotaryDrilling' || kind === 'SlideDrilling') return 'Drilling';
  if (kind === 'Circulation') return 'Circulation';
  if (kind === 'TrippingIn') return 'TrippingIn';
  if (kind === 'TrippingOut') return 'TrippingOut';
  if (kind === 'StaticObservation') return 'Static';
  if (kind === 'OtherMechanical' || kind === 'ReamingOrBackreaming' || kind === 'Connection') return 'MechanicalOther';
  return 'Unknown';
}

export function validateBlindDataset(value: unknown): BlindDataset {
  const dataset = value as Partial<BlindDataset>;
  if (!dataset || !Array.isArray(dataset.reviewWindows) || typeof dataset.packVersion !== 'string') throw new Error('不是有效的 blind annotation dataset。');
  const forbidden = JSON.stringify(value).toLowerCase();
  for (const token of ['v1finelabel', 'anchoredconfirmedfinelabel', 'recordedactcod', 'triggerreasons', 'futurenetbitdepth', 'motionconfirmationbasis', 'pumpgatestatus']) {
    if (forbidden.includes(token)) throw new Error('Blind dataset 包含模型或选择元数据，拒绝加载。');
  }
  return dataset as BlindDataset;
}

export function canReveal(reviewId: string, annotations: ManualAnnotation[]) {
  return annotations.some((annotation) => annotation.reviewId === reviewId && annotation.preRevealManualLabel.length > 0);
}

export function createBlindAnnotation(input: Omit<ManualAnnotation, 'manualOperationCategory' | 'createdAt' | 'preRevealManualLabel' | 'postRevealRevision' | 'revisionReason'>): ManualAnnotation {
  const preRevealManualLabel = JSON.stringify({ operation: input.manualOperationKind, motion: input.manualStringMotion, confidence: input.confidence, quality: input.evidenceQuality, start: input.segmentStart, end: input.segmentEnd });
  return { ...input, manualOperationCategory: operationCategory(input.manualOperationKind), createdAt: new Date().toISOString(), preRevealManualLabel, postRevealRevision: false, revisionReason: '' };
}

export function reviseAfterReveal(original: ManualAnnotation, patch: Pick<ManualAnnotation, 'manualOperationKind' | 'manualStringMotion' | 'confidence' | 'evidenceQuality' | 'notes' | 'segmentStart' | 'segmentEnd'>, revisionReason: string): ManualAnnotation {
  if (!revisionReason.trim()) throw new Error('Reveal 后修改必须填写 RevisionReason。');
  return { ...original, ...patch, manualOperationCategory: operationCategory(patch.manualOperationKind), postRevealRevision: true, revisionReason, createdAt: new Date().toISOString() };
}

function quote(value: unknown) { const text = String(value ?? ''); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
export function annotationsToCsv(annotations: ManualAnnotation[]) {
  const fields: Array<keyof ManualAnnotation> = ['reviewId', 'annotatorId', 'eventKey', 'windowStart', 'windowEnd', 'segmentStart', 'segmentEnd', 'manualOperationKind', 'manualOperationCategory', 'manualStringMotion', 'confidence', 'evidenceQuality', 'transitionIntervalStart', 'transitionIntervalEnd', 'notes', 'createdAt', 'sourceVersion', 'annotationVersion', 'preRevealManualLabel', 'postRevealRevision', 'revisionReason'];
  return [ANNOTATION_CSV_HEADER.join(','), ...annotations.map((annotation) => fields.map((field) => quote(annotation[field])).join(','))].join('\n');
}

export function annotationsFromCsv(source: string): ManualAnnotation[] {
  const [header, ...rows] = source.trim().split(/\r?\n/); if (!header) return [];
  const columns = parseCsvLine(header); if (columns.join(',') !== ANNOTATION_CSV_HEADER.join(',')) throw new Error('annotation CSV schema 不匹配。');
  return rows.filter(Boolean).map((row) => {
    const fields = parseCsvLine(row); const item = Object.fromEntries(columns.map((column, index) => [column, fields[index] ?? ''])) as Record<string, string>;
    return { reviewId: item.ReviewId, annotatorId: item.AnnotatorId, eventKey: item.EventKey, windowStart: item.WindowStart, windowEnd: item.WindowEnd, segmentStart: item.SegmentStart, segmentEnd: item.SegmentEnd,
      manualOperationKind: item.ManualOperationKind as ManualOperationKind, manualOperationCategory: item.ManualOperationCategory, manualStringMotion: item.ManualStringMotion as ManualStringMotion,
      confidence: item.Confidence as Confidence, evidenceQuality: item.EvidenceQuality as EvidenceQuality, transitionIntervalStart: item.TransitionIntervalStart, transitionIntervalEnd: item.TransitionIntervalEnd,
      notes: item.Notes, createdAt: item.CreatedAt, sourceVersion: item.SourceVersion, annotationVersion: item.AnnotationVersion, preRevealManualLabel: item.PreRevealManualLabel,
      postRevealRevision: item.PostRevealRevision === 'true', revisionReason: item.RevisionReason };
  });
}

function parseCsvLine(line: string) {
  const values: string[] = []; let current = ''; let quoted = false;
  for (let index = 0; index < line.length; index += 1) { const char = line[index]; if (quoted && char === '"' && line[index + 1] === '"') { current += '"'; index += 1; } else if (char === '"') quoted = !quoted; else if (char === ',' && !quoted) { values.push(current); current = ''; } else current += char; }
  values.push(current); return values;
}

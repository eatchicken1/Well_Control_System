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
export type AnnotationPhase = 'UNLABELED' | 'BLIND_INCOMPLETE' | 'BLIND_COMPLETE' | 'REVEALED';
export type AnnotationRecordType = 'BlindAnnotationRecord' | 'PostRevealRevision' | 'RevealAuditEvent';
export type RevisionAction = '' | 'Edit' | 'Reveal';

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
  recordType: AnnotationRecordType;
  annotationId: string;
  originalAnnotationId: string;
  revisionAction: RevisionAction;
  notPartOfPrimaryBlindGroundTruth: boolean;
  reviewId: string; annotatorId: string; eventKey: string; windowStart: string; windowEnd: string; segmentStart: string; segmentEnd: string;
  manualOperationKind: ManualOperationKind; manualOperationCategory: string; manualStringMotion: ManualStringMotion; confidence: Confidence; evidenceQuality: EvidenceQuality;
  transitionIntervalStart: string; transitionIntervalEnd: string; notes: string; createdAt: string; sourceVersion: string; annotationVersion: string;
  preRevealSnapshot: string; postRevealRevision: boolean; revisionReason: string;
}

export type BlindAnnotationInput = Omit<ManualAnnotation,
  'recordType' | 'annotationId' | 'originalAnnotationId' | 'revisionAction' | 'notPartOfPrimaryBlindGroundTruth' |
  'manualOperationCategory' | 'createdAt' | 'preRevealSnapshot' | 'postRevealRevision' | 'revisionReason'>;

export const ANNOTATION_CSV_HEADER = [
  'RecordType', 'AnnotationId', 'OriginalAnnotationId', 'RevisionAction', 'NotPartOfPrimaryBlindGroundTruth',
  'ReviewId', 'AnnotatorId', 'EventKey', 'WindowStart', 'WindowEnd', 'SegmentStart', 'SegmentEnd',
  'ManualOperationKind', 'ManualOperationCategory', 'ManualStringMotion', 'Confidence', 'EvidenceQuality',
  'TransitionIntervalStart', 'TransitionIntervalEnd', 'Notes', 'CreatedAt', 'SourceVersion', 'AnnotationVersion',
  'PreRevealSnapshot', 'PostRevealRevision', 'RevisionReason',
];

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
  for (const token of ['v1finelabel', 'anchoredconfirmedfinelabel', 'recordedactcod', 'triggerreasons', 'selectionstrata', 'uniformtimeaudit', 'futurenetbitdepth', 'motionconfirmationbasis', 'pumpgatestatus']) {
    if (forbidden.includes(token)) throw new Error('Blind dataset 包含模型、未来信息或选择元数据，拒绝加载。');
  }
  return dataset as BlindDataset;
}

export interface BlindCompletion { complete: boolean; issues: string[]; boundaryStart: string; boundaryEnd: string; }

/** Uses first/last admitted frame timestamps, never synthetic window edges. */
export function validateBlindWindowCompletion(review: BlindReviewWindow, records: ManualAnnotation[]): BlindCompletion {
  const boundaryStart = review.frames[0]?.timestamp ?? '';
  const boundaryEnd = review.frames.at(-1)?.timestamp ?? '';
  const issues: string[] = [];
  if (!boundaryStart || !boundaryEnd) return { complete: false, issues: ['NO_TELEMETRY_BOUNDARY'], boundaryStart, boundaryEnd };
  const startMs = Date.parse(boundaryStart); const endMs = Date.parse(boundaryEnd);
  const segments = primaryBlindRecords(records).filter((record) => record.reviewId === review.reviewId)
    .slice().sort((a, b) => Date.parse(a.segmentStart) - Date.parse(b.segmentStart) || a.annotationId.localeCompare(b.annotationId));
  if (!segments.length) issues.push('NO_BLIND_SEGMENTS');
  let cursor = startMs;
  for (const segment of segments) {
    const segmentStart = Date.parse(segment.segmentStart); const segmentEnd = Date.parse(segment.segmentEnd);
    if (!Number.isFinite(segmentStart) || !Number.isFinite(segmentEnd)) { issues.push(`INVALID_TIMESTAMP:${segment.annotationId}`); continue; }
    if (segmentStart < startMs || segmentEnd > endMs) issues.push(`OUTSIDE_WINDOW:${segment.annotationId}`);
    if (segmentStart >= segmentEnd) issues.push(`ZERO_OR_NEGATIVE_LENGTH:${segment.annotationId}`);
    if (segmentStart < cursor) issues.push(`OVERLAP:${segment.annotationId}`);
    if (segmentStart > cursor) issues.push(`UNLABELED_GAP:${segment.annotationId}`);
    cursor = Math.max(cursor, segmentEnd);
  }
  if (cursor < endMs) issues.push('UNLABELED_GAP:WINDOW_END');
  return { complete: issues.length === 0, issues, boundaryStart, boundaryEnd };
}

export function canReveal(review: BlindReviewWindow, records: ManualAnnotation[]) {
  return validateBlindWindowCompletion(review, records).complete;
}

export function canCreateBlindSegment(revealed: boolean) { return !revealed; }
export function canMutateBlindTopology(revealed: boolean) { return !revealed; }
export function canShowFutureNet(revealed: boolean) { return revealed; }
export function isReviewRevealed(reviewId: string, records: ManualAnnotation[]) {
  return records.some((record) => record.reviewId === reviewId && (record.recordType === 'RevealAuditEvent' || record.recordType === 'PostRevealRevision'));
}

export function primaryBlindRecords(records: ManualAnnotation[]) {
  return records.filter((record) => record.recordType === 'BlindAnnotationRecord');
}

export function effectiveAnnotation(record: ManualAnnotation, records: ManualAnnotation[]) {
  const revisions = records.filter((item) => item.recordType === 'PostRevealRevision' && item.originalAnnotationId === record.annotationId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.annotationId.localeCompare(b.annotationId));
  return revisions.at(-1) ?? record;
}

export function createBlindAnnotation(input: BlindAnnotationInput, annotationId: string = createAnnotationId(), createdAt = new Date().toISOString()): ManualAnnotation {
  const snapshot = JSON.stringify({ ...input, annotationId, createdAt, manualOperationCategory: operationCategory(input.manualOperationKind) });
  return {
    ...input, recordType: 'BlindAnnotationRecord', annotationId, originalAnnotationId: '', revisionAction: '', notPartOfPrimaryBlindGroundTruth: false,
    manualOperationCategory: operationCategory(input.manualOperationKind), createdAt, preRevealSnapshot: snapshot, postRevealRevision: false, revisionReason: '',
  };
}

/** Persisted append-only event: a reload cannot reopen a revealed blind window. */
export function createRevealAuditEvent(review: BlindReviewWindow, annotatorId: string, sourceVersion: string, annotationVersion: string,
  annotationId: string = createAnnotationId(), createdAt = new Date().toISOString()): ManualAnnotation {
  const snapshot = JSON.stringify({ reviewId: review.reviewId, boundaryStart: review.frames[0]?.timestamp, boundaryEnd: review.frames.at(-1)?.timestamp, createdAt });
  return {
    recordType: 'RevealAuditEvent', annotationId, originalAnnotationId: '', revisionAction: 'Reveal', notPartOfPrimaryBlindGroundTruth: true,
    reviewId: review.reviewId, annotatorId: annotatorId || 'unspecified', eventKey: review.eventKey, windowStart: review.windowStart, windowEnd: review.windowEnd,
    segmentStart: review.frames[0]?.timestamp || '', segmentEnd: review.frames.at(-1)?.timestamp || '', manualOperationKind: 'Unknown', manualOperationCategory: 'Unknown', manualStringMotion: 'Unknown',
    confidence: 'Ambiguous', evidenceQuality: 'Limited', transitionIntervalStart: '', transitionIntervalEnd: '', notes: 'Reveal audit event; not a manual label.', createdAt,
    sourceVersion, annotationVersion, preRevealSnapshot: snapshot, postRevealRevision: true, revisionReason: 'BlindWindowComplete confirmed before reveal.',
  };
}

export function reviseAfterReveal(original: ManualAnnotation,
  patch: Pick<ManualAnnotation, 'manualOperationKind' | 'manualStringMotion' | 'confidence' | 'evidenceQuality' | 'notes' | 'segmentStart' | 'segmentEnd' | 'transitionIntervalStart' | 'transitionIntervalEnd'>,
  revisionReason: string, annotationId: string = createAnnotationId(), createdAt = new Date().toISOString()): ManualAnnotation {
  if (!revisionReason.trim()) throw new Error('Reveal 后修改必须填写 RevisionReason。');
  const rootId = original.recordType === 'BlindAnnotationRecord' ? original.annotationId : original.originalAnnotationId;
  return {
    ...original, ...patch, recordType: 'PostRevealRevision', annotationId, originalAnnotationId: rootId, revisionAction: 'Edit', notPartOfPrimaryBlindGroundTruth: true,
    manualOperationCategory: operationCategory(patch.manualOperationKind), createdAt, preRevealSnapshot: original.preRevealSnapshot, postRevealRevision: true, revisionReason,
  };
}

function createAnnotationId() { return globalThis.crypto?.randomUUID?.() ?? `annotation-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function quote(value: unknown) { const text = String(value ?? ''); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
export function annotationsToCsv(records: ManualAnnotation[], primaryOnly = false) {
  const fields: Array<keyof ManualAnnotation> = [
    'recordType', 'annotationId', 'originalAnnotationId', 'revisionAction', 'notPartOfPrimaryBlindGroundTruth',
    'reviewId', 'annotatorId', 'eventKey', 'windowStart', 'windowEnd', 'segmentStart', 'segmentEnd',
    'manualOperationKind', 'manualOperationCategory', 'manualStringMotion', 'confidence', 'evidenceQuality',
    'transitionIntervalStart', 'transitionIntervalEnd', 'notes', 'createdAt', 'sourceVersion', 'annotationVersion',
    'preRevealSnapshot', 'postRevealRevision', 'revisionReason',
  ];
  const exported = primaryOnly ? primaryBlindRecords(records) : records;
  return [ANNOTATION_CSV_HEADER.join(','), ...exported.map((record) => fields.map((field) => quote(record[field])).join(','))].join('\n');
}

export function annotationsFromCsv(source: string): ManualAnnotation[] {
  const [header, ...rows] = source.trim().split(/\r?\n/); if (!header) return [];
  const columns = parseCsvLine(header); if (columns.join(',') !== ANNOTATION_CSV_HEADER.join(',')) throw new Error('annotation CSV schema 不匹配。');
  return rows.filter(Boolean).map((row) => {
    const fields = parseCsvLine(row); const item = Object.fromEntries(columns.map((column, index) => [column, fields[index] ?? ''])) as Record<string, string>;
    return {
      recordType: item.RecordType as AnnotationRecordType, annotationId: item.AnnotationId, originalAnnotationId: item.OriginalAnnotationId, revisionAction: item.RevisionAction as RevisionAction,
      notPartOfPrimaryBlindGroundTruth: item.NotPartOfPrimaryBlindGroundTruth === 'true', reviewId: item.ReviewId, annotatorId: item.AnnotatorId, eventKey: item.EventKey,
      windowStart: item.WindowStart, windowEnd: item.WindowEnd, segmentStart: item.SegmentStart, segmentEnd: item.SegmentEnd,
      manualOperationKind: item.ManualOperationKind as ManualOperationKind, manualOperationCategory: item.ManualOperationCategory, manualStringMotion: item.ManualStringMotion as ManualStringMotion,
      confidence: item.Confidence as Confidence, evidenceQuality: item.EvidenceQuality as EvidenceQuality, transitionIntervalStart: item.TransitionIntervalStart,
      transitionIntervalEnd: item.TransitionIntervalEnd, notes: item.Notes, createdAt: item.CreatedAt, sourceVersion: item.SourceVersion, annotationVersion: item.AnnotationVersion,
      preRevealSnapshot: item.PreRevealSnapshot, postRevealRevision: item.PostRevealRevision === 'true', revisionReason: item.RevisionReason,
    };
  });
}

function parseCsvLine(line: string) {
  const values: string[] = []; let current = ''; let quoted = false;
  for (let index = 0; index < line.length; index += 1) { const char = line[index]; if (quoted && char === '"' && line[index + 1] === '"') { current += '"'; index += 1; } else if (char === '"') quoted = !quoted; else if (char === ',' && !quoted) { values.push(current); current = ''; } else current += char; }
  values.push(current); return values;
}

export type ExplanationSource = 'deterministic' | string;
export type ExplanationLoadState = 'idle' | 'loading' | 'loaded' | 'fallback' | 'error';

export interface EventPhaseSegment {
  phaseId: string;
  eventId: string;
  candidateId: number;
  phaseType: string;
  operatingCondition: string;
  pumpState: string;
  boundaryPhase: string;
  operationEpisodeId: string;
  referenceAvailability: string;
  dataQualityLevel: string;
  startReason: string;
  endReason: string;
  startedAt: string;
  endedAt?: string | null;
  isActive: boolean;
  revision: number;
  hasDataGap: boolean;
  parameterBehaviors: ParameterBehavior[];
}

export interface ParameterBehavior {
  signalCode: string;
  fieldName: string;
  category: string;
  unit: string;
  phaseId: string;
  phaseType: string;
  referenceType: string;
  referenceValue?: number | null;
  referenceLow?: number | null;
  referenceHigh?: number | null;
  referenceConfidence: number;
  startValue?: number | null;
  endValue?: number | null;
  medianValue?: number | null;
  robustMin?: number | null;
  robustMax?: number | null;
  absoluteChange?: number | null;
  relativeChangePct?: number | null;
  residualFromReference?: number | null;
  residualZ?: number | null;
  robustSlopePerMinute?: number | null;
  continuousDeviationSeconds: number;
  firstDeviationAt?: string | null;
  lastDeviationAt?: string | null;
  recoveredAt?: string | null;
  integratedLowerBoundM3?: number | null;
  integratedNominalM3?: number | null;
  behaviorType: string;
  evidenceRole: string;
  interpretationCode: string;
  interpretation: string;
  dataQuality: string;
  semanticType: string;
  semanticConfidence: number;
  coverageSeconds: number;
  missingCoverageSeconds: number;
}

export interface EventEvidenceExplanation {
  evidenceId: string;
  phaseId: string;
  category: string;
  fieldName: string;
  role: string;
  strength: string;
  confidence: number;
  observedFact: string;
  physicalMeaning: string;
  supportsKick: boolean;
  supportsOperation: boolean;
  supportsSensorArtifact: boolean;
  limitation: string;
  startedAt: string;
  lastUpdatedAt: string;
}

export interface DeterministicEventExplanation {
  currentConclusion: string;
  currentPhaseSummary: string;
  preStopSummary?: string | null;
  pumpStopTransitionSummary?: string | null;
  postStopSummary?: string | null;
  shutInSummary?: string | null;
  restartSummary?: string | null;
  recoverySummary?: string | null;
  supportingEvidence: EventEvidenceExplanation[];
  contradictingEvidence: EventEvidenceExplanation[];
  alternativeExplanations: string[];
  operatorChecks: string[];
  dataLimitations: string[];
  changesSincePreviousRevision: string[];
  currentPhase: string;
  resolutionState: string;
  currentLevel: number;
  highestLevel: number;
}

export interface EventExplanation {
  eventId: string;
  candidateId: number;
  factRevision: number;
  explanationRevision: number;
  currentLevel: number;
  highestLevel: number;
  eventStatus: string;
  currentPhase: string;
  startedAt: string;
  updatedAt: string;
  deterministicSummary: DeterministicEventExplanation;
  effectiveSummary: DeterministicEventExplanation;
  explanationSource: ExplanationSource;
  phases: EventPhaseSegment[];
  parameterBehaviors: ParameterBehavior[];
  supportingEvidence: EventEvidenceExplanation[];
  contradictingEvidence: EventEvidenceExplanation[];
  alternativeExplanations: string[];
  operatorChecks: string[];
  dataLimitations: string[];
  changesSincePreviousRevision: string[];
  materialFactHash: string;
  generatedAt: string;
  generatorVersion: string;
  /** Latest persisted backend frame, when the narrative service is unavailable. */
  latestFrame?: {
    sampleTime: string;
    publicLevel: number;
    formalEvalLevel: number;
    eventState: string;
    inletFlow?: number | null;
    outletFlow?: number | null;
    pitVolume?: number | null;
    standpipePressure?: number | null;
    casingPressure?: number | null;
    bitDepth?: number | null;
    wellDepth?: number | null;
  };
  trend?: Array<{
    sampleTime: string;
    inletFlow?: number | null;
    outletFlow?: number | null;
    pitVolume?: number | null;
    standpipePressure?: number | null;
    casingPressure?: number | null;
  }>;
}

export interface EventExplanationCacheEntry {
  explanation?: EventExplanation;
  explanationRevision: number;
  factRevision: number;
  loadedAt: string;
  status: ExplanationLoadState;
}

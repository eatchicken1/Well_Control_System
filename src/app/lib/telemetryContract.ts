export type OutletSemanticKind = 'TrueVolumetricFlow' | 'TrueReturnFlow' | 'ValveOpeningProxy' | 'UnknownProxy' | string;

export function computeObservedFlowDelta(
  flowIn: number | null,
  flowOut: number | null,
  outletSemantic: string | undefined,
): number | null {
  if (!isTrueFlowSemantic(outletSemantic)) return null;
  if (flowIn === null || flowOut === null) return null;
  if (!Number.isFinite(flowIn) || !Number.isFinite(flowOut)) return null;
  return flowOut - flowIn;
}

export function isTrueFlowSemantic(semantic: string | undefined | null): boolean {
  if (!semantic) return false;
  return /^true(volumetric|return)flow$/i.test(semantic)
    || semantic === 'TrueVolumetricFlow'
    || semantic === 'TrueReturnFlow';
}

export function isValveOpeningSemantic(semantic: string | undefined | null): boolean {
  if (!semantic) return false;
  return /valve|opening|开度/i.test(semantic)
    || semantic === 'ValveOpeningProxy';
}

export function isUnknownSemantic(semantic: string | undefined | null): boolean {
  return !isTrueFlowSemantic(semantic) && !isValveOpeningSemantic(semantic);
}

export function outletDisplayLabel(semantic: string | undefined | null): string {
  if (isValveOpeningSemantic(semantic)) return '出口挡板开度';
  if (isTrueFlowSemantic(semantic)) return '出口流量';
  return '出口信号';
}

export function outletDisplayUnit(
  semantic: string | undefined | null,
  configuredUnit: string | undefined | null,
): string {
  if (isValveOpeningSemantic(semantic)) return '%';
  if (isTrueFlowSemantic(semantic)) {
    return configuredUnit && !/^unknown$/i.test(configuredUnit) ? configuredUnit : 'L/s';
  }
  if (configuredUnit && !/^unknown$/i.test(configuredUnit)) return configuredUnit;
  return '--';
}

export function readNullableNumber(
  record: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') {
      const n = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(n)) return n;
    }
  }
  const entries = Object.entries(record);
  for (const key of keys) {
    const normalizedKey = key.toLowerCase();
    const matched = entries.find(([recordKey, v]) => (
      recordKey.toLowerCase() === normalizedKey
      && v !== undefined
      && v !== null
      && v !== ''
    ));
    if (matched) {
      const n = typeof matched[1] === 'number' ? matched[1] : Number(matched[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

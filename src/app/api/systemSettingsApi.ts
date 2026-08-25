import { authenticatedFetch } from './authToken';

export const OUTLET_SIGNAL_SEMANTIC_SETTING_KEY = 'outlet_signal_semantic';
export type OutletSignalSemantic = 'TrueVolumetricFlow' | 'ValveOpeningProxy';

export interface SystemSetting {
  key: string;
  label: string;
  value: string;
  section?: string;
  description?: string;
}

export function outletSignalSemanticSetting(value: OutletSignalSemantic): SystemSetting {
  return {
    key: OUTLET_SIGNAL_SEMANTIC_SETTING_KEY,
    label: '出口通道定义',
    value,
    section: 'telemetry-contract',
    description: '出口 MFOA 信号的物理语义；决定是否允许流量差与物料平衡证据。',
  };
}

function asOutletSignalSemantic(value: unknown): OutletSignalSemantic | null {
  if (value === 'TrueVolumetricFlow' || value === 'TrueReturnFlow') return 'TrueVolumetricFlow';
  if (value === 'ValveOpeningProxy') return 'ValveOpeningProxy';
  return null;
}

/**
 * Reads both the persisted UI key and the backend option property for a
 * backwards-compatible configuration snapshot.  Unknown values deliberately
 * remain unselected: a flow-balance display must never infer its own meaning.
 */
export function outletSignalSemanticFromSettings(settings: SystemSetting[]): OutletSignalSemantic | null {
  const row = settings.find((item) => [
    OUTLET_SIGNAL_SEMANTIC_SETTING_KEY,
    'OutletSignalSemantic',
    'KickDetectionBackend:OutletSignalSemantic',
  ].includes(item.key));
  return asOutletSignalSemantic(row?.value);
}

export async function fetchSystemSettings(signal?: AbortSignal): Promise<SystemSetting[]> {
  const response = await authenticatedFetch('/api/system/settings', { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json() as { settings?: unknown };
  if (!Array.isArray(payload.settings)) return [];
  return payload.settings.filter((item): item is SystemSetting => Boolean(item && typeof item === 'object' && 'key' in item))
    .map((item) => {
      const row = item as unknown as Record<string, unknown>;
      return {
        key: String(row.key || ''),
        label: String(row.label || row.key || ''),
        value: String(row.value ?? ''),
        section: String(row.section || ''),
        description: String(row.description || ''),
      };
    });
}

export async function saveOutletSignalSemantic(semantic: OutletSignalSemantic): Promise<void> {
  const response = await authenticatedFetch(`/api/system/settings/${encodeURIComponent(OUTLET_SIGNAL_SEMANTIC_SETTING_KEY)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-wcs-csrf': '1' },
    body: JSON.stringify(outletSignalSemanticSetting(semantic)),
  });
  const payload = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; message?: string };
  if (!response.ok || payload.ok === false) throw new Error(payload.error || payload.message || `HTTP ${response.status}`);
}

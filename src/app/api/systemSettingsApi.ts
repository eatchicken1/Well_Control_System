import { authenticatedFetch } from './authToken';

export interface SystemSetting {
  key: string;
  label: string;
  value: string;
  section?: string;
  description?: string;
}

export async function fetchSystemSettings(signal?: AbortSignal): Promise<SystemSetting[]> {
  const response = await authenticatedFetch('/api/system/settings', { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json() as { settings?: unknown };
  if (!Array.isArray(payload.settings)) return [];
  return payload.settings.filter((item): item is SystemSetting => Boolean(item && typeof item === 'object' && 'key' in item))
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        key: String(row.key || ''),
        label: String(row.label || row.key || ''),
        value: String(row.value ?? ''),
        section: String(row.section || ''),
        description: String(row.description || ''),
      };
    });
}

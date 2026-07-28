import { authenticatedFetch } from './authToken';
import type { WellboreProfile } from './wellboreProfileApi';

export interface WellProfile {
  wellId: number;
  wellName: string;
  wellCode: string;
  blockName?: string | null;
  fieldName?: string | null;
  targetLayer?: string | null;
  wellType: string;
  wellStatus: string;
  qualityGrade: string;
  realtimeTableName?: string | null;
  registeredDepthMax?: number | null;
  sectionCount: number;
  trajectoryCount: number;
  bhaIntervalCount: number;
  bhaComponentCount: number;
  hasAlgorithmProfile: boolean;
}

export interface WellProfileMutationRequest {
  wellName: string;
  wellCode: string;
  blockName?: string;
  fieldName?: string;
  targetLayer?: string;
  wellType: string;
  wellStatus: string;
  qualityGrade: string;
}

export type CreateWellProfileRequest = WellProfileMutationRequest;
export type UpdateWellProfileRequest = WellProfileMutationRequest;

const baseUrl = '/api/well-management';

async function parseError(response: Response) {
  const body = await response.json().catch(() => ({})) as {
    error?: string;
    detail?: string;
    title?: string;
    errors?: Record<string, string[]>;
  };
  const validationMessage = body.errors
    ? Object.values(body.errors).flat().find(Boolean)
    : undefined;
  return body.error || body.detail || validationMessage || body.title || `HTTP ${response.status}`;
}

async function expectJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<T>;
}

export async function listWellProfiles(signal?: AbortSignal) {
  const response = await authenticatedFetch(baseUrl, { cache: 'no-store', signal });
  const payload = await expectJson<{ wells?: WellProfile[] }>(response);
  return payload.wells || [];
}

export async function getWellProfile(id: number | string, signal?: AbortSignal) {
  const response = await authenticatedFetch(`${baseUrl}/${encodeURIComponent(id)}`, { cache: 'no-store', signal });
  return expectJson<WellProfile>(response);
}

export async function getManagedWellbore(id: number | string, signal?: AbortSignal) {
  const response = await authenticatedFetch(`${baseUrl}/${encodeURIComponent(id)}/wellbore`, { cache: 'no-store', signal });
  return expectJson<WellboreProfile>(response);
}

export async function createWellProfile(request: CreateWellProfileRequest) {
  const response = await authenticatedFetch(baseUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-wcs-csrf': '1' },
    body: JSON.stringify(request),
  });
  return expectJson<WellProfile>(response);
}

export async function updateWellProfile(id: number | string, request: UpdateWellProfileRequest) {
  const response = await authenticatedFetch(`${baseUrl}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-wcs-csrf': '1' },
    body: JSON.stringify(request),
  });
  return expectJson<WellProfile>(response);
}

export async function deleteWellProfile(id: number | string) {
  const response = await authenticatedFetch(`${baseUrl}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-wcs-csrf': '1' },
  });
  if (!response.ok) throw new Error(await parseError(response));
}

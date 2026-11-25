import {
  AutoSheetConfigSummary,
  DispatcherAuthStatus,
  PublicVehicleSummary,
  TripLog,
  Vehicle,
} from '../types/fleet';

let dispatcherToken: string | null = null;

export function getDispatcherToken(): string | null {
  return dispatcherToken;
}

export function setDispatcherToken(token: string | null) {
  dispatcherToken = token;
}

export class DispatcherAuthError extends Error {
  constructor(message = 'Phiên đăng nhập điều hành đã hết hạn.') {
    super(message);
    this.name = 'DispatcherAuthError';
  }
}

async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
  requireAuth = false
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (requireAuth || dispatcherToken) {
    if (dispatcherToken) {
      headers.Authorization = `Bearer ${dispatcherToken}`;
    }
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 401 && requireAuth) {
    dispatcherToken = null;
    throw new DispatcherAuthError();
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Lỗi máy chủ (${res.status})`);
  }

  return data as T;
}

export async function fetchAuthStatus(): Promise<DispatcherAuthStatus> {
  return apiFetch<DispatcherAuthStatus>('/api/auth/status');
}

export async function setupDispatcherAccount(
  username: string,
  password: string
): Promise<{ token: string; username: string }> {
  const res = await apiFetch<{ token: string; username: string }>('/api/auth/setup', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  dispatcherToken = res.token;
  return res;
}

export async function loginDispatcher(
  username: string,
  password: string
): Promise<{ token: string; username: string }> {
  const res = await apiFetch<{ token: string; username: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  dispatcherToken = res.token;
  return res;
}

export function logoutDispatcher() {
  dispatcherToken = null;
}

export async function fetchPublicBootstrap(): Promise<{
  vehicles: PublicVehicleSummary[];
  autoSheetEnabled: boolean;
  autoSheetMode: 'webhook' | 'service_account' | 'none';
  sheetTitle: string | null;
}> {
  return apiFetch('/api/public/bootstrap');
}

export async function submitDriverTrip(trip: TripLog): Promise<{
  ok: boolean;
  trip: TripLog;
  vehicle: Vehicle | null;
  sheetSynced: boolean;
  sheetError: string | null;
}> {
  return apiFetch('/api/trips', {
    method: 'POST',
    body: JSON.stringify(trip),
  });
}

export async function fetchAdminState(): Promise<{
  vehicles: Vehicle[];
  trips: TripLog[];
  autoSheet: AutoSheetConfigSummary;
}> {
  return apiFetch('/api/admin/state', {}, true);
}

export async function updateAdminTrip(trip: TripLog): Promise<{ ok: boolean; trip: TripLog }> {
  return apiFetch(
    `/api/admin/trips/${encodeURIComponent(trip.id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(trip),
    },
    true
  );
}

export async function deleteAdminTrip(tripId: string): Promise<{ ok: boolean }> {
  return apiFetch(
    `/api/admin/trips/${encodeURIComponent(tripId)}`,
    { method: 'DELETE' },
    true
  );
}

export async function createAdminVehicle(
  vehicle: Vehicle
): Promise<{ ok: boolean; vehicle: Vehicle }> {
  return apiFetch(
    '/api/admin/vehicles',
    {
      method: 'POST',
      body: JSON.stringify(vehicle),
    },
    true
  );
}

export async function updateAdminVehicle(
  vehicle: Vehicle
): Promise<{ ok: boolean; vehicle: Vehicle }> {
  return apiFetch(
    `/api/admin/vehicles/${encodeURIComponent(vehicle.bienSo)}`,
    {
      method: 'PUT',
      body: JSON.stringify(vehicle),
    },
    true
  );
}

export async function replaceAdminStore(payload: {
  vehicles?: Vehicle[];
  trips?: TripLog[];
}): Promise<{ ok: boolean }> {
  return apiFetch(
    '/api/admin/sync-replace',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    true
  );
}

export async function saveAutoSheetConfig(payload: {
  webhookUrl?: string;
  sheetUrl?: string;
  sheetTitle?: string;
  targetTab?: string;
  clearWebhook?: boolean;
}): Promise<{ ok: boolean; autoSheet: AutoSheetConfigSummary }> {
  return apiFetch(
    '/api/admin/auto-sheet',
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
    true
  );
}

export async function testAutoSheetConnection(
  syncAll = false
): Promise<{ ok: boolean; lastAutoSyncAt: string }> {
  return apiFetch(
    '/api/admin/auto-sheet/test',
    {
      method: 'POST',
      body: JSON.stringify({ syncAll }),
    },
    true
  );
}

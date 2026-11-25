import { createInitialTrips, createInitialVehicles } from '../data/fleetData';
import {
  AutoSheetConfigSummary,
  DispatcherAuthStatus,
  PublicVehicleSummary,
  TripLog,
  Vehicle,
} from '../types/fleet';
import { formatDateVN, formatMinutesToHHMM, parseReeferMinutes } from '../utils/fleetMetrics';

let dispatcherToken: string | null = null;
let backendMode: 'unknown' | 'server' | 'static' = 'unknown';
let staticSessionUsername: string | null = null;

const STATIC_VEHICLES_KEY = 'truck_log_static_vehicles_v1';
const STATIC_TRIPS_KEY = 'truck_log_static_trips_v1';
const STATIC_AUTOSHEET_KEY = 'truck_log_static_autosheet_v1';
const STATIC_AUTH_KEY = 'truck_log_static_auth_v1';

const TRIPS_HEADER_15 = [
  'NGÀY XP',
  'NGÀY KT',
  'HÀNH TRÌNH',
  'MÃ CHUYẾN',
  'MẶT HÀNG',
  'GIỜ LẠNH XP',
  'GIỜ LẠNH KT',
  'KM ĐẦU',
  'KM CUỐI',
  'TỔNG KM',
  'BKS',
  'TÊN LÁI XE',
  'LOẠI HÌNH',
  'TỔNG GIỜ LẠNH',
  'THỜI GIAN NHẬP',
];

interface StaticAutoSheetRecord {
  webhookUrl: string;
  sheetUrl: string;
  sheetTitle: string;
  targetTab: string;
  lastAutoSyncAt: string | null;
}

interface StaticAuthRecord {
  username: string;
  salt: string;
  hash: string;
}

class StaticHostFallbackError extends Error {
  constructor() {
    super('STATIC_HOST');
    this.name = 'StaticHostFallbackError';
  }
}

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

function validateAppsScriptUrl(
  rawUrl: string
): { ok: true; url: URL } | { ok: false; error: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { ok: false, error: 'Đường dẫn Web App URL không được để trống.' };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Định dạng URL không hợp lệ.' };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'URL phải sử dụng giao thức HTTPS.' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'URL không được chứa thông tin xác thực.' };
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== 'script.google.com' && host !== 'script.googleusercontent.com') {
    return {
      ok: false,
      error: 'Chỉ chấp nhận Google Apps Script URL (https://script.google.com/macros/s/.../exec).',
    };
  }
  return { ok: true, url: parsed };
}

function maskUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    const u = new URL(rawUrl);
    const parts = u.pathname.split('/');
    if (parts.length > 3) {
      const id = parts[3] || '';
      const shortId = id.length > 12 ? `${id.slice(0, 6)}...${id.slice(-4)}` : id;
      return `${u.origin}/macros/s/${shortId}/exec`;
    }
    return `${u.origin}${u.pathname}`;
  } catch {
    return 'Đã cấu hình';
  }
}

function tripToSheetRow(t: TripLog): Array<string | number> {
  const driversCombined = t.taiXe2 ? `${t.taiXe} / ${t.taiXe2}` : t.taiXe;
  return [
    formatDateVN(t.ngay),
    t.ngayKetThuc ? formatDateVN(t.ngayKetThuc) : '',
    t.tuyenDuong,
    t.mcx || '',
    t.matHang || '',
    t.gioLanhBatDau || '',
    t.gioLanhKetThuc || '',
    t.odoDau,
    t.odoCuoi ?? '',
    t.quangDuongKm,
    t.bienSo,
    driversCombined,
    t.taiTrong,
    t.thoiGianChayLanhPhut > 0 ? formatMinutesToHHMM(t.thoiGianChayLanhPhut) : '',
    t.thoiGianNhap || '',
  ];
}

function readStaticVehicles(): Vehicle[] {
  try {
    const raw = localStorage.getItem(STATIC_VEHICLES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Vehicle[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Fallback to seed
  }
  const initial = createInitialVehicles();
  try {
    localStorage.setItem(STATIC_VEHICLES_KEY, JSON.stringify(initial));
  } catch {
    // Ignore storage quota issues
  }
  return initial;
}

function writeStaticVehicles(vehicles: Vehicle[]) {
  try {
    localStorage.setItem(STATIC_VEHICLES_KEY, JSON.stringify(vehicles));
  } catch {
    // Ignore storage quota issues
  }
}

function readStaticTrips(vehicles: Vehicle[]): TripLog[] {
  try {
    const raw = localStorage.getItem(STATIC_TRIPS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TripLog[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Fallback to seed
  }
  const initial = createInitialTrips(vehicles);
  try {
    localStorage.setItem(STATIC_TRIPS_KEY, JSON.stringify(initial));
  } catch {
    // Ignore storage quota issues
  }
  return initial;
}

function writeStaticTrips(trips: TripLog[]) {
  try {
    localStorage.setItem(STATIC_TRIPS_KEY, JSON.stringify(trips));
  } catch {
    // Ignore storage quota issues
  }
}

async function readStaticAutoSheet(): Promise<StaticAutoSheetRecord> {
  try {
    const raw = localStorage.getItem(STATIC_AUTOSHEET_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StaticAutoSheetRecord>;
      return {
        webhookUrl: parsed.webhookUrl || '',
        sheetUrl: parsed.sheetUrl || '',
        sheetTitle: parsed.sheetTitle || '',
        targetTab: parsed.targetTab || '',
        lastAutoSyncAt: parsed.lastAutoSyncAt || null,
      };
    }
  } catch {
    // Continue to static config file
  }

  try {
    const res = await fetch('/sheet-config.json', { cache: 'no-store' });
    if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
      const cfg = (await res.json()) as Partial<StaticAutoSheetRecord>;
      const record: StaticAutoSheetRecord = {
        webhookUrl: cfg.webhookUrl || '',
        sheetUrl: cfg.sheetUrl || '',
        sheetTitle: cfg.sheetTitle || '',
        targetTab: cfg.targetTab || '',
        lastAutoSyncAt: null,
      };
      try {
        localStorage.setItem(STATIC_AUTOSHEET_KEY, JSON.stringify(record));
      } catch {
        // Ignore storage errors
      }
      return record;
    }
  } catch {
    // Ignore missing config
  }

  return {
    webhookUrl: '',
    sheetUrl: '',
    sheetTitle: '',
    targetTab: '',
    lastAutoSyncAt: null,
  };
}

function writeStaticAutoSheet(record: StaticAutoSheetRecord) {
  try {
    localStorage.setItem(STATIC_AUTOSHEET_KEY, JSON.stringify(record));
  } catch {
    // Ignore storage errors
  }
}

function toAutoSheetSummary(record: StaticAutoSheetRecord): AutoSheetConfigSummary {
  return {
    enabled: Boolean(record.webhookUrl),
    mode: record.webhookUrl ? 'webhook' : 'none',
    hasEnvWebhook: false,
    hasEnvServiceAccount: false,
    webhookUrlMasked: maskUrl(record.webhookUrl),
    sheetUrl: record.sheetUrl,
    sheetTitle: record.sheetTitle,
    targetTab: record.targetTab,
    lastAutoSyncAt: record.lastAutoSyncAt,
  };
}

async function postToAppsScriptFromBrowser(webhookUrl: string, payload: unknown): Promise<void> {
  const check = validateAppsScriptUrl(webhookUrl);
  if (!check.ok) {
    throw new Error(check.error);
  }

  let res: globalThis.Response;
  try {
    // Use text/plain to keep CORS simple (Apps Script does not handle OPTIONS preflight)
    res = await fetch(check.url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });
  } catch {
    throw new Error(
      'Không gửi được tới Apps Script (có thể chưa bật quyền "Bất kỳ ai (Anyone)" hoặc chưa triển khai Phiên bản mới với mã doPost).'
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      'Apps Script từ chối truy cập (401/403). Hãy chọn "Người có quyền truy cập = Bất kỳ ai (Anyone)" khi Deploy.'
    );
  }
  if (!res.ok) {
    throw new Error(`Google Apps Script trả về lỗi HTTP ${res.status}.`);
  }

  const text = await res.text();
  let parsed: { ok?: boolean; error?: string } | null = null;
  try {
    parsed = JSON.parse(text) as { ok?: boolean; error?: string };
  } catch {
    throw new Error(
      'Apps Script chưa trả về JSON hợp lệ (hãy kiểm tra lại mã doPost/doGet, chọn Triển khai Phiên bản mới và quyền "Bất kỳ ai (Anyone)").'
    );
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Phản hồi từ Google Apps Script không hợp lệ.');
  }
  if (parsed.ok === false) {
    throw new Error(parsed.error || 'Apps Script báo lỗi khi ghi Google Sheet.');
  }
}

async function hashPasswordClient(password: string, saltHex: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Trình duyệt không hỗ trợ mã hóa mật khẩu an toàn.');
  }
  const enc = new TextEncoder();
  const data = enc.encode(`${saltHex}:${password}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomSaltHex(): string {
  const buf = new Uint8Array(16);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function readStaticAuth(): StaticAuthRecord | null {
  try {
    const raw = localStorage.getItem(STATIC_AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StaticAuthRecord>;
    if (parsed.username && parsed.salt && parsed.hash) {
      return parsed as StaticAuthRecord;
    }
    return null;
  } catch {
    return null;
  }
}

async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
  requireAuth = false
): Promise<T> {
  if (backendMode === 'static') {
    throw new StaticHostFallbackError();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if ((requireAuth || dispatcherToken) && dispatcherToken) {
    headers.Authorization = `Bearer ${dispatcherToken}`;
  }

  let res: globalThis.Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch {
    backendMode = 'static';
    throw new StaticHostFallbackError();
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (res.status === 405 || res.status === 404 || !contentType.includes('application/json')) {
    backendMode = 'static';
    throw new StaticHostFallbackError();
  }

  backendMode = 'server';

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
  try {
    return await apiFetch<DispatcherAuthStatus>('/api/auth/status');
  } catch (err) {
    if (!(err instanceof StaticHostFallbackError)) throw err;
    const claimed = readStaticAuth();
    return {
      authenticated: Boolean(staticSessionUsername),
      username: staticSessionUsername,
      isSetupRequired: !claimed,
      envConfigured: false,
    };
  }
}

export async function setupDispatcherAccount(
  username: string,
  password: string
): Promise<{ token: string; username: string }> {
  try {
    const res = await apiFetch<{ token: string; username: string }>('/api/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    dispatcherToken = res.token;
    return res;
  } catch (err) {
    if (!(err instanceof StaticHostFallbackError)) throw err;
    if (readStaticAuth()) {
      throw new Error('Tài khoản điều hành đã được thiết lập trước đó. Vui lòng đăng nhập.');
    }
    const cleanUser = username.trim();
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(cleanUser)) {
      throw new Error('ID đăng nhập phải từ 3–40 ký tự (chữ, số, ., _, -).');
    }
    if (password.length < 6 || password.length > 100) {
      throw new Error('Mật khẩu phải từ 6 đến 100 ký tự.');
    }
    const salt = randomSaltHex();
    const hash = await hashPasswordClient(password, salt);
    localStorage.setItem(STATIC_AUTH_KEY, JSON.stringify({ username: cleanUser, salt, hash }));
    staticSessionUsername = cleanUser;
    dispatcherToken = 'static-session';
    return { token: dispatcherToken, username: cleanUser };
  }
}

export async function loginDispatcher(
  username: string,
  password: string
): Promise<{ token: string; username: string }> {
  try {
    const res = await apiFetch<{ token: string; username: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    dispatcherToken = res.token;
    return res;
  } catch (err) {
    if (!(err instanceof StaticHostFallbackError)) throw err;
    const claimed = readStaticAuth();
    if (!claimed) {
      throw new Error('Chưa thiết lập tài khoản điều hành. Vui lòng tạo tài khoản lần đầu.');
    }
    const cleanUser = username.trim();
    const computedHash = await hashPasswordClient(password, claimed.salt);
    if (!safeEqualHex(cleanUser, claimed.username) || !safeEqualHex(computedHash, claimed.hash)) {
      throw new Error('Sai ID hoặc mật khẩu điều hành.');
    }
    staticSessionUsername = claimed.username;
    dispatcherToken = 'static-session';
    return { token: dispatcherToken, username: claimed.username };
  }
}

export function logoutDispatcher() {
  dispatcherToken = null;
  staticSessionUsername = null;
}

export async function fetchPublicBootstrap(): Promise<{
  vehicles: PublicVehicleSummary[];
  autoSheetEnabled: boolean;
  autoSheetMode: 'webhook' | 'service_account' | 'none';
  sheetTitle: string | null;
}> {
  try {
    return await apiFetch('/api/public/bootstrap');
  } catch (err) {
    if (!(err instanceof StaticHostFallbackError)) throw err;
    const vehicles = readStaticVehicles().map((v) => ({
      bienSo: v.bienSo,
      taiTrong: v.taiTrong,
      khuVuc: v.khuVuc,
      trangThai: v.trangThai,
      odoHienTai: v.odoHienTai,
      gioLanhHienTai: v.gioLanhHienTai,
    }));
    const autoSheet = await readStaticAutoSheet();
    return {
      vehicles,
      autoSheetEnabled: Boolean(autoSheet.webhookUrl),
      autoSheetMode: autoSheet.webhookUrl ? 'webhook' : 'none',
      sheetTitle: autoSheet.sheetTitle || null,
    };
  }
}

export async function submitDriverTrip(trip: TripLog): Promise<{
  ok: boolean;
  trip: TripLog;
  vehicle: Vehicle | null;
  sheetSynced: boolean;
  sheetError: string | null;
}> {
  try {
    return await apiFetch('/api/trips', {
      method: 'POST',
      body: JSON.stringify(trip),
    });
  } catch (err) {
    if (!(err instanceof StaticHostFallbackError)) throw err;

    const vehicles = readStaticVehicles();
    const trips = readStaticTrips(vehicles);
    const matched = vehicles.find((v) => v.bienSo === trip.bienSo);
    const savedTrip: TripLog = {
      ...trip,
      taiTrong: matched?.taiTrong || trip.taiTrong,
    };

    const nextTrips = [savedTrip, ...trips];
    let updatedVehicle: Vehicle | null = null;
    const nextVehicles = vehicles.map((v) => {
      if (v.bienSo !== savedTrip.bienSo) return v;
      const nextOdo =
        savedTrip.odoCuoi !== null && savedTrip.odoCuoi > v.odoHienTai
          ? savedTrip.odoCuoi
          : Math.max(v.odoHienTai, savedTrip.odoDau);

      let nextReefer = v.gioLanhHienTai;
      const curMin = parseReeferMinutes(v.gioLanhHienTai) ?? 0;
      const endMin = parseReeferMinutes(savedTrip.gioLanhKetThuc);
      const startMin = parseReeferMinutes(savedTrip.gioLanhBatDau);
      if (endMin !== null && endMin >= curMin) {
        nextReefer = savedTrip.gioLanhKetThuc;
      } else if (startMin !== null && startMin > curMin) {
        nextReefer = savedTrip.gioLanhBatDau;
      }
      const isCompleted = savedTrip.odoCuoi !== null || savedTrip.gioLanhKetThuc !== '';
      updatedVehicle = {
        ...v,
        trangThai: isCompleted ? 'SanSang' : 'DangChay',
        odoHienTai: nextOdo,
        gioLanhHienTai: nextReefer,
      };
      return updatedVehicle;
    });

    writeStaticVehicles(nextVehicles);
    writeStaticTrips(nextTrips);

    const autoSheet = await readStaticAutoSheet();
    let sheetSynced = false;
    let sheetError: string | null = null;

    if (autoSheet.webhookUrl) {
      try {
        await postToAppsScriptFromBrowser(autoSheet.webhookUrl, {
          action: 'appendTrip',
          tabName: autoSheet.targetTab,
          header: TRIPS_HEADER_15,
          row: tripToSheetRow(savedTrip),
        });
        sheetSynced = true;
        writeStaticAutoSheet({
          ...autoSheet,
          lastAutoSyncAt: new Date().toISOString(),
        });
      } catch (sheetErr: unknown) {
        sheetSynced = false;
        sheetError =
          sheetErr instanceof Error
            ? sheetErr.message
            : 'Lỗi gửi dữ liệu tự động lên Google Sheet.';
      }
    }

    return {
      ok: true,
      trip: savedTrip,
      vehicle: updatedVehicle,
      sheetSynced,
      sheetError,
    };
  }
}

function assertStaticAuth() {
  if (!staticSessionUsername) {
    throw new DispatcherAuthError();
  }
}

export async function fetchAdminState(): Promise<{
  vehicles: Vehicle[];
  trips: TripLog[];
  autoSheet: AutoSheetConfigSummary;
}> {
  try {
    return await apiFetch('/api/admin/state', {}, true);
  } catch (err) {
    if (!(err instanceof StaticHostFallbackError)) throw err;
    assertStaticAuth();
    const vehicles = readStaticVehicles();
    const trips = readStaticTrips(vehicles);
    const autoSheet = await readStaticAutoSheet();
    return {
      vehicles,
      trips,
      autoSheet: toAutoSheetSummary(autoSheet),
    };
  }
}

export async function updateAdminTrip(trip: TripLog): Promise<{ ok: boolean; trip: TripLog }> {
  try {
    return await apiFetch(
      `/api/admin/trips/${encodeURIComponent(trip.id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(trip),
      },
      true
    );
  } catch (err) {
    if (!(err instanceof StaticHostFallbackError)) throw err;
    assertStaticAuth();
    const vehicles = readStaticVehicles();
    const trips = readStaticTrips(vehicles);
    const nextTrips = trips.map((t) => (t.id === trip.id ? trip : t));
    writeStaticTrips(nextTrips);
    return { ok: true, trip };
  }
}

export async function deleteAdminTrip(tripId: string): Promise<{ ok: boolean }> {
  try {
    return await apiFetch(
      `/api/admin/trips/${encodeURIComponent(tripId)}`,
      { method: 'DELETE' },
      true
    );
  } catch (err) {
    if (!(err instanceof StaticHostFallbackError)) throw err;
    assertStaticAuth();
    const vehicles = readStaticVehicles();
    const trips = readStaticTrips(vehicles);
    writeStaticTrips(trips.filter((t) => t.id !== tripId));
    return { ok: true };
  }
}

export async function createAdminVehicle(
  vehicle: Vehicle
): Promise<{ ok: boolean; vehicle: Vehicle }> {
  try {
    return await apiFetch(
      '/api/admin/vehicles',
      {
        method: 'POST',
        body: JSON.stringify(vehicle),
      },
      true
    );
  } catch (err) {
    if (!(err instanceof StaticHostFallbackError)) throw err;
    assertStaticAuth();
    const vehicles = readStaticVehicles();
    writeStaticVehicles([...vehicles, vehicle]);
    return { ok: true, vehicle };
  }
}

export async function updateAdminVehicle(
  vehicle: Vehicle
): Promise<{ ok: boolean; vehicle: Vehicle }> {
  try {
    return await apiFetch(
      `/api/admin/vehicles/${encodeURIComponent(vehicle.bienSo)}`,
      {
        method: 'PUT',
        body: JSON.stringify(vehicle),
      },
      true
    );
  } catch (err) {
    if (!(err instanceof StaticHostFallbackError)) throw err;
    assertStaticAuth();
    const vehicles = readStaticVehicles();
    writeStaticVehicles(vehicles.map((v) => (v.bienSo === vehicle.bienSo ? vehicle : v)));
    return { ok: true, vehicle };
  }
}

export async function replaceAdminStore(payload: {
  vehicles?: Vehicle[];
  trips?: TripLog[];
}): Promise<{ ok: boolean }> {
  try {
    return await apiFetch(
      '/api/admin/sync-replace',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      true
    );
  } catch (err) {
    if (!(err instanceof StaticHostFallbackError)) throw err;
    assertStaticAuth();
    if (payload.vehicles && payload.vehicles.length > 0) {
      writeStaticVehicles(payload.vehicles);
    }
    if (payload.trips) {
      writeStaticTrips(payload.trips);
    }
    return { ok: true };
  }
}

export async function saveAutoSheetConfig(payload: {
  webhookUrl?: string;
  sheetUrl?: string;
  sheetTitle?: string;
  targetTab?: string;
  clearWebhook?: boolean;
}): Promise<{ ok: boolean; autoSheet: AutoSheetConfigSummary }> {
  try {
    return await apiFetch(
      '/api/admin/auto-sheet',
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
      true
    );
  } catch (err) {
    if (!(err instanceof StaticHostFallbackError)) throw err;
    assertStaticAuth();
    const current = await readStaticAutoSheet();
    let nextWebhook = current.webhookUrl;
    if (payload.webhookUrl?.trim()) {
      const check = validateAppsScriptUrl(payload.webhookUrl);
      if (!check.ok) throw new Error(check.error);
      nextWebhook = check.url.toString();
    } else if (payload.clearWebhook) {
      nextWebhook = '';
    }

    let nextSheetUrl = current.sheetUrl;
    if (payload.sheetUrl?.trim()) {
      try {
        const parsed = new URL(payload.sheetUrl.trim());
        if (parsed.protocol === 'https:' && parsed.hostname === 'docs.google.com') {
          nextSheetUrl = parsed.toString();
        }
      } catch {
        // Ignore invalid preview URL
      }
    } else if (payload.clearWebhook) {
      nextSheetUrl = '';
    }

    const updated: StaticAutoSheetRecord = {
      webhookUrl: nextWebhook,
      sheetUrl: nextSheetUrl,
      sheetTitle: (payload.sheetTitle ?? current.sheetTitle).trim(),
      targetTab: (payload.targetTab ?? current.targetTab).trim(),
      lastAutoSyncAt: current.lastAutoSyncAt,
    };
    writeStaticAutoSheet(updated);
    return { ok: true, autoSheet: toAutoSheetSummary(updated) };
  }
}

export async function testAutoSheetConnection(
  syncAll = false
): Promise<{ ok: boolean; lastAutoSyncAt: string }> {
  try {
    return await apiFetch(
      '/api/admin/auto-sheet/test',
      {
        method: 'POST',
        body: JSON.stringify({ syncAll }),
      },
      true
    );
  } catch (err) {
    if (!(err instanceof StaticHostFallbackError)) throw err;
    assertStaticAuth();
    const current = await readStaticAutoSheet();
    if (!current.webhookUrl) {
      throw new Error('Chưa cấu hình Google Apps Script Webhook URL.');
    }
    const vehicles = readStaticVehicles();
    const trips = readStaticTrips(vehicles);
    if (syncAll) {
      await postToAppsScriptFromBrowser(current.webhookUrl, {
        action: 'syncAll',
        tabName: current.targetTab,
        rows: [TRIPS_HEADER_15, ...trips.map(tripToSheetRow)],
      });
    } else {
      await postToAppsScriptFromBrowser(current.webhookUrl, {
        action: 'ensureHeader',
        tabName: current.targetTab,
        header: TRIPS_HEADER_15,
      });
    }
    const now = new Date().toISOString();
    writeStaticAutoSheet({ ...current, lastAutoSyncAt: now });
    return { ok: true, lastAutoSyncAt: now };
  }
}

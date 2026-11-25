import {
  GoogleSheetConfig,
  TonnageType,
  TripLog,
  Vehicle,
  VehicleStatus,
} from '../types/fleet';
import {
  diffReeferMinutes,
  formatDateVN,
  formatMinutesToHHMM,
} from '../utils/fleetMetrics';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export const DEFAULT_TABS = {
  trips: 'NhatKyChuyen',
  vehicles: 'DanhSachXe',
};

// Exact 15 columns from user's Google Sheet layout (A -> O)
export const TRIPS_HEADER = [
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

const VEHICLES_HEADER = [
  'BienSo',
  'TaiTrong',
  'KhuVuc',
  'TrangThaiXe',
  'OdoHienTai',
  'GioLanhHienTai',
  'TaiXeMacDinh',
];

export class SheetsAuthError extends Error {
  constructor(message = 'Phiên kết nối Google Sheets đã hết hạn. Vui lòng đăng nhập lại.') {
    super(message);
    this.name = 'SheetsAuthError';
  }
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }
  return trimmed;
}

async function sheetsFetch<T>(
  url: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    throw new SheetsAuthError();
  }

  if (!res.ok) {
    let message = `Lỗi Google Sheets (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody?.error?.message) {
        message = errBody.error.message;
      }
    } catch {
      // Ignore parse error
    }
    throw new Error(message);
  }

  return (await res.json()) as T;
}

interface SpreadsheetMetadataResponse {
  spreadsheetId: string;
  spreadsheetUrl: string;
  properties: {
    title: string;
  };
  sheets: Array<{
    properties: {
      sheetId: number;
      title: string;
    };
  }>;
}

export async function inspectSpreadsheet(
  spreadsheetIdOrUrl: string,
  accessToken: string
): Promise<{
  spreadsheetId: string;
  title: string;
  url: string;
  sheetTitles: string[];
}> {
  const id = extractSpreadsheetId(spreadsheetIdOrUrl);
  if (!id) {
    throw new Error('Vui lòng nhập đường dẫn hoặc ID của Google Sheet.');
  }

  const data = await sheetsFetch<SpreadsheetMetadataResponse>(
    `${SHEETS_API_BASE}/${encodeURIComponent(id)}?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets.properties(sheetId,title)`,
    accessToken
  );

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || 'Bảng tính Google Sheets',
    url: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
    sheetTitles: (data.sheets || []).map((s) => s.properties.title),
  };
}

function formatSheetRange(tabName: string, rangeA1: string): string {
  const escaped = tabName.replace(/'/g, "''");
  return `'${escaped}'!${rangeA1}`;
}

function tripToSheetRow(t: TripLog): Array<string | number> {
  const driversCombined = t.taiXe2 ? `${t.taiXe} / ${t.taiXe2}` : t.taiXe;
  return [
    formatDateVN(t.ngay), // A: NGÀY XP
    t.ngayKetThuc ? formatDateVN(t.ngayKetThuc) : '', // B: NGÀY KT
    t.tuyenDuong, // C: HÀNH TRÌNH
    t.mcx || '', // D: MÃ CHUYẾN
    t.matHang || '', // E: MẶT HÀNG
    t.gioLanhBatDau || '', // F: GIỜ LẠNH XP
    t.gioLanhKetThuc || '', // G: GIỜ LẠNH KT
    t.odoDau, // H: KM ĐẦU
    t.odoCuoi ?? '', // I: KM CUỐI
    t.quangDuongKm, // J: TỔNG KM
    t.bienSo, // K: BKS
    driversCombined, // L: TÊN LÁI XE
    t.taiTrong, // M: LOẠI HÌNH
    t.thoiGianChayLanhPhut > 0 ? formatMinutesToHHMM(t.thoiGianChayLanhPhut) : '', // N: TỔNG GIỜ LẠNH
    t.thoiGianNhap || '', // O: THỜI GIAN NHẬP
  ];
}

export async function createFleetSpreadsheet(
  title: string,
  accessToken: string,
  vehicles: Vehicle[],
  trips: TripLog[]
): Promise<GoogleSheetConfig> {
  const payload = {
    properties: {
      title: title || 'Nhật Ký Vận Hành Xe Tải 5T-8T-13T',
      locale: 'vi_VN',
    },
    sheets: [
      { properties: { title: DEFAULT_TABS.trips, gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: DEFAULT_TABS.vehicles, gridProperties: { frozenRowCount: 1 } } },
    ],
  };

  const created = await sheetsFetch<SpreadsheetMetadataResponse>(SHEETS_API_BASE, accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const config: GoogleSheetConfig = {
    spreadsheetId: created.spreadsheetId,
    spreadsheetTitle: created.properties.title,
    spreadsheetUrl:
      created.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`,
    lastSyncedAt: new Date().toISOString(),
    availableTabs: [DEFAULT_TABS.trips, DEFAULT_TABS.vehicles],
    tabNames: { ...DEFAULT_TABS },
  };

  await pushAllDataToSheet(config, accessToken, vehicles, trips);
  return config;
}

export async function ensureRequiredTabsExist(
  spreadsheetId: string,
  existingTitles: string[],
  tabNames: GoogleSheetConfig['tabNames'],
  accessToken: string
): Promise<void> {
  const needed = [tabNames.trips, tabNames.vehicles];
  const missing = needed.filter((name) => !existingTitles.includes(name));
  if (missing.length === 0) return;

  await sheetsFetch(
    `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: missing.map((title) => ({
          addSheet: {
            properties: {
              title,
              gridProperties: { frozenRowCount: 1 },
            },
          },
        })),
      }),
    }
  );
}

/**
 * Real-time append of a single trip row directly into Google Sheet (columns A:O)
 */
export async function appendTripRowToSheet(
  config: GoogleSheetConfig,
  accessToken: string,
  trip: TripLog
): Promise<GoogleSheetConfig> {
  const meta = await inspectSpreadsheet(config.spreadsheetId, accessToken);
  const targetTripTab = meta.sheetTitles.includes(config.tabNames.trips)
    ? config.tabNames.trips
    : meta.sheetTitles[0] || DEFAULT_TABS.trips;

  // Check if header row A1:O1 exists; if sheet is empty, write header first
  const headerRange = formatSheetRange(targetTripTab, 'A1:O1');
  const existingHeader = await sheetsFetch<{ values?: string[][] }>(
    `${SHEETS_API_BASE}/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(headerRange)}`,
    accessToken
  );

  if (!existingHeader.values || existingHeader.values.length === 0) {
    await sheetsFetch(
      `${SHEETS_API_BASE}/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(headerRange)}?valueInputOption=RAW`,
      accessToken,
      {
        method: 'PUT',
        body: JSON.stringify({
          values: [TRIPS_HEADER],
        }),
      }
    );
  }

  const appendRange = formatSheetRange(targetTripTab, 'A:O');
  await sheetsFetch(
    `${SHEETS_API_BASE}/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(appendRange)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        values: [tripToSheetRow(trip)],
      }),
    }
  );

  return {
    ...config,
    spreadsheetTitle: meta.title,
    spreadsheetUrl: meta.url,
    availableTabs: meta.sheetTitles,
    tabNames: {
      ...config.tabNames,
      trips: targetTripTab,
    },
    lastSyncedAt: new Date().toISOString(),
  };
}

export async function pushAllDataToSheet(
  config: GoogleSheetConfig,
  accessToken: string,
  vehicles: Vehicle[],
  trips: TripLog[]
): Promise<GoogleSheetConfig> {
  const meta = await inspectSpreadsheet(config.spreadsheetId, accessToken);
  await ensureRequiredTabsExist(
    config.spreadsheetId,
    meta.sheetTitles,
    config.tabNames,
    accessToken
  );

  const rangesToClear = [
    formatSheetRange(config.tabNames.trips, 'A1:O'),
    formatSheetRange(config.tabNames.vehicles, 'A1:G'),
  ];

  await sheetsFetch(
    `${SHEETS_API_BASE}/${encodeURIComponent(config.spreadsheetId)}/values:batchClear`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ ranges: rangesToClear }),
    }
  );

  const tripRows = trips.map(tripToSheetRow);

  const vehicleRows = vehicles.map((v) => [
    v.bienSo,
    v.taiTrong,
    v.khuVuc,
    v.trangThai,
    v.odoHienTai,
    v.gioLanhHienTai || '0:00',
    v.taiXeMacDinh,
  ]);

  await sheetsFetch(
    `${SHEETS_API_BASE}/${encodeURIComponent(config.spreadsheetId)}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: [
          {
            range: formatSheetRange(config.tabNames.trips, 'A1'),
            values: [TRIPS_HEADER, ...tripRows],
          },
          {
            range: formatSheetRange(config.tabNames.vehicles, 'A1'),
            values: [VEHICLES_HEADER, ...vehicleRows],
          },
        ],
      }),
    }
  );

  return {
    ...config,
    spreadsheetTitle: meta.title,
    spreadsheetUrl: meta.url,
    availableTabs: meta.sheetTitles,
    lastSyncedAt: new Date().toISOString(),
  };
}

interface BatchGetResponse {
  valueRanges: Array<{
    range: string;
    values?: string[][];
  }>;
}

function parseTonnage(val: string | undefined): TonnageType {
  if (val === '5T' || val === '8T' || val === '13T') return val;
  return '8T';
}

function parseVehicleStatus(val: string | undefined): VehicleStatus {
  if (val === 'SanSang' || val === 'DangChay') return val;
  return 'SanSang';
}

function toNumber(val: string | number | undefined, fallback = 0): number {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') return Number.isFinite(val) ? val : fallback;
  const cleaned = String(val).replace(/[.,\s]/g, (m) => (m === '.' ? '.' : ''));
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : fallback;
}

function parseDateFromSheet(val: string | undefined): string {
  if (!val) return '';
  const trimmed = String(val).trim();
  // Convert DD/MM/YYYY to YYYY-MM-DD
  const vnMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (vnMatch) {
    return `${vnMatch[3]}-${vnMatch[2].padStart(2, '0')}-${vnMatch[1].padStart(2, '0')}`;
  }
  return trimmed;
}

export async function pullAllDataFromSheet(
  config: GoogleSheetConfig,
  accessToken: string
): Promise<{
  vehicles: Vehicle[] | null;
  trips: TripLog[] | null;
  updatedConfig: GoogleSheetConfig;
}> {
  const meta = await inspectSpreadsheet(config.spreadsheetId, accessToken);
  const existing = new Set(meta.sheetTitles);

  const ranges: string[] = [];
  if (existing.has(config.tabNames.trips)) {
    ranges.push(formatSheetRange(config.tabNames.trips, 'A2:O'));
  }
  if (existing.has(config.tabNames.vehicles)) {
    ranges.push(formatSheetRange(config.tabNames.vehicles, 'A2:G'));
  }

  if (ranges.length === 0) {
    return {
      vehicles: null,
      trips: null,
      updatedConfig: {
        ...config,
        spreadsheetTitle: meta.title,
        spreadsheetUrl: meta.url,
        availableTabs: meta.sheetTitles,
        lastSyncedAt: new Date().toISOString(),
      },
    };
  }

  const query = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');
  const data = await sheetsFetch<BatchGetResponse>(
    `${SHEETS_API_BASE}/${encodeURIComponent(config.spreadsheetId)}/values:batchGet?${query}`,
    accessToken
  );

  let parsedTrips: TripLog[] | null = null;
  let parsedVehicles: Vehicle[] | null = null;

  for (const vr of data.valueRanges || []) {
    const rows = vr.values || [];
    if (
      vr.range.startsWith(config.tabNames.trips) ||
      vr.range.includes(`'${config.tabNames.trips}'`)
    ) {
      parsedTrips = rows
        .filter((r) => r[0] || r[2] || r[10])
        .map((r, idx) => {
          const odoDau = toNumber(r[7], 0);
          const odoCuoi = r[8] !== undefined && r[8] !== '' ? toNumber(r[8], 0) : null;
          const quangDuongKm =
            r[9] !== undefined && r[9] !== ''
              ? toNumber(r[9], 0)
              : odoCuoi !== null && odoCuoi >= odoDau
                ? odoCuoi - odoDau
                : 0;
          const gioLanhBatDau = r[5] ? String(r[5]).trim() : '';
          const gioLanhKetThuc = r[6] ? String(r[6]).trim() : '';
          const thoiGianChayLanhPhut = diffReeferMinutes(gioLanhBatDau, gioLanhKetThuc);

          const rawDrivers = String(r[11] || '').trim();
          const driverParts = rawDrivers.split('/').map((s) => s.trim());
          const taiXe = driverParts[0] || '';
          const taiXe2 = driverParts.slice(1).join(' / ');

          const thoiGianNhap = String(r[14] || '');
          const timeMatch = thoiGianNhap.match(/(\d{2}:\d{2})/);

          return {
            id: `TR-GS-${idx + 1}`,
            ngay: parseDateFromSheet(r[0]),
            ngayKetThuc: parseDateFromSheet(r[1]),
            gioKhoiHanh: timeMatch ? timeMatch[1] : '08:00',
            gioKetThuc: '',
            bienSo: String(r[10] || '').trim(),
            taiTrong: parseTonnage(r[12]),
            mcx: String(r[3] || '').trim(),
            matHang: String(r[4] || '').trim(),
            taiXe,
            taiXe2,
            tuyenDuong: String(r[2] || '').trim(),
            odoDau,
            odoCuoi,
            quangDuongKm,
            gioLanhBatDau,
            gioLanhKetThuc,
            thoiGianChayLanhPhut,
            thoiGianNhap,
            ghiChu: '',
          };
        });
    } else if (
      vr.range.startsWith(config.tabNames.vehicles) ||
      vr.range.includes(`'${config.tabNames.vehicles}'`)
    ) {
      parsedVehicles = rows
        .filter((r) => r[0])
        .map((r) => {
          const bienSo = String(r[0]).trim();
          return {
            bienSo,
            taiTrong: parseTonnage(r[1]),
            khuVuc:
              r[2] === 'TP.HCM' ? 'TP.HCM' : bienSo.startsWith('29') ? 'Hà Nội' : 'TP.HCM',
            trangThai: parseVehicleStatus(r[3]),
            odoHienTai: toNumber(r[4], 0),
            gioLanhHienTai: String(r[5] || '0:00'),
            taiXeMacDinh: String(r[6] || ''),
          };
        });
    }
  }

  return {
    vehicles: parsedVehicles && parsedVehicles.length > 0 ? parsedVehicles : null,
    trips: parsedTrips,
    updatedConfig: {
      ...config,
      spreadsheetTitle: meta.title,
      spreadsheetUrl: meta.url,
      availableTabs: meta.sheetTitles,
      lastSyncedAt: new Date().toISOString(),
    },
  };
}

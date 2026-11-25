import 'dotenv/config';
import crypto from 'crypto';
import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

type TonnageType = '5T' | '8T' | '13T';
type VehicleStatus = 'SanSang' | 'DangChay';

interface Vehicle {
  bienSo: string;
  taiTrong: TonnageType;
  khuVuc: 'Hà Nội' | 'TP.HCM';
  trangThai: VehicleStatus;
  odoHienTai: number;
  gioLanhHienTai: string;
  taiXeMacDinh: string;
}

interface TripLog {
  id: string;
  ngay: string;
  ngayKetThuc: string;
  gioKhoiHanh: string;
  gioKetThuc: string;
  bienSo: string;
  taiTrong: TonnageType;
  mcx: string;
  matHang: string;
  taiXe: string;
  taiXe2: string;
  tuyenDuong: string;
  odoDau: number;
  odoCuoi: number | null;
  quangDuongKm: number;
  gioLanhBatDau: string;
  gioLanhKetThuc: string;
  thoiGianChayLanhPhut: number;
  thoiGianNhap: string;
  ghiChu: string;
}

interface ServerAutoSheetConfig {
  webhookUrl: string;
  sheetUrl: string;
  sheetTitle: string;
  targetTab: string;
  lastAutoSyncAt: string | null;
}

interface PersistedFleetStore {
  vehicles: Vehicle[];
  trips: TripLog[];
  autoSheet: ServerAutoSheetConfig;
}

interface PersistedAuthRecord {
  username: string;
  salt: string;
  hash: string;
  createdAt: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '.data');
const STORE_PATH = path.resolve(DATA_DIR, 'fleet-store.json');
const AUTH_PATH = path.resolve(DATA_DIR, 'auth.json');

const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const TRIPS_HEADER = [
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

const RAW_FLEET_LIST: Array<{ bienSo: string; taiTrong: TonnageType }> = [
  { bienSo: '29KT00146', taiTrong: '5T' },
  { bienSo: '29KT10851', taiTrong: '5T' },
  { bienSo: '29KT10402', taiTrong: '5T' },
  { bienSo: '29KT10258', taiTrong: '5T' },
  { bienSo: '50H51789', taiTrong: '5T' },
  { bienSo: '50H51812', taiTrong: '5T' },
  { bienSo: '50H44588', taiTrong: '5T' },
  { bienSo: '50H44940', taiTrong: '5T' },
  { bienSo: '50H44944', taiTrong: '5T' },
  { bienSo: '50H44995', taiTrong: '5T' },
  { bienSo: '50H45076', taiTrong: '5T' },
  { bienSo: '50H45301', taiTrong: '5T' },
  { bienSo: '50H45329', taiTrong: '5T' },
  { bienSo: '50H45377', taiTrong: '5T' },
  { bienSo: '50H45413', taiTrong: '5T' },
  { bienSo: '50H45864', taiTrong: '5T' },
  { bienSo: '50H18896', taiTrong: '8T' },
  { bienSo: '29KT20247', taiTrong: '8T' },
  { bienSo: '29KT20249', taiTrong: '8T' },
  { bienSo: '29KT20132', taiTrong: '8T' },
  { bienSo: '29KT20285', taiTrong: '8T' },
  { bienSo: '29KT20033', taiTrong: '8T' },
  { bienSo: '29KT20052', taiTrong: '8T' },
  { bienSo: '29KT20063', taiTrong: '8T' },
  { bienSo: '29KT20100', taiTrong: '8T' },
  { bienSo: '29KT00410', taiTrong: '8T' },
  { bienSo: '50H09851', taiTrong: '8T' },
  { bienSo: '50H53792', taiTrong: '8T' },
  { bienSo: '50H53914', taiTrong: '8T' },
  { bienSo: '50H54123', taiTrong: '8T' },
  { bienSo: '50H54164', taiTrong: '8T' },
  { bienSo: '50H54256', taiTrong: '8T' },
  { bienSo: '50H54259', taiTrong: '8T' },
  { bienSo: '50E56867', taiTrong: '8T' },
  { bienSo: '29KT00435', taiTrong: '13T' },
  { bienSo: '29KT00646', taiTrong: '13T' },
  { bienSo: '50H21251', taiTrong: '13T' },
  { bienSo: '29KT00443', taiTrong: '13T' },
  { bienSo: '29KT00782', taiTrong: '13T' },
  { bienSo: '29KT02135', taiTrong: '8T' },
  { bienSo: '29KT02144', taiTrong: '8T' },
  { bienSo: '29KT02070', taiTrong: '8T' },
  { bienSo: '29KT02005', taiTrong: '8T' },
  { bienSo: '29KT02076', taiTrong: '8T' },
  { bienSo: '29KT02023', taiTrong: '8T' },
  { bienSo: '29KT02060', taiTrong: '8T' },
  { bienSo: '29KT02066', taiTrong: '8T' },
  { bienSo: '29KT02113', taiTrong: '8T' },
  { bienSo: '29KT02052', taiTrong: '8T' },
  { bienSo: '29KT02062', taiTrong: '8T' },
  { bienSo: '29KT02038', taiTrong: '8T' },
  { bienSo: '29KT01991', taiTrong: '8T' },
  { bienSo: '29KT02058', taiTrong: '8T' },
  { bienSo: '29KT02086', taiTrong: '8T' },
];

const SAMPLE_DRIVERS = [
  'Nguyễn Văn Hùng',
  'Trần Minh Tuấn',
  'Lê Quốc Bảo',
  'Phạm Hoàng Nam',
  'Vũ Đức Thắng',
  'Đặng Hữu Phước',
  'Bùi Quang Vinh',
  'Hoàng Anh Dũng',
  'Ngô Thanh Tùng',
  'Đinh Trọng Nghĩa',
  'Đoàn Văn Khải',
  'Trương Công Hậu',
  'Phan Nhật Linh',
  'Huỳnh Tấn Phát',
  'Võ Minh Khang',
  'Lý Văn Cường',
];

function parseReeferMinutes(val: string | null | undefined): number | null {
  if (!val) return null;
  const trimmed = val.trim();
  const match = trimmed.match(/^(\d+):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatMinutesToHHMM(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${hours}:${String(mins).padStart(2, '0')}`;
}

function diffReeferMinutes(startStr: string, endStr: string): number {
  const s = parseReeferMinutes(startStr);
  const e = parseReeferMinutes(endStr);
  if (s === null || e === null || e < s) return 0;
  return e - s;
}

function formatDateVN(isoDate: string): string {
  if (!isoDate) return '';
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function getTodayISO(): string {
  const now = new Date();
  const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return vnTime.toISOString().slice(0, 10);
}

function getNowTimestampVN(): string {
  const now = new Date();
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const d = String(vn.getUTCDate()).padStart(2, '0');
  const m = String(vn.getUTCMonth() + 1).padStart(2, '0');
  const y = vn.getUTCFullYear();
  const hh = String(vn.getUTCHours()).padStart(2, '0');
  const mm = String(vn.getUTCMinutes()).padStart(2, '0');
  const ss = String(vn.getUTCSeconds()).padStart(2, '0');
  return `${d}/${m}/${y} ${hh}:${mm}:${ss}`;
}

function addDaysISO(baseDateStr: string, offsetDays: number): string {
  const d = new Date(`${baseDateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function createInitialVehicles(): Vehicle[] {
  return RAW_FLEET_LIST.map((item, idx) => {
    const khuVuc: 'Hà Nội' | 'TP.HCM' = item.bienSo.startsWith('29') ? 'Hà Nội' : 'TP.HCM';
    const baseOdo =
      item.taiTrong === '5T'
        ? 42000 + (idx % 12) * 4350
        : item.taiTrong === '8T'
          ? 68000 + (idx % 15) * 5120
          : 112000 + (idx % 5) * 8400;

    const baseReeferMinutes = (1800 + idx * 73) * 60 + ((idx * 17) % 60);
    const gioLanhHienTai = idx === 2 ? '4124:00' : formatMinutesToHHMM(baseReeferMinutes);
    const trangThai: VehicleStatus =
      idx === 0 || idx === 16 || idx === 19 || idx === 34 || idx === 40
        ? 'DangChay'
        : 'SanSang';

    return {
      bienSo: item.bienSo,
      taiTrong: item.taiTrong,
      khuVuc,
      trangThai,
      odoHienTai: baseOdo,
      gioLanhHienTai,
      taiXeMacDinh: SAMPLE_DRIVERS[idx % SAMPLE_DRIVERS.length],
    };
  });
}

function createInitialTrips(vehicles: Vehicle[]): TripLog[] {
  const today = getTodayISO();
  const yesterday = addDaysISO(today, -1);
  const twoDaysAgo = addDaysISO(today, -2);
  const byPlate = new Map(vehicles.map((v) => [v.bienSo, v]));
  const pick = (plate: string) => byPlate.get(plate) ?? vehicles[0];

  const v0 = pick('29KT00146');
  const v2 = pick('29KT10402');
  const v5 = pick('50H51812');
  const v16 = pick('50H18896');
  const v20 = pick('29KT20285');
  const v34 = pick('29KT00435');
  const v36 = pick('50H21251');

  return [
    {
      id: 'TR-001',
      ngay: today,
      ngayKetThuc: '',
      gioKhoiHanh: '06:30',
      gioKetThuc: '',
      bienSo: v0.bienSo,
      taiTrong: v0.taiTrong,
      mcx: 'MCX-261125-01',
      matHang: 'Thực phẩm tươi sống / mát',
      taiXe: v0.taiXeMacDinh,
      taiXe2: '',
      tuyenDuong: 'Kho Long Biên (HN) → KCN VSIP Bắc Ninh',
      odoDau: v0.odoHienTai,
      odoCuoi: null,
      quangDuongKm: 0,
      gioLanhBatDau: v0.gioLanhHienTai,
      gioLanhKetThuc: '',
      thoiGianChayLanhPhut: 0,
      thoiGianNhap: `${formatDateVN(today)} 06:32:10`,
      ghiChu: '',
    },
    {
      id: 'TR-002',
      ngay: today,
      ngayKetThuc: '',
      gioKhoiHanh: '07:15',
      gioKetThuc: '',
      bienSo: v16.bienSo,
      taiTrong: v16.taiTrong,
      mcx: 'MCX-261125-02',
      matHang: 'Hàng đông lạnh (-18°C)',
      taiXe: v16.taiXeMacDinh,
      taiXe2: '',
      tuyenDuong: 'Kho Sóng Thần (BD) → Cảng Cát Lái (TP.HCM)',
      odoDau: v16.odoHienTai,
      odoCuoi: null,
      quangDuongKm: 0,
      gioLanhBatDau: v16.gioLanhHienTai,
      gioLanhKetThuc: '',
      thoiGianChayLanhPhut: 0,
      thoiGianNhap: `${formatDateVN(today)} 07:16:45`,
      ghiChu: '',
    },
    {
      id: 'TR-003',
      ngay: today,
      ngayKetThuc: today,
      gioKhoiHanh: '05:45',
      gioKetThuc: '09:30',
      bienSo: v2.bienSo,
      taiTrong: v2.taiTrong,
      mcx: 'MCX-261125-03',
      matHang: 'Sữa & chế phẩm sữa',
      taiXe: v2.taiXeMacDinh,
      taiXe2: '',
      tuyenDuong: 'Kho Gia Lâm (HN) → KCN Yên Phong (Bắc Ninh)',
      odoDau: v2.odoHienTai - 68,
      odoCuoi: v2.odoHienTai,
      quangDuongKm: 68,
      gioLanhBatDau: '4123:12',
      gioLanhKetThuc: '4124:00',
      thoiGianChayLanhPhut: diffReeferMinutes('4123:12', '4124:00'),
      thoiGianNhap: `${formatDateVN(today)} 09:31:05`,
      ghiChu: 'Đã ký biên bản giao nhận đầy đủ',
    },
    {
      id: 'TR-004',
      ngay: today,
      ngayKetThuc: '',
      gioKhoiHanh: '08:00',
      gioKetThuc: '',
      bienSo: v34.bienSo,
      taiTrong: v34.taiTrong,
      mcx: 'MCX-261125-04',
      matHang: 'Hàng đông lạnh (-18°C)',
      taiXe: v34.taiXeMacDinh,
      taiXe2: 'Phạm Hoàng Nam',
      tuyenDuong: 'Kho Long Biên (HN) → KCN Tràng Duệ (Hải Phòng)',
      odoDau: v34.odoHienTai,
      odoCuoi: null,
      quangDuongKm: 0,
      gioLanhBatDau: v34.gioLanhHienTai,
      gioLanhKetThuc: '',
      thoiGianChayLanhPhut: 0,
      thoiGianNhap: `${formatDateVN(today)} 08:02:18`,
      ghiChu: '',
    },
    {
      id: 'TR-005',
      ngay: yesterday,
      ngayKetThuc: yesterday,
      gioKhoiHanh: '07:00',
      gioKetThuc: '16:40',
      bienSo: v36.bienSo,
      taiTrong: v36.taiTrong,
      mcx: 'MCX-261124-11',
      matHang: 'Nông sản / trái cây',
      taiXe: v36.taiXeMacDinh,
      taiXe2: 'Bùi Quang Vinh',
      tuyenDuong: 'Trung chuyển TP.HCM ↔ Cần Thơ',
      odoDau: v36.odoHienTai - 342,
      odoCuoi: v36.odoHienTai,
      quangDuongKm: 342,
      gioLanhBatDau: '4420:15',
      gioLanhKetThuc: '4428:45',
      thoiGianChayLanhPhut: diffReeferMinutes('4420:15', '4428:45'),
      thoiGianNhap: `${formatDateVN(yesterday)} 16:42:00`,
      ghiChu: 'Khứ hồi trong ngày',
    },
    {
      id: 'TR-006',
      ngay: yesterday,
      ngayKetThuc: yesterday,
      gioKhoiHanh: '08:20',
      gioKetThuc: '12:50',
      bienSo: v5.bienSo,
      taiTrong: v5.taiTrong,
      mcx: 'MCX-261124-14',
      matHang: 'Hàng tiêu dùng nhanh (FMCG)',
      taiXe: v5.taiXeMacDinh,
      taiXe2: '',
      tuyenDuong: 'Kho Tân Bình (TP.HCM) → KCN Long Hậu (Long An)',
      odoDau: v5.odoHienTai - 74,
      odoCuoi: v5.odoHienTai,
      quangDuongKm: 74,
      gioLanhBatDau: '2161:30',
      gioLanhKetThuc: '2165:00',
      thoiGianChayLanhPhut: diffReeferMinutes('2161:30', '2165:00'),
      thoiGianNhap: `${formatDateVN(yesterday)} 12:51:30`,
      ghiChu: '',
    },
    {
      id: 'TR-007',
      ngay: twoDaysAgo,
      ngayKetThuc: twoDaysAgo,
      gioKhoiHanh: '06:50',
      gioKetThuc: '14:15',
      bienSo: v20.bienSo,
      taiTrong: v20.taiTrong,
      mcx: 'MCX-261123-08',
      matHang: 'Hàng đông lạnh (-18°C)',
      taiXe: v20.taiXeMacDinh,
      taiXe2: '',
      tuyenDuong: 'Kho Long Biên (HN) → KCN Tràng Duệ (Hải Phòng)',
      odoDau: v20.odoHienTai - 226,
      odoCuoi: v20.odoHienTai,
      quangDuongKm: 226,
      gioLanhBatDau: '3253:20',
      gioLanhKetThuc: '3260:00',
      thoiGianChayLanhPhut: diffReeferMinutes('3253:20', '3260:00'),
      thoiGianNhap: `${formatDateVN(twoDaysAgo)} 14:18:22`,
      ghiChu: 'Hoàn tất đúng tiến độ',
    },
  ];
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStore(): PersistedFleetStore {
  ensureDataDir();
  if (fs.existsSync(STORE_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as Partial<PersistedFleetStore>;
      const vehicles =
        Array.isArray(parsed.vehicles) && parsed.vehicles.length > 0
          ? parsed.vehicles
          : createInitialVehicles();
      const trips = Array.isArray(parsed.trips)
        ? parsed.trips
        : createInitialTrips(vehicles);
      const autoSheet: ServerAutoSheetConfig = {
        webhookUrl: parsed.autoSheet?.webhookUrl || '',
        sheetUrl: parsed.autoSheet?.sheetUrl || '',
        sheetTitle: parsed.autoSheet?.sheetTitle || '',
        targetTab: parsed.autoSheet?.targetTab ?? '',
        lastAutoSyncAt: parsed.autoSheet?.lastAutoSyncAt || null,
      };
      return { vehicles, trips, autoSheet };
    } catch {
      // Fallback to clean seed store
    }
  }

  const vehicles = createInitialVehicles();
  const initialStore: PersistedFleetStore = {
    vehicles,
    trips: createInitialTrips(vehicles),
    autoSheet: {
      webhookUrl: '',
      sheetUrl: '',
      sheetTitle: '',
      targetTab: '',
      lastAutoSyncAt: null,
    },
  };
  saveStore(initialStore);
  return initialStore;
}

function saveStore(store: PersistedFleetStore) {
  ensureDataDir();
  const tmpPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmpPath, STORE_PATH);
}

let store: PersistedFleetStore = loadStore();

// Auth helpers (no hardcoded credentials; env vars or first-run claimed scrypt hash)
function getEnvAuthConfig(): { configured: boolean; username: string; password: string } {
  const envUser = (process.env.DISPATCHER_USERNAME || '').trim();
  const envPass = process.env.DISPATCHER_PASSWORD || '';
  if (envPass.length > 0 && envUser.length > 0) {
    return { configured: true, username: envUser, password: envPass };
  }
  return { configured: false, username: '', password: '' };
}

function loadClaimedAuth(): PersistedAuthRecord | null {
  ensureDataDir();
  if (!fs.existsSync(AUTH_PATH)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8')) as PersistedAuthRecord;
    if (parsed && parsed.username && parsed.salt && parsed.hash) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function safeEqualStrings(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function verifyClaimedPassword(password: string, record: PersistedAuthRecord): boolean {
  const derived = crypto.scryptSync(password, record.salt, 64);
  const stored = Buffer.from(record.hash, 'hex');
  if (derived.length !== stored.length) return false;
  return crypto.timingSafeEqual(derived, stored);
}

function signSessionToken(username: string): string {
  const payload = {
    sub: username,
    role: 'dispatcher',
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(token: string): { sub: string; role: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      sub?: string;
      role?: string;
      exp?: number;
    };
    if (!payload.sub || payload.role !== 'dispatcher' || !payload.exp) return null;
    if (Date.now() > payload.exp) return null;
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

function extractBearerToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

interface AuthenticatedRequest extends Request {
  dispatcherUsername?: string;
}

function requireDispatcherAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Vui lòng đăng nhập tài khoản điều hành để truy cập.' });
    return;
  }
  const verified = verifySessionToken(token);
  if (!verified) {
    res.status(401).json({ error: 'Phiên đăng nhập điều hành đã hết hạn hoặc không hợp lệ.' });
    return;
  }
  req.dispatcherUsername = verified.sub;
  next();
}

// Simple rate limiter for auth attempts
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count += 1;
  return true;
}

// Strict SSRF allowlist for Google Apps Script Web App URLs
function validateAppsScriptUrl(rawUrl: string): { ok: true; url: URL } | { ok: false; error: string } {
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

async function postToAppsScript(webhookUrl: string, payload: unknown): Promise<void> {
  const initialCheck = validateAppsScriptUrl(webhookUrl);
  if (!initialCheck.ok) {
    throw new Error(initialCheck.error);
  }

  let currentUrl = initialCheck.url.toString();
  let method: 'POST' | 'GET' = 'POST';
  let body: string | undefined = JSON.stringify(payload);

  for (let hop = 0; hop < 4; hop += 1) {
    const res = await fetch(currentUrl, {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(12000),
    });

    if (res.status === 301 || res.status === 302 || res.status === 303 || res.status === 307 || res.status === 308) {
      const location = res.headers.get('location');
      if (!location) {
        throw new Error('Apps Script chuyển hướng không hợp lệ.');
      }
      const nextUrlObj = new URL(location, currentUrl);
      const nextCheck = validateAppsScriptUrl(nextUrlObj.toString());
      if (!nextCheck.ok) {
        throw new Error('Chuyển hướng nằm ngoài tên miền Google Apps Script được phép.');
      }
      currentUrl = nextCheck.url.toString();
      if (res.status === 301 || res.status === 302 || res.status === 303) {
        method = 'GET';
        body = undefined;
      }
      continue;
    }

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        'Apps Script trả về lỗi 401 (chưa mở quyền công khai). Trong Google Apps Script → Triển khai → Quản lý các mục triển khai → đổi "Người có quyền truy cập" thành "Bất kỳ ai (Anyone)".'
      );
    }

    if (!res.ok) {
      throw new Error(`Google Apps Script trả về lỗi HTTP ${res.status}`);
    }

    const text = await res.text();
    let parsed: { ok?: boolean; error?: string } | null = null;
    try {
      parsed = JSON.parse(text) as { ok?: boolean; error?: string };
    } catch {
      throw new Error(
        'Apps Script chưa trả về JSON hợp lệ (hãy kiểm tra lại trong Apps Script: dán đúng mã doPost/doGet, chọn Triển khai Phiên bản mới và Người có quyền truy cập = "Bất kỳ ai (Anyone)").'
      );
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Phản hồi từ Google Apps Script không hợp lệ.');
    }
    if (parsed.ok === false) {
      throw new Error(parsed.error || 'Apps Script báo lỗi khi ghi Google Sheet.');
    }
    return;
  }

  throw new Error('Quá số lần chuyển hướng khi gọi Apps Script.');
}

// Optional Service Account support via GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_SHEET_ID
let cachedSaToken: { token: string; expiresAt: number } | null = null;

async function getServiceAccountAccessToken(saJsonRaw: string): Promise<string> {
  if (cachedSaToken && Date.now() < cachedSaToken.expiresAt - 60_000) {
    return cachedSaToken.token;
  }
  const sa = JSON.parse(saJsonRaw) as {
    client_email: string;
    private_key: string;
    token_uri?: string;
  };
  if (!sa.client_email || !sa.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON thiếu client_email hoặc private_key.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
      exp: nowSec + 3600,
      iat: nowSec,
    })
  ).toString('base64url');
  const unsigned = `${header}.${claim}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(sa.private_key, 'base64url');
  const assertion = `${unsigned}.${signature}`;

  const tokenRes = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!tokenRes.ok) {
    throw new Error(`Không thể lấy token Service Account (${tokenRes.status}).`);
  }
  const tokenData = (await tokenRes.json()) as { access_token: string; expires_in?: number };
  cachedSaToken = {
    token: tokenData.access_token,
    expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
  };
  return tokenData.access_token;
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

function formatSheetRange(tabName: string, rangeA1: string): string {
  const escaped = tabName.replace(/'/g, "''");
  return `'${escaped}'!${rangeA1}`;
}

async function appendViaServiceAccount(
  saJsonRaw: string,
  sheetId: string,
  targetTab: string,
  trip: TripLog
): Promise<void> {
  const token = await getServiceAccountAccessToken(saJsonRaw);
  const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}`;

  const headerRange = formatSheetRange(targetTab, 'A1:O1');
  const headerRes = await fetch(`${baseUrl}/values/${encodeURIComponent(headerRange)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (headerRes.ok) {
    const headerBody = (await headerRes.json()) as { values?: string[][] };
    if (!headerBody.values || headerBody.values.length === 0) {
      await fetch(
        `${baseUrl}/values/${encodeURIComponent(headerRange)}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [TRIPS_HEADER] }),
          signal: AbortSignal.timeout(10000),
        }
      );
    }
  }

  const appendRange = formatSheetRange(targetTab, 'A:O');
  const appendRes = await fetch(
    `${baseUrl}/values/${encodeURIComponent(appendRange)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [tripToSheetRow(trip)] }),
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!appendRes.ok) {
    throw new Error(`Google Sheets Service Account lỗi (${appendRes.status}).`);
  }
}

function getEffectiveAutoSheetInfo() {
  const envWebhook = (process.env.APPS_SCRIPT_WEBHOOK_URL || '').trim();
  const envSa = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  const envSheetId = (process.env.GOOGLE_SHEET_ID || '').trim();
  const envTab = (process.env.GOOGLE_SHEET_TAB || '').trim();

  const webhookUrl = envWebhook || store.autoSheet.webhookUrl;
  const targetTab = envTab || store.autoSheet.targetTab || '';

  let mode: 'webhook' | 'service_account' | 'none' = 'none';
  if (webhookUrl) {
    mode = 'webhook';
  } else if (envSa && envSheetId) {
    mode = 'service_account';
  }

  return {
    enabled: mode !== 'none',
    mode,
    webhookUrl,
    envSa,
    envSheetId,
    targetTab,
    hasEnvWebhook: Boolean(envWebhook),
    hasEnvServiceAccount: Boolean(envSa && envSheetId),
    sheetUrl:
      store.autoSheet.sheetUrl ||
      (envSheetId ? `https://docs.google.com/spreadsheets/d/${envSheetId}/edit` : ''),
    sheetTitle: store.autoSheet.sheetTitle || '',
  };
}

async function autoAppendTripToSheet(trip: TripLog): Promise<{ synced: boolean; error?: string }> {
  const info = getEffectiveAutoSheetInfo();
  if (!info.enabled) {
    return { synced: false };
  }

  try {
    if (info.mode === 'webhook' && info.webhookUrl) {
      await postToAppsScript(info.webhookUrl, {
        action: 'appendTrip',
        tabName: info.targetTab,
        header: TRIPS_HEADER,
        row: tripToSheetRow(trip),
      });
    } else if (info.mode === 'service_account' && info.envSa && info.envSheetId) {
      await appendViaServiceAccount(
        info.envSa,
        info.envSheetId,
        info.targetTab || 'NhatKyChuyen',
        trip
      );
    }

    store.autoSheet.lastAutoSyncAt = new Date().toISOString();
    saveStore(store);
    return { synced: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi gửi dữ liệu tự động lên Google Sheet.';
    return { synced: false, error: message };
  }
}

function cleanStr(val: unknown, maxLen = 240): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Auth status endpoint
  app.get('/api/auth/status', (req, res) => {
    const envCfg = getEnvAuthConfig();
    const claimed = loadClaimedAuth();
    const token = extractBearerToken(req);
    const verified = token ? verifySessionToken(token) : null;

    res.json({
      authenticated: Boolean(verified),
      username: verified ? verified.sub : null,
      isSetupRequired: !envCfg.configured && !claimed,
      envConfigured: envCfg.configured,
    });
  });

  // One-time first-run dispatcher setup (disabled once claimed or env configured)
  app.post('/api/auth/setup', (req, res) => {
    const envCfg = getEnvAuthConfig();
    if (envCfg.configured) {
      res.status(403).json({
        error: 'Tài khoản điều hành đã được cấu hình trong biến môi trường.',
      });
      return;
    }
    if (loadClaimedAuth()) {
      res.status(403).json({
        error: 'Tài khoản điều hành đã được thiết lập trước đó. Vui lòng đăng nhập.',
      });
      return;
    }

    const username = cleanStr(req.body?.username, 40);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) {
      res.status(400).json({
        error: 'ID đăng nhập phải từ 3–40 ký tự (chữ, số, ., _, -).',
      });
      return;
    }
    if (password.length < 6 || password.length > 100) {
      res.status(400).json({ error: 'Mật khẩu phải từ 6 đến 100 ký tự.' });
      return;
    }

    ensureDataDir();
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    const record: PersistedAuthRecord = {
      username,
      salt,
      hash,
      createdAt: new Date().toISOString(),
    };

    try {
      fs.writeFileSync(AUTH_PATH, JSON.stringify(record, null, 2), {
        encoding: 'utf8',
        flag: 'wx',
      });
    } catch {
      res.status(403).json({
        error: 'Tài khoản điều hành đã được thiết lập trước đó.',
      });
      return;
    }

    const token = signSessionToken(username);
    res.json({ token, username });
  });

  // Dispatcher login endpoint
  app.post('/api/auth/login', (req, res) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(ip)) {
      res.status(429).json({
        error: 'Quá nhiều lần đăng nhập sai. Vui lòng thử lại sau ít phút.',
      });
      return;
    }

    const username = cleanStr(req.body?.username, 60);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!username || !password) {
      res.status(400).json({ error: 'Vui lòng nhập đầy đủ ID và mật khẩu.' });
      return;
    }

    const envCfg = getEnvAuthConfig();
    if (envCfg.configured) {
      const okUser = safeEqualStrings(username, envCfg.username);
      const okPass = safeEqualStrings(password, envCfg.password);
      if (!okUser || !okPass) {
        res.status(401).json({ error: 'Sai ID hoặc mật khẩu điều hành.' });
        return;
      }
      const token = signSessionToken(envCfg.username);
      res.json({ token, username: envCfg.username });
      return;
    }

    const claimed = loadClaimedAuth();
    if (!claimed) {
      res.status(400).json({
        error: 'Chưa thiết lập tài khoản điều hành. Vui lòng tạo tài khoản lần đầu.',
      });
      return;
    }

    const okUser = safeEqualStrings(username, claimed.username);
    const okPass = verifyClaimedPassword(password, claimed);
    if (!okUser || !okPass) {
      res.status(401).json({ error: 'Sai ID hoặc mật khẩu điều hành.' });
      return;
    }

    const token = signSessionToken(claimed.username);
    res.json({ token, username: claimed.username });
  });

  // Public bootstrap for drivers (no auth required, never leaks sensitive data)
  app.get('/api/public/bootstrap', (_req, res) => {
    const info = getEffectiveAutoSheetInfo();
    const publicVehicles = store.vehicles.map((v) => ({
      bienSo: v.bienSo,
      taiTrong: v.taiTrong,
      khuVuc: v.khuVuc,
      trangThai: v.trangThai,
      odoHienTai: v.odoHienTai,
      gioLanhHienTai: v.gioLanhHienTai,
    }));

    res.json({
      vehicles: publicVehicles,
      autoSheetEnabled: info.enabled,
      autoSheetMode: info.mode,
      sheetTitle: info.sheetTitle || null,
    });
  });

  // Public driver trip submission -> persists on server & auto-sends to Google Sheet
  app.post('/api/trips', async (req, res) => {
    const b = req.body || {};
    const bienSo = cleanStr(b.bienSo, 20);
    const ngay = cleanStr(b.ngay, 10);
    const ngayKetThuc = cleanStr(b.ngayKetThuc, 10);
    const gioKhoiHanh = cleanStr(b.gioKhoiHanh, 10) || '08:00';
    const gioKetThuc = cleanStr(b.gioKetThuc, 10);
    const taiXe = cleanStr(b.taiXe, 100);
    const taiXe2 = cleanStr(b.taiXe2, 100);
    const mcx = cleanStr(b.mcx, 80);
    const matHang = cleanStr(b.matHang, 120);
    const tuyenDuong = cleanStr(b.tuyenDuong, 240);
    const gioLanhBatDau = cleanStr(b.gioLanhBatDau, 20);
    const gioLanhKetThuc = cleanStr(b.gioLanhKetThuc, 20);
    const ghiChu = cleanStr(b.ghiChu, 300);

    if (!bienSo || !taiXe || !tuyenDuong || !/^\d{4}-\d{2}-\d{2}$/.test(ngay)) {
      res.status(400).json({
        error: 'Thiếu thông tin bắt buộc (Biển số, Ngày XP, Tên lái xe, Hành trình).',
      });
      return;
    }
    if (ngayKetThuc && (!/^\d{4}-\d{2}-\d{2}$/.test(ngayKetThuc) || ngayKetThuc < ngay)) {
      res.status(400).json({ error: 'Ngày kết thúc không hợp lệ.' });
      return;
    }

    const odoDau = Number(b.odoDau);
    const odoCuoiRaw =
      b.odoCuoi === null || b.odoCuoi === undefined || b.odoCuoi === ''
        ? null
        : Number(b.odoCuoi);

    if (!Number.isFinite(odoDau) || odoDau < 0) {
      res.status(400).json({ error: 'KM đầu không hợp lệ.' });
      return;
    }
    if (odoCuoiRaw !== null && (!Number.isFinite(odoCuoiRaw) || odoCuoiRaw < odoDau)) {
      res.status(400).json({ error: 'KM cuối phải lớn hơn hoặc bằng KM đầu.' });
      return;
    }

    if (gioLanhBatDau && parseReeferMinutes(gioLanhBatDau) === null) {
      res.status(400).json({ error: 'Giờ lạnh XP phải có định dạng giờ:phút.' });
      return;
    }
    if (gioLanhKetThuc && parseReeferMinutes(gioLanhKetThuc) === null) {
      res.status(400).json({ error: 'Giờ lạnh KT phải có định dạng giờ:phút.' });
      return;
    }
    if (gioLanhKetThuc && !gioLanhBatDau) {
      res.status(400).json({ error: 'Cần nhập Giờ lạnh XP trước khi nhập Giờ lạnh KT.' });
      return;
    }
    if (gioLanhBatDau && gioLanhKetThuc) {
      const sMin = parseReeferMinutes(gioLanhBatDau)!;
      const eMin = parseReeferMinutes(gioLanhKetThuc)!;
      if (eMin < sMin) {
        res.status(400).json({ error: 'Giờ lạnh KT phải lớn hơn hoặc bằng Giờ lạnh XP.' });
        return;
      }
    }

    const matchedVehicle = store.vehicles.find((v) => v.bienSo === bienSo);
    const fallbackTonnage: TonnageType =
      b.taiTrong === '5T' || b.taiTrong === '8T' || b.taiTrong === '13T' ? b.taiTrong : '8T';

    const newTrip: TripLog = {
      id: `TR-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`,
      ngay,
      ngayKetThuc,
      gioKhoiHanh,
      gioKetThuc,
      bienSo,
      taiTrong: matchedVehicle?.taiTrong || fallbackTonnage,
      mcx,
      matHang,
      taiXe,
      taiXe2,
      tuyenDuong,
      odoDau,
      odoCuoi: odoCuoiRaw,
      quangDuongKm: odoCuoiRaw !== null ? odoCuoiRaw - odoDau : 0,
      gioLanhBatDau,
      gioLanhKetThuc,
      thoiGianChayLanhPhut: diffReeferMinutes(gioLanhBatDau, gioLanhKetThuc),
      thoiGianNhap: getNowTimestampVN(),
      ghiChu,
    };

    store.trips.unshift(newTrip);
    let updatedVehicle: Vehicle | null = null;
    store.vehicles = store.vehicles.map((v) => {
      if (v.bienSo !== newTrip.bienSo) return v;
      const nextOdo =
        newTrip.odoCuoi !== null && newTrip.odoCuoi > v.odoHienTai
          ? newTrip.odoCuoi
          : Math.max(v.odoHienTai, newTrip.odoDau);

      let nextReefer = v.gioLanhHienTai;
      const curMin = parseReeferMinutes(v.gioLanhHienTai) ?? 0;
      const endMin = parseReeferMinutes(newTrip.gioLanhKetThuc);
      const startMin = parseReeferMinutes(newTrip.gioLanhBatDau);
      if (endMin !== null && endMin >= curMin) {
        nextReefer = newTrip.gioLanhKetThuc;
      } else if (startMin !== null && startMin > curMin) {
        nextReefer = newTrip.gioLanhBatDau;
      }
      const isCompleted = newTrip.odoCuoi !== null || newTrip.gioLanhKetThuc !== '';
      updatedVehicle = {
        ...v,
        trangThai: isCompleted ? 'SanSang' : 'DangChay',
        odoHienTai: nextOdo,
        gioLanhHienTai: nextReefer,
      };
      return updatedVehicle;
    });
    saveStore(store);

    // Real-time automatic sync to Google Sheet (no driver email login required)
    const sheetResult = await autoAppendTripToSheet(newTrip);

    res.json({
      ok: true,
      trip: newTrip,
      vehicle: updatedVehicle,
      sheetSynced: sheetResult.synced,
      sheetError: sheetResult.error || null,
    });
  });

  // Protected Dispatcher Routes
  app.get('/api/admin/state', requireDispatcherAuth, (_req, res) => {
    const info = getEffectiveAutoSheetInfo();
    res.json({
      vehicles: store.vehicles,
      trips: store.trips,
      autoSheet: {
        enabled: info.enabled,
        mode: info.mode,
        hasEnvWebhook: info.hasEnvWebhook,
        hasEnvServiceAccount: info.hasEnvServiceAccount,
        webhookUrlMasked: maskUrl(info.webhookUrl),
        sheetUrl: info.sheetUrl,
        sheetTitle: info.sheetTitle,
        targetTab: info.targetTab,
        lastAutoSyncAt: store.autoSheet.lastAutoSyncAt,
      },
    });
  });

  app.put('/api/admin/trips/:id', requireDispatcherAuth, (req, res) => {
    const id = req.params.id;
    const exists = store.trips.some((t) => t.id === id);
    if (!exists) {
      res.status(404).json({ error: 'Không tìm thấy chuyến xe.' });
      return;
    }
    const b = req.body || {};
    const updatedTrip: TripLog = {
      id,
      ngay: cleanStr(b.ngay, 10),
      ngayKetThuc: cleanStr(b.ngayKetThuc, 10),
      gioKhoiHanh: cleanStr(b.gioKhoiHanh, 10),
      gioKetThuc: cleanStr(b.gioKetThuc, 10),
      bienSo: cleanStr(b.bienSo, 20),
      taiTrong:
        b.taiTrong === '5T' || b.taiTrong === '8T' || b.taiTrong === '13T'
          ? b.taiTrong
          : '8T',
      mcx: cleanStr(b.mcx, 80),
      matHang: cleanStr(b.matHang, 120),
      taiXe: cleanStr(b.taiXe, 100),
      taiXe2: cleanStr(b.taiXe2, 100),
      tuyenDuong: cleanStr(b.tuyenDuong, 240),
      odoDau: Number(b.odoDau) || 0,
      odoCuoi:
        b.odoCuoi === null || b.odoCuoi === undefined || b.odoCuoi === ''
          ? null
          : Number(b.odoCuoi),
      quangDuongKm: Number(b.quangDuongKm) || 0,
      gioLanhBatDau: cleanStr(b.gioLanhBatDau, 20),
      gioLanhKetThuc: cleanStr(b.gioLanhKetThuc, 20),
      thoiGianChayLanhPhut: diffReeferMinutes(
        cleanStr(b.gioLanhBatDau, 20),
        cleanStr(b.gioLanhKetThuc, 20)
      ),
      thoiGianNhap: cleanStr(b.thoiGianNhap, 30) || getNowTimestampVN(),
      ghiChu: cleanStr(b.ghiChu, 300),
    };

    store.trips = store.trips.map((t) => (t.id === id ? updatedTrip : t));
    saveStore(store);
    res.json({ ok: true, trip: updatedTrip });
  });

  app.delete('/api/admin/trips/:id', requireDispatcherAuth, (req, res) => {
    const id = req.params.id;
    store.trips = store.trips.filter((t) => t.id !== id);
    saveStore(store);
    res.json({ ok: true });
  });

  app.post('/api/admin/vehicles', requireDispatcherAuth, (req, res) => {
    const b = req.body || {};
    const bienSo = cleanStr(b.bienSo, 20).toUpperCase();
    if (!bienSo) {
      res.status(400).json({ error: 'Thiếu biển số xe.' });
      return;
    }
    if (store.vehicles.some((v) => v.bienSo === bienSo)) {
      res.status(409).json({ error: 'Biển số xe đã tồn tại.' });
      return;
    }
    const newVehicle: Vehicle = {
      bienSo,
      taiTrong:
        b.taiTrong === '5T' || b.taiTrong === '8T' || b.taiTrong === '13T'
          ? b.taiTrong
          : '8T',
      khuVuc: b.khuVuc === 'TP.HCM' ? 'TP.HCM' : 'Hà Nội',
      trangThai: b.trangThai === 'DangChay' ? 'DangChay' : 'SanSang',
      odoHienTai: Math.max(0, Number(b.odoHienTai) || 0),
      gioLanhHienTai: cleanStr(b.gioLanhHienTai, 20) || '0:00',
      taiXeMacDinh: cleanStr(b.taiXeMacDinh, 100),
    };
    store.vehicles.push(newVehicle);
    saveStore(store);
    res.json({ ok: true, vehicle: newVehicle });
  });

  app.put('/api/admin/vehicles/:plate', requireDispatcherAuth, (req, res) => {
    const plate = req.params.plate;
    const existing = store.vehicles.find((v) => v.bienSo === plate);
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy đầu xe.' });
      return;
    }
    const b = req.body || {};
    const updated: Vehicle = {
      bienSo: existing.bienSo,
      taiTrong:
        b.taiTrong === '5T' || b.taiTrong === '8T' || b.taiTrong === '13T'
          ? b.taiTrong
          : existing.taiTrong,
      khuVuc: b.khuVuc === 'TP.HCM' ? 'TP.HCM' : 'Hà Nội',
      trangThai: b.trangThai === 'DangChay' ? 'DangChay' : 'SanSang',
      odoHienTai: Math.max(0, Number(b.odoHienTai) || 0),
      gioLanhHienTai: cleanStr(b.gioLanhHienTai, 20) || '0:00',
      taiXeMacDinh: cleanStr(b.taiXeMacDinh, 100),
    };
    store.vehicles = store.vehicles.map((v) => (v.bienSo === plate ? updated : v));
    saveStore(store);
    res.json({ ok: true, vehicle: updated });
  });

  app.post('/api/admin/sync-replace', requireDispatcherAuth, (req, res) => {
    const b = req.body || {};
    if (Array.isArray(b.vehicles) && b.vehicles.length > 0) {
      store.vehicles = b.vehicles;
    }
    if (Array.isArray(b.trips)) {
      store.trips = b.trips;
    }
    saveStore(store);
    res.json({ ok: true });
  });

  // Configure Google Apps Script Auto-Sync Webhook (admin only)
  app.put('/api/admin/auto-sheet', requireDispatcherAuth, async (req, res) => {
    const b = req.body || {};
    const rawWebhookUrl = cleanStr(b.webhookUrl, 500);
    const sheetUrl = cleanStr(b.sheetUrl, 500);
    const sheetTitle = cleanStr(b.sheetTitle, 140);
    const targetTab = cleanStr(b.targetTab, 80);

    if (rawWebhookUrl) {
      const check = validateAppsScriptUrl(rawWebhookUrl);
      if (!check.ok) {
        res.status(400).json({ error: check.error });
        return;
      }
      store.autoSheet.webhookUrl = check.url.toString();
    } else if (b.clearWebhook === true) {
      store.autoSheet.webhookUrl = '';
    }

    if (sheetUrl) {
      try {
        const parsedSheet = new URL(sheetUrl);
        if (parsedSheet.protocol === 'https:' && parsedSheet.hostname === 'docs.google.com') {
          store.autoSheet.sheetUrl = parsedSheet.toString();
        }
      } catch {
        // Ignore invalid sheet preview URL
      }
    } else if (b.clearWebhook === true) {
      store.autoSheet.sheetUrl = '';
    }

    store.autoSheet.sheetTitle = sheetTitle;
    store.autoSheet.targetTab = targetTab;
    saveStore(store);

    const info = getEffectiveAutoSheetInfo();
    res.json({
      ok: true,
      autoSheet: {
        enabled: info.enabled,
        mode: info.mode,
        hasEnvWebhook: info.hasEnvWebhook,
        hasEnvServiceAccount: info.hasEnvServiceAccount,
        webhookUrlMasked: maskUrl(info.webhookUrl),
        sheetUrl: info.sheetUrl,
        sheetTitle: info.sheetTitle,
        targetTab: info.targetTab,
        lastAutoSyncAt: store.autoSheet.lastAutoSyncAt,
      },
    });
  });

  app.post('/api/admin/auto-sheet/test', requireDispatcherAuth, async (req, res) => {
    const info = getEffectiveAutoSheetInfo();
    if (!info.enabled) {
      res.status(400).json({ error: 'Chưa cấu hình Google Apps Script Webhook URL.' });
      return;
    }

    try {
      const syncAll = Boolean(req.body?.syncAll);
      if (info.mode === 'webhook' && info.webhookUrl) {
        if (syncAll) {
          await postToAppsScript(info.webhookUrl, {
            action: 'syncAll',
            tabName: info.targetTab,
            rows: [TRIPS_HEADER, ...store.trips.map(tripToSheetRow)],
          });
        } else {
          await postToAppsScript(info.webhookUrl, {
            action: 'ensureHeader',
            tabName: info.targetTab,
            header: TRIPS_HEADER,
          });
        }
      }
      store.autoSheet.lastAutoSyncAt = new Date().toISOString();
      saveStore(store);
      res.json({ ok: true, lastAutoSyncAt: store.autoSheet.lastAutoSyncAt });
    } catch (err: unknown) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Không thể kết nối tới Google Apps Script.',
      });
    }
  });

  // Vite dev middleware or static dist serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

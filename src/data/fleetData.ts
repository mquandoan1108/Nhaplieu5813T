import { TonnageType, TripLog, Vehicle } from '../types/fleet';
import { diffReeferMinutes, formatMinutesToHHMM } from '../utils/fleetMetrics';

interface RawFleetItem {
  bienSo: string;
  taiTrong: TonnageType;
}

// Exact 54 vehicles from fleet list (16 x 5T, 33 x 8T, 5 x 13T)
const RAW_FLEET_LIST: RawFleetItem[] = [
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

export const COMMON_ROUTES = [
  'Kho Long Biên (HN) → KCN VSIP Bắc Ninh',
  'Kho Long Biên (HN) → KCN Tràng Duệ (Hải Phòng)',
  'Kho Gia Lâm (HN) → KCN Yên Phong (Bắc Ninh)',
  'Kho Thanh Trì (HN) → KCN Đồng Văn (Hà Nam)',
  'Kho Sóng Thần (BD) → Cảng Cát Lái (TP.HCM)',
  'Kho Tân Bình (TP.HCM) → KCN Long Hậu (Long An)',
  'Kho Bình Chánh (TP.HCM) → KCN Amata (Đồng Nai)',
  'Kho Thủ Đức (TP.HCM) → KCN Mỹ Phước 3 (Bình Dương)',
  'Trung chuyển Hà Nội ↔ Thanh Hóa',
  'Trung chuyển TP.HCM ↔ Cần Thơ',
];

function addDaysISO(baseDateStr: string, offsetDays: number): string {
  const d = new Date(`${baseDateStr}T00:00:00`);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createInitialVehicles(): Vehicle[] {
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

    const trangThai: Vehicle['trangThai'] =
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

export function getNowTimestampVN(): string {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${d}/${m}/${y} ${hh}:${mm}:${ss}`;
}

export const COMMON_CARGO_TYPES = [
  'Hàng đông lạnh (-18°C)',
  'Thực phẩm tươi sống / mát',
  'Sữa & chế phẩm sữa',
  'Nông sản / trái cây',
  'Hàng tiêu dùng nhanh (FMCG)',
  'Linh kiện / hàng công nghiệp',
];

export function createInitialTrips(vehicles: Vehicle[]): TripLog[] {
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
      thoiGianNhap: `${today.split('-').reverse().join('/')} 06:32:10`,
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
      thoiGianNhap: `${today.split('-').reverse().join('/')} 07:16:45`,
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
      thoiGianNhap: `${today.split('-').reverse().join('/')} 09:31:05`,
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
      thoiGianNhap: `${today.split('-').reverse().join('/')} 08:02:18`,
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
      thoiGianNhap: `${yesterday.split('-').reverse().join('/')} 16:42:00`,
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
      thoiGianNhap: `${yesterday.split('-').reverse().join('/')} 12:51:30`,
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
      thoiGianNhap: `${twoDaysAgo.split('-').reverse().join('/')} 14:18:22`,
      ghiChu: 'Hoàn tất đúng tiến độ',
    },
  ];
}

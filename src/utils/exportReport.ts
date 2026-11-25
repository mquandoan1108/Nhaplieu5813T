import * as XLSX from 'xlsx';
import { TripLog, Vehicle } from '../types/fleet';
import { formatDateVN, formatMinutesToHHMM } from './fleetMetrics';

const VEHICLE_STATUS_LABELS: Record<Vehicle['trangThai'], string> = {
  SanSang: 'Sẵn sàng',
  DangChay: 'Đang chạy',
};

export interface ReportFilterOptions {
  periodLabel: string;
  trips: TripLog[];
  vehicles: Vehicle[];
}

export function exportToExcel({ periodLabel, trips, vehicles }: ReportFilterOptions) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Nhật ký chuyến đi (chuẩn 15 cột A -> O giống Google Sheet)
  const tripRows = trips.map((t) => ({
    'NGÀY XP': formatDateVN(t.ngay),
    'NGÀY KT': t.ngayKetThuc ? formatDateVN(t.ngayKetThuc) : '',
    'HÀNH TRÌNH': t.tuyenDuong,
    'MÃ CHUYẾN': t.mcx || '',
    'MẶT HÀNG': t.matHang || '',
    'GIỜ LẠNH XP': t.gioLanhBatDau || '',
    'GIỜ LẠNH KT': t.gioLanhKetThuc || '',
    'KM ĐẦU': t.odoDau,
    'KM CUỐI': t.odoCuoi ?? '',
    'TỔNG KM': t.quangDuongKm,
    BKS: t.bienSo,
    'TÊN LÁI XE': t.taiXe2 ? `${t.taiXe} / ${t.taiXe2}` : t.taiXe,
    'LOẠI HÌNH': t.taiTrong,
    'TỔNG GIỜ LẠNH':
      t.thoiGianChayLanhPhut > 0 ? formatMinutesToHHMM(t.thoiGianChayLanhPhut) : '',
    'THỜI GIAN NHẬP': t.thoiGianNhap || '',
  }));

  const wsTrips = XLSX.utils.json_to_sheet(
    tripRows.length > 0
      ? tripRows
      : [{ 'Thông báo': `Không có chuyến đi nào trong kỳ ${periodLabel}` }]
  );
  wsTrips['!cols'] = [
    { wch: 12 }, // NGÀY XP
    { wch: 12 }, // NGÀY KT
    { wch: 36 }, // HÀNH TRÌNH
    { wch: 18 }, // MÃ CHUYẾN
    { wch: 20 }, // MẶT HÀNG
    { wch: 14 }, // GIỜ LẠNH XP
    { wch: 14 }, // GIỜ LẠNH KT
    { wch: 12 }, // KM ĐẦU
    { wch: 12 }, // KM CUỐI
    { wch: 12 }, // TỔNG KM
    { wch: 13 }, // BKS
    { wch: 26 }, // TÊN LÁI XE
    { wch: 11 }, // LOẠI HÌNH
    { wch: 16 }, // TỔNG GIỜ LẠNH
    { wch: 20 }, // THỜI GIAN NHẬP
  ];
  XLSX.utils.book_append_sheet(wb, wsTrips, 'NhatKyChuyen');

  // Sheet 2: Tổng hợp theo xe
  const tripCountByPlate = new Map<
    string,
    { count: number; km: number; reeferMinutes: number }
  >();
  for (const t of trips) {
    const cur = tripCountByPlate.get(t.bienSo) || { count: 0, km: 0, reeferMinutes: 0 };
    cur.count += 1;
    cur.km += t.quangDuongKm || 0;
    cur.reeferMinutes += t.thoiGianChayLanhPhut || 0;
    tripCountByPlate.set(t.bienSo, cur);
  }

  const vehicleRows = vehicles.map((v, idx) => {
    const stat = tripCountByPlate.get(v.bienSo) || {
      count: 0,
      km: 0,
      reeferMinutes: 0,
    };
    return {
      STT: idx + 1,
      'Biển số xe': v.bienSo,
      'Tải trọng': v.taiTrong,
      'Khu vực': v.khuVuc,
      'Trạng thái xe': VEHICLE_STATUS_LABELS[v.trangThai],
      'Số chuyến (kỳ lọc)': stat.count,
      'Km trong kỳ': stat.km,
      'Giờ chạy lạnh trong kỳ': formatMinutesToHHMM(stat.reeferMinutes),
      'Odo hiện tại (km)': v.odoHienTai,
      'Giờ lạnh hiện tại': v.gioLanhHienTai,
      'Tài xế mặc định': v.taiXeMacDinh,
    };
  });

  const wsVehicles = XLSX.utils.json_to_sheet(vehicleRows);
  wsVehicles['!cols'] = [
    { wch: 5 },
    { wch: 13 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, wsVehicles, 'TongHopDoiXe');

  const safePeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `NhatKyVanHanh_XeTai_${safePeriod}.xlsx`);
}

function escapeCSV(val: string | number | null | undefined): string {
  const s = val === null || val === undefined ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportTripsToCSV(trips: TripLog[], periodLabel: string) {
  const headers = [
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

  const lines = [
    headers.join(','),
    ...trips.map((t) =>
      [
        formatDateVN(t.ngay),
        t.ngayKetThuc ? formatDateVN(t.ngayKetThuc) : '',
        t.tuyenDuong,
        t.mcx,
        t.matHang,
        t.gioLanhBatDau,
        t.gioLanhKetThuc,
        t.odoDau,
        t.odoCuoi ?? '',
        t.quangDuongKm,
        t.bienSo,
        t.taiXe2 ? `${t.taiXe} / ${t.taiXe2}` : t.taiXe,
        t.taiTrong,
        t.thoiGianChayLanhPhut > 0 ? formatMinutesToHHMM(t.thoiGianChayLanhPhut) : '',
        t.thoiGianNhap,
      ]
        .map(escapeCSV)
        .join(',')
    ),
  ];

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safePeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  link.href = url;
  link.setAttribute('download', `NhatKyChuyen_${safePeriod}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

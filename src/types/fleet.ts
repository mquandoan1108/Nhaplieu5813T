export type TonnageType = '5T' | '8T' | '13T';

export type VehicleStatus = 'SanSang' | 'DangChay';

export interface Vehicle {
  bienSo: string;
  taiTrong: TonnageType;
  khuVuc: 'Hà Nội' | 'TP.HCM';
  trangThai: VehicleStatus;
  odoHienTai: number;
  gioLanhHienTai: string; // Cumulative HH:MM e.g. "4124:00"
  taiXeMacDinh: string;
}

export interface TripLog {
  id: string;
  ngay: string; // NGÀY XP (YYYY-MM-DD)
  ngayKetThuc: string; // NGÀY KT (YYYY-MM-DD or '')
  gioKhoiHanh: string; // HH:mm
  gioKetThuc: string; // HH:mm or ''
  bienSo: string; // BKS
  taiTrong: TonnageType; // LOẠI HÌNH (5T | 8T | 13T)
  mcx: string; // MÃ CHUYẾN (MCX trong VTMan)
  matHang: string; // MẶT HÀNG
  taiXe: string;
  taiXe2: string; // Tài xế 2 (nếu xe đi 2 lái)
  tuyenDuong: string; // HÀNH TRÌNH
  odoDau: number; // KM ĐẦU
  odoCuoi: number | null; // KM CUỐI
  quangDuongKm: number; // TỔNG KM
  gioLanhBatDau: string; // GIỜ LẠNH XP (HH:MM)
  gioLanhKetThuc: string; // GIỜ LẠNH KT (HH:MM or '')
  thoiGianChayLanhPhut: number; // TỔNG GIỜ LẠNH (minutes)
  thoiGianNhap: string; // THỜI GIAN NHẬP (DD/MM/YYYY HH:mm:ss)
  ghiChu: string;
}

export interface GoogleSheetConfig {
  spreadsheetId: string;
  spreadsheetTitle: string;
  spreadsheetUrl: string;
  lastSyncedAt: string | null;
  availableTabs?: string[];
  tabNames: {
    trips: string;
    vehicles: string;
  };
}

export type ActiveTab = 'entry' | 'trips' | 'reports';

export interface PendingConfirmation {
  title: string;
  description: string;
  details: string[];
  confirmLabel: string;
  tone: 'primary' | 'danger';
  onConfirm: () => Promise<void> | void;
  onCancel?: () => void;
}

export interface AutoSheetConfigSummary {
  enabled: boolean;
  mode: 'webhook' | 'service_account' | 'none';
  hasEnvWebhook: boolean;
  hasEnvServiceAccount: boolean;
  webhookUrlMasked: string;
  sheetUrl: string;
  sheetTitle: string;
  targetTab: string;
  lastAutoSyncAt: string | null;
}

export interface DispatcherAuthStatus {
  authenticated: boolean;
  username: string | null;
  isSetupRequired: boolean;
  envConfigured: boolean;
}

export interface PublicVehicleSummary {
  bienSo: string;
  taiTrong: TonnageType;
  khuVuc: 'Hà Nội' | 'TP.HCM';
  trangThai: VehicleStatus;
  odoHienTai: number;
  gioLanhHienTai: string;
}


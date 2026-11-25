import {
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  Search,
  Send,
  UserPlus,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  COMMON_CARGO_TYPES,
  getNowTimestampVN,
  getTodayISO,
} from '../data/fleetData';
import { PublicVehicleSummary, TonnageType, TripLog } from '../types/fleet';
import {
  diffReeferMinutes,
  formatMinutesToHHMM,
  formatNumber,
  isValidReeferTime,
  parseReeferMinutes,
} from '../utils/fleetMetrics';

interface TripEntryViewProps {
  vehicles: PublicVehicleSummary[];
  autoSheetEnabled: boolean;
  sheetTitle: string | null;
  isDispatcherAuthenticated: boolean;
  onSaveTrip: (
    trip: TripLog
  ) => Promise<{ saved: boolean; sheetSynced: boolean; sheetError?: string | null }>;
  onOpenDispatcherLog: () => void;
  onOpenSheetsSetup: () => void;
}

function getCurrentTimeHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function TripEntryView({
  vehicles,
  autoSheetEnabled,
  sheetTitle,
  isDispatcherAuthenticated,
  onSaveTrip,
  onOpenDispatcherLog,
  onOpenSheetsSetup,
}: TripEntryViewProps) {
  const [tonnageFilter, setTonnageFilter] = useState<'ALL' | TonnageType>('ALL');
  const [plateSearch, setPlateSearch] = useState('');
  const [bienSo, setBienSo] = useState(
    () => vehicles.find((v) => v.trangThai === 'SanSang')?.bienSo || vehicles[0]?.bienSo || ''
  );
  const [ngay, setNgay] = useState(getTodayISO);
  const [ngayKetThuc, setNgayKetThuc] = useState(getTodayISO);
  const [gioKhoiHanh, setGioKhoiHanh] = useState(getCurrentTimeHHMM);
  const [gioKetThuc, setGioKetThuc] = useState('');
  const [taiXe, setTaiXe] = useState('');
  const [hasSecondDriver, setHasSecondDriver] = useState(false);
  const [taiXe2, setTaiXe2] = useState('');
  const [mcx, setMcx] = useState('');
  const [matHang, setMatHang] = useState('');
  const [diemDi, setDiemDi] = useState('');
  const [diemDen, setDiemDen] = useState('');
  const [odoDau, setOdoDau] = useState('');
  const [odoCuoi, setOdoCuoi] = useState('');
  const [gioLanhBatDau, setGioLanhBatDau] = useState('');
  const [gioLanhKetThuc, setGioLanhKetThuc] = useState('');
  const [ghiChu, setGhiChu] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTrip, setSubmittedTrip] = useState<{
    trip: TripLog;
    sentToSheet: boolean;
    sheetError?: string | null;
  } | null>(null);

  // Sync only Odo & reefer starting meter when initial plate loads (never auto-fill driver name)
  useEffect(() => {
    if (!bienSo && vehicles.length > 0) {
      const first = vehicles[0];
      setBienSo(first.bienSo);
      setOdoDau(String(first.odoHienTai));
      setGioLanhBatDau(first.gioLanhHienTai || '');
      return;
    }
    const current = vehicles.find((v) => v.bienSo === bienSo);
    if (current && !odoDau) {
      setOdoDau(String(current.odoHienTai));
      setGioLanhBatDau(current.gioLanhHienTai || '');
    }
  }, [vehicles, bienSo, odoDau]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      if (tonnageFilter !== 'ALL' && v.taiTrong !== tonnageFilter) return false;
      if (plateSearch.trim()) {
        const q = plateSearch.trim().toLowerCase();
        return (
          v.bienSo.toLowerCase().includes(q) ||
          v.taiTrong.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [vehicles, tonnageFilter, plateSearch]);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.bienSo === bienSo) || null,
    [vehicles, bienSo]
  );

  const handleSelectPlate = (plate: string) => {
    setBienSo(plate);
    setSubmittedTrip(null);
    const v = vehicles.find((item) => item.bienSo === plate);
    if (v) {
      setOdoDau(String(v.odoHienTai));
      setGioLanhBatDau(v.gioLanhHienTai || '');
    }
  };

  const handleResetForm = () => {
    const v = vehicles.find((item) => item.bienSo === bienSo) || vehicles[0];
    const today = getTodayISO();
    setError(null);
    setSubmittedTrip(null);
    setNgay(today);
    setNgayKetThuc(today);
    setGioKhoiHanh(getCurrentTimeHHMM());
    setGioKetThuc('');
    setTaiXe('');
    setHasSecondDriver(false);
    setTaiXe2('');
    setMcx('');
    setMatHang('');
    setDiemDi('');
    setDiemDen('');
    setOdoDau(v ? String(v.odoHienTai) : '0');
    setOdoCuoi('');
    setGioLanhBatDau(v?.gioLanhHienTai || '');
    setGioLanhKetThuc('');
    setGhiChu('');
  };

  const numOdoDau = Number(odoDau) || 0;
  const numOdoCuoi = odoCuoi.trim() !== '' ? Number(odoCuoi) : null;
  const computedDistance =
    numOdoCuoi !== null && numOdoCuoi >= numOdoDau ? numOdoCuoi - numOdoDau : 0;

  const computedReeferMinutes = diffReeferMinutes(gioLanhBatDau, gioLanhKetThuc);
  const hasValidReeferDiff =
    gioLanhBatDau.trim() !== '' &&
    gioLanhKetThuc.trim() !== '' &&
    parseReeferMinutes(gioLanhBatDau) !== null &&
    parseReeferMinutes(gioLanhKetThuc) !== null &&
    (parseReeferMinutes(gioLanhKetThuc) as number) >=
      (parseReeferMinutes(gioLanhBatDau) as number);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmittedTrip(null);

    if (!bienSo) {
      setError('Vui lòng chọn biển số xe.');
      return;
    }
    if (!taiXe.trim()) {
      setError('Vui lòng nhập tên tài xế.');
      return;
    }
    if (hasSecondDriver && !taiXe2.trim()) {
      setError('Vui lòng nhập tên lái xe 2 hoặc bỏ mục lái xe 2.');
      return;
    }
    if (!diemDi.trim()) {
      setError('Vui lòng nhập điểm đi.');
      return;
    }
    if (!diemDen.trim()) {
      setError('Vui lòng nhập điểm đến.');
      return;
    }
    if (ngayKetThuc && ngayKetThuc < ngay) {
      setError('Ngày kết thúc (NGÀY KT) không được nhỏ hơn ngày xuất phát (NGÀY XP).');
      return;
    }
    if (numOdoDau < 0) {
      setError('KM đầu không hợp lệ.');
      return;
    }
    if (numOdoCuoi !== null && numOdoCuoi < numOdoDau) {
      setError('KM cuối phải lớn hơn hoặc bằng KM đầu.');
      return;
    }

    const startReefer = gioLanhBatDau.trim();
    const endReefer = gioLanhKetThuc.trim();

    if (startReefer && !isValidReeferTime(startReefer)) {
      setError('Giờ lạnh XP phải đúng định dạng giờ:phút (ví dụ: 4123:12).');
      return;
    }
    if (endReefer && !isValidReeferTime(endReefer)) {
      setError('Giờ lạnh KT phải đúng định dạng giờ:phút (ví dụ: 4124:00).');
      return;
    }
    if (endReefer && !startReefer) {
      setError('Vui lòng nhập Giờ lạnh XP trước khi nhập Giờ lạnh KT.');
      return;
    }
    if (startReefer && endReefer) {
      const startMin = parseReeferMinutes(startReefer)!;
      const endMin = parseReeferMinutes(endReefer)!;
      if (endMin < startMin) {
        setError('Giờ lạnh KT phải lớn hơn hoặc bằng giờ lạnh XP.');
        return;
      }
    }

    const newTrip: TripLog = {
      id: `TR-${Date.now().toString().slice(-6)}`,
      ngay,
      ngayKetThuc,
      gioKhoiHanh,
      gioKetThuc,
      bienSo,
      taiTrong: selectedVehicle?.taiTrong || '8T',
      mcx: mcx.trim(),
      matHang: matHang.trim(),
      taiXe: taiXe.trim(),
      taiXe2: hasSecondDriver ? taiXe2.trim() : '',
      tuyenDuong: `${diemDi.trim()} → ${diemDen.trim()}`,
      odoDau: numOdoDau,
      odoCuoi: numOdoCuoi,
      quangDuongKm: computedDistance,
      gioLanhBatDau: startReefer,
      gioLanhKetThuc: endReefer,
      thoiGianChayLanhPhut: diffReeferMinutes(startReefer, endReefer),
      thoiGianNhap: getNowTimestampVN(),
      ghiChu: ghiChu.trim(),
    };

    setIsSubmitting(true);
    try {
      const result = await onSaveTrip(newTrip);
      if (!result.saved) return;

      setSubmittedTrip({
        trip: newTrip,
        sentToSheet: result.sheetSynced,
        sheetError: result.sheetError,
      });

      setMcx('');
      setMatHang('');
      setDiemDi('');
      setDiemDen('');
      setGioKetThuc('');
      setGioKhoiHanh(getCurrentTimeHHMM());
      if (numOdoCuoi !== null && numOdoCuoi >= numOdoDau) {
        setOdoDau(String(numOdoCuoi));
      }
      setOdoCuoi('');
      if (endReefer) {
        setGioLanhBatDau(endReefer);
      }
      setGioLanhKetThuc('');
      setGhiChu('');
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Không thể gửi thông tin chuyến xe.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Main Driver Entry Form */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 xl:col-span-8">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              Nhập thông tin chuyến xe
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Dữ liệu gửi trực tiếp về 15 cột Google Sheet (NGÀY XP → THỜI GIAN NHẬP).
            </p>
          </div>

          {autoSheetEnabled ? (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 whitespace-nowrap">
              <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
              {sheetTitle
                ? `Tự động gửi về: ${sheetTitle}`
                : 'Tự động cập nhật Google Sheet'}
            </div>
          ) : isDispatcherAuthenticated ? (
            <button
              type="button"
              onClick={onOpenSheetsSetup}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 whitespace-nowrap"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
              Chưa bật tự động gửi Sheet · Cấu hình →
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 whitespace-nowrap">
              <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              Gửi trực tiếp về điều hành
            </div>
          )}
        </div>

        {submittedTrip && (
          <div
            role="status"
            className="mt-4 flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <div>
                <p className="font-semibold">
                  {submittedTrip.sentToSheet
                    ? `Đã lưu & tự động cập nhật chuyến xe ${submittedTrip.trip.bienSo} lên Google Sheet`
                    : `Đã lưu thông tin chuyến xe ${submittedTrip.trip.bienSo}`}
                </p>
                <p className="text-xs text-emerald-800">
                  {submittedTrip.trip.tuyenDuong}
                  {submittedTrip.trip.mcx ? ` · Mã chuyến: ${submittedTrip.trip.mcx}` : ''}
                  {` · Lúc ${submittedTrip.trip.thoiGianNhap}`}
                </p>
                {submittedTrip.sheetError && (
                  <p className="mt-1 text-xs font-medium text-amber-800">
                    Chưa gửi được sang Google Sheet: {submittedTrip.sheetError}
                  </p>
                )}
              </div>
            </div>
            {isDispatcherAuthenticated && (
              <button
                type="button"
                onClick={onOpenDispatcherLog}
                className="self-start text-xs font-semibold text-emerald-800 underline underline-offset-2 hover:text-emerald-950 sm:self-center whitespace-nowrap"
              >
                Xem trong Nhật ký →
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Vehicle Selector */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-700">
                Chọn BKS &amp; Loại hình ({vehicles.length} đầu xe)
              </label>
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
                {(['ALL', '5T', '8T', '13T'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTonnageFilter(t)}
                    className={`min-h-[32px] rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                      tonnageFilter === t
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t === 'ALL' ? 'Tất cả' : t}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={plateSearch}
                  onChange={(e) => setPlateSearch(e.target.value)}
                  placeholder="Tìm biển số xe..."
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <select
                value={bienSo}
                onChange={(e) => handleSelectPlate(e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                {filteredVehicles.map((v) => (
                  <option key={v.bienSo} value={v.bienSo}>
                    {v.bienSo} · {v.taiTrong}
                  </option>
                ))}
              </select>
            </div>
            {selectedVehicle && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>Loại hình: {selectedVehicle.taiTrong}</span>
                <span aria-hidden="true">·</span>
                <span>Khu vực: {selectedVehicle.khuVuc}</span>
              </div>
            )}
          </div>

          {/* Dates & Time */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Ngày xuất phát (NGÀY XP)
              </label>
              <input
                type="date"
                value={ngay}
                onChange={(e) => setNgay(e.target.value)}
                required
                className="h-11 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Ngày kết thúc (NGÀY KT)
              </label>
              <input
                type="date"
                value={ngayKetThuc}
                onChange={(e) => setNgayKetThuc(e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Giờ xuất phát / kết thúc
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="time"
                  value={gioKhoiHanh}
                  onChange={(e) => setGioKhoiHanh(e.target.value)}
                  aria-label="Giờ xuất phát"
                  className="h-11 w-full rounded-lg border border-slate-200 px-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
                <input
                  type="time"
                  value={gioKetThuc}
                  onChange={(e) => setGioKetThuc(e.target.value)}
                  aria-label="Giờ kết thúc"
                  className="h-11 w-full rounded-lg border border-slate-200 px-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Driver(s) & MCX */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-700">
                    {hasSecondDriver ? 'Tên lái xe 1' : 'Tên lái xe'}
                  </label>
                  {!hasSecondDriver && (
                    <button
                      type="button"
                      onClick={() => setHasSecondDriver(true)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Thêm lái xe 2
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={taiXe}
                  onChange={(e) => setTaiXe(e.target.value)}
                  autoComplete="off"
                  placeholder="Nhập họ tên lái xe"
                  required
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Mã chuyến (MCX)
                </label>
                <input
                  type="text"
                  value={mcx}
                  onChange={(e) => setMcx(e.target.value)}
                  placeholder="Nhập MCX hiện tại trong VTMan"
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {hasSecondDriver && (
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Tên lái xe 2 (xe đi 2 lái)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setHasSecondDriver(false);
                      setTaiXe2('');
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600 whitespace-nowrap"
                  >
                    <X className="h-3.5 w-3.5" />
                    Bỏ lái xe 2
                  </button>
                </div>
                <input
                  type="text"
                  value={taiXe2}
                  onChange={(e) => setTaiXe2(e.target.value)}
                  autoComplete="off"
                  placeholder="Nhập họ tên lái xe thứ 2"
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Route & Cargo */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-8">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Điểm đi (Hành trình)
                </label>
                <input
                  type="text"
                  value={diemDi}
                  onChange={(e) => setDiemDi(e.target.value)}
                  placeholder="VD: Kho Long Biên (HN)"
                  required
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Điểm đến (Hành trình)
                </label>
                <input
                  type="text"
                  value={diemDen}
                  onChange={(e) => setDiemDen(e.target.value)}
                  placeholder="VD: KCN VSIP Bắc Ninh"
                  required
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
            <div className="lg:col-span-4">
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Mặt hàng
              </label>
              <input
                type="text"
                value={matHang}
                onChange={(e) => setMatHang(e.target.value)}
                list="driver-common-cargo-list"
                placeholder="VD: Hàng đông lạnh, sữa, nông sản..."
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
              <datalist id="driver-common-cargo-list">
                {COMMON_CARGO_TYPES.map((cargo) => (
                  <option key={cargo} value={cargo} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Odo Km */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                KM đầu
              </label>
              <input
                type="number"
                min={0}
                value={odoDau}
                onChange={(e) => setOdoDau(e.target.value)}
                required
                className="h-11 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                KM cuối
              </label>
              <input
                type="number"
                min={0}
                value={odoCuoi}
                onChange={(e) => setOdoCuoi(e.target.value)}
                placeholder="Nhập khi xong chuyến"
                className="h-11 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Tổng KM
              </label>
              <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm font-semibold tabular-nums text-slate-900">
                {formatNumber(computedDistance)} km
              </div>
            </div>
          </div>

          {/* Giờ lạnh lũy kế (giờ:phút) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Giờ lạnh XP (giờ:phút)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={gioLanhBatDau}
                onChange={(e) => setGioLanhBatDau(e.target.value)}
                placeholder="VD: 4123:12"
                className="h-11 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm tabular-nums text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Giờ lạnh KT (giờ:phút)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={gioLanhKetThuc}
                onChange={(e) => setGioLanhKetThuc(e.target.value)}
                placeholder="VD: 4124:00"
                className="h-11 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm tabular-nums text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Tổng giờ lạnh
              </label>
              <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm font-semibold tabular-nums text-slate-900">
                {hasValidReeferDiff ? formatMinutesToHHMM(computedReeferMinutes) : '—'}
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={handleResetForm}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
            >
              <RotateCcw className="h-4 w-4" />
              Làm mới biểu mẫu
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isSubmitting
                ? autoSheetEnabled
                  ? 'Đang gửi lên Google Sheet...'
                  : 'Đang lưu chuyến xe...'
                : 'Lưu thông tin chuyến xe'}
            </button>
          </div>
        </form>
      </section>

      {/* Side Quick Guide Panel */}
      <aside className="xl:col-span-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-bold text-slate-900">
            Hướng dẫn nhập nhanh cho lái xe
          </h2>
          <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-slate-600">
            <li>
              1. Chọn đúng BKS đang chạy (lọc nhanh 5T, 8T hoặc 13T).
            </li>
            <li>
              2. Nhập tên lái xe (bấm <strong>Thêm lái xe 2</strong> nếu đi 2 lái), mã{' '}
              <strong>MCX</strong> từ VTMan, hành trình và mặt hàng.
            </li>
            <li>
              3. Nhập <strong>KM đầu / cuối</strong> và <strong>Giờ lạnh XP / KT</strong>{' '}
              theo đồng hồ lũy kế dạng <span className="font-mono font-semibold">giờ:phút</span>{' '}
              (VD: <span className="font-mono">4123:12</span> →{' '}
              <span className="font-mono">4124:00</span>).
            </li>
            <li>
              4. Bấm <strong>Lưu thông tin chuyến xe</strong> để ghi trực tiếp dữ liệu
              vào Google Sheet theo thời gian thực.
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

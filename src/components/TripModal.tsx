import { Search, UserPlus, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  COMMON_CARGO_TYPES,
  COMMON_ROUTES,
  getNowTimestampVN,
  getTodayISO,
} from '../data/fleetData';
import { TonnageType, TripLog, Vehicle } from '../types/fleet';
import {
  diffReeferMinutes,
  formatMinutesToHHMM,
  formatNumber,
  isValidReeferTime,
  parseReeferMinutes,
} from '../utils/fleetMetrics';

interface TripModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialTrip?: TripLog | null;
  preselectedPlate?: string | null;
  vehicles: Vehicle[];
  onClose: () => void;
  onSave: (trip: TripLog) => Promise<boolean> | boolean;
}

function getCurrentTimeHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function TripModal({
  isOpen,
  mode,
  initialTrip,
  preselectedPlate,
  vehicles,
  onClose,
  onSave,
}: TripModalProps) {
  const [tonnageFilter, setTonnageFilter] = useState<'ALL' | TonnageType>('ALL');
  const [plateSearch, setPlateSearch] = useState('');
  const [bienSo, setBienSo] = useState('');
  const [ngay, setNgay] = useState(getTodayISO());
  const [ngayKetThuc, setNgayKetThuc] = useState(getTodayISO());
  const [gioKhoiHanh, setGioKhoiHanh] = useState(getCurrentTimeHHMM());
  const [gioKetThuc, setGioKetThuc] = useState('');
  const [taiXe, setTaiXe] = useState('');
  const [hasSecondDriver, setHasSecondDriver] = useState(false);
  const [taiXe2, setTaiXe2] = useState('');
  const [mcx, setMcx] = useState('');
  const [matHang, setMatHang] = useState('');
  const [tuyenDuong, setTuyenDuong] = useState('');
  const [odoDau, setOdoDau] = useState<string>('');
  const [odoCuoi, setOdoCuoi] = useState<string>('');
  const [gioLanhBatDau, setGioLanhBatDau] = useState('');
  const [gioLanhKetThuc, setGioLanhKetThuc] = useState('');
  const [ghiChu, setGhiChu] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setPlateSearch('');
    setTonnageFilter('ALL');

    if (initialTrip && mode === 'edit') {
      setBienSo(initialTrip.bienSo);
      setNgay(initialTrip.ngay);
      setNgayKetThuc(initialTrip.ngayKetThuc || '');
      setGioKhoiHanh(initialTrip.gioKhoiHanh);
      setGioKetThuc(initialTrip.gioKetThuc);
      setTaiXe(initialTrip.taiXe);
      setHasSecondDriver(Boolean(initialTrip.taiXe2));
      setTaiXe2(initialTrip.taiXe2 || '');
      setMcx(initialTrip.mcx || '');
      setMatHang(initialTrip.matHang || '');
      setTuyenDuong(initialTrip.tuyenDuong);
      setOdoDau(String(initialTrip.odoDau));
      setOdoCuoi(initialTrip.odoCuoi !== null ? String(initialTrip.odoCuoi) : '');
      setGioLanhBatDau(initialTrip.gioLanhBatDau || '');
      setGioLanhKetThuc(initialTrip.gioLanhKetThuc || '');
      setGhiChu(initialTrip.ghiChu);
    } else {
      const targetPlate =
        preselectedPlate ||
        vehicles.find((v) => v.trangThai === 'SanSang')?.bienSo ||
        vehicles[0]?.bienSo ||
        '';
      const selected = vehicles.find((v) => v.bienSo === targetPlate);
      const today = getTodayISO();
      setBienSo(targetPlate);
      setNgay(today);
      setNgayKetThuc(today);
      setGioKhoiHanh(getCurrentTimeHHMM());
      setGioKetThuc('');
      setTaiXe('');
      setHasSecondDriver(false);
      setTaiXe2('');
      setMcx('');
      setMatHang('');
      setTuyenDuong('');
      setOdoDau(selected ? String(selected.odoHienTai) : '0');
      setOdoCuoi('');
      setGioLanhBatDau(selected?.gioLanhHienTai || '');
      setGioLanhKetThuc('');
      setGhiChu('');
    }
  }, [isOpen, mode, initialTrip, preselectedPlate, vehicles]);

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
    const v = vehicles.find((item) => item.bienSo === plate);
    if (v && mode === 'create') {
      setOdoDau(String(v.odoHienTai));
      setGioLanhBatDau(v.gioLanhHienTai || '');
    }
  };

  if (!isOpen) return null;

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
    if (!tuyenDuong.trim()) {
      setError('Vui lòng nhập hành trình vận chuyển.');
      return;
    }
    if (ngayKetThuc && ngayKetThuc < ngay) {
      setError('Ngày kết thúc không được nhỏ hơn ngày xuất phát.');
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

    const tripId =
      initialTrip?.id && mode === 'edit'
        ? initialTrip.id
        : `TR-${Date.now().toString().slice(-6)}`;

    const ok = await onSave({
      id: tripId,
      ngay,
      ngayKetThuc,
      gioKhoiHanh,
      gioKetThuc,
      bienSo,
      taiTrong: selectedVehicle?.taiTrong || initialTrip?.taiTrong || '8T',
      mcx: mcx.trim(),
      matHang: matHang.trim(),
      taiXe: taiXe.trim(),
      taiXe2: hasSecondDriver ? taiXe2.trim() : '',
      tuyenDuong: tuyenDuong.trim(),
      odoDau: numOdoDau,
      odoCuoi: numOdoCuoi,
      quangDuongKm: computedDistance,
      gioLanhBatDau: startReefer,
      gioLanhKetThuc: endReefer,
      thoiGianChayLanhPhut: diffReeferMinutes(startReefer, endReefer),
      thoiGianNhap:
        mode === 'edit' && initialTrip?.thoiGianNhap
          ? initialTrip.thoiGianNhap
          : getNowTimestampVN(),
      ghiChu: ghiChu.trim(),
    });

    if (ok !== false) {
      onClose();
    }
  };

  const modalTitle =
    mode === 'edit'
      ? `Cập nhật chuyến ${initialTrip?.id} · ${bienSo}`
      : 'Ghi nhận chuyến vận hành mới';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trip-modal-title"
    >
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-slate-200 bg-white sm:max-w-2xl sm:rounded-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 id="trip-modal-title" className="text-base font-bold text-slate-900">
              {modalTitle}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Nhập thông tin MCX, mặt hàng, hành trình, KM và đồng hồ giờ lạnh (giờ:phút).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {mode === 'create' && (
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
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
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
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <select
                  value={bienSo}
                  onChange={(e) => handleSelectPlate(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
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
          )}

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
                className="h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
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
                className="h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Giờ XP / KT
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="time"
                  value={gioKhoiHanh}
                  onChange={(e) => setGioKhoiHanh(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 px-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
                <input
                  type="time"
                  value={gioKetThuc}
                  onChange={(e) => setGioKetThuc(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 px-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

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
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
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
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
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
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Hành trình (Điểm đi → Điểm đến)
              </label>
              <input
                type="text"
                value={tuyenDuong}
                onChange={(e) => setTuyenDuong(e.target.value)}
                list="common-routes-list"
                placeholder="VD: Kho Long Biên (HN) → KCN VSIP Bắc Ninh"
                required
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
              <datalist id="common-routes-list">
                {COMMON_ROUTES.map((route) => (
                  <option key={route} value={route} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Mặt hàng
              </label>
              <input
                type="text"
                value={matHang}
                onChange={(e) => setMatHang(e.target.value)}
                list="common-cargo-list"
                placeholder="VD: Hàng đông lạnh, sữa..."
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
              <datalist id="common-cargo-list">
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
                className="h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
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
                className="h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Tổng KM
              </label>
              <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm font-semibold tabular-nums text-slate-900">
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
                className="h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm tabular-nums text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
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
                className="h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm tabular-nums text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Tổng giờ lạnh
              </label>
              <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm font-semibold tabular-nums text-slate-900">
                {hasValidReeferDiff ? formatMinutesToHHMM(computedReeferMinutes) : '—'}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="min-h-[42px] rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0"
            >
              {mode === 'edit' ? 'Lưu thay đổi' : 'Lưu thông tin chuyến xe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

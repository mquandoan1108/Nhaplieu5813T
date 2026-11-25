import { Edit3, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getTodayISO } from '../data/fleetData';
import { TonnageType, TripLog } from '../types/fleet';
import {
  formatDateVN,
  formatMinutesToHHMM,
  formatNumber,
} from '../utils/fleetMetrics';

interface TripsViewProps {
  trips: TripLog[];
  onCreateTrip: () => void;
  onEditTrip: (trip: TripLog) => void;
  onDeleteTrip: (trip: TripLog) => void;
}

export function TripsView({
  trips,
  onCreateTrip,
  onEditTrip,
  onDeleteTrip,
}: TripsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tonnageFilter, setTonnageFilter] = useState<'ALL' | TonnageType>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');

  const today = getTodayISO();

  const filteredTrips = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return trips
      .filter((t) => {
        if (tonnageFilter !== 'ALL' && t.taiTrong !== tonnageFilter) return false;
        if (dateFilter && t.ngay !== dateFilter) return false;
        if (q) {
          return (
            t.bienSo.toLowerCase().includes(q) ||
            t.taiXe.toLowerCase().includes(q) ||
            (t.taiXe2 || '').toLowerCase().includes(q) ||
            t.tuyenDuong.toLowerCase().includes(q) ||
            t.mcx.toLowerCase().includes(q) ||
            (t.matHang || '').toLowerCase().includes(q) ||
            t.id.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (a.ngay !== b.ngay) return b.ngay.localeCompare(a.ngay);
        return b.gioKhoiHanh.localeCompare(a.gioKhoiHanh);
      });
  }, [trips, searchQuery, tonnageFilter, dateFilter]);

  const stats = useMemo(() => {
    const todayCount = trips.filter((t) => t.ngay === today).length;
    const totalKm = filteredTrips.reduce((acc, t) => acc + (t.quangDuongKm || 0), 0);
    const totalReeferMinutes = filteredTrips.reduce(
      (acc, t) => acc + (t.thoiGianChayLanhPhut || 0),
      0
    );
    return {
      totalCount: filteredTrips.length,
      todayCount,
      totalKm,
      totalReeferMinutes,
    };
  }, [trips, filteredTrips, today]);

  const clearFilters = () => {
    setSearchQuery('');
    setTonnageFilter('ALL');
    setDateFilter('');
  };

  return (
    <div className="space-y-6">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500">Số lượt vận hành (kỳ lọc)</p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-900">
            {stats.totalCount}
            <span className="ml-1.5 font-sans text-xs font-medium text-slate-500">
              chuyến · hôm nay {stats.todayCount}
            </span>
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500">Tổng KM ghi nhận</p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-blue-700">
            {formatNumber(stats.totalKm)}
            <span className="ml-1.5 font-sans text-xs font-medium text-slate-500">km</span>
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500">Tổng giờ lạnh</p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-900">
            {formatMinutesToHHMM(stats.totalReeferMinutes)}
            <span className="ml-1.5 font-sans text-xs font-medium text-slate-500">giờ:phút</span>
          </p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm BKS, mã chuyến, mặt hàng, lái xe..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 self-start sm:self-auto">
              {(['ALL', '5T', '8T', '13T'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTonnageFilter(t)}
                  className={`min-h-[32px] rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    tonnageFilter === t
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t === 'ALL' ? 'Tất cả tải' : t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Lọc theo ngày xuất phát"
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-mono text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
            />

            {(searchQuery || tonnageFilter !== 'ALL' || dateFilter) && (
              <button
                type="button"
                onClick={clearFilters}
                className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredTrips.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center">
          <p className="text-base font-semibold text-slate-900">
            Không tìm thấy lượt nhật ký phù hợp
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Thay đổi điều kiện tìm kiếm hoặc ghi nhận chuyến vận hành mới cho đội xe.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            {(searchQuery || tonnageFilter !== 'ALL' || dateFilter) && (
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Hiển thị tất cả
              </button>
            )}
            <button
              type="button"
              onClick={onCreateTrip}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              <Plus className="h-4 w-4" />
              Nhập chuyến xe
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop High-Density Table (Matches 15-column Sheet structure) */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                    <th className="px-4 py-3 whitespace-nowrap">Ngày XP / KT</th>
                    <th className="px-4 py-3 whitespace-nowrap">BKS · Loại hình</th>
                    <th className="px-4 py-3 whitespace-nowrap">Mã chuyến</th>
                    <th className="px-4 py-3 whitespace-nowrap">Tên lái xe</th>
                    <th className="px-4 py-3">Hành trình · Mặt hàng</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">KM (Đầu → Cuối / Tổng)</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Giờ lạnh (XP → KT)</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Tổng giờ lạnh</th>
                    <th className="px-4 py-3 whitespace-nowrap">Thời gian nhập</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredTrips.map((trip) => (
                    <tr key={trip.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <div className="font-mono text-xs font-semibold tabular-nums text-slate-900">
                          XP: {formatDateVN(trip.ngay)}
                        </div>
                        <div className="mt-0.5 font-mono text-xs tabular-nums text-slate-500">
                          KT: {trip.ngayKetThuc ? formatDateVN(trip.ngayKetThuc) : '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <div className="font-mono text-sm font-bold text-slate-900">
                          {trip.bienSo}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">{trip.taiTrong}</div>
                      </td>
                      <td className="px-4 py-3 align-top font-mono text-xs font-semibold text-slate-800 whitespace-nowrap">
                        {trip.mcx || '—'}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-slate-800 whitespace-nowrap">
                        <div>{trip.taiXe}</div>
                        {trip.taiXe2 && (
                          <div className="mt-0.5 text-xs text-slate-500">
                            Lái 2: {trip.taiXe2}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="max-w-xs font-medium text-slate-900">
                          {trip.tuyenDuong}
                        </div>
                        {trip.matHang && (
                          <div className="mt-0.5 max-w-xs truncate text-xs text-slate-500">
                            Hàng: {trip.matHang}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right align-top font-mono text-xs tabular-nums whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {trip.quangDuongKm > 0 ? `${formatNumber(trip.quangDuongKm)} km` : '—'}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {formatNumber(trip.odoDau)} →{' '}
                          {trip.odoCuoi !== null ? formatNumber(trip.odoCuoi) : '...'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right align-top font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                        <div>{trip.gioLanhBatDau || '—'}</div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          → {trip.gioLanhKetThuc || '...'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right align-top font-mono text-xs font-semibold tabular-nums text-blue-700 whitespace-nowrap">
                        {trip.thoiGianChayLanhPhut > 0
                          ? formatMinutesToHHMM(trip.thoiGianChayLanhPhut)
                          : '—'}
                      </td>
                      <td className="px-4 py-3 align-top font-mono text-[11px] tabular-nums text-slate-500 whitespace-nowrap">
                        {trip.thoiGianNhap || '—'}
                      </td>
                      <td className="px-4 py-3 text-right align-top whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onEditTrip(trip)}
                            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                            title="Chỉnh sửa"
                            aria-label={`Sửa chuyến ${trip.id}`}
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTrip(trip)}
                            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            title="Xóa chuyến"
                            aria-label={`Xóa chuyến ${trip.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Touch-Friendly Card List */}
          <div className="space-y-3 md:hidden">
            {filteredTrips.map((trip) => (
              <div
                key={trip.id}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold text-slate-900">
                        {trip.bienSo}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        · {trip.taiTrong}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      XP: {formatDateVN(trip.ngay)}
                      {trip.ngayKetThuc ? ` · KT: ${formatDateVN(trip.ngayKetThuc)}` : ''} ·{' '}
                      {trip.taiXe}
                      {trip.taiXe2 ? ` & ${trip.taiXe2}` : ''}
                    </p>
                  </div>
                  {trip.mcx && (
                    <span className="font-mono text-xs font-semibold text-slate-700">
                      {trip.mcx}
                    </span>
                  )}
                </div>

                <p className="mt-2.5 text-sm font-medium text-slate-900">{trip.tuyenDuong}</p>
                {trip.matHang && (
                  <p className="mt-1 text-xs text-slate-500">Mặt hàng: {trip.matHang}</p>
                )}

                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs">
                  <div>
                    <span className="text-slate-500">KM (Đầu → Cuối)</span>
                    <div className="mt-0.5 font-mono font-semibold tabular-nums text-slate-900">
                      {formatNumber(trip.odoDau)} →{' '}
                      {trip.odoCuoi !== null ? formatNumber(trip.odoCuoi) : '...'}
                      {trip.quangDuongKm > 0 ? ` (${formatNumber(trip.quangDuongKm)} km)` : ''}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Giờ lạnh (XP → KT)</span>
                    <div className="mt-0.5 font-mono font-semibold tabular-nums text-blue-700">
                      {trip.gioLanhBatDau || '—'} → {trip.gioLanhKetThuc || '...'}
                      {trip.thoiGianChayLanhPhut > 0
                        ? ` (${formatMinutesToHHMM(trip.thoiGianChayLanhPhut)})`
                        : ''}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => onEditTrip(trip)}
                    className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Cập nhật chuyến
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTrip(trip)}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                    aria-label="Xóa chuyến"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

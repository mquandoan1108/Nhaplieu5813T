import {
  Check,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Send,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { getTodayISO } from '../data/fleetData';
import {
  AutoSheetConfigSummary,
  TonnageType,
  TripLog,
  Vehicle,
} from '../types/fleet';
import { exportToExcel, exportTripsToCSV } from '../utils/exportReport';
import { formatMinutesToHHMM, formatNumber } from '../utils/fleetMetrics';

const APPS_SCRIPT_CODE = `function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, status: 'ready' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
  var data = JSON.parse(raw);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = data.tabName ? ss.getSheetByName(data.tabName) : ss.getSheets()[0];
  if (!sheet) sheet = ss.insertSheet(data.tabName || 'NhatKyChuyen');

  if (data.action === 'ensureHeader' || data.action === 'appendTrip') {
    if (sheet.getLastRow() === 0 && data.header) {
      sheet.appendRow(data.header);
    }
    if (data.action === 'appendTrip' && data.row) {
      var nextRow = sheet.getLastRow() + 1;
      sheet.getRange(nextRow, 1, 1, 7).setNumberFormat('@');
      sheet.getRange(nextRow, 14, 1, 2).setNumberFormat('@');
      sheet.getRange(nextRow, 1, 1, data.row.length).setValues([data.row]);
    }
  } else if (data.action === 'syncAll' && data.rows && data.rows.length > 0) {
    sheet.clearContents();
    sheet.getRange(1, 1, data.rows.length, 7).setNumberFormat('@');
    sheet.getRange(1, 14, data.rows.length, 2).setNumberFormat('@');
    sheet.getRange(1, 1, data.rows.length, data.rows[0].length).setValues(data.rows);
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}`;

interface ReportsAndSheetsViewProps {
  vehicles: Vehicle[];
  trips: TripLog[];
  autoSheetConfig: AutoSheetConfigSummary;
  syncBusy: boolean;
  onSaveAutoSheet: (payload: {
    webhookUrl?: string;
    sheetUrl?: string;
    sheetTitle?: string;
    targetTab?: string;
    clearWebhook?: boolean;
  }) => Promise<void>;
  onTestAutoSheet: (syncAll: boolean) => Promise<void>;
}

type ExportPeriodMode = 'day' | 'month' | 'range' | 'all';

export function ReportsAndSheetsView({
  vehicles,
  trips,
  autoSheetConfig,
  syncBusy,
  onSaveAutoSheet,
  onTestAutoSheet,
}: ReportsAndSheetsViewProps) {
  const today = getTodayISO();
  const [periodMode, setPeriodMode] = useState<ExportPeriodMode>('month');
  const [selectedDay, setSelectedDay] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [rangeStart, setRangeStart] = useState(`${today.slice(0, 7)}-01`);
  const [rangeEnd, setRangeEnd] = useState(today);
  const [tonnageFilter, setTonnageFilter] = useState<'ALL' | TonnageType>('ALL');
  const [plateFilter, setPlateFilter] = useState<string>('ALL');

  const [webhookInput, setWebhookInput] = useState('');
  const [autoSheetTitle, setAutoSheetTitle] = useState(autoSheetConfig.sheetTitle || '');
  const [autoSheetUrl, setAutoSheetUrl] = useState(autoSheetConfig.sheetUrl || '');
  const [autoTargetTab, setAutoTargetTab] = useState(autoSheetConfig.targetTab || '');
  const [autoError, setAutoError] = useState<string | null>(null);
  const [autoSuccess, setAutoSuccess] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showScriptCode, setShowScriptCode] = useState(false);

  const filteredReportData = useMemo(() => {
    const matchedVehicles = vehicles.filter((v) => {
      if (tonnageFilter !== 'ALL' && v.taiTrong !== tonnageFilter) return false;
      if (plateFilter !== 'ALL' && v.bienSo !== plateFilter) return false;
      return true;
    });
    const allowedPlates = new Set(matchedVehicles.map((v) => v.bienSo));

    const matchedTrips = trips.filter((t) => {
      if (!allowedPlates.has(t.bienSo)) return false;
      if (periodMode === 'day') return t.ngay === selectedDay;
      if (periodMode === 'month') return t.ngay.startsWith(selectedMonth);
      if (periodMode === 'range') {
        if (rangeStart && t.ngay < rangeStart) return false;
        if (rangeEnd && t.ngay > rangeEnd) return false;
        return true;
      }
      return true;
    });

    const totalKm = matchedTrips.reduce((sum, t) => sum + (t.quangDuongKm || 0), 0);
    const totalReeferMinutes = matchedTrips.reduce(
      (sum, t) => sum + (t.thoiGianChayLanhPhut || 0),
      0
    );

    const periodLabel =
      periodMode === 'day'
        ? selectedDay
        : periodMode === 'month'
          ? selectedMonth
          : periodMode === 'range'
            ? `${rangeStart}_${rangeEnd}`
            : 'ToanBo';

    return {
      matchedTrips,
      matchedVehicles,
      totalKm,
      totalReeferMinutes,
      periodLabel,
    };
  }, [
    vehicles,
    trips,
    periodMode,
    selectedDay,
    selectedMonth,
    rangeStart,
    rangeEnd,
    tonnageFilter,
    plateFilter,
  ]);

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_CODE);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2500);
    } catch {
      setShowScriptCode(true);
    }
  };

  const handleSaveAutoConfig = async () => {
    setAutoError(null);
    setAutoSuccess(null);
    try {
      await onSaveAutoSheet({
        webhookUrl: webhookInput.trim() || undefined,
        sheetUrl: autoSheetUrl.trim() || undefined,
        sheetTitle: autoSheetTitle.trim(),
        targetTab: autoTargetTab.trim(),
      });
      setWebhookInput('');
      setAutoSuccess('Đã lưu cấu hình tự động gửi Google Sheet.');
    } catch (err: unknown) {
      setAutoError(
        err instanceof Error ? err.message : 'Không thể lưu cấu hình tự động.'
      );
    }
  };

  const handleTestAuto = async (syncAll: boolean) => {
    setAutoError(null);
    setAutoSuccess(null);
    try {
      await onTestAutoSheet(syncAll);
      setAutoSuccess(
        syncAll
          ? 'Đã đẩy toàn bộ danh sách chuyến lên Google Sheet thành công!'
          : 'Kết nối thành công! Hàng tiêu đề 15 cột đã sẵn sàng trên Google Sheet.'
      );
    } catch (err: unknown) {
      setAutoError(
        err instanceof Error ? err.message : 'Kiểm tra kết nối thất bại.'
      );
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Panel 1: Zero-Login Real-Time Auto Sync to Google Sheet */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 xl:col-span-7">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Tự động cập nhật lên Google Sheet (Không cần đăng nhập Email)
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Mỗi khi lái xe bấm <strong>Lưu thông tin chuyến xe</strong>, hệ thống tự động
              ghi ngay 15 cột (NGÀY XP → THỜI GIAN NHẬP) sang Google Sheet qua Web App URL.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
              autoSheetConfig.enabled
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            {autoSheetConfig.enabled
              ? autoSheetConfig.mode === 'service_account'
                ? 'Đang bật (Service Account)'
                : 'Đang bật tự động ghi'
              : 'Chưa cấu hình URL'}
          </span>
        </div>

        {(autoError || autoSuccess) && (
          <div
            className={`mt-4 rounded-lg border px-3.5 py-2.5 text-xs leading-relaxed font-medium ${
              autoError
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {autoError || autoSuccess}
          </div>
        )}

        <div className="mt-5 space-y-4">
          {autoSheetConfig.enabled && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3.5 py-3 text-xs text-emerald-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Web App đang gắn:{' '}
                  <strong className="font-mono">
                    {autoSheetConfig.webhookUrlMasked || 'Service Account Server'}
                  </strong>
                  {' · '}
                  Tab:{' '}
                  <strong className="font-mono">
                    {autoSheetConfig.targetTab || 'Tab đầu tiên'}
                  </strong>
                </span>
                {autoSheetConfig.sheetUrl && (
                  <a
                    href={autoSheetConfig.sheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
                  >
                    Mở Sheet <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              {autoSheetConfig.lastAutoSyncAt && (
                <p className="mt-1 text-[11px] text-emerald-800">
                  Ghi tự động gần nhất:{' '}
                  {new Date(autoSheetConfig.lastAutoSyncAt).toLocaleString('vi-VN')}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Google Apps Script Web App URL
            </label>
            <input
              type="url"
              value={webhookInput}
              onChange={(e) => setWebhookInput(e.target.value)}
              placeholder={
                autoSheetConfig.webhookUrlMasked
                  ? `Đang dùng: ${autoSheetConfig.webhookUrlMasked} (dán URL mới nếu muốn đổi)`
                  : 'https://script.google.com/macros/s/.../exec'
              }
              className="h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Tên bảng tính (hiển thị)
              </label>
              <input
                type="text"
                value={autoSheetTitle}
                onChange={(e) => setAutoSheetTitle(e.target.value)}
                placeholder="VD: Nhật Ký Xe Tải 2026"
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Tên Tab nhận dữ liệu
              </label>
              <input
                type="text"
                value={autoTargetTab}
                onChange={(e) => setAutoTargetTab(e.target.value)}
                placeholder="Để trống = tab đầu tiên"
                className="h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Link mở Sheet (tùy chọn)
              </label>
              <input
                type="url"
                value={autoSheetUrl}
                onChange={(e) => setAutoSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              disabled={syncBusy}
              onClick={handleSaveAutoConfig}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap"
            >
              <Send className="h-3.5 w-3.5" />
              Lưu cấu hình
            </button>

            {autoSheetConfig.enabled && (
              <>
                <button
                  type="button"
                  disabled={syncBusy}
                  onClick={() => handleTestAuto(false)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap"
                >
                  Kiểm tra kết nối ngay
                </button>
                <button
                  type="button"
                  disabled={syncBusy}
                  onClick={() => handleTestAuto(true)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap"
                >
                  Đẩy toàn bộ ({trips.length} chuyến)
                </button>
                {!autoSheetConfig.hasEnvWebhook && (
                  <button
                    type="button"
                    disabled={syncBusy}
                    onClick={() =>
                      onSaveAutoSheet({ clearWebhook: true }).then(() =>
                        setAutoSuccess('Đã tắt webhook tự động.')
                      )
                    }
                    className="inline-flex h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-red-50 hover:text-red-700"
                  >
                    Tắt tự động
                  </button>
                )}
              </>
            )}
          </div>

          {/* Apps Script Setup Guide */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-slate-900">
                Cài đặt Apps Script trong Google Sheet (chọn đúng quyền &ldquo;Bất kỳ ai&rdquo;)
              </h3>
              <button
                type="button"
                onClick={handleCopyScript}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap"
              >
                {copiedScript ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-700" />
                    Đã chép mã
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Chép mã Apps Script
                  </>
                )}
              </button>
            </div>
            <ol className="mt-2.5 space-y-1.5 text-[11px] leading-relaxed text-slate-600">
              <li>
                1. Mở Google Sheet → <strong>Tiện ích mở rộng</strong> →{' '}
                <strong>Apps Script</strong>, dán mã chuẩn 15 cột và bấm Lưu.
              </li>
              <li>
                2. Bấm <strong>Triển khai (Deploy)</strong> →{' '}
                <strong>Tạo mục triển khai mới</strong> → loại{' '}
                <strong>Ứng dụng web (Web app)</strong>.
              </li>
              <li>
                3. Ở mục <strong>Người có quyền truy cập (Who has access)</strong>, bắt buộc chọn{' '}
                <strong>Bất kỳ ai (Anyone)</strong> — không chọn &ldquo;Chỉ mình tôi&rdquo; hay
                &ldquo;Bất kỳ ai có tài khoản Google&rdquo;, vì sẽ bị lỗi 401.
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowScriptCode((v) => !v)}
              className="mt-2.5 text-[11px] font-semibold text-blue-700 hover:underline"
            >
              {showScriptCode ? 'Ẩn mã Apps Script' : 'Xem mã Apps Script chuẩn 15 cột'}
            </button>
            {showScriptCode && (
              <pre className="mt-2 max-h-44 overflow-auto rounded-md border border-slate-200 bg-white p-2.5 font-mono text-[10px] leading-relaxed text-slate-800">
                {APPS_SCRIPT_CODE}
              </pre>
            )}
          </div>
        </div>
      </section>

      {/* Panel 2: Excel & CSV Report Export */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 xl:col-span-5">
        <div className="border-b border-slate-200 pb-4">
          <h2 className="text-base font-bold text-slate-900">
            Xuất báo cáo Excel (.xlsx) &amp; CSV
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Lọc dữ liệu vận hành theo ngày hoặc theo tháng, xuất đủ 15 cột chuẩn kèm tổng KM
            và tổng giờ lạnh.
          </p>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Chế độ thời gian báo cáo
            </label>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 sm:grid-cols-4">
              {(
                [
                  { id: 'day', label: 'Theo ngày' },
                  { id: 'month', label: 'Theo tháng' },
                  { id: 'range', label: 'Khoảng ngày' },
                  { id: 'all', label: 'Toàn bộ' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setPeriodMode(mode.id)}
                  className={`min-h-[34px] rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                    periodMode === mode.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {periodMode === 'day' && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Chọn ngày xuất báo cáo
              </label>
              <input
                type="date"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          )}

          {periodMode === 'month' && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Chọn tháng xuất báo cáo
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          )}

          {periodMode === 'range' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Từ ngày
                </label>
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Đến ngày
                </label>
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Lọc theo tải trọng
              </label>
              <select
                value={tonnageFilter}
                onChange={(e) => {
                  setTonnageFilter(e.target.value as 'ALL' | TonnageType);
                  setPlateFilter('ALL');
                }}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="ALL">Tất cả (5T, 8T, 13T)</option>
                <option value="5T">Xe 5T</option>
                <option value="8T">Xe 8T</option>
                <option value="13T">Xe 13T</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Lọc theo biển số xe
              </label>
              <select
                value={plateFilter}
                onChange={(e) => setPlateFilter(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="ALL">Tất cả xe trong nhóm</option>
                {vehicles
                  .filter((v) => tonnageFilter === 'ALL' || v.taiTrong === tonnageFilter)
                  .map((v) => (
                    <option key={v.bienSo} value={v.bienSo}>
                      {v.bienSo} ({v.taiTrong})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Live Preview Metrics */}
          <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-slate-50/70">
            <div className="p-3">
              <p className="text-[11px] font-medium text-slate-500">Số chuyến</p>
              <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-slate-900">
                {filteredReportData.matchedTrips.length}
              </p>
            </div>
            <div className="p-3">
              <p className="text-[11px] font-medium text-slate-500">Tổng Km</p>
              <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-blue-700">
                {formatNumber(filteredReportData.totalKm)}
              </p>
            </div>
            <div className="p-3">
              <p className="text-[11px] font-medium text-slate-500">Tổng giờ lạnh</p>
              <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-slate-900">
                {formatMinutesToHHMM(filteredReportData.totalReeferMinutes)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
            <button
              type="button"
              onClick={() =>
                exportToExcel({
                  periodLabel: filteredReportData.periodLabel,
                  trips: filteredReportData.matchedTrips,
                  vehicles: filteredReportData.matchedVehicles,
                })
              }
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 whitespace-nowrap"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Xuất Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={() =>
                exportTripsToCSV(
                  filteredReportData.matchedTrips,
                  filteredReportData.periodLabel
                )
              }
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap"
            >
              <FileText className="h-4 w-4 text-slate-600" />
              Xuất CSV (UTF-8)
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

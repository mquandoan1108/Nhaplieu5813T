import {
  ClipboardList,
  FilePlus2,
  FileSpreadsheet,
  Lock,
  LogOut,
  Plus,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ConfirmActionModal } from './components/ConfirmActionModal';
import { DispatcherLoginModal } from './components/DispatcherLoginModal';
import { ReportsAndSheetsView } from './components/ReportsAndSheetsView';
import { TripEntryView } from './components/TripEntryView';
import { TripModal } from './components/TripModal';
import { TripsView } from './components/TripsView';
import { createInitialVehicles } from './data/fleetData';
import {
  deleteAdminTrip,
  DispatcherAuthError,
  fetchAdminState,
  fetchPublicBootstrap,
  logoutDispatcher,
  saveAutoSheetConfig,
  submitDriverTrip,
  testAutoSheetConnection,
  updateAdminTrip,
} from './services/apiClient';
import {
  ActiveTab,
  AutoSheetConfigSummary,
  PendingConfirmation,
  PublicVehicleSummary,
  TripLog,
  Vehicle,
} from './types/fleet';

const EMPTY_AUTO_SHEET: AutoSheetConfigSummary = {
  enabled: false,
  mode: 'none',
  hasEnvWebhook: false,
  hasEnvServiceAccount: false,
  webhookUrlMasked: '',
  sheetUrl: '',
  sheetTitle: '',
  targetTab: '',
  lastAutoSyncAt: null,
};

export default function App() {
  // Public driver state (available without any login)
  const [publicVehicles, setPublicVehicles] = useState<PublicVehicleSummary[]>(() =>
    createInitialVehicles().map((v) => ({
      bienSo: v.bienSo,
      taiTrong: v.taiTrong,
      khuVuc: v.khuVuc,
      trangThai: v.trangThai,
      odoHienTai: v.odoHienTai,
      gioLanhHienTai: v.gioLanhHienTai,
    }))
  );
  const [publicAutoSheet, setPublicAutoSheet] = useState<{
    enabled: boolean;
    sheetTitle: string | null;
  }>({ enabled: false, sheetTitle: null });

  // Dispatcher auth & protected state (populated only after dispatcher login)
  const [dispatcherUsername, setDispatcherUsername] = useState<string | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<TripLog[]>([]);
  const [autoSheetConfig, setAutoSheetConfig] =
    useState<AutoSheetConfigSummary>(EMPTY_AUTO_SHEET);

  // Default landing tab is always the Driver Trip Entry screen
  const [activeTab, setActiveTab] = useState<ActiveTab>('entry');
  const [syncBusy, setSyncBusy] = useState(false);

  // Toast message
  const [toast, setToast] = useState<{ text: string; tone: 'success' | 'error' } | null>(
    null
  );

  // Trip modal (Dispatcher only)
  const [tripModalState, setTripModalState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    trip: TripLog | null;
  }>({ isOpen: false, mode: 'create', trip: null });

  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);

  const showToast = useCallback((text: string, tone: 'success' | 'error' = 'success') => {
    setToast({ text, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Load public vehicle list + auto-sheet availability for drivers
  useEffect(() => {
    fetchPublicBootstrap()
      .then((data) => {
        if (data.vehicles && data.vehicles.length > 0) {
          setPublicVehicles(data.vehicles);
        }
        setPublicAutoSheet({
          enabled: data.autoSheetEnabled,
          sheetTitle: data.sheetTitle,
        });
      })
      .catch(() => {
        // Fallback keeps initial 54 vehicles usable
      });
  }, []);

  const handleDispatcherSessionExpired = useCallback(
    (err: unknown) => {
      if (err instanceof DispatcherAuthError) {
        logoutDispatcher();
        setDispatcherUsername(null);
        setVehicles([]);
        setTrips([]);
        setActiveTab('entry');
        setLoginModalOpen(true);
        showToast(err.message, 'error');
        return true;
      }
      return false;
    },
    [showToast]
  );

  const loadDispatcherWorkspace = useCallback(async () => {
    try {
      const state = await fetchAdminState();
      setVehicles(state.vehicles);
      setTrips(state.trips);
      setAutoSheetConfig(state.autoSheet);
      setPublicVehicles(
        state.vehicles.map((v) => ({
          bienSo: v.bienSo,
          taiTrong: v.taiTrong,
          khuVuc: v.khuVuc,
          trangThai: v.trangThai,
          odoHienTai: v.odoHienTai,
          gioLanhHienTai: v.gioLanhHienTai,
        }))
      );
      setPublicAutoSheet({
        enabled: state.autoSheet.enabled,
        sheetTitle: state.autoSheet.sheetTitle || null,
      });
    } catch (err) {
      handleDispatcherSessionExpired(err);
    }
  }, [handleDispatcherSessionExpired]);

  const handleDispatcherAuthenticated = async (username: string) => {
    setDispatcherUsername(username);
    await loadDispatcherWorkspace();
    showToast(`Đã đăng nhập Điều hành (${username}).`);
  };

  const handleDispatcherLogout = () => {
    logoutDispatcher();
    setDispatcherUsername(null);
    setVehicles([]);
    setTrips([]);
    setAutoSheetConfig(EMPTY_AUTO_SHEET);
    setActiveTab('entry');
    showToast('Đã đăng xuất tài khoản điều hành.');
  };

  const isDispatcher = Boolean(dispatcherUsername);

  // Zero-login driver trip submission -> server persists & auto-sends to Google Sheet immediately
  const handleDriverSubmitTrip = async (
    newTrip: TripLog
  ): Promise<{ saved: boolean; sheetSynced: boolean; sheetError?: string | null }> => {
    const res = await submitDriverTrip(newTrip);

    if (res.vehicle) {
      const updatedV = res.vehicle;
      setPublicVehicles((prev) =>
        prev.map((v) =>
          v.bienSo === updatedV.bienSo
            ? {
                bienSo: updatedV.bienSo,
                taiTrong: updatedV.taiTrong,
                khuVuc: updatedV.khuVuc,
                trangThai: updatedV.trangThai,
                odoHienTai: updatedV.odoHienTai,
                gioLanhHienTai: updatedV.gioLanhHienTai,
              }
            : v
        )
      );
      if (isDispatcher) {
        setVehicles((prev) =>
          prev.map((v) => (v.bienSo === updatedV.bienSo ? updatedV : v))
        );
      }
    }

    if (isDispatcher) {
      setTrips((prev) => [res.trip, ...prev]);
    }

    return {
      saved: true,
      sheetSynced: res.sheetSynced,
      sheetError: res.sheetError,
    };
  };

  // Dispatcher TripModal save (create or edit)
  const handleDispatcherSaveTrip = async (savedTrip: TripLog): Promise<boolean> => {
    const isEditing = trips.some((t) => t.id === savedTrip.id);
    try {
      if (isEditing) {
        const res = await updateAdminTrip(savedTrip);
        setTrips((prev) =>
          prev.map((t) => (t.id === res.trip.id ? res.trip : t))
        );
        showToast(`Đã cập nhật chuyến xe ${savedTrip.bienSo}.`);
        return true;
      }

      const res = await handleDriverSubmitTrip(savedTrip);
      showToast(
        res.sheetSynced
          ? `Đã lưu & tự động gửi chuyến ${savedTrip.bienSo} lên Google Sheet.`
          : `Đã lưu chuyến xe ${savedTrip.bienSo}.`
      );
      return true;
    } catch (err: unknown) {
      if (!handleDispatcherSessionExpired(err)) {
        showToast(
          err instanceof Error ? err.message : 'Không thể lưu thông tin chuyến xe.',
          'error'
        );
      }
      return false;
    }
  };

  const handleRequestDeleteTrip = (trip: TripLog) => {
    setConfirmation({
      title: `Xóa nhật ký chuyến ${trip.id}?`,
      description: `Bạn có chắc muốn xóa chuyến đi của xe ${trip.bienSo} (${trip.tuyenDuong}) khỏi nhật ký?`,
      details: [
        `Ngày: ${trip.ngay} · Tài xế: ${trip.taiXe}${trip.taiXe2 ? ` & ${trip.taiXe2}` : ''}${trip.mcx ? ` · MCX: ${trip.mcx}` : ''}`,
        'Dữ liệu sẽ bị xóa khỏi danh sách điều hành trên máy chủ.',
      ],
      confirmLabel: 'Xóa chuyến',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await deleteAdminTrip(trip.id);
          setTrips((prev) => prev.filter((t) => t.id !== trip.id));
          showToast(`Đã xóa chuyến ${trip.id}.`);
        } catch (err) {
          if (!handleDispatcherSessionExpired(err)) {
            showToast(
              err instanceof Error ? err.message : 'Không thể xóa chuyến xe.',
              'error'
            );
          }
        }
      },
    });
  };

  const handleSaveAutoSheet = async (payload: {
    webhookUrl?: string;
    sheetUrl?: string;
    sheetTitle?: string;
    targetTab?: string;
    clearWebhook?: boolean;
  }) => {
    setSyncBusy(true);
    try {
      const res = await saveAutoSheetConfig(payload);
      setAutoSheetConfig(res.autoSheet);
      setPublicAutoSheet({
        enabled: res.autoSheet.enabled,
        sheetTitle: res.autoSheet.sheetTitle || null,
      });
    } catch (err) {
      handleDispatcherSessionExpired(err);
      throw err;
    } finally {
      setSyncBusy(false);
    }
  };

  const handleTestAutoSheet = async (syncAll: boolean) => {
    setSyncBusy(true);
    try {
      const res = await testAutoSheetConnection(syncAll);
      setAutoSheetConfig((prev) => ({
        ...prev,
        lastAutoSyncAt: res.lastAutoSyncAt,
      }));
    } catch (err) {
      handleDispatcherSessionExpired(err);
      throw err;
    } finally {
      setSyncBusy(false);
    }
  };

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    shortLabel: string;
    icon: typeof ClipboardList;
    audience: string;
  }> = [
    {
      id: 'entry',
      label: 'Nhập chuyến xe',
      shortLabel: 'Nhập chuyến',
      icon: FilePlus2,
      audience: 'Lái xe',
    },
    {
      id: 'trips',
      label: 'Nhật ký chuyến đi',
      shortLabel: 'Nhật ký',
      icon: ClipboardList,
      audience: 'Điều hành',
    },
    {
      id: 'reports',
      label: 'Báo cáo & Google Sheets',
      shortLabel: 'Google Sheet',
      icon: FileSpreadsheet,
      audience: 'Điều hành',
    },
  ];

  const effectiveTab: ActiveTab = isDispatcher ? activeTab : 'entry';
  const currentTitle =
    navItems.find((item) => item.id === effectiveTab)?.label || 'Nhập chuyến xe';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Desktop Sidebar (visible ONLY for authenticated dispatcher) */}
      {isDispatcher && (
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
          <div className="flex h-16 items-center border-b border-slate-200 px-6">
            <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
              Nhật Ký Xe Tải
            </span>
          </div>

          <nav className="flex-1 space-y-1 p-3" aria-label="Điều hướng chính">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = effectiveTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        active ? 'text-white' : 'text-slate-500'
                      }`}
                    />
                    {item.label}
                  </span>
                  <span
                    className={`text-[11px] font-medium ${
                      active ? 'text-slate-300' : 'text-slate-400'
                    }`}
                  >
                    {item.audience}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-slate-200 p-4 text-xs text-slate-600">
            <p className="font-semibold text-slate-900">Trạng thái Google Sheet</p>
            <p className="mt-1 text-[11px] text-slate-500">
              {autoSheetConfig.enabled
                ? `Đang tự động ghi${autoSheetConfig.targetTab ? ` (${autoSheetConfig.targetTab})` : ''}`
                : 'Chưa cấu hình Web App URL'}
            </p>
          </div>
        </aside>
      )}

      {/* Main Content Shell */}
      <div className={isDispatcher ? 'lg:pl-64' : ''}>
        {/* Top Bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xs sm:h-16 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`text-sm font-bold text-slate-900 whitespace-nowrap ${
                isDispatcher ? 'lg:hidden' : 'sm:text-base'
              }`}
            >
              Nhật Ký Xe Tải 5T · 8T · 13T
            </span>
            {isDispatcher && (
              <span className="hidden text-base font-bold text-slate-900 lg:inline truncate">
                {currentTitle}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {isDispatcher ? (
              <>
                {effectiveTab === 'entry' ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab('trips')}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 sm:h-10 sm:px-4 sm:text-sm whitespace-nowrap shrink-0"
                  >
                    <ClipboardList className="h-4 w-4 text-slate-600" />
                    Nhật ký điều hành
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setTripModalState({
                        isOpen: true,
                        mode: 'create',
                        trip: null,
                      })
                    }
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-blue-800 sm:h-10 sm:px-4 sm:text-sm whitespace-nowrap shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                    Ghi chuyến mới
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDispatcherLogout}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                  title={`Đăng xuất tài khoản ${dispatcherUsername}`}
                >
                  <LogOut className="h-3.5 w-3.5 text-slate-500" />
                  <span className="hidden sm:inline">{dispatcherUsername}</span>
                  <span className="sm:hidden">Thoát</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setLoginModalOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <Lock className="h-3.5 w-3.5 text-slate-500" />
                Đăng nhập Điều hành
              </button>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main
          className={`mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-6 ${
            isDispatcher ? 'pb-20 lg:pb-8' : 'pb-8'
          }`}
        >
          {toast && (toast.tone === 'error' || effectiveTab !== 'entry') && (
            <div
              role="status"
              className={`mb-4 flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm font-medium ${
                toast.tone === 'error'
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-900'
              }`}
            >
              <span>{toast.text}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="ml-4 text-xs font-semibold opacity-70 hover:opacity-100"
              >
                Đóng
              </button>
            </div>
          )}

          {effectiveTab === 'entry' && (
            <TripEntryView
              vehicles={publicVehicles}
              autoSheetEnabled={publicAutoSheet.enabled}
              sheetTitle={publicAutoSheet.sheetTitle}
              isDispatcherAuthenticated={isDispatcher}
              onSaveTrip={handleDriverSubmitTrip}
              onOpenDispatcherLog={() => setActiveTab('trips')}
              onOpenSheetsSetup={() => setActiveTab('reports')}
            />
          )}

          {isDispatcher && effectiveTab === 'trips' && (
            <TripsView
              trips={trips}
              onCreateTrip={() => setActiveTab('entry')}
              onEditTrip={(trip) =>
                setTripModalState({ isOpen: true, mode: 'edit', trip })
              }
              onDeleteTrip={handleRequestDeleteTrip}
            />
          )}

          {isDispatcher && effectiveTab === 'reports' && (
            <ReportsAndSheetsView
              vehicles={vehicles}
              trips={trips}
              autoSheetConfig={autoSheetConfig}
              syncBusy={syncBusy}
              onSaveAutoSheet={handleSaveAutoSheet}
              onTestAutoSheet={handleTestAutoSheet}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation (visible ONLY for authenticated dispatcher) */}
      {isDispatcher && (
        <nav
          className="fixed inset-x-0 bottom-0 z-20 grid h-14 grid-cols-3 border-t border-slate-200 bg-white lg:hidden"
          aria-label="Điều hướng di động"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = effectiveTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
                  active ? 'text-blue-700' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.shortLabel}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Dispatcher Login Modal */}
      <DispatcherLoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onAuthenticated={handleDispatcherAuthenticated}
      />

      {/* Dispatcher Trip Edit/Create Modal */}
      {isDispatcher && (
        <TripModal
          isOpen={tripModalState.isOpen}
          mode={tripModalState.mode}
          initialTrip={tripModalState.trip}
          vehicles={vehicles}
          onClose={() =>
            setTripModalState({
              isOpen: false,
              mode: 'create',
              trip: null,
            })
          }
          onSave={handleDispatcherSaveTrip}
        />
      )}

      <ConfirmActionModal
        confirmation={confirmation}
        onClose={() => setConfirmation(null)}
      />
    </div>
  );
}

import { Lock, ShieldCheck, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import {
  fetchAuthStatus,
  loginDispatcher,
  setupDispatcherAccount,
} from '../services/apiClient';

interface DispatcherLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (username: string) => Promise<void> | void;
}

export function DispatcherLoginModal({
  isOpen,
  onClose,
  onAuthenticated,
}: DispatcherLoginModalProps) {
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [isSetupRequired, setIsSetupRequired] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setPassword('');
    setConfirmPassword('');
    setLoadingStatus(true);
    fetchAuthStatus()
      .then((status) => {
        setIsSetupRequired(status.isSetupRequired);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : 'Không thể kiểm tra trạng thái đăng nhập.'
        );
      })
      .finally(() => {
        setLoadingStatus(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      setError('Vui lòng nhập đầy đủ ID và mật khẩu.');
      return;
    }

    if (isSetupRequired) {
      if (password.length < 6) {
        setError('Mật khẩu cần tối thiểu 6 ký tự.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Mật khẩu xác nhận không khớp.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const result = isSetupRequired
        ? await setupDispatcherAccount(trimmedUser, password)
        : await loginDispatcher(trimmedUser, password);
      await onAuthenticated(result.username);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Đăng nhập không thành công.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispatcher-login-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700">
              {isSetupRequired ? (
                <ShieldCheck className="h-5 w-5" />
              ) : (
                <Lock className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2
                id="dispatcher-login-title"
                className="text-base font-bold text-slate-900"
              >
                {isSetupRequired
                  ? 'Thiết lập tài khoản Điều hành'
                  : 'Đăng nhập Điều hành'}
              </h2>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                {isSetupRequired
                  ? 'Tạo ID và mật khẩu điều hành lần đầu để mở khóa Nhật ký, Đội xe và cấu hình Google Sheet.'
                  : 'Nhập ID và mật khẩu điều hành để truy cập Quản lý đội xe, Nhật ký và Google Sheets.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          {loadingStatus ? (
            <p className="py-4 text-center text-xs text-slate-500">
              Đang kiểm tra cấu hình bảo mật...
            </p>
          ) : (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  ID đăng nhập
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="Nhập ID điều hành"
                  required
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Mật khẩu
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSetupRequired ? 'new-password' : 'current-password'}
                  placeholder="Nhập mật khẩu"
                  required
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              {isSetupRequired && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Xác nhận mật khẩu
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Nhập lại mật khẩu"
                    required
                    className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[40px] rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {submitting
                    ? 'Đang xử lý...'
                    : isSetupRequired
                      ? 'Lưu & Đăng nhập'
                      : 'Đăng nhập'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

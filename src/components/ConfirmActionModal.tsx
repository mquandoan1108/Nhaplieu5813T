import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { useState } from 'react';
import { PendingConfirmation } from '../types/fleet';

interface ConfirmActionModalProps {
  confirmation: PendingConfirmation | null;
  onClose: () => void;
}

export function ConfirmActionModal({ confirmation, onClose }: ConfirmActionModalProps) {
  const [submitting, setSubmitting] = useState(false);

  if (!confirmation) return null;

  const isDanger = confirmation.tone === 'danger';

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await confirmation.onConfirm();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (submitting) return;
    confirmation.onCancel?.();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                isDanger
                  ? 'border-red-200 bg-red-50 text-red-600'
                  : 'border-blue-200 bg-blue-50 text-blue-700'
              }`}
            >
              {isDanger ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </div>
            <div>
              <h3 id="confirm-modal-title" className="text-base font-semibold text-slate-900">
                {confirmation.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {confirmation.description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
            aria-label="Đóng hộp thoại"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {confirmation.details.length > 0 && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
            <ul className="space-y-1.5 text-xs text-slate-700">
              {confirmation.details.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 ${
              isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-700 hover:bg-blue-800'
            }`}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmation.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

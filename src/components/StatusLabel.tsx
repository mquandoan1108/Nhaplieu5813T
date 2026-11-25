import { CheckCircle2, Navigation } from 'lucide-react';
import { VehicleStatus } from '../types/fleet';

export function VehicleStatusDisplay({ status }: { status: VehicleStatus }) {
  switch (status) {
    case 'SanSang':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          Sẵn sàng
        </span>
      );
    case 'DangChay':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 whitespace-nowrap">
          <Navigation className="h-3.5 w-3.5 shrink-0 text-blue-600" />
          Đang chạy
        </span>
      );
  }
}

import React from 'react';
import { useOnlineStatus } from '../hooks/usePWAInstall.ts';
import { WifiOff } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-600 text-white px-4 py-1.5 text-xs font-medium flex items-center justify-center gap-2 shadow-xs sticky top-0 z-50 animate-in slide-in-from-top"
    >
      <WifiOff className="w-3.5 h-3.5 animate-pulse" />
      <span>Offline Mode active — You can freely edit syllabus, log study time, and view formulas. Changes are saved locally and will sync when reconnected.</span>
    </div>
  );
};

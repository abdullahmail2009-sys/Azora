import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import { Download, Smartphone, X, CheckCircle2 } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed as standalone PWA
  if (isInstalled) {
    return (
      <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#75D9B4]/25 text-[#1B4D48] border border-[#42BDAE]/50">
        <CheckCircle2 className="w-3.5 h-3.5 text-[#1B4D48]" />
        AZORA Installed
      </span>
    );
  }

  // Chromium / Android / Desktop prompt
  if (isInstallable) {
    return (
      <button
        onClick={install}
        aria-label="Install AZORA App"
        className="inline-flex items-center gap-1.5 rounded-xl bg-[#42BDAE] hover:bg-[#35A597] text-[#FBF7EF] px-3 py-2 text-xs font-semibold shadow-2xs transition active:scale-95 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install AZORA</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          aria-label="Install instructions for iOS Safari"
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#E2DAC7] bg-[#F5EFE2] px-2.5 py-1.5 text-xs font-medium text-[#1B4D48] hover:bg-[#EDE5D4] transition"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#42BDAE]" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B4D48]/30 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#FBF7EF] p-6 shadow-xl border border-[#E2DAC7]">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2DAC7]">
                <h3 className="text-base font-semibold text-[#1B4D48] flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#42BDAE]" />
                  Install AZORA on iPhone / iPad
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="text-[#4A6B66] hover:text-[#1B4D48] p-1 rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-4 space-y-3 text-sm text-[#4A6B66]">
                <p className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#75D9B4]/30 text-[#1B4D48] text-xs font-bold flex items-center justify-center">
                    1
                  </span>
                  <span>
                    Tap the <strong className="text-[#1B4D48]">Share</strong> icon in the Safari bottom bar.
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#75D9B4]/30 text-[#1B4D48] text-xs font-bold flex items-center justify-center">
                    2
                  </span>
                  <span>
                    Scroll down and tap <strong className="text-[#1B4D48]">Add to Home Screen</strong>.
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#75D9B4]/30 text-[#1B4D48] text-xs font-bold flex items-center justify-center">
                    3
                  </span>
                  <span>Open AZORA like a native app with full offline support.</span>
                </p>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-[#1B4D48] hover:bg-[#143B37] text-[#FBF7EF] py-2 text-sm font-semibold transition"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

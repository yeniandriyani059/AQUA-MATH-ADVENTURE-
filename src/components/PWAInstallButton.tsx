import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

export const PWAInstallButton: React.FC<{ className?: string }> = ({ className }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={
          className ||
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-sky-950 font-bold text-xs cursor-pointer shadow-md border border-white'
        }
      >
        <Download className="w-3.5 h-3.5 stroke-[2.5]" />
        <span>Install PWA HP</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            className ||
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-800 hover:bg-sky-700 text-cyan-200 font-bold text-xs cursor-pointer border border-cyan-400/50'
          }
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Install iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-sky-950/90 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-sky-900 border-2 border-cyan-400 p-5 shadow-2xl text-cyan-100 space-y-3">
              <div className="flex items-center justify-between border-b border-cyan-500/30 pb-2">
                <h3 className="font-['Fredoka'] font-bold text-base text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-yellow-300" />
                  <span>Pasang Aplikasi di iOS</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg hover:bg-sky-800 text-cyan-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs leading-relaxed">
                1. Ketuk tombol <strong>Bagikan (Share)</strong> di Safari.<br />
                2. Gulir ke bawah lalu pilih <strong>Tambahkan ke Layar Utama (Add to Home Screen)</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-sky-950 font-bold text-xs cursor-pointer"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

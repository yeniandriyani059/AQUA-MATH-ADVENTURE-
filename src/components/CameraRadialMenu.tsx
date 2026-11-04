import React from 'react';
import {
  Camera,
  RotateCcw,
  Sparkles,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { CameraControlActions, CameraViewDistancePreset } from './AquaCityCanvas';
import { soundManager } from '../utils/sound';

interface CameraRadialMenuProps {
  cameraControlRef: React.MutableRefObject<CameraControlActions | null>;
  cameraPreset: CameraViewDistancePreset;
  onPresetChange: (preset: CameraViewDistancePreset) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const CameraRadialMenu: React.FC<CameraRadialMenuProps> = ({
  cameraControlRef,
  cameraPreset,
  onPresetChange,
  isOpen,
  onToggleOpen,
}) => {
  const handleZoomIn = () => {
    soundManager.playClick();
    cameraControlRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    soundManager.playClick();
    cameraControlRef.current?.zoomOut();
  };

  const handleSetWide = () => {
    soundManager.playClick();
    cameraControlRef.current?.setViewPreset('wide');
    onPresetChange('wide');
  };

  const handleSetNormal = () => {
    soundManager.playClick();
    cameraControlRef.current?.setViewPreset('normal');
    onPresetChange('normal');
  };

  const handleReset = () => {
    soundManager.playClick();
    cameraControlRef.current?.resetCamera();
  };

  // Radial items configuration: positioned around the central hub fanning into the screen (top-left quadrant)
  // -175° (left), -152° (upper left), -130° (diagonal up-left), -108° (upper high), -85° (straight top)
  const radius = 68; // pixels distance from center
  const radialButtons = [
    {
      id: 'zoom-out',
      testId: 'cam-radial-zoom-out',
      title: 'Zoom Out',
      angleDeg: -175,
      icon: <ZoomOut className="w-4 h-4 text-cyan-200 stroke-[2.5]" />,
      onClick: handleZoomOut,
      active: false,
    },
    {
      id: 'zoom-in',
      testId: 'cam-radial-zoom-in',
      title: 'Zoom In',
      angleDeg: -152,
      icon: <ZoomIn className="w-4 h-4 text-cyan-200 stroke-[2.5]" />,
      onClick: handleZoomIn,
      active: false,
    },
    {
      id: 'wide-view',
      testId: 'cam-radial-wide',
      title: 'Wide View',
      angleDeg: -130,
      icon: <Maximize2 className="w-4 h-4 text-cyan-100 stroke-[2.5]" />,
      onClick: handleSetWide,
      active: cameraPreset === 'wide',
    },
    {
      id: 'normal-view',
      testId: 'cam-radial-normal',
      title: 'Normal View',
      angleDeg: -108,
      icon: <Minimize2 className="w-4 h-4 text-cyan-100 stroke-[2.5]" />,
      onClick: handleSetNormal,
      active: cameraPreset === 'normal',
    },
    {
      id: 'reset-cam',
      testId: 'cam-radial-reset',
      title: 'Reset Camera',
      angleDeg: -85,
      icon: <RotateCcw className="w-4 h-4 text-yellow-300 stroke-[2.75]" />,
      onClick: handleReset,
      active: false,
    },
  ];

  return (
    <div className="relative flex items-center justify-center pointer-events-auto select-none">
      {/* Background Soft Glow Backdrop when Radial is active */}
      {isOpen && (
        <div
          className="absolute w-40 h-40 rounded-full bg-cyan-500/10 backdrop-blur-xs border border-cyan-400/20 pointer-events-none transition-all duration-300 scale-100 opacity-100"
          style={{ transform: 'translate(-38px, -38px)' }}
        />
      )}

      {/* Radial Satellite Buttons */}
      {radialButtons.map((btn, index) => {
        const rad = (btn.angleDeg * Math.PI) / 180;
        const x = Math.round(Math.cos(rad) * radius);
        const y = Math.round(Math.sin(rad) * radius);

        return (
          <button
            key={btn.id}
            type="button"
            tabIndex={-1}
            data-testid={btn.testId}
            title={btn.title}
            aria-label={btn.title}
            onClick={(e) => {
              e.currentTarget.blur();
              btn.onClick();
            }}
            style={{
              transform: isOpen
                ? `translate(${x}px, ${y}px) scale(1)`
                : 'translate(0px, 0px) scale(0)',
              opacity: isOpen ? 1 : 0,
              pointerEvents: isOpen ? 'auto' : 'none',
              transitionDelay: `${isOpen ? index * 35 : 0}ms`,
            }}
            className={`absolute z-30 w-10 h-10 rounded-full flex items-center justify-center border-2 shadow-lg transition-all duration-200 cursor-pointer active:scale-90 ${
              btn.active
                ? 'bg-cyan-500 text-sky-950 border-white shadow-[0_0_12px_rgba(6,182,212,0.8)]'
                : 'bg-sky-950/95 hover:bg-sky-900 text-cyan-200 border-cyan-400/80 shadow-[0_4px_12px_rgba(3,43,67,0.7)] hover:border-yellow-300'
            }`}
          >
            {btn.icon}
          </button>
        );
      })}

      {/* Primary Circular Camera Hub Button (Always Visible in Lower-Right HUD) */}
      <button
        type="button"
        tabIndex={-1}
        data-testid="camera-round-button"
        aria-label={isOpen ? 'Tutup Kontrol Kamera' : 'Buka Kontrol Kamera'}
        title={isOpen ? 'Tutup Menu Kamera' : 'Kontrol Kamera 3D'}
        onClick={(e) => {
          e.currentTarget.blur();
          soundManager.playClick();
          onToggleOpen();
        }}
        className={`relative z-40 w-12 h-12 sm:w-13 sm:h-13 rounded-full flex items-center justify-center border-2 transition-all duration-200 cursor-pointer shadow-xl active:scale-95 ${
          isOpen
            ? 'bg-rose-950/95 hover:bg-rose-900 border-rose-400 text-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.6)]'
            : 'bg-gradient-to-br from-sky-900 via-sky-950 to-cyan-950 hover:from-sky-800 hover:to-sky-900 border-cyan-400/90 hover:border-yellow-300 text-cyan-200 shadow-[0_0_14px_rgba(34,211,238,0.5)]'
        }`}
      >
        {/* Soft inner ambient ring */}
        <div className="absolute inset-0.5 rounded-full border border-white/20 pointer-events-none" />

        {isOpen ? (
          <X className="w-5 h-5 text-rose-200 stroke-[2.75]" />
        ) : (
          <Camera className="w-5 h-5 text-cyan-300 stroke-[2.5]" />
        )}
      </button>
    </div>
  );
};

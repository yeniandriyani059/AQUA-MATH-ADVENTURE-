import React, { useRef, useState } from 'react';
import { JoystickVector } from './AquaCityCanvas';

interface VirtualJoystickProps {
  joystickRef: React.MutableRefObject<JoystickVector>;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({ joystickRef }) => {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const updateFromClientXY = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dynamicRadius = Math.max(36, rect.width * 0.38);

    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist > dynamicRadius) {
      dx = (dx / dist) * dynamicRadius;
      dy = (dy / dist) * dynamicRadius;
    }

    setKnobOffset({ x: dx, y: dy });
    joystickRef.current = {
      x: Number((dx / dynamicRadius).toFixed(3)),
      y: Number((dy / dynamicRadius).toFixed(3)),
    };
  };

  const resetJoystick = () => {
    setActive(false);
    setKnobOffset({ x: 0, y: 0 });
    joystickRef.current = { x: 0, y: 0 };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setActive(true);
    updateFromClientXY(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!active) return;
    updateFromClientXY(e.clientX, e.clientY);
  };

  return (
    <div className="flex flex-col items-center select-none pointer-events-auto">
      <div
        ref={baseRef}
        role="slider"
        aria-label="Joystick Kendali Karakter"
        aria-valuemin={-1}
        aria-valuemax={1}
        aria-valuenow={joystickRef.current.x}
        tabIndex={-1}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={resetJoystick}
        onPointerCancel={resetJoystick}
        className={`relative w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-full flex items-center justify-center touch-none cursor-grab active:cursor-grabbing transition-colors ${
          active
            ? 'bg-sky-950/90 border-4 border-yellow-400 shadow-lg'
            : 'bg-sky-950/80 border-4 border-cyan-400/80 shadow-md'
        }`}
      >
        {/* Direction Arrows */}
        <span className="absolute top-1.5 sm:top-2 text-[10px] sm:text-xs font-bold text-cyan-300 pointer-events-none select-none">▲</span>
        <span className="absolute bottom-1.5 sm:bottom-2 text-[10px] sm:text-xs font-bold text-cyan-300 pointer-events-none select-none">▼</span>
        <span className="absolute left-2 sm:left-2.5 text-[10px] sm:text-xs font-bold text-cyan-300 pointer-events-none select-none">◀</span>
        <span className="absolute right-2 sm:right-2.5 text-[10px] sm:text-xs font-bold text-cyan-300 pointer-events-none select-none">▶</span>

        {/* Draggable Thumb Knob */}
        <div
          style={{
            transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
          }}
          className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full border-2 flex items-center justify-center pointer-events-none transition-transform duration-75 select-none ${
            active
              ? 'bg-yellow-400 border-white text-sky-950 scale-105 shadow-md'
              : 'bg-cyan-400 border-white text-sky-950 shadow-sm'
          }`}
        >
          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/80" />
        </div>
      </div>
    </div>
  );
};

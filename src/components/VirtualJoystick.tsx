import React, { useRef, useState } from 'react';
import { JoystickVector } from './AquaCityCanvas';

interface VirtualJoystickProps {
  joystickRef: React.MutableRefObject<JoystickVector>;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({ joystickRef }) => {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const maxRadius = 42;

  const updateFromClientXY = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    setKnobOffset({ x: dx, y: dy });
    joystickRef.current = {
      x: Number((dx / maxRadius).toFixed(3)),
      y: Number((dy / maxRadius).toFixed(3)),
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
        className={`relative w-28 h-28 rounded-full flex items-center justify-center touch-none cursor-grab active:cursor-grabbing transition-colors ${
          active
            ? 'bg-sky-950/90 border-4 border-yellow-400 shadow-lg'
            : 'bg-sky-950/80 border-4 border-cyan-400/80 shadow-md'
        }`}
      >
        {/* Direction Arrows */}
        <span className="absolute top-1.5 text-[10px] font-bold text-cyan-300 pointer-events-none">▲</span>
        <span className="absolute bottom-1.5 text-[10px] font-bold text-cyan-300 pointer-events-none">▼</span>
        <span className="absolute left-2 text-[10px] font-bold text-cyan-300 pointer-events-none">◀</span>
        <span className="absolute right-2 text-[10px] font-bold text-cyan-300 pointer-events-none">▶</span>

        {/* Draggable Thumb Knob */}
        <div
          style={{
            transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
          }}
          className={`w-12 h-12 rounded-full border-2 flex items-center justify-center pointer-events-none transition-transform duration-75 ${
            active
              ? 'bg-yellow-400 border-white text-sky-950 scale-105'
              : 'bg-cyan-400 border-white text-sky-950'
          }`}
        >
          <div className="w-4 h-4 rounded-full bg-white/80" />
        </div>
      </div>
    </div>
  );
};

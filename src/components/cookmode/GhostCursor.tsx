import React, { useEffect, useState } from 'react';
import { MousePointer2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GhostCursorProps {
  x: number;
  y: number;
  isMoving: boolean;
  className?: string;
}

export const GhostCursor: React.FC<GhostCursorProps> = ({ x, y, isMoving, className }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isMoving) {
      setVisible(true);
      const timeout = setTimeout(() => setVisible(false), 2000); // Hide after 2s of no movement
      return () => clearTimeout(timeout);
    }
  }, [isMoving, x, y]);

  if (!visible || x === 0 || y === 0) return null;

  return (
    <div
      className={cn(
        "fixed pointer-events-none z-[9999] transition-all duration-100",
        className
      )}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="relative">
        <MousePointer2 
          className="w-6 h-6 text-neon-cyan drop-shadow-[0_0_8px_rgba(0,255,255,0.8)] animate-pulse" 
          fill="currentColor"
        />
        <div className="absolute inset-0 animate-ping">
          <MousePointer2 className="w-6 h-6 text-neon-cyan opacity-75" />
        </div>
      </div>
    </div>
  );
};

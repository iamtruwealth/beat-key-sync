import React, { useRef, useEffect } from 'react';

interface StaticWaveformProps {
  peaks: Float32Array[];
  duration: number;
  width: number;
  height: number;
  waveColor: string;
  progressColor: string;
  progress: number; // 0 to 1
  className?: string;
}

export const StaticWaveform: React.FC<StaticWaveformProps> = ({
  peaks,
  duration,
  width,
  height,
  waveColor,
  progressColor,
  progress,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas resolution only when size changes to avoid flicker
    const dpr = window.devicePixelRatio || 1;
    const widthPx = Math.max(1, Math.floor(width * dpr));
    const heightPx = Math.max(1, Math.floor(height * dpr));

    if (canvas.width !== widthPx || canvas.height !== heightPx) {
      canvas.width = widthPx;
      canvas.height = heightPx;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Reset transform before scaling to prevent compounding scale
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks || peaks.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Use first channel for visualization
    const channelPeaks = peaks[0];
    const barWidth = 2;
    const barGap = 1;
    const barSpacing = barWidth + barGap;
    const numBars = Math.floor(width / barSpacing);
    const samplesPerBar = Math.max(1, Math.floor(channelPeaks.length / numBars));

    // Draw waveform bars once using base color (no progress overlay to avoid flicker)
    ctx.fillStyle = waveColor;
    for (let i = 0; i < numBars; i++) {
      const x = i * barSpacing;

      // Get max value for this bar
      let max = 0;
      for (let j = 0; j < samplesPerBar; j++) {
        const index = i * samplesPerBar + j;
        if (index < channelPeaks.length) {
          max = Math.max(max, channelPeaks[index]);
        }
      }

      // Normalize and calculate bar height
      const barHeight = Math.max(1, max * height * 0.9);
      const y = (height - barHeight) / 2;

      ctx.fillRect(x, y, barWidth, barHeight);
    }
  }, [peaks, width, height, waveColor]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width, height, pointerEvents: 'none' }}
    />
  );
};

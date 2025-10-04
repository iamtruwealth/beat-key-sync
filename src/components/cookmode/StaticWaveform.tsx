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
    if (!canvas || !peaks || peaks.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas resolution
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Use first channel for visualization
    const channelPeaks = peaks[0];
    const barWidth = 2;
    const barGap = 1;
    const barSpacing = barWidth + barGap;
    const numBars = Math.floor(width / barSpacing);
    const samplesPerBar = Math.max(1, Math.floor(channelPeaks.length / numBars));

    const progressX = progress * width;

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

      // Choose color based on progress
      ctx.fillStyle = x < progressX ? progressColor : waveColor;
      ctx.fillRect(x, y, barWidth, barHeight);
    }
  }, [peaks, width, height, waveColor, progressColor, progress]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width, height }}
    />
  );
};

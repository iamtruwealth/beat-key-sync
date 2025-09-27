import React, { useRef, useEffect, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

interface Track {
  id: string;
  name: string;
  file_url: string;
  stem_type: string;
  isMuted?: boolean;
  isSolo?: boolean;
  volume?: number;
}

interface AudioClip {
  id: string;
  trackId: string;
  startTime: number;
  endTime: number;
  originalTrack: Track;
}

interface WaveformStackProps {
  clips: AudioClip[];
  currentTime: number;
  isPlaying: boolean;
  pixelsPerSecond: number;
  trackHeight: number;
  containerWidth: number;
}

export const WaveformStack: React.FC<WaveformStackProps> = ({
  clips,
  currentTime,
  isPlaying,
  pixelsPerSecond,
  trackHeight,
  containerWidth,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveSurfersRef = useRef<Map<string, WaveSurfer>>(new Map());
  const [isLoaded, setIsLoaded] = useState<Map<string, boolean>>(new Map());

  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.substring(1,3),16);
    const g = parseInt(hex.substring(3,5),16);
    const b = parseInt(hex.substring(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
  };

  const getStemColors = (stemType: string) => {
    const base: Record<string,string[]> = {
      drums: ['#ff9a9a','#dc2626'],
      bass: ['#a3c4ff','#2563eb'],
      melody: ['#81e6d9','#059669'],
      vocals: ['#c4b5fd','#7c3aed'],
      other: ['#e5e7eb','#4b5563']
    };
    return base[stemType] || base.other;
  };

  useEffect(() => {
    if (!containerRef.current) return;

    clips.forEach(clip => {
      if (waveSurfersRef.current.has(clip.id)) return;

      const track = clip.originalTrack;
      const waveSurfer = WaveSurfer.create({
        container: document.createElement('div'),
        waveColor: getStemColors(track.stem_type)[0],
        progressColor: getStemColors(track.stem_type)[1],
        cursorColor: 'rgba(255,255,255,0.8)',
        barWidth: 2,
        barGap: 1,
        height: trackHeight - 8,
        normalize: true,
        interact: false,
        hideScrollbar: true,
        minPxPerSec: pixelsPerSecond,
        fillParent: false,
        mediaControls: false,
        autoplay: false,
        backend: 'WebAudio'
      });

      // Append waveform div to main container
      const waveformDiv = waveSurfer.container;
      waveformDiv.style.position = 'absolute';
      waveformDiv.style.top = `${clips.indexOf(clip) * trackHeight}px`;
      waveformDiv.style.left = '0';
      waveformDiv.style.width = `${containerWidth}px`;
      waveformDiv.style.zIndex = `${track.isSolo ? 10 : 1}`;
      waveformDiv.style.opacity = `${track.isMuted ? 0.3 : 1}`;
      containerRef.current!.appendChild(waveformDiv);

      waveSurfer.load(track.file_url).then(() => {
        setIsLoaded(prev => new Map(prev.set(clip.id, true)));
        waveSurfer.pause();
      });

      waveSurfersRef.current.set(clip.id, waveSurfer);
    });

    return () => {
      waveSurfersRef.current.forEach(ws => ws.destroy());
      waveSurfersRef.current.clear();
    };
  }, [clips, trackHeight, pixelsPerSecond, containerWidth]);

  // Update playhead
  useEffect(() => {
    waveSurfersRef.current.forEach((waveSurfer, clipId) => {
      const clip = clips.find(c => c.id === clipId);
      if (!clip || !isLoaded.get(clipId)) return;
      const relTime = currentTime - clip.startTime;
      const progress = Math.max(0, Math.min(1, relTime / (clip.endTime - clip.startTime)));
      waveSurfer.seekTo(progress);
    });
  }, [currentTime, clips, isLoaded]);

  // Update mute/solo visuals
  useEffect(() => {
    waveSurfersRef.current.forEach((waveSurfer, clipId) => {
      const clip = clips.find(c => c.id === clipId);
      if (!clip || !isLoaded.get(clipId)) return;

      waveSurfer.setOptions({
        waveColor: clip.originalTrack.isMuted
          ? hexToRgba(getStemColors(clip.originalTrack.stem_type)[0], 0.3)
          : getStemColors(clip.originalTrack.stem_type)[0],
        progressColor: clip.originalTrack.isMuted
          ? hexToRgba(getStemColors(clip.originalTrack.stem_type)[1], 0.3)
          : getStemColors(clip.originalTrack.stem_type)[1]
      });

      waveSurfer.container.style.zIndex = `${clip.originalTrack.isSolo ? 10 : 1}`;
      waveSurfer.container.style.opacity = `${clip.originalTrack.isMuted ? 0.3 : 1}`;
    });
  }, [clips, isLoaded]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: containerWidth,
        height: clips.length * trackHeight,
        overflow: 'hidden'
      }}
    />
  );
};

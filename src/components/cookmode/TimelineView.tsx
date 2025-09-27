import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, RotateCcw, Repeat } from 'lucide-react';

interface Track {
  id: string;
  name: string;
  file_url: string;
  stem_type: string;
  uploaded_by: string;
  version_number: number;
  duration?: number;
  volume: number;
  isMuted: boolean;
  isSolo: boolean;
  waveformData?: number[];
}

interface TimelineViewProps {
  tracks: Track[];
  isPlaying: boolean;
  currentTime: number;
  bpm: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  tracks,
  isPlaying,
  currentTime,
  bpm,
  onPlayPause,
  onSeek
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isLooping, setIsLooping] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(32); // Default 8 bars
  const [isDraggingLoop, setIsDraggingLoop] = useState<'start' | 'end' | 'region' | null>(null);
  const [timelineWidth, setTimelineWidth] = useState(0);

  // Calculate timing constants
  const secondsPerBeat = 60 / bpm;
  const beatsPerBar = 4;
  const secondsPerBar = secondsPerBeat * beatsPerBar;
  const maxDuration = Math.max(...tracks.map(t => t.duration || 60), 60);
  const totalBars = Math.ceil(maxDuration / secondsPerBar);
  const pixelsPerSecond = 40; // Zoom level
  const pixelsPerBeat = pixelsPerSecond * secondsPerBeat;
  const pixelsPerBar = pixelsPerBeat * beatsPerBar;

  // Update timeline width
  useEffect(() => {
    if (timelineRef.current) {
      setTimelineWidth(timelineRef.current.offsetWidth);
    }
  }, []);

  // Handle loop logic
  useEffect(() => {
    if (isLooping && currentTime >= loopEnd) {
      onSeek(loopStart);
    }
  }, [currentTime, isLooping, loopStart, loopEnd, onSeek]);

  const handleTimelineClick = useCallback((event: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const time = (x / pixelsPerSecond);
    onSeek(Math.max(0, Math.min(time, maxDuration)));
  }, [pixelsPerSecond, maxDuration, onSeek]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPosition = (seconds: number) => {
    const bar = Math.floor(seconds / secondsPerBar) + 1;
    const beat = Math.floor((seconds % secondsPerBar) / secondsPerBeat) + 1;
    return `${bar}.${beat}`;
  };

  const getStemColor = (stemType: string) => {
    const colors = {
      melody: '#00f5ff',
      drums: '#0080ff', 
      bass: '#ff00ff',
      vocal: '#00f5ff',
      fx: '#0080ff',
      other: '#888888'
    };
    return colors[stemType as keyof typeof colors] || colors.other;
  };

  const renderBarMarkers = () => {
    const markers = [];
    for (let bar = 0; bar < totalBars; bar++) {
      const x = bar * pixelsPerBar;
      
      // Bar line
      markers.push(
        <div
          key={`bar-${bar}`}
          className="absolute top-0 bottom-0 w-px bg-border/40"
          style={{ left: x }}
        />
      );

      // Bar number
      markers.push(
        <div
          key={`bar-label-${bar}`}
          className="absolute top-0 text-xs text-muted-foreground font-mono"
          style={{ left: x + 4, transform: 'translateY(-20px)' }}
        >
          {bar + 1}
        </div>
      );

      // Beat markers
      for (let beat = 1; beat < beatsPerBar; beat++) {
        const beatX = x + (beat * pixelsPerBeat);
        markers.push(
          <div
            key={`beat-${bar}-${beat}`}
            className="absolute top-4 bottom-0 w-px bg-border/20"
            style={{ left: beatX }}
          />
        );
      }
    }
    return markers;
  };

  const renderWaveform = (track: Track, index: number) => {
    const trackHeight = 60;
    const trackY = index * (trackHeight + 8);
    const waveformData = track.waveformData || [];
    const duration = track.duration || 60;
    const width = duration * pixelsPerSecond;

    return (
      <div
        key={track.id}
        className="absolute bg-card/30 border border-border/30 rounded"
        style={{
          top: trackY,
          left: 0,
          width: width,
          height: trackHeight
        }}
      >
        {/* Track header */}
        <div className="absolute -left-32 top-0 w-30 h-full flex items-center">
          <div className="text-xs">
            <div className="font-medium text-foreground truncate w-24">{track.name}</div>
            <Badge 
              variant="outline" 
              className="text-xs mt-1"
              style={{ color: getStemColor(track.stem_type) }}
            >
              {track.stem_type}
            </Badge>
          </div>
        </div>

        {/* Waveform visualization */}
        <div className="h-full relative overflow-hidden rounded">
          <svg width="100%" height="100%" className="absolute inset-0">
            {waveformData.length > 0 ? (
              <polyline
                points={waveformData.map((value, i) => 
                  `${(i / waveformData.length) * width},${trackHeight/2 + value * trackHeight/4}`
                ).join(' ')}
                fill="none"
                stroke={getStemColor(track.stem_type)}
                strokeWidth="1"
                opacity="0.8"
              />
            ) : (
              // Placeholder waveform
              <rect
                x="0"
                y={trackHeight/2 - 2}
                width="100%"
                height="4"
                fill={getStemColor(track.stem_type)}
                opacity="0.3"
              />
            )}
          </svg>
          
          {/* Mute/Solo overlay */}
          {(track.isMuted || (tracks.some(t => t.isSolo) && !track.isSolo)) && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <span className="text-xs text-muted-foreground">
                {track.isMuted ? 'MUTED' : 'SOLO OFF'}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-background/50">
      {/* Timeline Header */}
      <div className="p-4 border-b border-border/50 bg-card/20 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Arrangement View</h3>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-mono">
              {formatPosition(currentTime)}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {formatTime(currentTime)}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {bpm} BPM
            </Badge>
          </div>
        </div>

        {/* Transport Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPlayPause}
            className="border-border/50"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSeek(0)}
            className="border-border/50"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>

          <Button
            variant={isLooping ? "default" : "outline"}
            size="sm"
            onClick={() => setIsLooping(!isLooping)}
            className={isLooping ? "bg-neon-cyan text-black" : "border-border/50"}
          >
            <Repeat className="w-4 h-4" />
          </Button>

          {isLooping && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Loop: {formatPosition(loopStart)} - {formatPosition(loopEnd)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Timeline Content */}
      <div className="flex-1 relative overflow-auto">
        <div className="flex">
          {/* Track names sidebar */}
          <div className="w-32 flex-shrink-0 bg-card/10 border-r border-border/30">
            <div className="h-8"></div> {/* Spacer for ruler */}
            {tracks.map((track, index) => (
              <div
                key={track.id}
                className="h-16 border-b border-border/20 p-2 flex flex-col justify-center"
              >
                <div className="text-xs font-medium text-foreground truncate">
                  {track.name}
                </div>
                <Badge 
                  variant="outline" 
                  className="text-xs mt-1 w-fit"
                  style={{ color: getStemColor(track.stem_type) }}
                >
                  {track.stem_type}
                </Badge>
              </div>
            ))}
          </div>

          {/* Timeline area */}
          <div className="flex-1 relative">
            {/* Ruler */}
            <div 
              className="h-8 bg-card/20 border-b border-border/30 relative"
              style={{ width: totalBars * pixelsPerBar }}
            >
              {renderBarMarkers()}
            </div>

            {/* Tracks area */}
            <div
              ref={timelineRef}
              className="relative cursor-pointer"
              style={{ 
                height: tracks.length * 68,
                minHeight: 200,
                width: totalBars * pixelsPerBar
              }}
              onClick={handleTimelineClick}
            >
              {/* Loop region */}
              {isLooping && (
                <div
                  className="absolute top-0 bottom-0 bg-neon-cyan/10 border-x-2 border-neon-cyan/50"
                  style={{
                    left: loopStart * pixelsPerSecond,
                    width: (loopEnd - loopStart) * pixelsPerSecond
                  }}
                >
                  <div className="absolute -top-8 left-0 text-xs text-neon-cyan">
                    {formatPosition(loopStart)}
                  </div>
                  <div className="absolute -top-8 right-0 text-xs text-neon-cyan">
                    {formatPosition(loopEnd)}
                  </div>
                </div>
              )}

              {/* Track waveforms */}
              {tracks.map((track, index) => renderWaveform(track, index))}

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-neon-cyan shadow-lg z-20"
                style={{
                  left: currentTime * pixelsPerSecond,
                  boxShadow: '0 0 10px #00f5ff'
                }}
              >
                <div className="absolute -top-2 -left-2 w-4 h-4 bg-neon-cyan rounded-full shadow-lg"></div>
              </div>

              {/* Grid lines */}
              <div className="absolute inset-0 pointer-events-none">
                {renderBarMarkers()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
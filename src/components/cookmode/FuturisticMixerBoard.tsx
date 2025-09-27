import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Volume2, 
  VolumeX, 
  Headphones, 
  Trash2,
  Settings,
  Waves,
  Activity
} from 'lucide-react';

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

interface FuturisticMixerBoardProps {
  tracks: Track[];
  onUpdateTrack: (trackId: string, updates: Partial<Track>) => void;
  onRemoveTrack: (trackId: string) => Promise<void>;
}

export const FuturisticMixerBoard: React.FC<FuturisticMixerBoardProps> = ({
  tracks,
  onUpdateTrack,
  onRemoveTrack
}) => {
  const [draggedFader, setDraggedFader] = useState<string | null>(null);

  const getStemColor = (stemType: string) => {
    const colors = {
      melody: 'from-neon-cyan to-electric-blue',
      drums: 'from-electric-blue to-neon-magenta', 
      bass: 'from-neon-magenta to-neon-cyan',
      vocal: 'from-neon-cyan to-electric-blue',
      fx: 'from-electric-blue to-neon-magenta',
      other: 'from-muted to-muted-foreground'
    };
    return colors[stemType as keyof typeof colors] || colors.other;
  };

  const getStemAccentColor = (stemType: string) => {
    const colors = {
      melody: 'text-neon-cyan',
      drums: 'text-electric-blue', 
      bass: 'text-neon-magenta',
      vocal: 'text-neon-cyan',
      fx: 'text-electric-blue',
      other: 'text-muted-foreground'
    };
    return colors[stemType as keyof typeof colors] || colors.other;
  };

  const handleVolumeChange = (trackId: string, volume: number) => {
    onUpdateTrack(trackId, { volume: volume / 100 });
  };

  const handleMute = (trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (track) {
      onUpdateTrack(trackId, { isMuted: !track.isMuted });
    }
  };

  const handleSolo = (trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (track) {
      onUpdateTrack(trackId, { isSolo: !track.isSolo });
    }
  };

  // Generate random waveform data for visualization
  const generateWaveformData = useCallback(() => {
    return Array.from({ length: 32 }, () => Math.random() * 0.8 + 0.1);
  }, []);

  const [waveformData, setWaveformData] = useState<{ [trackId: string]: number[] }>({});

  useEffect(() => {
    const interval = setInterval(() => {
      const newWaveformData: { [trackId: string]: number[] } = {};
      tracks.forEach(track => {
        if (!track.isMuted) {
          newWaveformData[track.id] = generateWaveformData();
        } else {
          newWaveformData[track.id] = Array(32).fill(0);
        }
      });
      setWaveformData(newWaveformData);
    }, 100);

    return () => clearInterval(interval);
  }, [tracks, generateWaveformData]);

  const VerticalFader: React.FC<{
    track: Track;
    onVolumeChange: (value: number) => void;
  }> = ({ track, onVolumeChange }) => {
    const faderRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [smoothVolume, setSmoothVolume] = useState(track.volume * 100);

    // Smooth volume interpolation
    useEffect(() => {
      const targetVolume = track.volume * 100;
      const startTime = Date.now();
      const duration = 150; // ms
      const startVolume = smoothVolume;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth transition
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentVolume = startVolume + (targetVolume - startVolume) * easeOut;
        
        setSmoothVolume(currentVolume);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
    }, [track.volume]);

    const handleMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      setDraggedFader(track.id);
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
      if (!isDragging || !faderRef.current) return;

      const rect = faderRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const height = rect.height;
      // More granular control with 0.1 step precision
      const rawValue = Math.max(0, Math.min(100, 100 - (y / height) * 100));
      const value = Math.round(rawValue * 10) / 10; // Round to 1 decimal place
      onVolumeChange(value);
    }, [isDragging, onVolumeChange]);

    const handleMouseUp = useCallback(() => {
      setIsDragging(false);
      setDraggedFader(null);
    }, []);

    useEffect(() => {
      if (isDragging) {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };
      }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const faderPosition = smoothVolume;
    const trackWaveform = waveformData[track.id] || [];

    return (
      <div className="relative flex flex-col items-center h-full">
        {/* Volume readout */}
        <div className="text-xs font-mono text-muted-foreground mb-2 min-w-[3rem] text-center">
          {smoothVolume.toFixed(1)}
        </div>
        
        {/* Waveform visualization */}
        <div className="w-16 h-12 mb-2 bg-background/30 rounded border border-border/30 p-1 overflow-hidden">
          <div className="flex items-end justify-center h-full gap-px">
            {trackWaveform.map((level, index) => (
              <div
                key={index}
                className={`bg-gradient-to-t ${getStemColor(track.stem_type)} transition-all duration-75 min-w-[2px] ${
                  track.isMuted ? 'opacity-20' : 'opacity-80'
                }`}
                style={{
                  height: `${level * 100 * (track.volume)}%`,
                  minHeight: '2px'
                }}
              />
            ))}
          </div>
        </div>
        
        {/* Fader track */}
        <div 
          ref={faderRef}
          className="relative w-8 h-48 bg-background/30 rounded-lg border border-border/50 cursor-pointer group hover:border-border transition-all duration-200 shadow-inner"
          onMouseDown={handleMouseDown}
        >
          {/* Track background with gradient */}
          <div className={`absolute inset-0 rounded-lg bg-gradient-to-t ${getStemColor(track.stem_type)} opacity-15 group-hover:opacity-25 transition-opacity`} />
          
          {/* Volume level indicator with smooth animation */}
          <div 
            className={`absolute bottom-0 left-0 right-0 rounded-lg bg-gradient-to-t ${getStemColor(track.stem_type)} transition-all duration-100 ${
              track.isMuted ? 'opacity-20' : 'opacity-70'
            } shadow-lg`}
            style={{ 
              height: `${faderPosition}%`,
              boxShadow: `0 0 10px hsl(var(--neon-cyan) / 0.3)`
            }}
          />
          
          {/* Level markings */}
          <div className="absolute inset-0 pointer-events-none">
            {[0, 25, 50, 75, 100].map(level => (
              <div
                key={level}
                className="absolute left-0 right-0 h-px bg-border/30"
                style={{ bottom: `${level}%` }}
              />
            ))}
          </div>
          
          {/* Fader handle */}
          <div 
            className={`absolute w-10 h-6 -left-1 bg-card border-2 border-border rounded-lg shadow-2xl cursor-pointer transition-all duration-150 ${
              isDragging || draggedFader === track.id 
                ? 'border-neon-cyan shadow-neon-cyan/50 scale-110' 
                : 'hover:border-border/80 hover:shadow-lg'
            } backdrop-blur-sm`}
            style={{ 
              bottom: `${faderPosition}%`,
              transform: `translateY(50%) ${isDragging ? 'scale(1.1)' : 'scale(1)'}`
            }}
          >
            {/* Handle gradient */}
            <div className="absolute inset-0 rounded-lg bg-gradient-to-b from-card/90 to-background/90" />
            
            {/* Handle grip lines */}
            <div className="absolute inset-0 flex flex-col justify-center items-center gap-0.5">
              <div className="w-4 h-0.5 bg-border/60 rounded-full" />
              <div className="w-4 h-0.5 bg-border/60 rounded-full" />
              <div className="w-4 h-0.5 bg-border/60 rounded-full" />
            </div>
          </div>
        </div>
        
        {/* dB markings */}
        <div className="absolute right-10 top-16 text-xs text-muted-foreground/40 space-y-6 pointer-events-none">
          <div>0dB</div>
          <div>-12</div>
          <div>-24</div>
          <div>-36</div>
          <div>-∞</div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full bg-gradient-to-b from-background/80 to-background p-6">
      {/* Mixer header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold bg-gradient-to-r from-neon-cyan to-electric-blue bg-clip-text text-transparent">
          Futuristic Mixer Board
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {tracks.length} Channels
          </Badge>
          <Button variant="ghost" size="sm" className="p-2">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Mixer channels */}
      <div className="flex gap-6 overflow-x-auto pb-4">
        {tracks.map((track, index) => (
          <Card key={track.id} className="bg-card/30 border-border/50 backdrop-blur-sm p-4 min-w-[140px] hover:bg-card/40 transition-colors">
            <div className="flex flex-col h-full">
              {/* Channel header */}
              <div className="text-center mb-4">
                <div className="text-xs font-mono text-muted-foreground mb-1">
                  CH {index + 1}
                </div>
                <Badge variant="outline" className={`text-xs ${getStemAccentColor(track.stem_type)} mb-2`}>
                  {track.stem_type.toUpperCase()}
                </Badge>
                <h4 className="font-medium text-sm text-foreground truncate max-w-[120px]" title={track.name}>
                  {track.name}
                </h4>
              </div>

              {/* EQ visualization placeholder */}
              <div className="h-16 bg-background/50 rounded border border-border/30 mb-4 relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Waves className="w-6 h-6 text-muted-foreground/30" />
                </div>
                <div className={`absolute inset-0 bg-gradient-to-r ${getStemColor(track.stem_type)} opacity-10`} />
              </div>

              {/* Fader section */}
              <div className="flex-1 flex flex-col items-center mb-4">
                <VerticalFader
                  track={track}
                  onVolumeChange={(volume) => handleVolumeChange(track.id, volume)}
                />
              </div>

              {/* Control buttons */}
              <div className="flex flex-col gap-2">
                {/* Mute button */}
                <Button
                  variant={track.isMuted ? "destructive" : "ghost"}
                  size="sm"
                  onClick={() => handleMute(track.id)}
                  className={`w-full h-8 text-xs ${track.isMuted ? 'bg-red-500/20 border-red-500/50' : 'hover:bg-card/50'}`}
                >
                  {track.isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                  MUTE
                </Button>

                {/* Solo button */}
                <Button
                  variant={track.isSolo ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handleSolo(track.id)}
                  className={`w-full h-8 text-xs ${
                    track.isSolo 
                      ? 'bg-neon-cyan/20 border-neon-cyan/50 text-neon-cyan' 
                      : 'hover:bg-card/50'
                  }`}
                >
                  <Headphones className="w-3 h-3" />
                  SOLO
                </Button>

                {/* Delete button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveTrack(track.id)}
                  className="w-full h-8 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="w-3 h-3" />
                  DEL
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
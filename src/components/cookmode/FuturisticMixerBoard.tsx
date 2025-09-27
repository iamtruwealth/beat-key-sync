import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Volume2, 
  VolumeX, 
  Headphones, 
  Trash2,
  Settings,
  Waves
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

  const VerticalFader: React.FC<{
    track: Track;
    onVolumeChange: (value: number) => void;
  }> = ({ track, onVolumeChange }) => {
    const faderRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      setDraggedFader(track.id);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !faderRef.current) return;

      const rect = faderRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const height = rect.height;
      const value = Math.max(0, Math.min(100, 100 - (y / height) * 100));
      onVolumeChange(value);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDraggedFader(null);
    };

    useEffect(() => {
      if (isDragging) {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };
      }
    }, [isDragging]);

    const faderPosition = track.volume * 100;

    return (
      <div className="relative flex flex-col items-center h-full">
        {/* Volume readout */}
        <div className="text-xs font-mono text-muted-foreground mb-2">
          {Math.round(track.volume * 100)}
        </div>
        
        {/* Fader track */}
        <div 
          ref={faderRef}
          className="relative w-6 h-48 bg-background/30 rounded-full border border-border/50 cursor-pointer group hover:border-border transition-colors"
          onMouseDown={handleMouseDown}
        >
          {/* Track background with gradient */}
          <div className={`absolute inset-0 rounded-full bg-gradient-to-t ${getStemColor(track.stem_type)} opacity-20 group-hover:opacity-30 transition-opacity`} />
          
          {/* Volume level indicator */}
          <div 
            className={`absolute bottom-0 left-0 right-0 rounded-full bg-gradient-to-t ${getStemColor(track.stem_type)} transition-all duration-100 ${track.isMuted ? 'opacity-30' : 'opacity-80'}`}
            style={{ height: `${faderPosition}%` }}
          />
          
          {/* Fader handle */}
          <div 
            className={`absolute w-8 h-4 -left-1 bg-card border-2 border-border rounded-md shadow-lg cursor-pointer transition-all duration-100 ${
              isDragging || draggedFader === track.id 
                ? 'border-neon-cyan shadow-neon-cyan/50' 
                : 'hover:border-border/80'
            }`}
            style={{ 
              bottom: `${faderPosition}%`,
              transform: 'translateY(50%)'
            }}
          >
            {/* Handle indicator */}
            <div className="absolute inset-0 rounded bg-gradient-to-b from-card to-background opacity-80" />
            <div className="absolute inset-x-0 top-1/2 h-0.5 bg-border/50 transform -translate-y-1/2" />
          </div>
        </div>
        
        {/* dB markings */}
        <div className="absolute right-8 top-4 text-xs text-muted-foreground/50 space-y-8">
          <div>0</div>
          <div>-10</div>
          <div>-20</div>
          <div>-30</div>
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
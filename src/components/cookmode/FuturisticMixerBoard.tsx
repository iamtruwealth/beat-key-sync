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
  const [masterVolume, setMasterVolume] = useState(75); // Master volume 0-100

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

  const applyMasterVolume = useCallback(() => {
    // Apply master volume to all audio elements
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      const baseVolume = parseFloat(audio.getAttribute('data-base-volume') || '1');
      audio.volume = (baseVolume * masterVolume) / 100;
    });
  }, [masterVolume]);

  const handleVolumeChange = (trackId: string, volume: number) => {
    onUpdateTrack(trackId, { volume: volume / 100 });
    // Set base volume attribute for master volume calculation
    setTimeout(() => {
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach(audio => {
        if (!audio.getAttribute('data-base-volume')) {
          audio.setAttribute('data-base-volume', (volume / 100).toString());
        }
      });
      applyMasterVolume();
    }, 100);
  };

  const handleMasterVolumeChange = (volume: number) => {
    setMasterVolume(volume);
    // Apply master volume to all current audio elements
    setTimeout(applyMasterVolume, 10);
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

  const [audioLevels, setAudioLevels] = useState<{ [trackId: string]: number }>({});

  // Simulate real-time audio levels (replace with actual audio analysis)
  useEffect(() => {
    const interval = setInterval(() => {
      const newAudioLevels: { [trackId: string]: number } = {};
      tracks.forEach(track => {
        if (!track.isMuted) {
          // Simulate real audio levels - replace with actual audio analysis
          newAudioLevels[track.id] = Math.random() * track.volume;
        } else {
          newAudioLevels[track.id] = 0;
        }
      });
      setAudioLevels(newAudioLevels);
    }, 50);

    return () => clearInterval(interval);
  }, [tracks]);

  const VerticalFader: React.FC<{
    track: Track;
    onVolumeChange: (value: number) => void;
  }> = ({ track, onVolumeChange }) => {
    const faderRef = useRef<HTMLDivElement>(null);
    const handleRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [smoothVolume, setSmoothVolume] = useState(track.volume * 100);
    const [dragOffset, setDragOffset] = useState(0);

    // Smooth volume interpolation
    useEffect(() => {
      if (isDragging) return; // Don't smooth while dragging
      
      const targetVolume = track.volume * 100;
      const startTime = Date.now();
      const duration = 100;
      const startVolume = smoothVolume;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeOut = 1 - Math.pow(1 - progress, 2);
        const currentVolume = startVolume + (targetVolume - startVolume) * easeOut;
        
        setSmoothVolume(currentVolume);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
    }, [track.volume, isDragging]);

    const handleMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      setDraggedFader(track.id);
      
      if (handleRef.current && faderRef.current) {
        const handleRect = handleRef.current.getBoundingClientRect();
        const faderRect = faderRef.current.getBoundingClientRect();
        const handleCenter = handleRect.top + handleRect.height / 2;
        setDragOffset(e.clientY - handleCenter);
      }
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
      if (!isDragging || !faderRef.current) return;

      const rect = faderRef.current.getBoundingClientRect();
      const adjustedY = e.clientY - dragOffset - rect.top;
      const height = rect.height;
      
      // Invert Y axis so dragging up increases volume
      const rawValue = Math.max(0, Math.min(100, 100 - (adjustedY / height) * 100));
      const value = Math.round(rawValue * 2) / 2; // Round to 0.5 steps for smooth control
      
      setSmoothVolume(value);
      onVolumeChange(value);
    }, [isDragging, onVolumeChange, dragOffset]);

    const handleMouseUp = useCallback(() => {
      setIsDragging(false);
      setDraggedFader(null);
      setDragOffset(0);
    }, []);

    useEffect(() => {
      if (isDragging) {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        
        return () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        };
      }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const faderPosition = smoothVolume;
    const audioLevel = audioLevels[track.id] || 0;
    const glowIntensity = audioLevel * 100;

    return (
      <div className="relative flex flex-col items-center h-full">
        {/* Volume readout */}
        <div className="text-xs font-mono text-muted-foreground mb-3 min-w-[3rem] text-center bg-background/50 px-2 py-1 rounded border border-border/30">
          {smoothVolume.toFixed(1)}dB
        </div>
        
        {/* Fader track */}
        <div 
          ref={faderRef}
          className="relative w-10 h-52 bg-background/40 rounded-lg border-2 border-border/50 cursor-grab active:cursor-grabbing group hover:border-border transition-all duration-200 shadow-inner"
          onMouseDown={handleMouseDown}
        >
          {/* Track background with subtle gradient */}
          <div className={`absolute inset-1 rounded-md bg-gradient-to-t ${getStemColor(track.stem_type)} opacity-10 group-hover:opacity-15 transition-opacity`} />
          
          {/* Audio level glow effect */}
          {!track.isMuted && audioLevel > 0.01 && (
            <div 
              className={`absolute inset-0 rounded-lg bg-gradient-to-t ${getStemColor(track.stem_type)} transition-all duration-75`}
              style={{ 
                opacity: Math.min(glowIntensity * 0.008, 0.6),
                boxShadow: `inset 0 0 ${glowIntensity * 0.3}px hsl(var(--neon-cyan) / ${Math.min(glowIntensity * 0.01, 0.8)})`
              }}
            />
          )}
          
          {/* Volume level indicator */}
          <div 
            className={`absolute bottom-1 left-1 right-1 rounded-md bg-gradient-to-t ${getStemColor(track.stem_type)} transition-all duration-150 ${
              track.isMuted ? 'opacity-20' : 'opacity-60'
            }`}
            style={{ 
              height: `${Math.max((faderPosition / 100) * (100 - 2), 0)}%`
            }}
          />
          
          {/* Level markings */}
          <div className="absolute inset-0 pointer-events-none">
            {[0, 25, 50, 75, 100].map(level => (
              <div
                key={level}
                className="absolute left-1 right-1 h-px bg-border/20"
                style={{ bottom: `${level}%` }}
              />
            ))}
          </div>
          
          {/* Fader handle */}
          <div 
            ref={handleRef}
            className={`absolute w-12 h-8 -left-1 bg-card border-2 border-border rounded-xl shadow-2xl cursor-grab active:cursor-grabbing transition-all duration-100 ${
              isDragging || draggedFader === track.id 
                ? 'border-neon-cyan shadow-neon-cyan/60 scale-105' 
                : 'hover:border-border/80 hover:shadow-xl'
            } backdrop-blur-sm`}
            style={{ 
              bottom: `${faderPosition}%`,
              transform: `translateY(50%) ${isDragging ? 'scale(1.05)' : ''}`,
              boxShadow: isDragging 
                ? '0 0 20px hsl(var(--neon-cyan) / 0.5), 0 10px 30px rgba(0,0,0,0.3)' 
                : '0 5px 15px rgba(0,0,0,0.2)'
            }}
          >
            {/* Handle surface */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-card/95 to-background/95 border border-border/30" />
            
            {/* Handle center indicator */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`w-6 h-1 rounded-full ${getStemColor(track.stem_type).replace('from-', 'bg-').replace('to-electric-blue', '').replace('to-neon-cyan', '').replace('to-neon-magenta', '')} opacity-60`} />
            </div>
            
            {/* Handle grip texture */}
            <div className="absolute inset-0 flex flex-col justify-center items-center gap-1">
              <div className="w-6 h-0.5 bg-border/40 rounded-full" />
              <div className="w-6 h-0.5 bg-border/40 rounded-full" />
            </div>
            
            {/* Real-time audio glow on handle */}
            {!track.isMuted && audioLevel > 0.01 && (
              <div 
                className={`absolute inset-0 rounded-xl bg-gradient-to-t ${getStemColor(track.stem_type)} transition-all duration-75`}
                style={{ 
                  opacity: Math.min(glowIntensity * 0.015, 0.4),
                  boxShadow: `0 0 ${glowIntensity * 0.8}px hsl(var(--neon-cyan) / ${Math.min(glowIntensity * 0.02, 0.9)})`
                }}
              />
            )}
          </div>
        </div>
        
        {/* dB scale */}
        <div className="absolute right-12 top-16 text-xs text-muted-foreground/40 space-y-12 pointer-events-none font-mono">
          <div>+6</div>
          <div>0</div>
          <div>-12</div>
          <div>-24</div>
          <div>-∞</div>
        </div>
      </div>
    );
  };

  // Master Fader Component
  const MasterFader: React.FC<{
    volume: number;
    onVolumeChange: (value: number) => void;
  }> = ({ volume, onVolumeChange }) => {
    const faderRef = useRef<HTMLDivElement>(null);
    const handleRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState(0);

    const handleMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      
      if (handleRef.current && faderRef.current) {
        const handleRect = handleRef.current.getBoundingClientRect();
        const faderRect = faderRef.current.getBoundingClientRect();
        const handleCenter = handleRect.top + handleRect.height / 2;
        setDragOffset(e.clientY - handleCenter);
      }
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
      if (!isDragging || !faderRef.current) return;

      const rect = faderRef.current.getBoundingClientRect();
      const adjustedY = e.clientY - dragOffset - rect.top;
      const height = rect.height;
      
      // Invert Y axis so dragging up increases volume
      const rawValue = Math.max(0, Math.min(100, 100 - (adjustedY / height) * 100));
      const value = Math.round(rawValue * 2) / 2; // Round to 0.5 steps for smooth control
      
      onVolumeChange(value);
    }, [isDragging, onVolumeChange, dragOffset]);

    const handleMouseUp = useCallback(() => {
      setIsDragging(false);
      setDragOffset(0);
    }, []);

    useEffect(() => {
      if (isDragging) {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        
        return () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        };
      }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const faderPosition = volume;

    return (
      <div className="relative flex flex-col items-center h-full">
        {/* Volume readout */}
        <div className="text-xs font-mono text-primary mb-3 min-w-[3rem] text-center bg-primary/10 px-2 py-1 rounded border border-primary/30">
          {volume.toFixed(1)}
        </div>
        
        {/* Master fader track */}
        <div 
          ref={faderRef}
          className="relative w-12 h-64 bg-primary/10 rounded-lg border-2 border-primary/50 cursor-grab active:cursor-grabbing group hover:border-primary transition-all duration-200 shadow-inner"
          onMouseDown={handleMouseDown}
        >
          {/* Track background with master gradient */}
          <div className="absolute inset-1 rounded-md bg-gradient-to-t from-primary/20 to-primary/40 opacity-60 group-hover:opacity-80 transition-opacity" />
          
          {/* Master volume level indicator */}
          <div 
            className="absolute bottom-1 left-1 right-1 rounded-md bg-gradient-to-t from-primary to-primary/80 transition-all duration-150"
            style={{ 
              height: `${Math.max((faderPosition / 100) * (100 - 2), 0)}%`
            }}
          />
          
          {/* Level markings */}
          <div className="absolute inset-0 pointer-events-none">
            {[0, 25, 50, 75, 100].map(level => (
              <div
                key={level}
                className="absolute left-1 right-1 h-px bg-primary/40"
                style={{ bottom: `${level}%` }}
              />
            ))}
          </div>
          
          {/* Master fader handle */}
          <div 
            ref={handleRef}
            className={`absolute w-14 h-10 -left-1 bg-gradient-to-b from-primary to-primary/80 border-2 border-primary/80 rounded-xl shadow-2xl cursor-grab active:cursor-grabbing transition-all duration-100 ${
              isDragging 
                ? 'border-primary shadow-primary/60 scale-105' 
                : 'hover:border-primary/90 hover:shadow-xl'
            } backdrop-blur-sm`}
            style={{ 
              bottom: `${faderPosition}%`,
              transform: `translateY(50%) ${isDragging ? 'scale(1.05)' : ''}`,
              boxShadow: isDragging 
                ? '0 0 25px hsl(var(--primary) / 0.6), 0 15px 40px rgba(0,0,0,0.4)' 
                : '0 8px 25px rgba(0,0,0,0.3)'
            }}
          >
            {/* Handle surface */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-primary/95 to-primary/80 border border-primary/50" />
            
            {/* Handle center indicator */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-1.5 rounded-full bg-white/80 opacity-80" />
            </div>
            
            {/* Handle grip texture */}
            <div className="absolute inset-0 flex flex-col justify-center items-center gap-1">
              <div className="w-8 h-0.5 bg-white/40 rounded-full" />
              <div className="w-8 h-0.5 bg-white/40 rounded-full" />
              <div className="w-8 h-0.5 bg-white/40 rounded-full" />
            </div>
          </div>
        </div>
        
        {/* dB scale for master */}
        <div className="absolute right-16 top-20 text-xs text-primary/60 space-y-16 pointer-events-none font-mono">
          <div>0</div>
          <div>-6</div>
          <div>-12</div>
          <div>-24</div>
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
      <div className="flex gap-4 justify-center h-[600px] overflow-x-auto">
        {/* Individual track faders */}
        {tracks.map((track, index) => (
          <Card key={track.id} className="bg-card/30 border-border/50 p-4 min-w-[120px] backdrop-blur-sm">
            <div className="flex flex-col h-full">
              {/* Track header */}
              <div className="mb-4 text-center">
                <div className="text-xs font-mono text-muted-foreground mb-1">
                  CH {index + 1}
                </div>
                <h4 className="text-sm font-medium text-foreground mb-2 truncate" title={track.name}>
                  {track.name}
                </h4>
                <Badge 
                  variant="outline" 
                  className={`text-xs ${getStemAccentColor(track.stem_type)} border-current/30`}
                >
                  {track.stem_type}
                </Badge>
              </div>

              {/* EQ section */}
              <div className="mb-4 space-y-2">
                <div className="text-xs text-muted-foreground text-center">EQ</div>
                <div className="grid grid-cols-3 gap-1">
                  {['Hi', 'Mid', 'Lo'].map((band) => (
                    <div key={band} className="text-center">
                      <div className="text-xs text-muted-foreground mb-1">{band}</div>
                      <div className="w-8 h-16 mx-auto bg-background/40 rounded border border-border/30 relative">
                        <div className="absolute bottom-1/2 left-1/2 w-6 h-2 bg-card border border-border rounded transform -translate-x-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Main fader */}
              <div className="flex-1 flex justify-center">
                <VerticalFader
                  track={track}
                  onVolumeChange={(volume) => handleVolumeChange(track.id, volume)}
                />
              </div>

              {/* Controls */}
              <div className="mt-4 space-y-2">
                <div className="flex justify-center gap-2">
                  <Button
                    variant={track.isMuted ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleMute(track.id)}
                    className="w-12 h-8 text-xs"
                  >
                    {track.isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                  </Button>
                  <Button
                    variant={track.isSolo ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSolo(track.id)}
                    className="w-12 h-8 text-xs"
                  >
                    <Headphones className="w-3 h-3" />
                  </Button>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onRemoveTrack(track.id)}
                  className="w-full h-8 text-xs"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {/* Master fader channel */}
        <Card className="bg-gradient-to-b from-primary/20 to-primary/40 border-primary/50 p-4 min-w-[140px] backdrop-blur-sm">
          <div className="flex flex-col h-full">
            {/* Master header */}
            <div className="mb-4 text-center">
              <h4 className="text-lg font-bold text-primary mb-2">MASTER</h4>
              <Badge variant="default" className="text-xs bg-primary text-primary-foreground">
                MIX
              </Badge>
            </div>

            {/* Master EQ section */}
            <div className="mb-4 space-y-2">
              <div className="text-xs text-primary text-center font-medium">MASTER EQ</div>
              <div className="grid grid-cols-3 gap-1">
                {['Hi', 'Mid', 'Lo'].map((band) => (
                  <div key={band} className="text-center">
                    <div className="text-xs text-primary/80 mb-1">{band}</div>
                    <div className="w-8 h-16 mx-auto bg-primary/10 rounded border border-primary/30 relative">
                      <div className="absolute bottom-1/2 left-1/2 w-6 h-2 bg-primary/20 border border-primary/50 rounded transform -translate-x-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Master fader */}
            <div className="flex-1 flex justify-center">
              <MasterFader
                volume={masterVolume}
                onVolumeChange={handleMasterVolumeChange}
              />
            </div>

            {/* Master controls */}
            <div className="mt-4 space-y-2">
              <div className="text-center">
                <div className="text-xs text-primary/80 mb-1">OUTPUT</div>
                <div className="flex justify-center gap-1">
                  {[...Array(10)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-1 h-4 rounded-sm ${
                        i < (masterVolume / 10) 
                          ? i < 7 ? 'bg-green-400' : i < 9 ? 'bg-yellow-400' : 'bg-red-400'
                          : 'bg-background/40'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs border-primary/50 text-primary hover:bg-primary/10"
              >
                <Activity className="w-3 h-3 mr-1" />
                LIMITER
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
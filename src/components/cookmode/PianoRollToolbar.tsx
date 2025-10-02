import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Pause, Square, ZoomIn, ZoomOut, Grid, Pencil, MousePointer } from 'lucide-react';
import { SnapGridValue } from '@/types/pianoRoll';

interface PianoRollToolbarProps {
  isPlaying: boolean;
  snapGrid: SnapGridValue;
  zoom: number;
  toolMode: 'draw' | 'select';
  onTogglePlayback: () => void;
  onStop: () => void;
  onSnapGridChange: (value: SnapGridValue) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToolModeChange: (mode: 'draw' | 'select') => void;
}

const SNAP_GRID_OPTIONS: { value: SnapGridValue; label: string; group: string }[] = [
  { value: 'none', label: 'None', group: 'General' },
  { value: 'line', label: 'Line', group: 'General' },
  { value: 'cell', label: 'Cell', group: 'General' },
  
  { value: '1/6-step', label: '1/6 Step', group: 'Steps' },
  { value: '1/4-step', label: '1/4 Step', group: 'Steps' },
  { value: '1/3-step', label: '1/3 Step', group: 'Steps' },
  { value: '1/2-step', label: '1/2 Step', group: 'Steps' },
  { value: '1-step', label: '1 Step', group: 'Steps' },
  
  { value: '1/6-beat', label: '1/6 Beat', group: 'Beats' },
  { value: '1/4-beat', label: '1/4 Beat', group: 'Beats' },
  { value: '1/3-beat', label: '1/3 Beat', group: 'Beats' },
  { value: '1/2-beat', label: '1/2 Beat', group: 'Beats' },
  { value: '1-beat', label: '1 Beat', group: 'Beats' },
  
  { value: '1-bar', label: '1 Bar', group: 'Bar' },
];

// Group options by category
const groupedOptions = SNAP_GRID_OPTIONS.reduce((acc, option) => {
  if (!acc[option.group]) {
    acc[option.group] = [];
  }
  acc[option.group].push(option);
  return acc;
}, {} as Record<string, typeof SNAP_GRID_OPTIONS>);

export const PianoRollToolbar: React.FC<PianoRollToolbarProps> = ({
  isPlaying,
  snapGrid,
  zoom,
  toolMode,
  onTogglePlayback,
  onStop,
  onSnapGridChange,
  onZoomIn,
  onZoomOut,
  onToolModeChange,
}) => {
  return (
    <div className="flex items-center gap-4 p-2 border-b border-border bg-card/50">
      {/* Transport Controls */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={isPlaying ? "destructive" : "default"}
          onClick={onTogglePlayback}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onStop}
        >
          <Square className="w-4 h-4" />
        </Button>
      </div>

      <div className="h-6 w-px bg-border" />

      {/* Tools */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={toolMode === 'draw' ? 'default' : 'outline'}
          onClick={() => onToolModeChange('draw')}
          title="Draw (add notes)"
        >
          <Pencil className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant={toolMode === 'select' ? 'default' : 'outline'}
          onClick={() => onToolModeChange('select')}
          title="Select/Move"
        >
          <MousePointer className="w-4 h-4" />
        </Button>
      </div>

      <div className="h-6 w-px bg-border" />

      {/* Snap Grid Selector */}
      <div className="flex items-center gap-2">
        <Grid className="w-4 h-4 text-muted-foreground" />
        <Select value={snapGrid} onValueChange={(value) => onSnapGridChange(value as SnapGridValue)}>
          <SelectTrigger className="w-32 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background border-border max-h-64 overflow-y-auto">
            {Object.entries(groupedOptions).map(([group, options]) => (
              <div key={group}>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border/50">
                  {group}
                </div>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-sm">
                    {option.label}
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="h-6 w-px bg-border" />

      {/* Zoom Controls */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onZoomOut}
          disabled={zoom <= 0.5}
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-sm font-mono text-foreground min-w-12 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={onZoomIn}
          disabled={zoom >= 4}
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

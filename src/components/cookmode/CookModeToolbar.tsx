import React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Pencil, 
  PaintBucket, 
  Trash2, 
  VolumeX, 
  Scissors, 
  MousePointer, 
  ZoomIn, 
  Volume2,
  Grid3x3,
  RotateCcw,
  RotateCw
} from 'lucide-react';

export type ToolType = 'draw' | 'paint' | 'delete' | 'mute' | 'slice' | 'select' | 'zoom' | 'playback';

interface CookModeToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  snapEnabled: boolean;
  onSnapToggle: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

const tools = [
  { id: 'draw' as ToolType, icon: Pencil, label: 'Draw', description: 'Add, move, and resize clips' },
  { id: 'paint' as ToolType, icon: PaintBucket, label: 'Paint', description: 'Paint multiple clips quickly' },
  { id: 'delete' as ToolType, icon: Trash2, label: 'Delete', description: 'Remove clips from timeline' },
  { id: 'mute' as ToolType, icon: VolumeX, label: 'Mute', description: 'Mute/unmute clips' },
  { id: 'slice' as ToolType, icon: Scissors, label: 'Slice', description: 'Cut clips into sections' },
  { id: 'select' as ToolType, icon: MousePointer, label: 'Select', description: 'Select multiple clips' },
  { id: 'zoom' as ToolType, icon: ZoomIn, label: 'Zoom', description: 'Zoom in on timeline area' },
  { id: 'playback' as ToolType, icon: Volume2, label: 'Preview', description: 'Audition clips' },
];

export function CookModeToolbar({
  activeTool,
  onToolChange,
  snapEnabled,
  onSnapToggle,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false
}: CookModeToolbarProps) {
  return (
    <div className="flex items-center gap-2 p-3 bg-card/30 border-b border-border/50 backdrop-blur-sm">
      {/* Undo/Redo */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onUndo}
          disabled={!canUndo}
          className="h-8 w-8 p-0 hover:bg-muted/50 disabled:opacity-30"
          title="Undo"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRedo}
          disabled={!canRedo}
          className="h-8 w-8 p-0 hover:bg-muted/50 disabled:opacity-30"
          title="Redo"
        >
          <RotateCw className="w-4 h-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Main Tools */}
      <div className="flex items-center gap-1">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          
          return (
            <Button
              key={tool.id}
              variant={isActive ? "default" : "ghost"}
              size="sm"
              onClick={() => onToolChange(tool.id)}
              className={`h-8 w-8 p-0 relative ${
                isActive 
                  ? "bg-primary text-primary-foreground shadow-md" 
                  : "hover:bg-muted/50"
              }`}
              title={`${tool.label} - ${tool.description}`}
            >
              <Icon className="w-4 h-4" />
              {isActive && (
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary-foreground rounded-full" />
              )}
            </Button>
          );
        })}
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Snap Control */}
      <div className="flex items-center gap-2">
        <Button
          variant={snapEnabled ? "default" : "ghost"}
          size="sm"
          onClick={onSnapToggle}
          className={`h-8 px-3 ${
            snapEnabled 
              ? "bg-primary text-primary-foreground" 
              : "hover:bg-muted/50"
          }`}
          title="Toggle grid snap"
        >
          <Grid3x3 className="w-4 h-4 mr-1" />
          Snap
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Active Tool Info */}
      <div className="flex items-center gap-2 ml-auto">
        <Badge variant="outline" className="text-xs font-medium">
          {tools.find(t => t.id === activeTool)?.label || 'Draw'}
        </Badge>
        <span className="text-xs text-muted-foreground hidden md:block">
          {tools.find(t => t.id === activeTool)?.description || ''}
        </span>
      </div>
    </div>
  );
}
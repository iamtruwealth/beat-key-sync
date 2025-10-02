import React from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff } from 'lucide-react';

interface AudioStreamIndicatorProps {
  isHost: boolean;
  isStreaming: boolean;
  audioLevel: number;
  onToggleStream?: () => void;
}

const AudioStreamIndicator: React.FC<AudioStreamIndicatorProps> = ({
  isHost,
  isStreaming,
  audioLevel,
  onToggleStream
}) => {
  return (
    <div>
      <Button
        variant={isStreaming ? "default" : "outline"}
        size="sm"
        onClick={onToggleStream}
        className={isStreaming ? "bg-red-500 hover:bg-red-600" : ""}
        disabled={!isHost || !onToggleStream}
      >
        {isStreaming ? (
          <>
            <Mic className="w-4 h-4 mr-2" />
            Stop Live
          </>
        ) : (
          <>
            <MicOff className="w-4 h-4 mr-2" />
            Go Live
          </>
        )}
      </Button>
    </div>
  );
};

export default AudioStreamIndicator;
// AudioStreamIndicator.tsx

import React from 'react';

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
            <button onClick={onToggleStream}>
                {isStreaming ? 'Stop Live' : 'Go Live'}
            </button>
        </div>
    );
};

export default AudioStreamIndicator;
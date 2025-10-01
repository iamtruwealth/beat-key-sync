import React from 'react';
import { Button } from '@/components/ui/button';
import { useRadioBroadcast } from '@/hooks/radio/useRadioBroadcast';
import { useRadioPlayer } from '@/hooks/radio/useRadioPlayer';

interface RadioStreamControlsProps {
  sessionId: string;
  isHost: boolean;
  currentUserId?: string;
}

const RadioStreamControls: React.FC<RadioStreamControlsProps> = ({ sessionId, isHost, currentUserId }) => {
  const { isBroadcasting, listenerCount, startBroadcast, stopBroadcast } = useRadioBroadcast({ sessionId, currentUserId });
  const { isListening, hostOnline, listeners, startListening, stopListening } = useRadioPlayer({ sessionId });

  return (
    <div className="flex items-center gap-3">
      {isHost ? (
        <>
          {!isBroadcasting ? (
            <Button onClick={startBroadcast}>Start Radio</Button>
          ) : (
            <Button variant="secondary" onClick={stopBroadcast}>Stop Radio</Button>
          )}
          <span className="text-sm opacity-80">Listeners: {listenerCount}</span>
        </>
      ) : (
        <>
          {!isListening ? (
            <Button onClick={startListening} disabled={!hostOnline}>Join Radio</Button>
          ) : (
            <Button variant="secondary" onClick={stopListening}>Leave Radio</Button>
          )}
          <span className="text-sm opacity-80">Listeners: {listeners}</span>
        </>
      )}
    </div>
  );
};

export default RadioStreamControls;

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BackgroundWebRTCConnector } from '@/components/cookmode/BackgroundWebRTCConnector';
import { useWebRTCStreaming } from '@/hooks/useWebRTCStreaming';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ViewerTest() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [currentUserId] = useState(`viewer-${Math.random().toString(36).substr(2, 9)}`);
  const [isConnected, setIsConnected] = useState(false);
  
  const { participants, isStreaming, startAsViewer } = useWebRTCStreaming({
    sessionId: sessionId || '',
    canEdit: false, // Always viewer
    currentUserId
  });

  useEffect(() => {
    if (sessionId && !isConnected) {
      console.log('🎬 Auto-joining session as viewer:', sessionId);
      startAsViewer();
      setIsConnected(true);
    }
  }, [sessionId, startAsViewer, isConnected]);

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-6 max-w-md">
          <h1 className="text-xl font-semibold mb-4">Viewer Test</h1>
          <p className="text-muted-foreground">
            No session ID provided. Use /viewer/:sessionId to join a session.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <Card className="p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4">🎧 Viewer Test Mode</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p><strong>Session ID:</strong> {sessionId}</p>
              <p><strong>User ID:</strong> {currentUserId}</p>
              <p><strong>Role:</strong> Viewer (canEdit: false)</p>
            </div>
            <div>
              <p><strong>Connected:</strong> {isConnected ? '✅' : '❌'}</p>
              <p><strong>Streaming:</strong> {isStreaming ? '✅' : '❌'}</p>
              <p><strong>Participants:</strong> {participants.length}</p>
            </div>
          </div>
        </Card>

        {participants.length > 0 && (
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">📹 Active Participants ({participants.length})</h2>
            <div className="space-y-2">
              {participants.map((p) => (
                <div key={p.user_id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">{p.username || 'Anonymous'}</p>
                    <p className="text-sm text-muted-foreground">ID: {p.user_id}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p>Stream: {p.stream ? '✅' : '❌'}</p>
                    <p>Audio Tracks: {p.stream ? (p.stream as MediaStream).getAudioTracks().length : 0}</p>
                    <p>Video Tracks: {p.stream ? (p.stream as MediaStream).getVideoTracks().length : 0}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">🎵 Audio Stream Status</h2>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This viewer will automatically receive audio streams from the host. 
              Check the browser console for detailed WebRTC and audio routing logs.
            </p>
            
            {participants.length === 0 && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-yellow-800">
                  ⏳ Waiting for host to start streaming... Make sure the host is in the session and broadcasting.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-xs bg-muted p-3 rounded">
              <div>
                <strong>Expected Console Logs:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>🎬 Auto-joining session as viewer</li>
                  <li>📹 User joined video session</li>
                  <li>📹 Received remote stream from</li>
                  <li>🎧 AudioContext sampleRate</li>
                </ul>
              </div>
              <div>
                <strong>Audio Debug Info:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>🎵 HostMasterAudio initialized</li>
                  <li>🔊 Adding master audio track</li>
                  <li>🔁 Replacing audio sender track</li>
                  <li>🌀 onnegotiationneeded</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* WebRTC Connector handles audio streaming */}
      <BackgroundWebRTCConnector
        sessionId={sessionId}
        canEdit={false}
        currentUserId={currentUserId}
      />
    </div>
  );
}
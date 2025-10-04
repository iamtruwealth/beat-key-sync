import { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Play, Check, X } from 'lucide-react';
import { useSessionRecordings } from '@/hooks/useSessionRecordings';
import { formatDuration } from '@/lib/utils';

interface SessionRecordingsListProps {
  sessionId: string;
}

export const SessionRecordingsList = ({ sessionId }: SessionRecordingsListProps) => {
  const { recordings, loading, loadRecordings, deleteRecording, toggleOuttake } = useSessionRecordings(sessionId);

  useEffect(() => {
    loadRecordings();
  }, [loadRecordings]);

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown';
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  if (loading) {
    return <div className="text-center py-4">Loading recordings...</div>;
  }

  if (recordings.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No recordings yet. Start recording to create your first take!
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold mb-4">Session Recordings</h3>
      {recordings.map((recording) => (
        <Card key={recording.id} className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium truncate">{recording.file_name}</h4>
                {recording.is_outtake ? (
                  <Badge variant="outline" className="text-xs">
                    <X className="h-3 w-3 mr-1" />
                    Outtake
                  </Badge>
                ) : (
                  <Badge variant="default" className="text-xs">
                    <Check className="h-3 w-3 mr-1" />
                    In Session
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {recording.metadata?.trackName && (
                  <span>Track: {recording.metadata.trackName}</span>
                )}
                {recording.duration && (
                  <span>Duration: {formatDuration(recording.duration)}</span>
                )}
                <span>Size: {formatFileSize(recording.file_size)}</span>
                {recording.sample_rate && (
                  <span>Sample Rate: {recording.sample_rate} Hz</span>
                )}
                <span>Created: {new Date(recording.created_at).toLocaleString()}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const audio = new Audio(recording.file_url);
                  audio.play();
                }}
                title="Play"
              >
                <Play className="h-4 w-4" />
              </Button>
              
              <Button
                variant={recording.is_outtake ? "outline" : "ghost"}
                size="sm"
                onClick={() => toggleOuttake(recording.id, !recording.is_outtake)}
              >
                {recording.is_outtake ? 'Use in Session' : 'Mark as Outtake'}
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (confirm('Delete this recording? This cannot be undone.')) {
                    deleteRecording(recording.id);
                  }
                }}
                title="Delete"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

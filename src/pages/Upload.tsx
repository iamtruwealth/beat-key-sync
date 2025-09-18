import { Upload, FileAudio, Info, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function UploadPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Upload Audio</h1>
        <p className="text-muted-foreground">
          Upload your stems and let our AI analyze BPM and musical key automatically.
        </p>
      </div>

      <Alert className="border-primary/20 bg-primary/5">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Backend Integration Required:</strong> To enable file uploads, audio analysis, and data storage, 
          you'll need to connect this project to Supabase using Lovable's native integration.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/50 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Upload Files
            </CardTitle>
            <CardDescription>
              Drag and drop your audio files or click to browse
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-border/50 rounded-lg p-8 text-center space-y-4">
              <FileAudio className="w-12 h-12 mx-auto text-muted-foreground" />
              <div>
                <p className="text-lg font-medium">Drop your audio files here</p>
                <p className="text-sm text-muted-foreground">
                  Supports MP3, WAV, FLAC, and AIFF files
                </p>
              </div>
              <Button variant="producer" disabled>
                <Upload className="w-4 h-4" />
                Choose Files
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80">
          <CardHeader>
            <CardTitle>Auto-Analysis Features</CardTitle>
            <CardDescription>
              What happens when you upload files
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
              <div>
                <p className="font-medium">BPM Detection</p>
                <p className="text-sm text-muted-foreground">
                  Automatically detect tempo using Essentia.js
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
              <div>
                <p className="font-medium">Key Detection</p>
                <p className="text-sm text-muted-foreground">
                  Analyze musical key and scale
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
              <div>
                <p className="font-medium">Metadata Extraction</p>
                <p className="text-sm text-muted-foreground">
                  Extract duration, format, and sample rate
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
              <div>
                <p className="font-medium">Waveform Generation</p>
                <p className="text-sm text-muted-foreground">
                  Create visual waveforms for playback
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-destructive/20 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            Connect Supabase to Continue
          </CardTitle>
          <CardDescription>
            This platform requires backend functionality for file storage, user authentication, and database management.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Lovable has a native Supabase integration that provides:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground mb-4">
            <li>Secure file storage for audio files</li>
            <li>User authentication and account management</li>
            <li>Database for storing project metadata, BPM, and key information</li>
            <li>Real-time collaboration features</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Click the green Supabase button in the top right of the interface to set up the integration.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
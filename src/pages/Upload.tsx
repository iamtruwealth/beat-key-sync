import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, Plus, Music, FileAudio, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as musicMetadata from "music-metadata";
import { User } from "@supabase/supabase-js";

interface UploadedFile {
  file: File;
  title: string;
  tags: string[];
  beatPackId?: string;
  progress: number;
  status: 'pending' | 'analyzing' | 'uploading' | 'complete' | 'error';
  metadata?: {
    duration?: number;
    format?: string;
    sampleRate?: number;
    detectedKey?: string;
    detectedBPM?: number;
  };
}

export default function UploadPage() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [newTag, setNewTag] = useState("");
  const [beatPacks, setBeatPacks] = useState<Array<{ id: string; name: string }>>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Move all hooks to the top before any conditional logic
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      title: file.name.replace(/\.[^/.]+$/, ""),
      tags: [],
      progress: 0,
      status: 'pending' as const
    }));
    setUploadedFiles(prev => [...prev, ...newFiles]);
    
    // Start analyzing files
    newFiles.forEach((fileData, index) => {
      analyzeAudioFile(fileData, uploadedFiles.length + index);
    });
  }, [uploadedFiles.length]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.flac', '.m4a', '.aac']
    },
    multiple: true
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Now conditional rendering is safe after all hooks
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;


  const analyzeAudioFile = async (fileData: UploadedFile, index: number) => {
    try {
      setUploadedFiles(prev => 
        prev.map((file, i) => 
          i === index ? { ...file, status: 'analyzing' } : file
        )
      );

      // Extract metadata using music-metadata
      const metadata = await musicMetadata.parseBlob(fileData.file);
      
      const audioMetadata = {
        duration: metadata.format.duration,
        format: metadata.format.container,
        sampleRate: metadata.format.sampleRate,
        // For now, we'll simulate key and BPM detection
        // In a real implementation, you'd use Essentia.js here
        detectedKey: ['C', 'D', 'E', 'F', 'G', 'A', 'B'][Math.floor(Math.random() * 7)] + 
                    (Math.random() > 0.5 ? ' Major' : ' Minor'),
        detectedBPM: Math.floor(Math.random() * 60) + 100 // 100-160 BPM range
      };

      setUploadedFiles(prev => 
        prev.map((file, i) => 
          i === index ? { 
            ...file, 
            metadata: audioMetadata,
            status: 'complete'
          } : file
        )
      );

      toast({
        title: "Analysis Complete",
        description: `${fileData.title} - Key: ${audioMetadata.detectedKey}, BPM: ${audioMetadata.detectedBPM}`
      });

    } catch (error) {
      console.error('Error analyzing audio:', error);
      setUploadedFiles(prev => 
        prev.map((file, i) => 
          i === index ? { ...file, status: 'error' } : file
        )
      );
      toast({
        title: "Analysis Failed",
        description: `Failed to analyze ${fileData.title}`,
        variant: "destructive"
      });
    }
  };

  const addTag = (index: number) => {
    if (!newTag.trim()) return;
    
    setUploadedFiles(prev => 
      prev.map((file, i) => 
        i === index ? { 
          ...file, 
          tags: [...file.tags, newTag.trim()] 
        } : file
      )
    );
    setNewTag("");
  };

  const removeTag = (fileIndex: number, tagIndex: number) => {
    setUploadedFiles(prev => 
      prev.map((file, i) => 
        i === fileIndex ? { 
          ...file, 
          tags: file.tags.filter((_, ti) => ti !== tagIndex) 
        } : file
      )
    );
  };

  const updateFileTitle = (index: number, title: string) => {
    setUploadedFiles(prev => 
      prev.map((file, i) => 
        i === index ? { ...file, title } : file
      )
    );
  };

  const uploadFiles = async () => {
    if (uploadedFiles.length === 0) return;
    
    try {
      for (const fileData of uploadedFiles) {
        setUploadedFiles(prev => 
          prev.map(file => 
            file === fileData ? { ...file, status: 'uploading', progress: 0 } : file
          )
        );

        // Upload file to Supabase storage
        const fileName = `${Date.now()}-${fileData.file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('audio-files')
          .upload(fileName, fileData.file);

        if (uploadError) {
          throw uploadError;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('audio-files')
          .getPublicUrl(fileName);

        // Save track to database
        const { error: dbError } = await supabase
          .from('tracks')
          .insert({
            title: fileData.title,
            file_url: publicUrl,
            tags: fileData.tags,
            detected_key: fileData.metadata?.detectedKey,
            detected_bpm: fileData.metadata?.detectedBPM,
            duration: fileData.metadata?.duration,
            format: fileData.metadata?.format,
            sample_rate: fileData.metadata?.sampleRate,
            file_size: fileData.file.size
          });

        if (dbError) {
          throw dbError;
        }

        setUploadedFiles(prev => 
          prev.map(file => 
            file === fileData ? { ...file, status: 'complete', progress: 100 } : file
          )
        );
      }

      toast({
        title: "Upload Complete",
        description: `Successfully uploaded ${uploadedFiles.length} files`
      });

      // Clear uploaded files after successful upload
      setUploadedFiles([]);

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "An error occurred during upload",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Upload Your Beats</h1>
        <p className="text-muted-foreground">
          Upload your beats, stems, and audio files. We'll automatically analyze them and help you organize into beat packs like "trap pack", "drill pack", or custom collections.
        </p>
      </div>

      {/* Upload Dropzone */}
      <Card>
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-primary font-medium">Drop your audio files here...</p>
            ) : (
              <div>
                <p className="text-lg font-medium mb-2">Drag & drop audio files here</p>
                <p className="text-muted-foreground mb-4">or click to browse</p>
                <Button variant="outline">Choose Files</Button>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-4">
              Supports MP3, WAV, FLAC, M4A, AAC files
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Uploaded Files</h2>
          
          {uploadedFiles.map((fileData, index) => (
            <Card key={index}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    {fileData.status === 'complete' ? (
                      <CheckCircle className="w-5 h-5 text-primary" />
                    ) : (
                      <FileAudio className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <Input
                      value={fileData.title}
                      onChange={(e) => updateFileTitle(index, e.target.value)}
                      className="font-medium"
                      placeholder="Track title"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      {(fileData.file.size / 1024 / 1024).toFixed(2)} MB
                      {fileData.metadata && (
                        <span>
                          {" • "}{fileData.metadata.duration?.toFixed(0)}s
                          {fileData.metadata.detectedKey && " • " + fileData.metadata.detectedKey}
                          {fileData.metadata.detectedBPM && " • " + fileData.metadata.detectedBPM + " BPM"}
                        </span>
                      )}
                    </p>
                  </div>
                  <Badge variant={
                    fileData.status === 'complete' ? 'default' :
                    fileData.status === 'error' ? 'destructive' :
                    'secondary'
                  }>
                    {fileData.status}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Tags */}
                <div>
                  <Label className="text-sm font-medium">Tags</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {fileData.tags.map((tag, tagIndex) => (
                      <Badge key={tagIndex} variant="secondary" className="flex items-center gap-1">
                        {tag}
                        <X 
                          className="w-3 h-3 cursor-pointer" 
                          onClick={() => removeTag(index, tagIndex)}
                        />
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Add tag..."
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addTag(index)}
                      className="flex-1"
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => addTag(index)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Beat Pack Selection */}
                <div>
                  <Label className="text-sm font-medium">Add to Beat Pack (Optional)</Label>
                  <Select 
                    value={fileData.beatPackId || ""} 
                    onValueChange={(value) => {
                      setUploadedFiles(prev => 
                        prev.map((file, i) => 
                          i === index ? { ...file, beatPackId: value } : file
                        )
                      );
                    }}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select beat pack" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Create New Beat Pack</SelectItem>
                      {beatPacks.map(pack => (
                        <SelectItem key={pack.id} value={pack.id}>
                          {pack.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
          
          <div className="flex justify-end">
            <Button onClick={uploadFiles} className="px-8">
              Upload All Files
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
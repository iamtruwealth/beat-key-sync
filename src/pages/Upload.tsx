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
import { Upload, X, Plus, Music, FileAudio, CheckCircle, Image } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";
import { detectBPM, detectKey, getCompatibleKeys, AudioAnalysisResult, analyzeAudioFile } from "@/lib/audioAnalysis";

interface UploadedFile {
  file: File;
  title: string;
  tags: string[];
  beatPackId?: string;
  progress: number;
  status: 'pending' | 'analyzing' | 'uploading' | 'complete' | 'error';
  artwork?: File;
  artworkPreview?: string;
  analysis?: AudioAnalysisResult;
  manualBpm?: number;
  manualKey?: string;
}

export default function UploadPage() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [newTag, setNewTag] = useState("");
  const [beatPacks, setBeatPacks] = useState<Array<{ id: string; name: string }>>([]);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Define analyzeAudioFile function first to avoid hoisting issues
  const analyzeAudioFileLocal = async (fileData: UploadedFile, index: number) => {
    try {
      setUploadedFiles(prev => 
        prev.map((file, i) => 
          i === index ? { ...file, status: 'analyzing' } : file
        )
      );

      // Use the new analyzeAudioFile function
      const analysis = await analyzeAudioFile(fileData.file);

      setUploadedFiles(prev => 
        prev.map((file, i) => 
          i === index ? { 
            ...file, 
            analysis,
            status: 'complete'
          } : file
        )
      );

      toast({
        title: "Analysis Complete",
        description: `${fileData.title} - Key: ${analysis.key}, BPM: ${analysis.bpm} (${Math.round(analysis.confidenceScore * 100)}% confidence)${
          analysis.metadata.filenameAnalysis?.bpm || analysis.metadata.filenameAnalysis?.key 
            ? ` | From filename: ${analysis.metadata.filenameAnalysis.bpm || ''}${
                analysis.metadata.filenameAnalysis.bpm && analysis.metadata.filenameAnalysis.key ? ', ' : ''
              }${analysis.metadata.filenameAnalysis.key || ''}`
            : ''
        }`
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
      analyzeAudioFileLocal(fileData, uploadedFiles.length + index);
    });
  }, [uploadedFiles.length, analyzeAudioFileLocal]);

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
      
      // Fetch user profile to get producer name
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();
      
      setUserProfile(profile);
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      
      // Fetch user profile when auth state changes
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();
      
      setUserProfile(profile);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

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

  const uploadArtwork = async (file: File, userId: string): Promise<string | null> => {
    try {
      const fileName = `${userId}/artwork/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from('artwork')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('artwork')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Artwork upload error:', error);
      return null;
    }
  };

  const handleArtworkUpload = (index: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedFiles(prev => 
        prev.map((fileData, i) => 
          i === index ? { 
            ...fileData, 
            artwork: file,
            artworkPreview: e.target?.result as string
          } : fileData
        )
      );
    };
    reader.readAsDataURL(file);
  };

  const removeArtwork = (index: number) => {
    setUploadedFiles(prev => 
      prev.map((fileData, i) => 
        i === index ? { 
          ...fileData, 
          artwork: undefined,
          artworkPreview: undefined
        } : fileData
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

  const updateFileBpm = (index: number, bpm: number | undefined) => {
    setUploadedFiles(prev => 
      prev.map((file, i) => 
        i === index ? { ...file, manualBpm: bpm } : file
      )
    );
  };

  const updateFileKey = (index: number, key: string | undefined) => {
    setUploadedFiles(prev => 
      prev.map((file, i) => 
        i === index ? { ...file, manualKey: key } : file
      )
    );
  };

  const sendCorrections = async (trackId: string, fileData: UploadedFile) => {
    if (!fileData.analysis) return;
    
    const hasCorrections = fileData.manualBpm || fileData.manualKey;
    if (!hasCorrections) return;

    try {
      const { error } = await supabase.functions.invoke('learn-from-corrections', {
        body: {
          track_id: trackId,
          detected_bpm: fileData.analysis.bpm,
          detected_key: fileData.analysis.key,
          manual_bpm: fileData.manualBpm || null,
          manual_key: fileData.manualKey || null
        }
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error sending corrections:', error);
    }
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

        // Upload artwork if provided
        let artworkUrl = null;
        if (fileData.artwork) {
          artworkUrl = await uploadArtwork(fileData.artwork, user.id);
        }

        // Upload audio file to Supabase storage with user folder structure
        const fileName = `${user.id}/${Date.now()}-${fileData.file.name}`;
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
        const { data: insertedTrack, error: dbError } = await supabase
          .from('tracks')
          .insert({
            title: fileData.title,
            file_url: publicUrl,
            artwork_url: artworkUrl,
            artist: userProfile?.producer_name || 'Unknown Artist',
            tags: fileData.tags,
            detected_key: fileData.analysis?.key,
            detected_bpm: fileData.analysis?.bpm,
            manual_key: fileData.manualKey,
            manual_bpm: fileData.manualBpm,
            duration: fileData.analysis?.duration,
            format: fileData.analysis?.metadata.format,
            sample_rate: fileData.analysis?.metadata.sampleRate,
            file_size: fileData.file.size,
            user_id: user.id,
            metadata: {
              ...fileData.analysis?.metadata,
              compatibleKeys: fileData.analysis?.compatibleKeys,
              confidenceScore: fileData.analysis?.confidenceScore
            }
          })
          .select()
          .single();

        if (dbError) {
          throw dbError;
        }

        // Send corrections to learning system if user made manual edits
        if (insertedTrack) {
          await sendCorrections(insertedTrack.id, fileData);
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
                        {fileData.analysis && (
                          <span>
                            {" • "}{fileData.analysis.duration.toFixed(0)}s
                            {fileData.analysis.confidenceScore > 0 && " • " + Math.round(fileData.analysis.confidenceScore * 100) + "% confidence"}
                            {fileData.analysis.metadata.filenameAnalysis && (
                              fileData.analysis.metadata.filenameAnalysis.bpm || fileData.analysis.metadata.filenameAnalysis.key
                            ) && (
                              <span className="text-blue-600">
                                {" • Filename: "}
                                {fileData.analysis.metadata.filenameAnalysis.bpm && fileData.analysis.metadata.filenameAnalysis.bpm + " BPM"}
                                {fileData.analysis.metadata.filenameAnalysis.bpm && fileData.analysis.metadata.filenameAnalysis.key && ", "}
                                {fileData.analysis.metadata.filenameAnalysis.key}
                              </span>
                            )}
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
                {/* BPM and Key Metadata */}
                {fileData.analysis && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">BPM</Label>
                      <div className="space-y-2">
                        <Input
                          type="number"
                          min="60"
                          max="200"
                          placeholder="Enter BPM"
                          value={fileData.manualBpm || fileData.analysis.bpm || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            updateFileBpm(index, value ? parseInt(value) : undefined);
                          }}
                          className="mt-1"
                        />
                        {fileData.analysis.bpm && (
                          <p className="text-xs text-muted-foreground">
                            Detected: {fileData.analysis.bpm} BPM
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Key</Label>
                      <div className="space-y-2">
                        <Select
                          value={fileData.manualKey || fileData.analysis.key || ''}
                          onValueChange={(value: string) => updateFileKey(index, value || undefined)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select key" />
                          </SelectTrigger>
                          <SelectContent>
                            {['C Major', 'C# Major', 'D Major', 'D# Major', 'E Major', 'F Major', 'F# Major', 'G Major', 'G# Major', 'A Major', 'A# Major', 'B Major',
                              'C Minor', 'C# Minor', 'D Minor', 'D# Minor', 'E Minor', 'F Minor', 'F# Minor', 'G Minor', 'G# Minor', 'A Minor', 'A# Minor', 'B Minor'].map(key => (
                              <SelectItem key={key} value={key}>{key}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fileData.analysis.key && (
                          <p className="text-xs text-muted-foreground">
                            Detected: {fileData.analysis.key}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

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

                {/* Artwork Upload */}
                <div>
                  <Label className="text-sm font-medium">Track Artwork</Label>
                  <div className="mt-2 flex items-center gap-4">
                    {fileData.artworkPreview ? (
                      <div className="relative w-20 h-20 rounded-lg overflow-hidden border">
                        <img 
                          src={fileData.artworkPreview} 
                          alt="Track artwork" 
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => removeArtwork(index)}
                          className="absolute top-1 right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
                        <Image className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleArtworkUpload(index, file);
                        }}
                        className="mb-2"
                      />
                      <p className="text-xs text-muted-foreground">
                        Upload artwork or we'll use your profile photo as fallback
                      </p>
                    </div>
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
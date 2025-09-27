import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, Plus, FileAudio, CheckCircle, Image, DollarSign } from "lucide-react";
import { User } from "@supabase/supabase-js";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOptimizedAudioAnalysis, AudioAnalysisResult } from "@/hooks/useOptimizedAudioAnalysis";

// --- Main Component ---

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
  price: string;
  isFree: boolean;
  genre: string;
  description: string;
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeAudioFileLocal = async (fileData: UploadedFile, index: number) => {
    // Just mark as pending - analysis will happen after upload
    setUploadedFiles(prev => prev.map((file, i) => i === index ? { ...file, status: 'pending' } : file));
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      title: file.name.replace(/\.[^/.]+$/, ""),
      tags: [],
      progress: 0,
      status: 'pending' as const,
      price: "9.99",
      isFree: false,
      genre: "",
      description: ""
    }));
    const currentLength = uploadedFiles.length;
    setUploadedFiles(prev => [...prev, ...newFiles]);

    newFiles.forEach((fileData, index) => {
      setTimeout(() => {
        analyzeAudioFileLocal(fileData, currentLength + index);
      }, 100 * index);
    });
  }, [uploadedFiles.length]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'audio/*': ['.mp3', '.wav', '.flac', '.m4a', '.aac'] },
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
      
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      setUserProfile(profile);
      
      const { data: packs } = await supabase.from("beat_packs").select("id, name").eq("user_id", session.user.id).order("created_at", { ascending: false });
      setBeatPacks(packs || []);
      setLoading(false);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      setUserProfile(profile);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-screen">
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
    setUploadedFiles(prev => prev.map((file, i) => i === index ? { ...file, tags: [...file.tags, newTag.trim()] } : file));
    setNewTag("");
  };

  const removeTag = (fileIndex: number, tagIndex: number) => {
    setUploadedFiles(prev => prev.map((file, i) => i === fileIndex ? { ...file, tags: file.tags.filter((_, ti) => ti !== tagIndex) } : file));
  };
  
  const uploadArtwork = async (file: File, userId: string): Promise<string | null> => {
    try {
      const fileName = `${userId}/artwork/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('artwork').upload(fileName, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('artwork').getPublicUrl(fileName);
      return publicUrl;
    } catch (error) {
      console.error('Artwork upload error:', error);
      return null;
    }
  };

  const handleArtworkUpload = (index: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedFiles(prev => prev.map((fileData, i) => i === index ? { ...fileData, artwork: file, artworkPreview: e.target?.result as string } : fileData));
    };
    reader.readAsDataURL(file);
  };

  const removeArtwork = (index: number) => {
    setUploadedFiles(prev => prev.map((fileData, i) => i === index ? { ...fileData, artwork: undefined, artworkPreview: undefined } : fileData));
  };

  const updateFileField = (index: number, field: keyof UploadedFile, value: any) => {
    setUploadedFiles(prev => prev.map((file, i) => i === index ? { ...file, [field]: value } : file));
  };

  const uploadFiles = async () => {
    if (uploadedFiles.length === 0 || !user) return;
    
    try {
      for (const fileData of uploadedFiles) {
        setUploadedFiles(prev => prev.map(file => file === fileData ? { ...file, status: 'uploading', progress: 0 } : file));

        let artworkUrl = null;
        if (fileData.artwork) {
          artworkUrl = await uploadArtwork(fileData.artwork, user.id);
        }

        const fileName = `${user.id}/${Date.now()}-${fileData.file.name}`;
        const { error: uploadError } = await supabase.storage.from('audio-files').upload(fileName, fileData.file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('audio-files').getPublicUrl(fileName);

        const priceCents = fileData.isFree ? 0 : Math.round(parseFloat(fileData.price) * 100);

        const { data: insertedBeat, error: beatError } = await supabase.from('beats').insert({
          producer_id: user.id,
          title: fileData.title,
          description: fileData.description,
          audio_file_url: publicUrl,
          file_url: publicUrl,
          artwork_url: artworkUrl,
          price_cents: priceCents,
          is_free: fileData.isFree,
          genre: fileData.genre || null,
          // Use manual input, analysis will update these later
          manual_bpm: fileData.manualBpm || null,
          bpm: fileData.manualBpm || null,
          manual_key: fileData.manualKey || null,
          key: fileData.manualKey || null,
          tags: fileData.tags.filter(Boolean),
          metadata: {
            analysisStatus: 'pending'
          }
        }).select().single();

        if (beatError) throw beatError;

        // Trigger background analysis
        try {
          setUploadedFiles(prev => prev.map(file => file === fileData ? { ...file, status: 'analyzing' } : file));
          await supabase.functions.invoke('analyze-beat', {
            body: { beatId: insertedBeat.id }
          });
        } catch (analysisError) {
          console.warn('Background analysis failed to start:', analysisError);
        }

        if (!fileData.isFree) {
          await supabase.functions.invoke('create-beat-product', { body: { beatId: insertedBeat.id } });
        }

        setUploadedFiles(prev => prev.map(file => file === fileData ? { ...file, status: 'complete', progress: 100 } : file));
      }
      toast({ title: "Upload Complete", description: `Successfully uploaded ${uploadedFiles.length} beats. Analysis running in background.` });
      setUploadedFiles([]);
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: "Upload Failed", description: error instanceof Error ? error.message : "An error occurred", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Upload Your Beats</h1>
        <p className="text-muted-foreground">Upload your beats for sale. Set pricing, add metadata, and organize into beat packs.</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}>
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-primary font-medium">Drop your beat files here...</p>
            ) : (
              <div>
                <p className="text-lg font-medium mb-2">Drag & drop beat files here</p>
                <p className="text-muted-foreground mb-4">or click to browse</p>
                <Button variant="outline">Choose Files</Button>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-4">Supports MP3, WAV, FLAC, M4A, AAC files</p>
          </div>
        </CardContent>
      </Card>

      {uploadedFiles.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Uploaded Beats</h2>
            <Button onClick={uploadFiles} disabled={uploadedFiles.some(f => f.status === 'uploading' || f.status === 'analyzing')}>Upload All Beats</Button>
          </div>
          
          {uploadedFiles.map((fileData, index) => (
            <Card key={index}>
              <CardHeader className="pb-3 flex flex-row items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  {fileData.status === 'complete' ? <CheckCircle className="w-5 h-5 text-green-500" /> : <FileAudio className="w-5 h-5 text-primary" />}
                </div>
                <div className="flex-1">
                  <Input value={fileData.title} onChange={(e) => updateFileField(index, 'title', e.target.value)} className="font-medium" placeholder="Beat title" />
                  <p className="text-sm text-muted-foreground mt-1">
                    {(fileData.file.size / 1024 / 1024).toFixed(2)} MB
                    {fileData.analysis && <span>{" • "}{Math.round(fileData.analysis.duration)}s</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {fileData.status === 'analyzing' && (
                    <div className="flex items-center gap-2">
                      <Progress value={50} className="w-16 h-2" />
                      <span className="text-xs text-muted-foreground">Analyzing...</span>
                    </div>
                  )}
                  <Badge variant={fileData.status === 'complete' ? 'default' : fileData.status === 'error' ? 'destructive' : 'secondary'}>
                    {fileData.status}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Genre</Label>
                    <Input value={fileData.genre || ''} onChange={(e) => updateFileField(index, 'genre', e.target.value)} placeholder="Hip-hop, Trap, R&B..." />
                  </div>
                  <div>
                    <Label>Add to Beat Pack</Label>
                    <Select value={fileData.beatPackId || ''} onValueChange={(value) => updateFileField(index, 'beatPackId', value)}>
                      <SelectTrigger><SelectValue placeholder="Select beat pack (optional)" /></SelectTrigger>
                      <SelectContent>
                        {beatPacks.map((pack) => (<SelectItem key={pack.id} value={pack.id}>{pack.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Description</Label>
                  <Textarea value={fileData.description || ''} onChange={(e) => updateFileField(index, 'description', e.target.value)} placeholder="Describe your beat..." rows={2} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>BPM</Label>
                    <Input 
                      type="number" 
                      min="60" 
                      max="200" 
                      placeholder="Enter BPM" 
                      value={fileData.manualBpm ?? ''} 
                      onChange={(e) => updateFileField(index, 'manualBpm', e.target.value ? parseInt(e.target.value) : undefined)} 
                    />
                    <p className="text-xs text-muted-foreground mt-1">Will be auto-detected after upload if left empty</p>
                  </div>
                  <div>
                    <Label>Musical Key</Label>
                    <Input 
                      value={fileData.manualKey ?? ''} 
                      onChange={(e) => updateFileField(index, 'manualKey', e.target.value)} 
                      placeholder="C Major, A Minor..." 
                    />
                    <p className="text-xs text-muted-foreground mt-1">Will be auto-detected after upload if left empty</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch id={`isFree-${index}`} checked={fileData.isFree} onCheckedChange={(checked) => updateFileField(index, 'isFree', checked)} />
                    <Label htmlFor={`isFree-${index}`}>Free Download</Label>
                  </div>
                  {!fileData.isFree && (
                    <div>
                      <Label className="flex items-center gap-2"><DollarSign className="h-4 w-4" />Price (USD)</Label>
                      <Input type="number" step="0.01" min="0.99" value={fileData.price} onChange={(e) => updateFileField(index, 'price', e.target.value)} placeholder="9.99" />
                    </div>
                  )}
                </div>

                <div>
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {fileData.tags.map((tag, tagIndex) => (
                      <Badge key={tagIndex} variant="secondary" className="cursor-pointer" onClick={() => removeTag(index, tagIndex)}>{tag} <X className="ml-1 h-3 w-3" /></Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add tag and press Enter" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(index); } }} />
                    <Button type="button" variant="outline" size="icon" onClick={() => addTag(index)}><Plus className="w-4 h-4" /></Button>
                  </div>
                </div>
                
                <div>
                  <Label>Artwork (Optional)</Label>
                  <div className="flex items-center gap-4">
                    {fileData.artworkPreview ? (
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <img src={fileData.artworkPreview} alt="Artwork preview" className="w-full h-full object-cover" />
                        <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeArtwork(index)}><X className="w-3 h-3" /></Button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center flex-shrink-0">
                        <Image className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <Input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleArtworkUpload(index, file); }} className="flex-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


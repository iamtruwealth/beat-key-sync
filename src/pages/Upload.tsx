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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AudioAnalysisResult } from "@/lib/audioAnalysis";
import { Progress } from "@/components/ui/progress";
import AudioAnalysisWorker from "@/workers/audioAnalysis.worker.ts?worker";

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
  const [beatPacks, setBeatPacks] = useState<{id: string; name: string}[]>([]);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const workerRef = new AudioAnalysisWorker();

  const analyzeFileWithWorker = async (fileData: UploadedFile, index: number) => {
    setUploadedFiles(prev => prev.map((f, i) => i === index ? { ...f, status: 'analyzing' } : f));
    return new Promise<void>((resolve) => {
      workerRef.onmessage = (event: MessageEvent) => {
        const analysis: AudioAnalysisResult = event.data;
        setUploadedFiles(prev => prev.map((f, i) => i === index ? { ...f, analysis, status: 'complete' } : f));

        toast({
          title: "Analysis Complete",
          description: `${fileData.title} - Key: ${analysis.key}, BPM: ${analysis.bpm} (${Math.round(analysis.confidenceScore * 100)}% confidence)`
        });
        resolve();
      };
      workerRef.postMessage(fileData.file);
    });
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
    setUploadedFiles(prev => [...prev, ...newFiles]);

    const startIndex = uploadedFiles.length;
    newFiles.forEach((fileData, i) => {
      setTimeout(() => analyzeFileWithWorker(fileData, startIndex + i), 100 * i);
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
      if (!session) { navigate("/auth"); return; }
      setUser(session.user);

      const { data: profile } = await supabase
        .from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      setUserProfile(profile);

      const { data: packs } = await supabase
        .from("beat_packs").select("id, name").eq("user_id", session.user.id).order("created_at", { ascending: false });
      setBeatPacks(packs || []);
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate("/auth");
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const updateFileField = (index: number, field: string, value: any) => {
    setUploadedFiles(prev => prev.map((file, i) => i === index ? { ...file, [field]: value } : file));
  };

  const addTag = (index: number, tag: string) => {
    if (!tag.trim()) return;
    setUploadedFiles(prev => prev.map((file, i) => i === index ? { ...file, tags: [...file.tags, tag.trim()] } : file));
    setNewTag("");
  };

  const removeTag = (fileIndex: number, tagIndex: number) => {
    setUploadedFiles(prev => prev.map((file, i) => i === fileIndex ? { ...file, tags: file.tags.filter((_, ti) => ti !== tagIndex) } : file));
  };

  const handleArtworkUpload = (index: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedFiles(prev => prev.map((f, i) => i === index ? { ...f, artwork: file, artworkPreview: e.target?.result as string } : f));
    };
    reader.readAsDataURL(file);
  };

  const removeArtwork = (index: number) => {
    setUploadedFiles(prev => prev.map((f, i) => i === index ? { ...f, artwork: undefined, artworkPreview: undefined } : f));
  };

  const uploadFiles = async () => {
    if (uploadedFiles.length === 0) return;
    try {
      for (const fileData of uploadedFiles) {
        setUploadedFiles(prev => prev.map(f => f === fileData ? { ...f, status: 'uploading', progress: 0 } : f));

        let artworkUrl = null;
        if (fileData.artwork) {
          const fileName = `${user.id}/artwork/${Date.now()}-${fileData.artwork.name}`;
          const { data, error } = await supabase.storage.from('artwork').upload(fileName, fileData.artwork);
          if (error) throw error;
          const { data: { publicUrl } } = supabase.storage.from('artwork').getPublicUrl(fileName);
          artworkUrl = publicUrl;
        }

        const fileName = `${user.id}/${Date.now()}-${fileData.file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('audio-files').upload(fileName, fileData.file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('audio-files').getPublicUrl(fileName);

        const { data: insertedBeat, error: beatError } = await supabase.from('beats').insert({
          producer_id: user.id,
          title: fileData.title,
          description: fileData.description,
          audio_file_url: publicUrl,
          file_url: publicUrl,
          artwork_url: artworkUrl,
          price_cents: fileData.isFree ? 0 : Math.round(parseFloat(fileData.price) * 100),
          is_free: fileData.isFree,
          genre: fileData.genre || null,
          bpm: fileData.manualBpm || fileData.analysis?.bpm || null,
          key: fileData.manualKey || fileData.analysis?.key || null,
          tags: fileData.tags.filter(Boolean),
        }).select().single();
        if (beatError) throw beatError;

        setUploadedFiles(prev => prev.map(f => f === fileData ? { ...f, status: 'complete', progress: 100 } : f));
      }

      toast({ title: "Upload Complete", description: `Successfully uploaded ${uploadedFiles.length} beats` });
      setUploadedFiles([]);
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: "Upload Failed", description: error instanceof Error ? error.message : "Upload error", variant: "destructive" });
    }
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!user) return null;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold">Upload Your Beats</h1>
      <div {...getRootProps()} className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer">
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 mx-auto mb-4" />
        {isDragActive ? <p>Drop your files here...</p> : <p>Drag & drop files, or click to browse</p>}
      </div>

      {uploadedFiles.length > 0 && (
        <div className="space-y-4">
          {uploadedFiles.map((fileData, index) => (
            <Card key={index}>
              <CardHeader className="flex justify-between items-center">
                <Input value={fileData.title} onChange={(e) => updateFileField(index, 'title', e.target.value)} className="flex-1" />
                <Badge>{fileData.status}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <Label>Genre</Label>
                <Input value={fileData.genre} onChange={(e) => updateFileField(index, 'genre', e.target.value)} />

                <Label>Description</Label>
                <Textarea value={fileData.description} onChange={(e) => updateFileField(index, 'description', e.target.value)} rows={2} />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>BPM</Label>
                    <Input type="number" min={60} max={200} value={fileData.manualBpm || fileData.analysis?.bpm || ''} onChange={(e) => updateFileField(index, 'manualBpm', e.target.value ? parseInt(e.target.value) : undefined)} />
                  </div>
                  <div>
                    <Label>Key</Label>
                    <Input value={fileData.manualKey || fileData.analysis?.key || ''} onChange={(e) => updateFileField(index, 'manualKey', e.target.value)} />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch id={`isFree-${index}`} checked={fileData.isFree} onCheckedChange={(val) => updateFileField(index, 'isFree', val)} />
                  <Label htmlFor={`isFree-${index}`}>Free Download</Label>
                </div>

                {!fileData.isFree && (
                  <div>
                    <Label className="flex items-center gap-2"><DollarSign className="w-4 h-4" /> Price</Label>
                    <Input type="number" step={0.01} min={0.99} value={fileData.price} onChange={(e) => updateFileField(index, 'price', e.target.value)} />
                  </div>
                )}

                <div>
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {fileData.tags.map((tag, tagIndex) => (
                      <span key={tagIndex} className="bg-primary/10 text-primary px-2 py-1 rounded-md text-sm cursor-pointer" onClick={() => removeTag(index, tagIndex)}>{tag} ×</span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add tag..." onKeyDown={(e) => { if(e.key==='Enter'){ e.preventDefault(); addTag(index, newTag); }}} />
                    <Button type="button" onClick={() => addTag(index, newTag)}><Plus className="w-4 h-4" /></Button>
                  </div>
                </div>

                <div>
                  <Label>Artwork</Label>
                  <div className="flex items-center gap-4">
                    {fileData.artworkPreview ? <img src={fileData.artworkPreview} className="w-16 h-16 object-cover rounded-lg" /> : <div className="w-16 h-16 border-2 border-dashed rounded-lg" />}
                    <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if(f) handleArtworkUpload(index, f); }} />
                    {fileData.artworkPreview && <Button variant="destructive" onClick={() => removeArtwork(index)}><X className="w-3 h-3" /></Button>}
                  </div>
                </div>

                <Progress value={fileData.progress} />
              </CardContent>
            </Card>
          ))}
          <Button onClick={uploadFiles}>Upload All Beats</Button>
        </div>
      )}
    </div>
  );
}

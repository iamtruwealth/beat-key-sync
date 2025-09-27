import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Upload, Music, ArrowLeft, X, FileAudio } from "lucide-react";
import { MetaTags } from "@/components/MetaTags";

interface Beat {
  id: string;
  title: string;
  artist?: string;
}

interface StemFile {
  file: File;
  name: string;
  id: string;
}

export default function UploadStems() {
  const [beats, setBeats] = useState<Beat[]>([]);
  const [selectedBeatId, setSelectedBeatId] = useState<string>("");
  const [stemFiles, setStemFiles] = useState<StemFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadUserBeats();
  }, []);

  const loadUserBeats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('beats')
        .select('id, title, artist')
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBeats(data || []);
    } catch (error) {
      console.error('Error loading beats:', error);
      toast({
        title: "Error",
        description: "Failed to load your beats",
        variant: "destructive"
      });
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      handleFiles(files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  const handleFiles = (files: File[]) => {
    const audioFiles = files.filter(file => file.type.startsWith('audio/'));
    const newStems: StemFile[] = audioFiles.map(file => ({
      file,
      name: file.name.split('.')[0],
      id: Math.random().toString(36).substr(2, 9)
    }));
    
    setStemFiles(prev => [...prev, ...newStems]);
    
    if (audioFiles.length !== files.length) {
      toast({
        title: "Warning",
        description: "Only audio files are accepted for stems",
        variant: "destructive"
      });
    }
  };

  const removeStem = (id: string) => {
    setStemFiles(prev => prev.filter(stem => stem.id !== id));
  };

  const updateStemName = (id: string, newName: string) => {
    setStemFiles(prev => 
      prev.map(stem => 
        stem.id === id ? { ...stem, name: newName } : stem
      )
    );
  };

  const uploadStems = async () => {
    if (!selectedBeatId) {
      toast({
        title: "Error",
        description: "Please select a beat to associate with these stems",
        variant: "destructive"
      });
      return;
    }

    if (stemFiles.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one stem file to upload",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const uploadPromises = stemFiles.map(async (stem) => {
        // Upload file to storage
        const fileExt = stem.file.name.split('.').pop();
        const fileName = `${user.id}/${selectedBeatId}/${stem.name}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('audio-files')
          .upload(fileName, stem.file, {
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('audio-files')
          .getPublicUrl(fileName);

        // Create stem record in database
        const { error: dbError } = await supabase
          .from('stems')
          .insert({
            beat_id: selectedBeatId,
            user_id: user.id,
            name: stem.name,
            file_url: publicUrl,
            file_size: stem.file.size,
            format: stem.file.type
          });

        if (dbError) throw dbError;
      });

      await Promise.all(uploadPromises);

      toast({
        title: "Success!",
        description: `Successfully uploaded ${stemFiles.length} stems`,
      });

      // Reset form
      setStemFiles([]);
      setSelectedBeatId("");

    } catch (error) {
      console.error('Error uploading stems:', error);
      toast({
        title: "Error",
        description: "Failed to upload stems. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <MetaTags 
        title="Upload Stems | BeatPackz - Add Stems to Your Beats"
        description="Upload audio stems and associate them with your beats. Organize your production elements and provide stems to customers who purchase your beats."
      />
      
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/producer-dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-2">
            Upload Stems
          </h1>
          <p className="text-lg text-muted-foreground">
            Upload individual stems and associate them with your beats
          </p>
        </div>

        {/* Beat Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="w-5 h-5" />
              Select Beat
            </CardTitle>
            <CardDescription>
              Choose which beat these stems belong to
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="beat-select">Beat</Label>
                <Select value={selectedBeatId} onValueChange={setSelectedBeatId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a beat..." />
                  </SelectTrigger>
                  <SelectContent>
                    {beats.map((beat) => (
                      <SelectItem key={beat.id} value={beat.id}>
                        {beat.title} {beat.artist && `- ${beat.artist}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {beats.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No beats found. You need to upload beats first before adding stems.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* File Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Stem Files
            </CardTitle>
            <CardDescription>
              Drag and drop audio files or click to browse. Accepted formats: MP3, WAV, FLAC, M4A
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                  <FileAudio className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-medium mb-2">
                    Drop stem files here or click to browse
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Supports: MP3, WAV, FLAC, M4A files
                  </p>
                  <input
                    type="file"
                    multiple
                    accept="audio/*"
                    onChange={handleFileInput}
                    className="hidden"
                    id="file-input"
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => document.getElementById('file-input')?.click()}
                  >
                    Browse Files
                  </Button>
                </div>
              </div>
            </div>

            {/* Uploaded Files List */}
            {stemFiles.length > 0 && (
              <div className="mt-6 space-y-4">
                <h3 className="text-lg font-medium">Stems to Upload ({stemFiles.length})</h3>
                <div className="space-y-3">
                  {stemFiles.map((stem) => (
                    <div key={stem.id} className="flex items-center gap-4 p-4 border rounded-lg">
                      <FileAudio className="w-8 h-8 text-primary flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div>
                          <Label htmlFor={`stem-name-${stem.id}`}>Stem Name</Label>
                          <Input
                            id={`stem-name-${stem.id}`}
                            value={stem.name}
                            onChange={(e) => updateStemName(stem.id, e.target.value)}
                            placeholder="Enter stem name (e.g., Kick, Snare, Bass)"
                          />
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {stem.file.name} • {formatFileSize(stem.file.size)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeStem(stem.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload Button */}
        <div className="flex justify-center">
          <Button 
            size="lg" 
            onClick={uploadStems}
            disabled={isUploading || !selectedBeatId || stemFiles.length === 0}
            className="w-full max-w-md"
          >
            {isUploading ? (
              <>
                <Upload className="w-4 h-4 mr-2 animate-spin" />
                Uploading Stems...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload {stemFiles.length} Stem{stemFiles.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
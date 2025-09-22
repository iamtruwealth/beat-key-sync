import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, X, Music, Image, Video, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Beat {
  id: string;
  title: string;
  bpm?: number;
  key?: string;
  artwork_url?: string;
}

interface PostUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPostUploaded: (post: any) => void;
}

export function PostUploadDialog({ open, onOpenChange, onPostUploaded }: PostUploadDialogProps) {
  const [step, setStep] = useState<'upload' | 'details'>('upload');
  const [uploading, setUploading] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string>('');
  const [mediaType, setMediaType] = useState<'audio' | 'photo' | 'video'>('audio');
  const [userBeats, setUserBeats] = useState<Beat[]>([]);
  const [selectedBeat, setSelectedBeat] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [customBpm, setCustomBpm] = useState('');
  const [customKey, setCustomKey] = useState('');

  // Fetch user's beats when dialog opens
  useEffect(() => {
    if (open) {
      fetchUserBeats();
    }
  }, [open]);

  const fetchUserBeats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: beats, error } = await supabase
        .from('beats')
        .select('id, title, bpm, key, artwork_url')
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserBeats(beats || []);
    } catch (error) {
      console.error('Error fetching beats:', error);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Determine media type
    let type: 'audio' | 'photo' | 'video';
    if (file.type.startsWith('audio/')) {
      type = 'audio';
    } else if (file.type.startsWith('image/')) {
      type = 'photo';
    } else if (file.type.startsWith('video/')) {
      type = 'video';
    } else {
      toast.error('Unsupported file type. Please upload an audio, image, or video file.');
      return;
    }

    setMediaFile(file);
    setMediaType(type);
    setMediaPreview(URL.createObjectURL(file));
    setStep('details');
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a'],
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
      'video/*': ['.mp4', '.webm', '.mov']
    },
    maxSize: 100 * 1024 * 1024, // 100MB
    multiple: false
  });

  const handleUpload = async () => {
    if (!mediaFile) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload media file
      const fileExt = mediaFile.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `posts/${user.id}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(filePath, mediaFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('audio-files')
        .getPublicUrl(filePath);

      // Get beat info if selected
      const selectedBeatData = selectedBeat 
        ? userBeats.find(b => b.id === selectedBeat)
        : null;

      // Create post record
      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert({
          producer_id: user.id,
          type: mediaType,
          beat_id: selectedBeat || null,
          media_url: publicUrl,
          cover_url: selectedBeatData?.artwork_url || null,
          caption: caption.trim() || null,
          bpm: customBpm ? parseInt(customBpm) : selectedBeatData?.bpm || null,
          key: customKey || selectedBeatData?.key || null
        })
        .select(`
          *,
          producer:profiles!posts_producer_id_fkey(
            producer_name,
            producer_logo_url,
            verification_status
          )
        `)
        .single();

      if (postError) throw postError;

      onPostUploaded(post);
      handleReset();
    } catch (error) {
      console.error('Error uploading post:', error);
      toast.error('Failed to upload post. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setMediaFile(null);
    setMediaPreview('');
    setMediaType('audio');
    setSelectedBeat('');
    setCaption('');
    setCustomBpm('');
    setCustomKey('');
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Post</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
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
              <p className="text-lg">Drop your file here...</p>
            ) : (
              <div>
                <p className="text-lg font-medium mb-2">
                  Drag & drop your media here
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  or click to browse files
                </p>
                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Music className="w-4 h-4" />
                    Audio
                  </div>
                  <div className="flex items-center gap-1">
                    <Image className="w-4 h-4" />
                    Photo
                  </div>
                  <div className="flex items-center gap-1">
                    <Video className="w-4 h-4" />
                    Video
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'details' && (
          <div className="space-y-4">
            {/* Media Preview */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {mediaType === 'audio' && <Music className="w-4 h-4" />}
                    {mediaType === 'photo' && <Image className="w-4 h-4" />}
                    {mediaType === 'video' && <Video className="w-4 h-4" />}
                    <span className="text-sm font-medium capitalize">{mediaType}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep('upload')}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                {mediaType === 'photo' && (
                  <img 
                    src={mediaPreview} 
                    alt="Preview"
                    className="w-full h-32 object-cover rounded"
                  />
                )}
                {mediaType === 'video' && (
                  <video 
                    src={mediaPreview}
                    className="w-full h-32 object-cover rounded"
                    controls
                    muted
                  />
                )}
                {mediaType === 'audio' && (
                  <div className="flex items-center justify-center h-32 bg-muted rounded">
                    <Music className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Beat Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Link to Beat (Optional)
              </label>
              <Select value={selectedBeat} onValueChange={setSelectedBeat}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a beat from your library" />
                </SelectTrigger>
                <SelectContent>
                  {userBeats.map((beat) => (
                    <SelectItem key={beat.id} value={beat.id}>
                      {beat.title}
                      {beat.bpm && ` • ${beat.bpm} BPM`}
                      {beat.key && ` • ${beat.key}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Manual Beat Info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">BPM</label>
                <Input
                  type="number"
                  placeholder="120"
                  value={customBpm}
                  onChange={(e) => setCustomBpm(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Key</label>
                <Input
                  placeholder="C Major"
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                />
              </div>
            </div>

            {/* Caption */}
            <div>
              <label className="text-sm font-medium mb-2 block">Caption</label>
              <Textarea
                placeholder="Tell your story..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={3}
              />
            </div>

            {/* Upload Button */}
            <Button
              onClick={handleUpload}
              disabled={uploading || !mediaFile}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Upload Post'
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
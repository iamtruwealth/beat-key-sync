import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, Music, DollarSign } from 'lucide-react';

interface BeatUploadFormProps {
  onSuccess?: () => void;
}

export function BeatUploadForm({ onSuccess }: BeatUploadFormProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    genre: '',
    bpm: '',
    key: '',
    tags: '',
    price: '',
    isFree: false,
  });
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);

  const { getRootProps: getAudioRootProps, getInputProps: getAudioInputProps } = useDropzone({
    accept: {
      'audio/*': ['.mp3', '.wav', '.flac', '.aac']
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      setAudioFile(acceptedFiles[0]);
    }
  });

  const { getRootProps: getArtworkRootProps, getInputProps: getArtworkInputProps } = useDropzone({
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.webp']
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      setArtworkFile(acceptedFiles[0]);
    }
  });

  const uploadFile = async (file: File, bucket: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!audioFile) {
      toast.error('Please select an audio file');
      return;
    }

    if (!formData.isFree && (!formData.price || parseFloat(formData.price) <= 0)) {
      toast.error('Please set a valid price for paid beats');
      return;
    }

    setIsUploading(true);

    try {
      // Upload audio file
      const audioUrl = await uploadFile(audioFile, 'audio-files');
      
      // Upload artwork if provided
      let artworkUrl = null;
      if (artworkFile) {
        artworkUrl = await uploadFile(artworkFile, 'artwork');
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create beat record
      const priceCents = formData.isFree ? 0 : Math.round(parseFloat(formData.price) * 100);
      const tags = formData.tags.split(',').map(tag => tag.trim()).filter(Boolean);

      const { data: beat, error } = await supabase
        .from('beats')
        .insert({
          producer_id: user.id,
          title: formData.title,
          description: formData.description,
          audio_file_url: audioUrl,
          artwork_url: artworkUrl,
          price_cents: priceCents,
          is_free: formData.isFree,
          genre: formData.genre || null,
          bpm: formData.bpm ? parseInt(formData.bpm) : null,
          key: formData.key || null,
          tags,
        })
        .select()
        .single();

      if (error) throw error;

      // Create Stripe product if not free
      if (!formData.isFree) {
        try {
          await supabase.functions.invoke('create-beat-product', {
            body: { beatId: beat.id }
          });
        } catch (stripeError) {
          console.warn('Failed to create Stripe product:', stripeError);
          // Don't fail the whole upload for this
        }
      }

      toast.success('Beat uploaded successfully!');
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        genre: '',
        bpm: '',
        key: '',
        tags: '',
        price: '',
        isFree: false,
      });
      setAudioFile(null);
      setArtworkFile(null);
      
      onSuccess?.();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload beat. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5" />
          Upload New Beat
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Audio File Upload */}
          <div>
            <Label>Audio File *</Label>
            <div
              {...getAudioRootProps()}
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
            >
              <input {...getAudioInputProps()} />
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              {audioFile ? (
                <p className="text-sm">{audioFile.name}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Drop audio file here or click to browse
                </p>
              )}
            </div>
          </div>

          {/* Artwork Upload */}
          <div>
            <Label>Artwork (Optional)</Label>
            <div
              {...getArtworkRootProps()}
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
            >
              <input {...getArtworkInputProps()} />
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              {artworkFile ? (
                <p className="text-sm">{artworkFile.name}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Drop artwork here or click to browse
                </p>
              )}
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Beat title"
                required
              />
            </div>
            <div>
              <Label htmlFor="genre">Genre</Label>
              <Input
                id="genre"
                value={formData.genre}
                onChange={(e) => setFormData(prev => ({ ...prev, genre: e.target.value }))}
                placeholder="Hip-hop, Trap, R&B..."
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe your beat..."
              rows={3}
            />
          </div>

          {/* Technical Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="bpm">BPM</Label>
              <Input
                id="bpm"
                type="number"
                value={formData.bpm}
                onChange={(e) => setFormData(prev => ({ ...prev, bpm: e.target.value }))}
                placeholder="120"
              />
            </div>
            <div>
              <Label htmlFor="key">Key</Label>
              <Input
                id="key"
                value={formData.key}
                onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value }))}
                placeholder="C Major, A Minor..."
              />
            </div>
            <div>
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                placeholder="dark, heavy, melodic"
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="isFree"
                checked={formData.isFree}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isFree: checked }))}
              />
              <Label htmlFor="isFree">Free Download</Label>
            </div>

            {!formData.isFree && (
              <div>
                <Label htmlFor="price" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Price (USD)
                </Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0.99"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="9.99"
                />
              </div>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Upload Beat'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
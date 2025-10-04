import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Music, X, Upload, UploadCloud } from "lucide-react";

interface EPKModuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  epkProfileId: string;
  editingModule: any;
  onSuccess: () => void;
}

const MODULE_TYPES = [
  { value: "header", label: "Header Banner" },
  { value: "bio", label: "Bio" },
  { value: "press_photos", label: "Press Photos" },
  { value: "music_player", label: "Music Player" },
  { value: "video", label: "Video Showcase" },
  { value: "tour_dates", label: "Tour Dates" },
  { value: "discography", label: "Discography" },
  { value: "press_quotes", label: "Press Quotes" },
];

export function EPKModuleDialog({
  open,
  onOpenChange,
  epkProfileId,
  editingModule,
  onSuccess,
}: EPKModuleDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [moduleType, setModuleType] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [moduleData, setModuleData] = useState<any>({});
  const [userBeats, setUserBeats] = useState<any[]>([]);
  const [loadingBeats, setLoadingBeats] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  useEffect(() => {
    if (editingModule) {
      setModuleType(editingModule.module_type);
      setCustomTitle(editingModule.custom_title || "");
      setModuleData(editingModule.module_data || {});
    } else {
      setModuleType("");
      setCustomTitle("");
      setModuleData({});
    }
  }, [editingModule, open]);

  useEffect(() => {
    if (moduleType === "music_player" && open) {
      loadUserBeats();
    }
  }, [moduleType, open]);

  const loadUserBeats = async () => {
    setLoadingBeats(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('beats')
        .select('*')
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setUserBeats(data);
      }
    } catch (error) {
      console.error('Error loading beats:', error);
    } finally {
      setLoadingBeats(false);
    }
  };

  const toggleTrack = (beatId: string) => {
    const currentTracks = moduleData.track_ids || [];
    const index = currentTracks.indexOf(beatId);
    
    if (index > -1) {
      // Remove track
      setModuleData({
        ...moduleData,
        track_ids: currentTracks.filter((id: string) => id !== beatId)
      });
    } else {
      // Add track (max 10)
      if (currentTracks.length >= 10) {
        toast({
          title: "Maximum Reached",
          description: "You can only add up to 10 tracks",
          variant: "destructive",
        });
        return;
      }
      setModuleData({
        ...moduleData,
        track_ids: [...currentTracks, beatId]
      });
    }
  };

  const handleAudioUpload = async (files: File[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to upload files",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const uploadedBeatIds: string[] = [];
    const errors: string[] = [];

    try {
      for (const file of files) {
        // Upload audio file
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
        const filePath = `${user.id}/audio/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('audio-files')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Audio upload error:', uploadError);
          errors.push(`${file.name}: ${uploadError.message}`);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('audio-files')
          .getPublicUrl(filePath);

        // Create beat record
        const beatTitle = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
        const { data: beatData, error: beatError } = await supabase
          .from('beats')
          .insert({
            title: beatTitle,
            producer_id: user.id,
            file_url: publicUrl,
            audio_file_url: publicUrl,
            is_free: true,
            price_cents: 0,
          })
          .select('id')
          .single();

        if (beatError) {
          console.error('Beat creation error:', beatError);
          errors.push(`${file.name}: Failed to create track record`);
          continue;
        }

        if (beatData) {
          uploadedBeatIds.push(beatData.id);
        }
      }

      if (uploadedBeatIds.length > 0) {
        // Add uploaded beats to selected tracks
        const currentTracks = moduleData.track_ids || [];
        const newTracks = [...currentTracks, ...uploadedBeatIds].slice(0, 10); // Max 10
        
        setModuleData({
          ...moduleData,
          track_ids: newTracks
        });

        // Refresh the beats list
        await loadUserBeats();

        toast({
          title: "Upload Complete",
          description: `${uploadedBeatIds.length} song(s) uploaded successfully`,
        });
      }

      if (errors.length > 0) {
        toast({
          title: "Some Uploads Failed",
          description: errors.join('\n'),
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload songs",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!moduleType) {
      toast({
        title: "Module Type Required",
        description: "Please select a module type",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingModule) {
        const { error } = await supabase
          .from("epk_modules")
          .update({
            custom_title: customTitle,
            module_data: moduleData,
          })
          .eq("id", editingModule.id);

        if (error) throw error;

        toast({
          title: "Module Updated",
          description: "Your EPK module has been updated",
        });
      } else {
        const { data: existingModules } = await supabase
          .from("epk_modules")
          .select("position")
          .eq("epk_profile_id", epkProfileId)
          .order("position", { ascending: false })
          .limit(1);

        const nextPosition = existingModules && existingModules.length > 0 ? existingModules[0].position + 1 : 0;

        const { error } = await supabase.from("epk_modules").insert({
          epk_profile_id: epkProfileId,
          module_type: moduleType,
          custom_title: customTitle,
          module_data: moduleData,
          position: nextPosition,
          is_enabled: true,
        });

        if (error) throw error;

        toast({
          title: "Module Added",
          description: "Your new EPK module has been added",
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save module",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingModule ? "Edit Module" : "Add Module"}</DialogTitle>
          <DialogDescription>
            {editingModule ? "Update your EPK module content" : "Add a new module to your EPK"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="module-type">Module Type</Label>
            <Select value={moduleType} onValueChange={setModuleType} disabled={!!editingModule}>
              <SelectTrigger id="module-type">
                <SelectValue placeholder="Select a module type" />
              </SelectTrigger>
              <SelectContent>
                {MODULE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-title">Custom Title (Optional)</Label>
            <Input
              id="custom-title"
              placeholder="Override the default module title"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
            />
          </div>

          {moduleType === "bio" && (
            <div className="space-y-2">
              <Label htmlFor="bio-content">Bio Content</Label>
              <Textarea
                id="bio-content"
                placeholder="Write your artist bio..."
                value={moduleData.content || ""}
                onChange={(e) => setModuleData({ ...moduleData, content: e.target.value })}
                rows={6}
              />
            </div>
          )}

          {moduleType === "header" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  placeholder="Your artist tagline"
                  value={moduleData.tagline || ""}
                  onChange={(e) => setModuleData({ ...moduleData, tagline: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="banner-url">Banner Image</Label>
                <Input
                  id="banner-url"
                  placeholder="https://..."
                  value={moduleData.bannerUrl || ""}
                  onChange={(e) => setModuleData({ ...moduleData, bannerUrl: e.target.value })}
                />
                <p className="text-sm text-muted-foreground mb-2">
                  Recommended size: 1920x400px for optimal display
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('banner-upload')?.click()}
                    disabled={uploadingBanner}
                    className="w-full"
                  >
                    {uploadingBanner ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Banner
                      </>
                    )}
                  </Button>
                  <input
                    id="banner-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      setUploadingBanner(true);
                      
                      try {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) {
                          toast({
                            title: "Authentication Required",
                            description: "You must be logged in to upload files",
                            variant: "destructive",
                          });
                          return;
                        }

                        const fileExt = file.name.split('.').pop();
                        const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
                        const filePath = `${user.id}/banners/${fileName}`;

                        const { error: uploadError } = await supabase.storage
                          .from('artwork')
                          .upload(filePath, file);

                        if (uploadError) {
                          toast({
                            title: "Upload Failed",
                            description: uploadError.message,
                            variant: "destructive",
                          });
                          return;
                        }

                        const { data: { publicUrl } } = supabase.storage
                          .from('artwork')
                          .getPublicUrl(filePath);

                        setModuleData({ ...moduleData, bannerUrl: publicUrl });
                        toast({
                          title: "Banner Uploaded",
                          description: "Your banner image has been uploaded successfully",
                        });
                        
                        // Reset file input
                        e.target.value = '';
                      } catch (error: any) {
                        console.error('Banner upload error:', error);
                        toast({
                          title: "Upload Error",
                          description: error.message || "Failed to upload banner",
                          variant: "destructive",
                        });
                      } finally {
                        setUploadingBanner(false);
                      }
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {moduleType === "press_photos" && (
            <div className="space-y-4">
              <div>
                <Label>Press Photos</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Upload high-quality press photos (recommended: 2000x2000px minimum)
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('press-photos-upload')?.click()}
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Photos
                </Button>
                <input
                  id="press-photos-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;

                    const currentPhotos = moduleData.photos || [];
                    const uploadedUrls: string[] = [];
                    const errors: string[] = [];

                    setSaving(true);

                    // Get current user ID for the file path
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) {
                      toast({
                        title: "Authentication Required",
                        description: "You must be logged in to upload files",
                        variant: "destructive",
                      });
                      setSaving(false);
                      return;
                    }

                    for (const file of files) {
                      const fileExt = file.name.split('.').pop();
                      const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
                      // Include user ID in path for RLS policy compliance
                      const filePath = `${user.id}/press_photos/${fileName}`;

                      const { error: uploadError } = await supabase.storage
                        .from('artwork')
                        .upload(filePath, file, {
                          cacheControl: '3600',
                          upsert: false
                        });

                      if (uploadError) {
                        console.error('Upload error:', uploadError);
                        errors.push(`${file.name}: ${uploadError.message}`);
                        continue;
                      }

                      const { data: { publicUrl } } = supabase.storage
                        .from('artwork')
                        .getPublicUrl(filePath);

                      uploadedUrls.push(publicUrl);
                    }

                    setSaving(false);

                    if (uploadedUrls.length > 0) {
                      setModuleData({ 
                        ...moduleData, 
                        photos: [...currentPhotos, ...uploadedUrls] 
                      });

                      toast({
                        title: "Photos Uploaded",
                        description: `${uploadedUrls.length} photo(s) uploaded successfully`,
                      });
                    }

                    if (errors.length > 0) {
                      toast({
                        title: "Upload Errors",
                        description: errors.join('\n'),
                        variant: "destructive",
                      });
                    }

                    // Reset the input
                    e.target.value = '';
                  }}
                />
              </div>

              {moduleData.photos && moduleData.photos.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  {moduleData.photos.map((photoUrl: string, index: number) => (
                    <div key={index} className="relative group">
                      <img
                        src={photoUrl}
                        alt={`Press photo ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                        onClick={() => {
                          const updatedPhotos = moduleData.photos.filter((_: string, i: number) => i !== index);
                          setModuleData({ ...moduleData, photos: updatedPhotos });
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {moduleType === "video" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="video-url">Video URL (YouTube/Vimeo)</Label>
                <Input
                  id="video-url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={moduleData.video_url || ""}
                  onChange={(e) => setModuleData({ ...moduleData, video_url: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="video-title">Video Title</Label>
                <Input
                  id="video-title"
                  placeholder="Featured Video"
                  value={moduleData.video_title || ""}
                  onChange={(e) => setModuleData({ ...moduleData, video_title: e.target.value })}
                />
              </div>
            </>
          )}

          {moduleType === "tour_dates" && (
            <div className="space-y-2">
              <Label htmlFor="tour-dates">Tour Dates (JSON)</Label>
              <Textarea
                id="tour-dates"
                placeholder='[{"date": "2025-10-15", "venue": "The Venue", "city": "City", "ticket_url": ""}]'
                value={moduleData.dates ? JSON.stringify(moduleData.dates, null, 2) : ""}
                onChange={(e) => {
                  try {
                    const dates = JSON.parse(e.target.value);
                    setModuleData({ ...moduleData, dates });
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
                rows={6}
              />
            </div>
          )}

          {moduleType === "discography" && (
            <div className="space-y-2">
              <Label htmlFor="releases">Releases (JSON)</Label>
              <Textarea
                id="releases"
                placeholder='[{"title": "Album Name", "year": 2025, "cover_url": "", "spotify_url": ""}]'
                value={moduleData.releases ? JSON.stringify(moduleData.releases, null, 2) : ""}
                onChange={(e) => {
                  try {
                    const releases = JSON.parse(e.target.value);
                    setModuleData({ ...moduleData, releases });
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
                rows={6}
              />
            </div>
          )}

          {moduleType === "press_quotes" && (
            <div className="space-y-2">
              <Label htmlFor="quotes">Press Quotes (JSON)</Label>
              <Textarea
                id="quotes"
                placeholder='[{"quote": "Amazing artist!", "source": "John Doe", "publication": "Music Magazine"}]'
                value={moduleData.quotes ? JSON.stringify(moduleData.quotes, null, 2) : ""}
                onChange={(e) => {
                  try {
                    const quotes = JSON.parse(e.target.value);
                    setModuleData({ ...moduleData, quotes });
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
                rows={6}
              />
            </div>
          )}

          {moduleType === "music_player" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Select Tracks (Max 10)</Label>
                <span className="text-sm text-muted-foreground">
                  {(moduleData.track_ids || []).length} / 10 selected
                </span>
              </div>

              {/* Upload Section */}
              <div className="space-y-2">
                <Label>Upload Songs</Label>
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer bg-accent/5"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add('border-primary', 'bg-accent/20');
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.classList.remove('border-primary', 'bg-accent/20');
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-primary', 'bg-accent/20');
                    
                    const files = Array.from(e.dataTransfer.files).filter(file => 
                      file.type.startsWith('audio/')
                    );
                    
                    if (files.length === 0) {
                      toast({
                        title: "Invalid Files",
                        description: "Please upload audio files only",
                        variant: "destructive",
                      });
                      return;
                    }

                    // Handle upload
                    await handleAudioUpload(files);
                  }}
                  onClick={() => document.getElementById('audio-upload')?.click()}
                >
                  <UploadCloud className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm font-medium mb-1">
                    Drag and drop audio files here
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports MP3, WAV, M4A, OGG
                  </p>
                  <input
                    id="audio-upload"
                    type="file"
                    accept="audio/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) {
                        await handleAudioUpload(files);
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or select from your library
                  </span>
                </div>
              </div>
              
              {loadingBeats ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : userBeats.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <Music className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No songs uploaded yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Upload songs first to add them here</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-4">
                  {userBeats.map((beat) => {
                    const isSelected = (moduleData.track_ids || []).includes(beat.id);
                    return (
                      <div
                        key={beat.id}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <Checkbox
                          id={`beat-${beat.id}`}
                          checked={isSelected}
                          onCheckedChange={() => toggleTrack(beat.id)}
                        />
                        <label
                          htmlFor={`beat-${beat.id}`}
                          className="flex items-center gap-3 flex-1 cursor-pointer"
                        >
                          {beat.artwork_url ? (
                            <img
                              src={beat.artwork_url}
                              alt={beat.title}
                              className="w-10 h-10 rounded object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-primary/20 flex items-center justify-center">
                              <Music className="w-4 h-4 text-primary" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{beat.title}</p>
                            {beat.genre && (
                              <p className="text-xs text-muted-foreground">{beat.genre}</p>
                            )}
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-primary to-accent">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {editingModule ? "Update" : "Add"} Module
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

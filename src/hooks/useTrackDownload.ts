import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useTrackDownload = () => {
  const trackDownload = useCallback(async (beatId: string) => {
    try {
      // Increment download count for beat AND associated beat packs
      const { error } = await supabase.rpc('increment_beat_and_pack_download_count', {
        beat_id: beatId
      });
      
      if (error) {
        console.error('Error tracking download:', error);
        // Fallback: try the individual beat increment
        await supabase.rpc('increment_beat_download_count', {
          beat_id: beatId
        });
      }
    } catch (error) {
      console.error('Failed to track download:', error);
    }
  }, []);

  return { trackDownload };
};
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useTrackDownload = () => {
  const trackDownload = useCallback(async (beatId: string) => {
    try {
      // Increment download count in beats table
      const { error } = await supabase.rpc('increment_download_count', {
        beat_id: beatId
      });
      
      if (error) {
        console.error('Error tracking download:', error);
        // Fallback: try direct update with rpc function
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
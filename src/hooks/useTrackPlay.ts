import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useTrackPlay = () => {
  const trackPlay = useCallback(async (beatId: string) => {
    try {
      // Increment play count in beats table
      const { error } = await supabase.rpc('increment_beat_play_count', {
        beat_id: beatId
      });
      
      if (error) {
        console.error('Error tracking play:', error);
        // Fallback: try direct update with rpc function
        await supabase.rpc('increment_beat_play_count', {
          beat_id: beatId
        });
      }
    } catch (error) {
      console.error('Failed to track play:', error);
    }
  }, []);

  return { trackPlay };
};
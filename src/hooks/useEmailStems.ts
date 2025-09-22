import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EmailStemsParams {
  beatId: string;
  customerEmail: string;
  customerName?: string;
  purchaseId?: string;
}

export const useEmailStems = () => {
  const { toast } = useToast();

  const emailStems = useCallback(async (params: EmailStemsParams) => {
    try {
      console.log('Sending stems email for:', params);
      
      const { data, error } = await supabase.functions.invoke('email-stems', {
        body: params
      });

      if (error) {
        console.error('Error sending stems email:', error);
        toast({
          title: "Error",
          description: "Failed to send stems email. Please try again.",
          variant: "destructive"
        });
        return false;
      }

      if (data?.success) {
        toast({
          title: "Stems Sent!",
          description: `Successfully emailed ${data.stemsCount || 0} stems to ${params.customerEmail}`,
        });
        return true;
      } else {
        toast({
          title: "Info",
          description: data?.message || "No stems available for this beat",
        });
        return false;
      }
    } catch (error) {
      console.error('Failed to send stems email:', error);
      toast({
        title: "Error",
        description: "Failed to send stems email. Please check your connection.",
        variant: "destructive"
      });
      return false;
    }
  }, [toast]);

  return { emailStems };
};
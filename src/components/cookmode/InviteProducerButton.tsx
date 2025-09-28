import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { UserPlus, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface Producer {
  id: string;
  producer_name: string;
  producer_logo_url?: string;
  verification_status?: string;
}

interface InviteProducerButtonProps {
  sessionId: string;
}

export const InviteProducerButton: React.FC<InviteProducerButtonProps> = ({ sessionId }) => {
  const { toast } = useToast();
  const [producers, setProducers] = useState<Producer[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);

  useEffect(() => {
    loadProducers();
  }, []);

  const loadProducers = async () => {
    try {
      setLoading(true);
      
      // Get current user to exclude them from the list
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all producers who have public profiles and aren't already in this session
      const { data: allProducers, error } = await supabase
        .from('profiles')
        .select('id, producer_name, producer_logo_url, verification_status')
        .eq('public_profile_enabled', true)
        .not('producer_name', 'is', null)
        .neq('id', user.id);

      if (error) throw error;

      // Get existing members to filter them out
      const { data: existingMembers } = await supabase
        .from('collaboration_members')
        .select('user_id')
        .eq('collaboration_id', sessionId);

      const existingMemberIds = new Set(existingMembers?.map(m => m.user_id) || []);
      
      // Filter out existing members
      const availableProducers = (allProducers || []).filter(
        producer => !existingMemberIds.has(producer.id)
      );

      setProducers(availableProducers);
    } catch (error) {
      console.error('Error loading producers:', error);
      toast({
        title: "Error",
        description: "Failed to load producers",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const inviteProducer = async (producer: Producer) => {
    try {
      setInviting(producer.id);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Add producer as a collaboration member
      const { error: memberError } = await supabase
        .from('collaboration_members')
        .insert({
          collaboration_id: sessionId,
          user_id: producer.id,
          role: 'collaborator',
          status: 'invited',
          royalty_percentage: 0
        });

      if (memberError) throw memberError;

      // Get session details for the notification
      const { data: session } = await supabase
        .from('collaboration_projects')
        .select('name, created_by')
        .eq('id', sessionId)
        .single();

      // Get inviter's producer name
      const { data: inviterProfile } = await supabase
        .from('profiles')
        .select('producer_name')
        .eq('id', user.id)
        .single();

      // Create notification
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: producer.id,
          type: 'collaboration_invite',
          title: 'Cook Mode Session Invitation',
          message: `${inviterProfile?.producer_name || 'A producer'} invited you to join "${session?.name || 'Cook Mode Session'}"`,
          item_id: sessionId,
          actor_id: user.id
        });

      if (notificationError) throw notificationError;

      // Remove producer from available list
      setProducers(prev => prev.filter(p => p.id !== producer.id));

      toast({
        title: "Invitation Sent",
        description: `Invited ${producer.producer_name} to the session`,
      });

    } catch (error) {
      console.error('Error inviting producer:', error);
      toast({
        title: "Error",
        description: "Failed to send invitation",
        variant: "destructive"
      });
    } finally {
      setInviting(null);
    }
  };

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <UserPlus className="w-4 h-4 mr-2" />
        Loading...
      </Button>
    );
  }

  if (producers.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled>
        <UserPlus className="w-4 h-4 mr-2" />
        No producers available
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="border-border/50 hover:border-neon-cyan/50 text-xs"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Invite Producer
          <ChevronDown className="w-3 h-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-64 max-h-64 overflow-y-auto bg-background/95 backdrop-blur-sm border border-border/50"
      >
        {producers.map((producer) => (
          <DropdownMenuItem
            key={producer.id}
            onClick={() => inviteProducer(producer)}
            disabled={inviting === producer.id}
            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-card/50"
          >
            <div className="w-8 h-8 rounded-full bg-card/50 flex items-center justify-center overflow-hidden">
              {producer.producer_logo_url ? (
                <img 
                  src={producer.producer_logo_url} 
                  alt={producer.producer_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs font-medium">
                  {producer.producer_name.charAt(0)}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">
                  {producer.producer_name}
                </span>
                {producer.verification_status === 'verified' && (
                  <div className="w-4 h-4 text-neon-cyan">✓</div>
                )}
              </div>
            </div>
            {inviting === producer.id && (
              <div className="w-4 h-4 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
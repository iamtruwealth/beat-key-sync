import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CollaborationPermissions {
  canEdit: boolean;
  canView: boolean;
  userRole: 'creator' | 'collaborator' | 'viewer' | null;
  isOwner: boolean;
}

export const useCollaborationPermissions = (collaborationId: string | null) => {
  const [permissions, setPermissions] = useState<CollaborationPermissions>({
    canEdit: false,
    canView: false,
    userRole: null,
    isOwner: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!collaborationId) {
      setLoading(false);
      return;
    }

    const checkPermissions = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setPermissions({ canEdit: false, canView: false, userRole: null, isOwner: false });
          setLoading(false);
          return;
        }

        // Check if user is the project owner
        const { data: project } = await supabase
          .from('collaboration_projects')
          .select('created_by')
          .eq('id', collaborationId)
          .single();

        const isOwner = project?.created_by === user.id;

        // Check if user is a member with specific role
        const { data: member } = await supabase
          .from('collaboration_members')
          .select('role, status')
          .eq('collaboration_id', collaborationId)
          .eq('user_id', user.id)
          .single();

        let canEdit = false;
        let canView = true; // Authenticated users can always view
        let userRole: 'creator' | 'collaborator' | 'viewer' | null = 'viewer';

        if (isOwner) {
          canEdit = true;
          canView = true;
          userRole = 'creator';
        } else if (member && member.status === 'accepted') {
          canEdit = true; // Accepted members can edit
          canView = true;
          userRole = member.role as 'creator' | 'collaborator';
        }

        setPermissions({
          canEdit,
          canView,
          userRole,
          isOwner
        });

        console.log('🔐 Collaboration permissions:', {
          collaborationId,
          userId: user.id,
          isOwner,
          member,
          permissions: { canEdit, canView, userRole }
        });

      } catch (error) {
        console.error('Error checking collaboration permissions:', error);
        setPermissions({ canEdit: false, canView: true, userRole: 'viewer', isOwner: false });
      } finally {
        setLoading(false);
      }
    };

    checkPermissions();
  }, [collaborationId]);

  return { permissions, loading };
};
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, Edit } from "lucide-react";

interface AccessLevelNotificationProps {
  canEdit: boolean;
  userRole: string | null;
}

export const AccessLevelNotification = ({ canEdit, userRole }: AccessLevelNotificationProps) => {
  if (canEdit) return null; // Don't show notification for editors

  return (
    <Alert className="mx-4 mt-2 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
      <Eye className="h-4 w-4" />
      <AlertDescription>
        You're viewing this session in <strong>read-only mode</strong>. Only invited collaborators can edit tracks and controls.
      </AlertDescription>
    </Alert>
  );
};
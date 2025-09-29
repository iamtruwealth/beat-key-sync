import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, Edit } from "lucide-react";

interface AccessLevelNotificationProps {
  canEdit: boolean;
  userRole: string | null;
}

export const AccessLevelNotification = ({ canEdit, userRole }: AccessLevelNotificationProps) => {
  if (canEdit) return null; // Don't show notification for editors

  return (
    <Alert className="mx-4 mt-2 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
      <Eye className="h-4 w-4" />
      <AlertDescription>
        You're watching this live session. Audio is streaming automatically. You can chat and adjust volume.
      </AlertDescription>
    </Alert>
  );
};
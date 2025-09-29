import { Badge } from "@/components/ui/badge";
import { Users, Wifi, WifiOff, Edit, Eye } from "lucide-react";

interface LiveSessionIndicatorProps {
  participantCount: number;
  isConnected: boolean;
  canEdit?: boolean;
}

export const LiveSessionIndicator = ({ participantCount, isConnected, canEdit = false }: LiveSessionIndicatorProps) => {
  return (
    <div className="flex items-center gap-2">
      <Badge variant={isConnected ? "default" : "secondary"} className="gap-1">
        {isConnected ? (
          <Wifi className="w-3 h-3" />
        ) : (
          <WifiOff className="w-3 h-3" />
        )}
        {isConnected ? "LIVE" : "OFFLINE"}
      </Badge>
      
      <Badge variant="outline" className="gap-1">
        <Users className="w-3 h-3" />
        {participantCount}
      </Badge>

      <Badge variant={canEdit ? "default" : "secondary"} className="gap-1">
        {canEdit ? (
          <Edit className="w-3 h-3" />
        ) : (
          <Eye className="w-3 h-3" />
        )}
        {canEdit ? "EDITOR" : "VIEWER"}
      </Badge>
    </div>
  );
};
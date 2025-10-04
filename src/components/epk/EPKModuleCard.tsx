import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Music,
  Image as ImageIcon,
  Type,
  Video,
  Award,
  Calendar,
  Globe,
  Mail,
  ShoppingBag,
  MessageSquare,
} from "lucide-react";

interface EPKModuleCardProps {
  module: any;
  onEdit: (module: any) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, isEnabled: boolean) => void;
}

const MODULE_ICONS: Record<string, any> = {
  header: Globe,
  bio: Type,
  press_photos: ImageIcon,
  music_player: Music,
  music_video: Video,
  achievements: Award,
  performance_history: Calendar,
  social_stats: Globe,
  genre_tags: Type,
  contact: Mail,
  sync_licensing: Music,
  merch: ShoppingBag,
  testimonials: MessageSquare,
};

export function EPKModuleCard({ module, onEdit, onDelete, onToggle }: EPKModuleCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: module.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = MODULE_ICONS[module.module_type] || Type;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="p-4 border-l-4 border-l-primary/50 hover:border-l-primary transition-all"
    >
      <div className="flex items-center gap-4">
        <button
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">
                {module.custom_title || module.module_type.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
              </h3>
              {!module.is_enabled && (
                <Badge variant="outline" className="text-xs">
                  Hidden
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {module.module_type.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())} Module
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggle(module.id, module.is_enabled)}
            className="h-8 w-8 p-0"
          >
            {module.is_enabled ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(module)}
            className="h-8 w-8 p-0"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(module.id)}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

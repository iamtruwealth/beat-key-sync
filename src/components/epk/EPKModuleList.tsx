import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { EPKModuleCard } from "./EPKModuleCard";
import { EPKModuleDialog } from "./EPKModuleDialog";
import { Plus, Loader2 } from "lucide-react";

interface EPKModuleListProps {
  epkProfileId: string;
}

export function EPKModuleList({ epkProfileId }: EPKModuleListProps) {
  const { toast } = useToast();
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<any>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadModules();
  }, [epkProfileId]);

  const loadModules = async () => {
    try {
      const { data, error } = await supabase
        .from("epk_modules")
        .select("*")
        .eq("epk_profile_id", epkProfileId)
        .order("position");

      if (error) throw error;
      setModules(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load modules",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = modules.findIndex((m) => m.id === active.id);
    const newIndex = modules.findIndex((m) => m.id === over.id);

    const reorderedModules = arrayMove(modules, oldIndex, newIndex).map((m, idx) => ({
      ...m,
      position: idx,
    }));

    setModules(reorderedModules);

    try {
      const updates = reorderedModules.map((m) =>
        supabase.from("epk_modules").update({ position: m.position }).eq("id", m.id)
      );

      await Promise.all(updates);

      toast({
        title: "Modules Reordered",
        description: "Your EPK module order has been updated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save module order",
        variant: "destructive",
      });
      loadModules();
    }
  };

  const handleAddModule = () => {
    setEditingModule(null);
    setDialogOpen(true);
  };

  const handleEditModule = (module: any) => {
    setEditingModule(module);
    setDialogOpen(true);
  };

  const handleDeleteModule = async (moduleId: string) => {
    try {
      const { error } = await supabase.from("epk_modules").delete().eq("id", moduleId);

      if (error) throw error;

      setModules(modules.filter((m) => m.id !== moduleId));
      toast({
        title: "Module Deleted",
        description: "The module has been removed from your EPK",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete module",
        variant: "destructive",
      });
    }
  };

  const handleToggleModule = async (moduleId: string, isEnabled: boolean) => {
    try {
      const { error } = await supabase
        .from("epk_modules")
        .update({ is_enabled: !isEnabled })
        .eq("id", moduleId);

      if (error) throw error;

      setModules(modules.map((m) => (m.id === moduleId ? { ...m, is_enabled: !isEnabled } : m)));
      toast({
        title: isEnabled ? "Module Hidden" : "Module Visible",
        description: `The module is now ${isEnabled ? "hidden" : "visible"} in your EPK`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to toggle module visibility",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">EPK Modules</h2>
          <p className="text-muted-foreground">Drag to reorder, toggle visibility, or edit content</p>
        </div>
        <Button onClick={handleAddModule} className="bg-gradient-to-r from-primary to-accent">
          <Plus className="h-4 w-4 mr-2" />
          Add Module
        </Button>
      </div>

      {modules.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-2">
          <p className="text-muted-foreground mb-4">No modules yet. Start building your EPK!</p>
          <Button onClick={handleAddModule} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Module
          </Button>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {modules.map((module) => (
                <EPKModuleCard
                  key={module.id}
                  module={module}
                  onEdit={handleEditModule}
                  onDelete={handleDeleteModule}
                  onToggle={handleToggleModule}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <EPKModuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        epkProfileId={epkProfileId}
        editingModule={editingModule}
        onSuccess={loadModules}
      />
    </div>
  );
}

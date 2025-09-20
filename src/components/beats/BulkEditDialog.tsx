import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, Music, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Beat {
  id: string;
  title: string;
  price_cents: number;
  is_free: boolean;
  audio_file_url: string;
}

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedBeats: Beat[];
  onSuccess: () => void;
}

interface BeatUpdate {
  beatId: string;
  title?: string;
  priceCents?: number;
  isFree?: boolean;
  audioFileUrl?: string;
}

export function BulkEditDialog({ open, onOpenChange, selectedBeats, onSuccess }: BulkEditDialogProps) {
  const [updating, setUpdating] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [formData, setFormData] = useState({
    updateTitle: false,
    newTitle: "",
    updatePrice: false,
    newPrice: "",
    updateFreeStatus: false,
    makeFree: false,
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      // Reset form when dialog opens
      setFormData({
        updateTitle: false,
        newTitle: "",
        updatePrice: false,
        newPrice: "",
        updateFreeStatus: false,
        makeFree: false,
      });
      setResults([]);
      setShowResults(false);
    }
  }, [open]);

  const handleBulkUpdate = async () => {
    if (!selectedBeats.length) return;

    setUpdating(true);
    try {
      const updates: BeatUpdate[] = selectedBeats.map(beat => {
        const update: BeatUpdate = { beatId: beat.id };
        
        if (formData.updateTitle && formData.newTitle.trim()) {
          update.title = formData.newTitle.trim();
        }
        
        if (formData.updateFreeStatus) {
          update.isFree = formData.makeFree;
          if (formData.makeFree) {
            update.priceCents = 0;
          }
        }
        
        if (formData.updatePrice && !formData.makeFree && formData.newPrice) {
          const priceCents = Math.round(parseFloat(formData.newPrice) * 100);
          if (priceCents > 0) {
            update.priceCents = priceCents;
            update.isFree = false;
          }
        }
        
        return update;
      });

      const { data, error } = await supabase.functions.invoke('bulk-update-beats', {
        body: { updates }
      });

      if (error) throw error;

      setResults(data.results);
      setShowResults(true);

      const successCount = data.summary.successful;
      const failedCount = data.summary.failed;

      if (successCount > 0) {
        toast({
          title: "Bulk Update Complete",
          description: `Successfully updated ${successCount} beat${successCount === 1 ? '' : 's'}${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
        });
        onSuccess();
      }

      if (failedCount > 0) {
        toast({
          title: "Some Updates Failed",
          description: `${failedCount} beat${failedCount === 1 ? '' : 's'} could not be updated. Check the results below.`,
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error("Error updating beats:", error);
      toast({
        title: "Error",
        description: "Failed to update beats. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
    }
  };

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  if (showResults) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Update Results</DialogTitle>
            <DialogDescription>
              Update results for {selectedBeats.length} selected beat{selectedBeats.length === 1 ? '' : 's'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="font-semibold text-green-700">Successful</p>
                      <p className="text-2xl font-bold">{results.filter(r => r.success).length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-500" />
                    <div>
                      <p className="font-semibold text-red-700">Failed</p>
                      <p className="text-2xl font-bold">{results.filter(r => !r.success).length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Detailed Results</h3>
              {results.map((result, index) => {
                const beat = selectedBeats.find(b => b.id === result.beatId);
                return (
                  <div key={result.beatId} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {result.success ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <div>
                        <p className="font-medium">{beat?.title || 'Unknown Beat'}</p>
                        {!result.success && (
                          <p className="text-sm text-red-600">{result.error}</p>
                        )}
                        {result.success && result.updatedFields && (
                          <p className="text-sm text-muted-foreground">
                            Updated: {result.updatedFields.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant={result.success ? "default" : "destructive"}>
                      {result.success ? "Success" : "Failed"}
                    </Badge>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2">
              <Button onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Edit Beats</DialogTitle>
          <DialogDescription>
            Apply changes to {selectedBeats.length} selected beat{selectedBeats.length === 1 ? '' : 's'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Selected Beats Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Music className="w-4 h-4" />
                Selected Beats ({selectedBeats.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {selectedBeats.map(beat => (
                  <div key={beat.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{beat.title}</span>
                    <div className="flex items-center gap-2">
                      {beat.is_free ? (
                        <Badge variant="secondary">Free</Badge>
                      ) : (
                        <Badge variant="outline">${formatPrice(beat.price_cents)}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Update Options */}
          <div className="space-y-4">
            {/* Title Update */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Switch
                    id="update-title"
                    checked={formData.updateTitle}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, updateTitle: checked }))
                    }
                  />
                  <Label htmlFor="update-title" className="font-medium">
                    Update Title
                  </Label>
                </div>
                {formData.updateTitle && (
                  <div>
                    <Label htmlFor="new-title">New Title (will be applied to all selected beats)</Label>
                    <Input
                      id="new-title"
                      placeholder="Enter new title"
                      value={formData.newTitle}
                      onChange={(e) => 
                        setFormData(prev => ({ ...prev, newTitle: e.target.value }))
                      }
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Free Status Update */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Switch
                    id="update-free-status"
                    checked={formData.updateFreeStatus}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, updateFreeStatus: checked }))
                    }
                  />
                  <Label htmlFor="update-free-status" className="font-medium">
                    Update Free Status
                  </Label>
                </div>
                {formData.updateFreeStatus && (
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="make-free"
                      checked={formData.makeFree}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({ ...prev, makeFree: checked }))
                      }
                    />
                    <Label htmlFor="make-free">
                      {formData.makeFree ? "Make beats free" : "Make beats paid"}
                    </Label>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Price Update */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Switch
                    id="update-price"
                    checked={formData.updatePrice}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, updatePrice: checked }))
                    }
                    disabled={formData.makeFree}
                  />
                  <Label htmlFor="update-price" className="font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Update Price
                  </Label>
                </div>
                {formData.updatePrice && !formData.makeFree && (
                  <div>
                    <Label htmlFor="new-price">New Price (USD)</Label>
                    <Input
                      id="new-price"
                      type="number"
                      step="0.01"
                      min="0.50"
                      placeholder="0.00"
                      value={formData.newPrice}
                      onChange={(e) => 
                        setFormData(prev => ({ ...prev, newPrice: e.target.value }))
                      }
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Minimum price: $0.50. This will create new Stripe prices for existing products.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleBulkUpdate}
              disabled={updating || (!formData.updateTitle && !formData.updatePrice && !formData.updateFreeStatus)}
            >
              {updating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update {selectedBeats.length} Beat{selectedBeats.length === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
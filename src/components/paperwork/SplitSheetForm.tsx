import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Minus, CalendarIcon, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Contributor {
  id?: string;
  name: string;
  role: string;
  ownership_percentage: number;
  contact_info: string;
}

interface SplitSheetFormProps {
  onSave: (splitSheet: any) => void;
  initialData?: any;
}

export function SplitSheetForm({ onSave, initialData }: SplitSheetFormProps) {
  const [loading, setLoading] = useState(false);
  const [songTitle, setSongTitle] = useState(initialData?.song_title || "");
  const [artistName, setArtistName] = useState(initialData?.artist_name || "");
  const [producerName, setProducerName] = useState(initialData?.producer_name || "");
  const [dateOfAgreement, setDateOfAgreement] = useState<Date | undefined>(
    initialData?.date_of_agreement ? new Date(initialData.date_of_agreement) : new Date()
  );
  const [contributors, setContributors] = useState<Contributor[]>(
    initialData?.split_sheet_contributors || [
      { name: "", role: "Artist", ownership_percentage: 50, contact_info: "" },
      { name: "", role: "Producer", ownership_percentage: 50, contact_info: "" }
    ]
  );
  const { toast } = useToast();

  const addContributor = () => {
    setContributors([...contributors, { 
      name: "", 
      role: "Songwriter", 
      ownership_percentage: 0, 
      contact_info: "" 
    }]);
  };

  const removeContributor = (index: number) => {
    if (contributors.length > 2) {
      setContributors(contributors.filter((_, i) => i !== index));
    }
  };

  const updateContributor = (index: number, field: keyof Contributor, value: any) => {
    const updated = [...contributors];
    updated[index] = { ...updated[index], [field]: value };
    setContributors(updated);
  };

  const getTotalPercentage = () => {
    return contributors.reduce((sum, contributor) => sum + (contributor.ownership_percentage || 0), 0);
  };

  const validateForm = () => {
    if (!songTitle.trim()) {
      toast({ title: "Error", description: "Song title is required", variant: "destructive" });
      return false;
    }
    if (!artistName.trim()) {
      toast({ title: "Error", description: "Artist name is required", variant: "destructive" });
      return false;
    }
    if (!producerName.trim()) {
      toast({ title: "Error", description: "Producer name is required", variant: "destructive" });
      return false;
    }
    if (contributors.some(c => !c.name.trim())) {
      toast({ title: "Error", description: "All contributors must have names", variant: "destructive" });
      return false;
    }
    if (getTotalPercentage() !== 100) {
      toast({ title: "Error", description: "Ownership percentages must total 100%", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const splitSheetData = {
        song_title: songTitle,
        artist_name: artistName,
        producer_name: producerName,
        date_of_agreement: dateOfAgreement?.toISOString().split('T')[0],
        user_id: (await supabase.auth.getUser()).data.user?.id
      };

      let splitSheetResult;
      if (initialData?.id) {
        const { data, error } = await supabase
          .from('split_sheets')
          .update(splitSheetData)
          .eq('id', initialData.id)
          .select()
          .single();
        
        if (error) throw error;
        splitSheetResult = data;

        // Delete existing contributors and recreate
        await supabase
          .from('split_sheet_contributors')
          .delete()
          .eq('split_sheet_id', initialData.id);
      } else {
        const { data, error } = await supabase
          .from('split_sheets')
          .insert(splitSheetData)
          .select()
          .single();
        
        if (error) throw error;
        splitSheetResult = data;
      }

      // Insert contributors
      const contributorData = contributors.map(contributor => ({
        split_sheet_id: splitSheetResult.id,
        name: contributor.name,
        role: contributor.role,
        ownership_percentage: contributor.ownership_percentage,
        contact_info: contributor.contact_info
      }));

      const { error: contributorsError } = await supabase
        .from('split_sheet_contributors')
        .insert(contributorData);

      if (contributorsError) throw contributorsError;

      // Fetch complete data with contributors
      const { data: completeData, error: fetchError } = await supabase
        .from('split_sheets')
        .select(`
          *,
          split_sheet_contributors (*)
        `)
        .eq('id', splitSheetResult.id)
        .single();

      if (fetchError) throw fetchError;

      onSave(completeData);
    } catch (error: any) {
      toast({
        title: "Error saving split sheet",
        description: error.message,
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const totalPercentage = getTotalPercentage();
  const isValidTotal = totalPercentage === 100;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="song-title">Song Title *</Label>
          <Input
            id="song-title"
            value={songTitle}
            onChange={(e) => setSongTitle(e.target.value)}
            placeholder="Enter song title"
            required
          />
        </div>
        <div>
          <Label>Date of Agreement *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !dateOfAgreement && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateOfAgreement ? format(dateOfAgreement, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateOfAgreement}
                onSelect={setDateOfAgreement}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="artist-name">Artist Name *</Label>
          <Input
            id="artist-name"
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
            placeholder="Enter artist name"
            required
          />
        </div>
        <div>
          <Label htmlFor="producer-name">Producer Name *</Label>
          <Input
            id="producer-name"
            value={producerName}
            onChange={(e) => setProducerName(e.target.value)}
            placeholder="Enter producer name"
            required
          />
        </div>
      </div>

      {/* Contributors Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Contributors & Split</span>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-sm font-medium",
                isValidTotal ? "text-green-600" : "text-red-600"
              )}>
                Total: {totalPercentage}%
              </span>
              {!isValidTotal && <AlertCircle className="w-4 h-4 text-red-600" />}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {contributors.map((contributor, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border rounded-lg">
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={contributor.name}
                    onChange={(e) => updateContributor(index, 'name', e.target.value)}
                    placeholder="Full name"
                    required
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Input
                    value={contributor.role}
                    onChange={(e) => updateContributor(index, 'role', e.target.value)}
                    placeholder="e.g., Artist, Producer"
                  />
                </div>
                <div>
                  <Label>Ownership %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={contributor.ownership_percentage}
                    onChange={(e) => updateContributor(index, 'ownership_percentage', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Contact Info</Label>
                  <Input
                    value={contributor.contact_info}
                    onChange={(e) => updateContributor(index, 'contact_info', e.target.value)}
                    placeholder="Email or phone"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeContributor(index)}
                    disabled={contributors.length <= 2}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            <Button
              type="button"
              variant="outline"
              onClick={addContributor}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Contributor
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-end">
        <Button 
          type="submit" 
          disabled={loading || !isValidTotal}
          size="lg"
          className="bg-brand-red hover:bg-brand-red-glow"
        >
          {loading ? "Saving..." : initialData?.id ? "Update Split Sheet" : "Create Split Sheet"}
        </Button>
      </div>
    </form>
  );
}
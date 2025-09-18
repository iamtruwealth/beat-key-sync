import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, FileText, Download, Send, Edit, Trash2, Search, Filter } from "lucide-react";
import { SplitSheetForm } from "@/components/paperwork/SplitSheetForm";
import { SplitSheetPreview } from "@/components/paperwork/SplitSheetPreview";
import { PaperworkDashboard } from "@/components/paperwork/PaperworkDashboard";

export default function Paperwork() {
  const [activeTab, setActiveTab] = useState("create");
  const [splitSheets, setSplitSheets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentSplitSheet, setCurrentSplitSheet] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    loadSplitSheets();
  }, []);

  const loadSplitSheets = async () => {
    try {
      const { data, error } = await supabase
        .from('split_sheets')
        .select(`
          *,
          split_sheet_contributors (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSplitSheets(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading split sheets",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleSplitSheetSaved = (splitSheet: any) => {
    setCurrentSplitSheet(splitSheet);
    setActiveTab("preview");
    loadSplitSheets();
    toast({
      title: "Split sheet saved",
      description: "Your split sheet has been created successfully"
    });
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          Finalize Your Song Rights
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl">
          Generate, sign, and securely store professional split sheets so artists and producers get paid fairly.
        </p>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Split Sheet
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Preview & Sign
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Manage Documents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Create New Split Sheet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SplitSheetForm onSave={handleSplitSheetSaved} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview">
          {currentSplitSheet ? (
            <SplitSheetPreview 
              splitSheet={currentSplitSheet} 
              onUpdate={loadSplitSheets}
            />
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Split Sheet Selected</h3>
                <p className="text-muted-foreground mb-4">
                  Create a new split sheet or select one from your documents to preview.
                </p>
                <Button onClick={() => setActiveTab("create")}>
                  Create Split Sheet
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="manage">
          <PaperworkDashboard 
            splitSheets={splitSheets}
            onRefresh={loadSplitSheets}
            onEdit={(splitSheet) => {
              setCurrentSplitSheet(splitSheet);
              setActiveTab("preview");
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
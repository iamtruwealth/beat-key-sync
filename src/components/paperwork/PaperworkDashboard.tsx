import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Search, 
  Filter, 
  Download, 
  Send, 
  Edit, 
  Trash2, 
  Eye,
  FileText,
  Clock,
  CheckCircle,
  Users
} from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PaperworkDashboardProps {
  splitSheets: any[];
  onRefresh: () => void;
  onEdit: (splitSheet: any) => void;
}

export function PaperworkDashboard({ splitSheets, onRefresh, onEdit }: PaperworkDashboardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'pending_signatures': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Clock className="w-4 h-4" />;
      case 'pending_signatures': return <Users className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const filteredSplitSheets = splitSheets.filter(sheet => {
    const matchesSearch = sheet.song_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sheet.artist_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sheet.producer_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || sheet.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('split_sheets')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Split sheet deleted",
        description: "The split sheet has been permanently deleted"
      });
      
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error deleting split sheet",
        description: error.message,
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const handleDownload = (splitSheet: any) => {
    // PDF generation would go here
    toast({
      title: "PDF Download",
      description: "PDF generation feature coming soon!"
    });
  };

  const handleSend = (splitSheet: any) => {
    toast({
      title: "Send to Collaborators",
      description: "Email invitation feature coming soon!"
    });
  };

  const getSignatureProgress = (splitSheet: any) => {
    if (!splitSheet.split_sheet_contributors) return { signed: 0, total: 0 };
    
    const total = splitSheet.split_sheet_contributors.length;
    const signed = splitSheet.split_sheet_contributors.filter((c: any) => c.signed_at).length;
    
    return { signed, total };
  };

  return (
    <div className="space-y-6">
      {/* Header and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Split Sheet Dashboard</h2>
          <p className="text-muted-foreground">
            Manage your split sheets and track signature progress
          </p>
        </div>
        
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search split sheets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-64"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-md bg-background"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="pending_signatures">Pending Signatures</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Split Sheets Grid */}
      {filteredSplitSheets.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {searchTerm || statusFilter !== "all" ? "No matching split sheets" : "No split sheets yet"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== "all" 
                ? "Try adjusting your search or filters" 
                : "Create your first split sheet to get started"
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSplitSheets.map((splitSheet) => {
            const { signed, total } = getSignatureProgress(splitSheet);
            
            return (
              <Card key={splitSheet.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">
                        {splitSheet.song_title}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {splitSheet.artist_name} × {splitSheet.producer_name}
                      </p>
                    </div>
                    <Badge className={getStatusColor(splitSheet.status)}>
                      {getStatusIcon(splitSheet.status)}
                      <span className="ml-1 capitalize">
                        {splitSheet.status.replace('_', ' ')}
                      </span>
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Created:</span>
                      <div>{format(new Date(splitSheet.created_at), 'MMM d, yyyy')}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Signatures:</span>
                      <div>{signed}/{total} completed</div>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Progress</span>
                      <span>{Math.round((signed / total) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-brand-red h-2 rounded-full transition-all"
                        style={{ width: `${(signed / total) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <TooltipProvider>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEdit(splitSheet)}
                        className="flex-1"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(splitSheet)}
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Download PDF (View to generate)</p>
                        </TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSend(splitSheet)}
                          >
                            <Send className="w-3 h-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Email PDF (View to send)</p>
                        </TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Split Sheet</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{splitSheet.song_title}"? 
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(splitSheet.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete split sheet</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
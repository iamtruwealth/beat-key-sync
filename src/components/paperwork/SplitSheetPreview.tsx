import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Download, Send, FileText, Pen } from "lucide-react";
import { SignatureCapture } from "./SignatureCapture";
import { format } from "date-fns";

interface SplitSheetPreviewProps {
  splitSheet: any;
  onUpdate: () => void;
}

export function SplitSheetPreview({ splitSheet, onUpdate }: SplitSheetPreviewProps) {
  const [showSignature, setShowSignature] = useState(false);
  const [selectedContributor, setSelectedContributor] = useState<any>(null);
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

  const handleSign = (contributor: any) => {
    setSelectedContributor(contributor);
    setShowSignature(true);
  };

  const handleSignatureComplete = async (signatureData: string, signatureType: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('split_sheet_contributors')
        .update({
          signature_data: signatureData,
          signature_type: signatureType,
          signed_at: new Date().toISOString()
        })
        .eq('id', selectedContributor.id);

      if (error) throw error;

      // Update status if all contributors have signed
      const allSigned = splitSheet.split_sheet_contributors.every((c: any) => 
        c.id === selectedContributor.id || c.signed_at
      );

      if (allSigned) {
        await supabase
          .from('split_sheets')
          .update({ status: 'completed' })
          .eq('id', splitSheet.id);
      } else {
        await supabase
          .from('split_sheets')
          .update({ status: 'pending_signatures' })
          .eq('id', splitSheet.id);
      }

      toast({
        title: "Signature saved",
        description: "The split sheet has been signed successfully"
      });
      
      onUpdate();
      setShowSignature(false);
      setSelectedContributor(null);
    } catch (error: any) {
      toast({
        title: "Error saving signature",
        description: error.message,
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const handleDownloadPDF = () => {
    // This would generate and download a PDF - for now just show a toast
    toast({
      title: "PDF Download",
      description: "PDF generation feature coming soon!"
    });
  };

  const handleSendToCollaborators = () => {
    toast({
      title: "Send to Collaborators",
      description: "Email invitation feature coming soon!"
    });
  };

  const unsignedContributors = splitSheet.split_sheet_contributors?.filter((c: any) => !c.signed_at) || [];
  const signedContributors = splitSheet.split_sheet_contributors?.filter((c: any) => c.signed_at) || [];

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{splitSheet.song_title}</h2>
          <div className="flex items-center gap-2 mt-2">
            <Badge className={getStatusColor(splitSheet.status)}>
              {splitSheet.status.replace('_', ' ').toUpperCase()}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Created {format(new Date(splitSheet.created_at), 'PPP')}
            </span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadPDF}>
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
          <Button variant="outline" onClick={handleSendToCollaborators}>
            <Send className="w-4 h-4 mr-2" />
            Send to Collaborators
          </Button>
        </div>
      </div>

      {/* Split Sheet Document Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-center">
            SPLIT SHEET AGREEMENT
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Song Details */}
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold">"{splitSheet.song_title}"</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <strong>Artist:</strong> {splitSheet.artist_name}
              </div>
              <div>
                <strong>Producer:</strong> {splitSheet.producer_name}
              </div>
              <div>
                <strong>Date:</strong> {format(new Date(splitSheet.date_of_agreement), 'PP')}
              </div>
            </div>
          </div>

          <Separator />

          {/* Contributors Table */}
          <div>
            <h4 className="font-semibold mb-4">OWNERSHIP SPLIT</h4>
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-4 gap-4 p-3 bg-muted font-medium">
                <div>Name</div>
                <div>Role</div>
                <div>Ownership %</div>
                <div>Status</div>
              </div>
              {splitSheet.split_sheet_contributors?.map((contributor: any, index: number) => (
                <div key={contributor.id} className="grid grid-cols-4 gap-4 p-3 border-t">
                  <div>{contributor.name}</div>
                  <div>{contributor.role}</div>
                  <div>{contributor.ownership_percentage}%</div>
                  <div>
                    {contributor.signed_at ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        Signed
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSign(contributor)}
                        className="h-6 px-2 text-xs"
                      >
                        <Pen className="w-3 h-3 mr-1" />
                        Sign
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Signature Section */}
          {signedContributors.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-4">SIGNATURES</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {signedContributors.map((contributor: any) => (
                    <div key={contributor.id} className="border rounded p-3">
                      <div className="font-medium">{contributor.name}</div>
                      <div className="text-sm text-muted-foreground mb-2">{contributor.role}</div>
                      {contributor.signature_data && (
                        <div className="border-t pt-2">
                          <img 
                            src={contributor.signature_data} 
                            alt="Signature" 
                            className="max-h-16 object-contain"
                          />
                          <div className="text-xs text-muted-foreground">
                            Signed: {format(new Date(contributor.signed_at), 'PPp')}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Legal Text */}
          <Separator />
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              This agreement confirms the ownership split for the composition "{splitSheet.song_title}" 
              as agreed upon by all parties listed above. Each party acknowledges their respective 
              percentage of ownership and agrees to the terms of this split sheet.
            </p>
            <p>
              This document serves as a legal agreement between all parties and should be kept 
              for record-keeping and royalty distribution purposes.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Signature Modal */}
      {showSignature && selectedContributor && (
        <SignatureCapture
          contributor={selectedContributor}
          onComplete={handleSignatureComplete}
          onCancel={() => {
            setShowSignature(false);
            setSelectedContributor(null);
          }}
          loading={loading}
        />
      )}
    </div>
  );
}
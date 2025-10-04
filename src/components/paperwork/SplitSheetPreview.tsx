import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Download, Send, FileText, Pen, Mail, Loader2 } from "lucide-react";
import { SignatureCapture } from "./SignatureCapture";
import { format } from "date-fns";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface SplitSheetPreviewProps {
  splitSheet: any;
  onUpdate: () => void;
}

export function SplitSheetPreview({ splitSheet, onUpdate }: SplitSheetPreviewProps) {
  const [showSignature, setShowSignature] = useState(false);
  const [selectedContributor, setSelectedContributor] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const documentRef = useRef<HTMLDivElement>(null);
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

  const generatePDF = async (): Promise<string> => {
    if (!documentRef.current) {
      throw new Error("Document reference not found");
    }

    // Capture the document as an image
    const canvas = await html2canvas(documentRef.current, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    
    return pdf.output('datauristring');
  };

  const handleDownloadPDF = async () => {
    try {
      setLoading(true);
      const pdfDataUri = await generatePDF();
      
      // Convert data URI to blob and download
      const blob = await (await fetch(pdfDataUri)).blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${splitSheet.song_title.replace(/[^a-z0-9]/gi, '_')}_split_sheet.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "PDF Downloaded",
        description: "Split sheet PDF has been downloaded successfully"
      });
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendToCollaborators = () => {
    // Pre-fill with contributor emails
    const emails = splitSheet.split_sheet_contributors
      ?.map((c: any) => c.contact_info)
      .filter((email: string) => email && email.includes('@'))
      .join(', ');
    
    setEmailRecipients(emails || '');
    setShowEmailDialog(true);
  };

  const handleSendEmail = async () => {
    try {
      setSendingEmail(true);
      
      // Validate email addresses
      const emails = emailRecipients
        .split(',')
        .map(e => e.trim())
        .filter(e => e.includes('@'));
      
      if (emails.length === 0) {
        throw new Error("Please enter at least one valid email address");
      }

      // Generate PDF
      const pdfDataUri = await generatePDF();
      const pdfBase64 = pdfDataUri.split(',')[1]; // Remove data URI prefix

      // Call edge function to send email
      const { data, error } = await supabase.functions.invoke('email-splitsheet', {
        body: {
          splitSheetId: splitSheet.id,
          recipients: emails,
          pdfData: pdfBase64
        }
      });

      if (error) throw error;

      toast({
        title: "Emails Sent",
        description: `Split sheet sent to ${data.sent} recipient(s)`
      });

      setShowEmailDialog(false);
      setEmailRecipients('');
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send email",
        variant: "destructive"
      });
    } finally {
      setSendingEmail(false);
    }
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
          <Button 
            variant="outline" 
            onClick={handleDownloadPDF}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Download PDF
          </Button>
          <Button variant="outline" onClick={handleSendToCollaborators}>
            <Mail className="w-4 h-4 mr-2" />
            Email PDF
          </Button>
        </div>
      </div>

      {/* Split Sheet Document Preview */}
      <Card ref={documentRef}>
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

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email Split Sheet PDF</DialogTitle>
            <DialogDescription>
              Enter the email addresses of the recipients (separated by commas)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="email-recipients">Email Recipients</Label>
              <Input
                id="email-recipients"
                placeholder="email1@example.com, email2@example.com"
                value={emailRecipients}
                onChange={(e) => setEmailRecipients(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Separate multiple emails with commas
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowEmailDialog(false)}
              disabled={sendingEmail}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSendEmail}
              disabled={sendingEmail || !emailRecipients.trim()}
            >
              {sendingEmail ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
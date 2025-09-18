import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pen, Type, Upload, RotateCcw, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SignatureCaptureProps {
  contributor: any;
  onComplete: (signatureData: string, signatureType: string) => void;
  onCancel: () => void;
  loading: boolean;
}

export function SignatureCapture({ contributor, onComplete, onCancel, loading }: SignatureCaptureProps) {
  const [activeTab, setActiveTab] = useState("draw");
  const [typedSignature, setTypedSignature] = useState("");
  const [uploadedSignature, setUploadedSignature] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const { toast } = useToast();

  // Drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.beginPath();
      }
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) { // 1MB limit
      toast({
        title: "File too large",
        description: "Please choose an image under 1MB",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedSignature(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const generateTypedSignature = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000';
      ctx.font = '32px "Brush Script MT", cursive';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(typedSignature, canvas.width / 2, canvas.height / 2);
    }
    
    return canvas.toDataURL();
  };

  const handleComplete = () => {
    let signatureData = "";
    let signatureType = "";

    switch (activeTab) {
      case "draw":
        const canvas = canvasRef.current;
        if (!canvas) {
          toast({
            title: "Please draw your signature",
            variant: "destructive"
          });
          return;
        }
        signatureData = canvas.toDataURL();
        signatureType = "drawn";
        break;
      
      case "type":
        if (!typedSignature.trim()) {
          toast({
            title: "Please enter your signature",
            variant: "destructive"
          });
          return;
        }
        signatureData = generateTypedSignature();
        signatureType = "typed";
        break;
      
      case "upload":
        if (!uploadedSignature) {
          toast({
            title: "Please upload a signature image",
            variant: "destructive"
          });
          return;
        }
        signatureData = uploadedSignature;
        signatureType = "uploaded";
        break;
    }

    onComplete(signatureData, signatureType);
  };

  return (
    <Dialog open={true} onOpenChange={() => !loading && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sign Split Sheet</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Please provide your digital signature for <strong>{contributor.name}</strong>
          </p>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="draw" className="flex items-center gap-2">
              <Pen className="w-4 h-4" />
              Draw
            </TabsTrigger>
            <TabsTrigger value="type" className="flex items-center gap-2">
              <Type className="w-4 h-4" />
              Type
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="draw">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Draw Your Signature</CardTitle>
                    <Button variant="outline" size="sm" onClick={clearCanvas}>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Clear
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <canvas
                    ref={canvasRef}
                    width={500}
                    height={150}
                    className="border rounded w-full cursor-crosshair bg-white"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Use your mouse or trackpad to draw your signature above
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="type">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Type Your Signature</CardTitle>
                </CardHeader>
                <CardContent>
                  <Label htmlFor="typed-signature">Enter your name</Label>
                  <Input
                    id="typed-signature"
                    value={typedSignature}
                    onChange={(e) => setTypedSignature(e.target.value)}
                    placeholder="Type your full name"
                    className="mt-2"
                  />
                  {typedSignature && (
                    <div className="mt-4 p-4 border rounded bg-white">
                      <p className="text-sm text-muted-foreground mb-2">Preview:</p>
                      <div 
                        style={{ 
                          fontFamily: '"Brush Script MT", cursive',
                          fontSize: '32px',
                          textAlign: 'center',
                          padding: '10px'
                        }}
                      >
                        {typedSignature}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="upload">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Upload Signature Image</CardTitle>
                </CardHeader>
                <CardContent>
                  <Label htmlFor="signature-upload">Choose signature file</Label>
                  <Input
                    id="signature-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="mt-2"
                  />
                  {uploadedSignature && (
                    <div className="mt-4 p-4 border rounded bg-white">
                      <p className="text-sm text-muted-foreground mb-2">Preview:</p>
                      <img 
                        src={uploadedSignature} 
                        alt="Uploaded signature" 
                        className="max-h-24 object-contain mx-auto"
                      />
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground mt-2">
                    Upload a clear image of your signature (PNG, JPG, max 1MB)
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button 
            onClick={handleComplete} 
            disabled={loading}
            className="bg-brand-red hover:bg-brand-red-glow"
          >
            <Check className="w-4 h-4 mr-2" />
            {loading ? "Saving..." : "Complete Signature"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
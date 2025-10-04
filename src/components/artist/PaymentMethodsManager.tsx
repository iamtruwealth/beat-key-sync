import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, CheckCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";

const paypalSchema = z.object({
  email: z.string().email("Invalid PayPal email address").max(255)
});

const bankTransferSchema = z.object({
  accountName: z.string().trim().min(1, "Account name is required").max(200),
  accountNumber: z.string().trim().min(1, "Account number is required").max(50),
  bankName: z.string().trim().min(1, "Bank name is required").max(200),
  routingNumber: z.string().trim().min(1, "Routing number is required").max(20)
});

const cashAppVenmoZelleSchema = z.object({
  handle: z.string().trim().min(1, "Handle/username is required").max(100)
});

const stripeSchema = z.object({
  email: z.string().email("Invalid Stripe email address").max(255)
});

export function PaymentMethodsManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState("");
  const [formData, setFormData] = useState<any>({});
  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('artist_payment_methods')
        .select('*')
        .eq('artist_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPaymentMethods(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load payment methods",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    setErrors({});
    
    try {
      switch (selectedMethod) {
        case 'paypal':
          paypalSchema.parse(formData);
          break;
        case 'bank_transfer':
          bankTransferSchema.parse(formData);
          break;
        case 'cashapp':
        case 'venmo':
        case 'zelle':
          cashAppVenmoZelleSchema.parse(formData);
          break;
        case 'stripe':
          stripeSchema.parse(formData);
          break;
        default:
          throw new Error("Please select a payment method");
      }
      return true;
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const fieldErrors: any = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0]] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      }
      return false;
    }
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('artist_payment_methods')
        .insert({
          artist_id: user.id,
          payment_method: selectedMethod,
          account_details: formData,
          is_primary: paymentMethods.length === 0
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Payment method added successfully"
      });

      setDialogOpen(false);
      setFormData({});
      setSelectedMethod("");
      loadPaymentMethods();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('artist_payment_methods')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Payment method removed"
      });

      loadPaymentMethods();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const setPrimary = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Remove primary from all methods
      await supabase
        .from('artist_payment_methods')
        .update({ is_primary: false })
        .eq('artist_id', user.id);

      // Set new primary
      const { error } = await supabase
        .from('artist_payment_methods')
        .update({ is_primary: true })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Primary payment method updated"
      });

      loadPaymentMethods();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const renderFormFields = () => {
    switch (selectedMethod) {
      case 'paypal':
        return (
          <div className="space-y-2">
            <Label htmlFor="email">PayPal Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email || ""}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="your@email.com"
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>
        );
      
      case 'bank_transfer':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accountName">Account Name</Label>
              <Input
                id="accountName"
                value={formData.accountName || ""}
                onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
              />
              {errors.accountName && <p className="text-sm text-destructive">{errors.accountName}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountNumber">Account Number</Label>
              <Input
                id="accountNumber"
                value={formData.accountNumber || ""}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
              />
              {errors.accountNumber && <p className="text-sm text-destructive">{errors.accountNumber}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankName">Bank Name</Label>
              <Input
                id="bankName"
                value={formData.bankName || ""}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              />
              {errors.bankName && <p className="text-sm text-destructive">{errors.bankName}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="routingNumber">Routing Number</Label>
              <Input
                id="routingNumber"
                value={formData.routingNumber || ""}
                onChange={(e) => setFormData({ ...formData, routingNumber: e.target.value })}
              />
              {errors.routingNumber && <p className="text-sm text-destructive">{errors.routingNumber}</p>}
            </div>
          </div>
        );
      
      case 'cashapp':
      case 'venmo':
      case 'zelle':
        return (
          <div className="space-y-2">
            <Label htmlFor="handle">
              {selectedMethod === 'cashapp' ? 'Cash App' : selectedMethod === 'venmo' ? 'Venmo' : 'Zelle'} Handle
            </Label>
            <Input
              id="handle"
              value={formData.handle || ""}
              onChange={(e) => setFormData({ ...formData, handle: e.target.value })}
              placeholder="$username or username"
            />
            {errors.handle && <p className="text-sm text-destructive">{errors.handle}</p>}
          </div>
        );
      
      case 'stripe':
        return (
          <div className="space-y-2">
            <Label htmlFor="email">Stripe Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email || ""}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="your@email.com"
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>
        );
      
      default:
        return null;
    }
  };

  const getMethodLabel = (method: string) => {
    const labels: any = {
      paypal: 'PayPal',
      bank_transfer: 'Bank Transfer',
      stripe: 'Stripe',
      cashapp: 'Cash App',
      venmo: 'Venmo',
      zelle: 'Zelle'
    };
    return labels[method] || method;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Methods</CardTitle>
        <CardDescription>Manage how you receive payouts from subscriptions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {paymentMethods.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No payment methods added yet</p>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Payment Method
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Payment Method</DialogTitle>
                  <DialogDescription>
                    Add a payment method to receive your earnings
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <Select value={selectedMethod} onValueChange={setSelectedMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paypal">PayPal</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="stripe">Stripe</SelectItem>
                        <SelectItem value="cashapp">Cash App</SelectItem>
                        <SelectItem value="venmo">Venmo</SelectItem>
                        <SelectItem value="zelle">Zelle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {selectedMethod && renderFormFields()}
                  
                  <Button onClick={handleSave} disabled={saving || !selectedMethod} className="w-full">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save Payment Method
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <div 
                  key={method.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      {method.is_primary ? (
                        <CheckCircle className="w-5 h-5 text-primary" />
                      ) : (
                        <span className="text-lg">{getMethodLabel(method.payment_method).charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{getMethodLabel(method.payment_method)}</p>
                        {method.is_primary && (
                          <Badge variant="default" className="text-xs">Primary</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {method.payment_method === 'bank_transfer' 
                          ? `***${method.account_details.accountNumber?.slice(-4)}`
                          : method.account_details.email || method.account_details.handle}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!method.is_primary && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPrimary(method.id)}
                      >
                        Set Primary
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(method.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Another Method
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Payment Method</DialogTitle>
                  <DialogDescription>
                    Add a payment method to receive your earnings
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <Select value={selectedMethod} onValueChange={setSelectedMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paypal">PayPal</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="stripe">Stripe</SelectItem>
                        <SelectItem value="cashapp">Cash App</SelectItem>
                        <SelectItem value="venmo">Venmo</SelectItem>
                        <SelectItem value="zelle">Zelle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {selectedMethod && renderFormFields()}
                  
                  <Button onClick={handleSave} disabled={saving || !selectedMethod} className="w-full">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save Payment Method
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </CardContent>
    </Card>
  );
}
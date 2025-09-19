import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DollarSign, CreditCard, Clock, CheckCircle, XCircle } from 'lucide-react';

interface PayoutRequest {
  id: string;
  amount_cents: number;
  payout_method: string;
  status: string;
  created_at: string;
  processed_at?: string;
}

export function PayoutRequestForm() {
  const [availableBalance, setAvailableBalance] = useState(0);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    payoutMethod: '',
    paypalEmail: '',
    venmoUsername: '',
    cashappUsername: '',
  });

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch available balance
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('available_balance_cents')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      setAvailableBalance(profile?.available_balance_cents || 0);

      // Fetch payout requests
      const { data: requests, error: requestsError } = await supabase
        .from('payout_requests')
        .select('*')
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;
      setPayoutRequests(requests || []);
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast.error('Failed to load payout data');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.amount || !formData.payoutMethod) {
      toast.error('Please fill in all required fields');
      return;
    }

    const amountCents = Math.round(parseFloat(formData.amount) * 100);
    
    if (amountCents < 1000) { // Minimum $10
      toast.error('Minimum payout amount is $10.00');
      return;
    }

    if (amountCents > availableBalance) {
      toast.error('Insufficient balance for this payout');
      return;
    }

    setIsSubmitting(true);

    try {
      let payoutDetails: any = { method: formData.payoutMethod };

      switch (formData.payoutMethod) {
        case 'paypal':
          if (!formData.paypalEmail) {
            toast.error('PayPal email is required');
            return;
          }
          payoutDetails.email = formData.paypalEmail;
          break;
        case 'venmo':
          if (!formData.venmoUsername) {
            toast.error('Venmo username is required');
            return;
          }
          payoutDetails.username = formData.venmoUsername;
          break;
        case 'cashapp':
          if (!formData.cashappUsername) {
            toast.error('Cash App username is required');
            return;
          }
          payoutDetails.username = formData.cashappUsername;
          break;
        case 'stripe':
          // Stripe payouts are automatic
          break;
        default:
          toast.error('Invalid payout method');
          return;
      }

      const { data, error } = await supabase.functions.invoke('request-payout', {
        body: {
          amountCents,
          payoutMethod: formData.payoutMethod,
          payoutDetails,
        }
      });

      if (error) throw error;

      toast.success('Payout request submitted successfully!');
      
      // Reset form
      setFormData({
        amount: '',
        payoutMethod: '',
        paypalEmail: '',
        venmoUsername: '',
        cashappUsername: '',
      });

      // Refresh data
      fetchUserData();
    } catch (error) {
      console.error('Payout request error:', error);
      toast.error('Failed to submit payout request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'processing':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Processing</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Request Payout Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Request Payout
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Available balance: <span className="font-medium">${formatCurrency(availableBalance)}</span>
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount">Amount (USD) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="10.00"
                  max={formatCurrency(availableBalance)}
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="10.00"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum: $10.00 | Maximum: ${formatCurrency(availableBalance)}
                </p>
              </div>

              <div>
                <Label htmlFor="payoutMethod">Payout Method *</Label>
                <Select 
                  value={formData.payoutMethod} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, payoutMethod: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stripe">Stripe (Instant)</SelectItem>
                    <SelectItem value="paypal">PayPal (1-2 days)</SelectItem>
                    <SelectItem value="venmo">Venmo (1-2 days)</SelectItem>
                    <SelectItem value="cashapp">Cash App (1-2 days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Method-specific fields */}
            {formData.payoutMethod === 'paypal' && (
              <div>
                <Label htmlFor="paypalEmail">PayPal Email *</Label>
                <Input
                  id="paypalEmail"
                  type="email"
                  value={formData.paypalEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, paypalEmail: e.target.value }))}
                  placeholder="your@email.com"
                  required
                />
              </div>
            )}

            {formData.payoutMethod === 'venmo' && (
              <div>
                <Label htmlFor="venmoUsername">Venmo Username *</Label>
                <Input
                  id="venmoUsername"
                  value={formData.venmoUsername}
                  onChange={(e) => setFormData(prev => ({ ...prev, venmoUsername: e.target.value }))}
                  placeholder="@username"
                  required
                />
              </div>
            )}

            {formData.payoutMethod === 'cashapp' && (
              <div>
                <Label htmlFor="cashappUsername">Cash App Username *</Label>
                <Input
                  id="cashappUsername"
                  value={formData.cashappUsername}
                  onChange={(e) => setFormData(prev => ({ ...prev, cashappUsername: e.target.value }))}
                  placeholder="$username"
                  required
                />
              </div>
            )}

            {formData.payoutMethod === 'stripe' && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <CreditCard className="h-4 w-4 inline mr-1" />
                  Stripe payouts are processed instantly to your connected bank account.
                </p>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting || availableBalance < 1000}
            >
              {isSubmitting ? 'Submitting...' : 'Request Payout'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
        </CardHeader>
        <CardContent>
          {payoutRequests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No payout requests yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Processed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payoutRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      ${formatCurrency(request.amount_cents)}
                    </TableCell>
                    <TableCell className="capitalize">{request.payout_method}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>{formatDate(request.created_at)}</TableCell>
                    <TableCell>
                      {request.processed_at ? formatDate(request.processed_at) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
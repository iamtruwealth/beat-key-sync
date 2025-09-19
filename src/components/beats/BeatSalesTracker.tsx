import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, TrendingUp, Download, Calendar } from 'lucide-react';

type BeatSale = Tables<'beat_sales'> & {
  beats?: {
    title: string;
    description: string | null;
  };
};

export function BeatSalesTracker() {
  const [sales, setSales] = useState<BeatSale[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchSalesData();
  }, []);

  const fetchSalesData = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: salesData, error } = await supabase
        .from('beat_sales')
        .select(`
          *,
          beats!inner(title, description)
        `)
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSales(salesData || []);
      
      // Calculate total earnings
      const total = salesData?.reduce((sum, sale) => sum + sale.amount_received, 0) || 0;
      setTotalEarnings(total);
    } catch (error) {
      console.error('Error fetching sales data:', error);
      toast({
        title: "Error",
        description: "Failed to load sales data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD'
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Beat Sales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading sales data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Earnings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-primary/10 rounded-full">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Earnings</p>
                <p className="text-2xl font-bold">{formatCurrency(totalEarnings)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-500/10 rounded-full">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-bold">{sales.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-500/10 rounded-full">
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold">
                  {sales.filter(sale => {
                    const saleDate = new Date(sale.created_at);
                    const now = new Date();
                    return saleDate.getMonth() === now.getMonth() && 
                           saleDate.getFullYear() === now.getFullYear();
                  }).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Recent Sales
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No sales yet</h3>
              <p className="mb-4">When customers purchase your beats, they'll appear here.</p>
              <Button onClick={fetchSalesData} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {sales.map((sale) => (
                <div 
                  key={sale.id} 
                  className="flex items-center justify-between p-4 border rounded-lg bg-card"
                >
                  <div className="flex-1">
                    <h4 className="font-medium">{sale.beats?.title || 'Unknown Beat'}</h4>
                    <p className="text-sm text-muted-foreground">
                      Sold to: {sale.buyer_email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(sale.created_at)}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-semibold text-green-600">
                      {formatCurrency(sale.amount_received)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Fee: {formatCurrency(sale.platform_fee)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
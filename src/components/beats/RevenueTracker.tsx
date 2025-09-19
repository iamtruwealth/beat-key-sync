import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, TrendingUp, Download, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface Sale {
  id: string;
  amount_received: number;
  platform_fee: number;
  buyer_email: string;
  created_at: string;
  beats: {
    title: string;
  } | null;
}

interface RevenueStats {
  totalEarnings: number;
  availableBalance: number;
  totalSales: number;
  thisMonthEarnings: number;
}

export function RevenueTracker() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [stats, setStats] = useState<RevenueStats>({
    totalEarnings: 0,
    availableBalance: 0,
    totalSales: 0,
    thisMonthEarnings: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRevenueData();
  }, []);

  const fetchRevenueData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch recent sales
      const { data: salesData, error: salesError } = await supabase
        .from('beat_sales')
        .select(`
          id,
          amount_received,
          platform_fee,
          buyer_email,
          created_at,
          beats(title)
        `)
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (salesError) throw salesError;

      setSales((salesData || []).map(sale => ({
        ...sale,
        beats: Array.isArray(sale.beats) && sale.beats.length > 0 ? sale.beats[0] : null
      })));

      // Fetch profile stats
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('total_earnings_cents, available_balance_cents')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      // Calculate this month's earnings
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);

      const { data: monthlyData, error: monthlyError } = await supabase
        .from('beat_sales')
        .select('amount_received, platform_fee')
        .eq('producer_id', user.id)
        .gte('created_at', thisMonth.toISOString());

      if (monthlyError) throw monthlyError;

      const thisMonthEarnings = monthlyData?.reduce((sum, sale) => 
        sum + (sale.amount_received - sale.platform_fee), 0) || 0;

      setStats({
        totalEarnings: profile?.total_earnings_cents || 0,
        availableBalance: profile?.available_balance_cents || 0,
        totalSales: salesData?.length || 0,
        thisMonthEarnings,
      });
    } catch (error) {
      console.error('Error fetching revenue data:', error);
      toast.error('Failed to load revenue data');
    } finally {
      setLoading(false);
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
    });
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-6 bg-muted rounded mb-2"></div>
              <div className="h-8 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Revenue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Earnings</p>
                <p className="text-2xl font-bold">${formatCurrency(stats.totalEarnings)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Available Balance</p>
                <p className="text-2xl font-bold">${formatCurrency(stats.availableBalance)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold">${formatCurrency(stats.thisMonthEarnings)}</p>
              </div>
              <Calendar className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-bold">{stats.totalSales}</p>
              </div>
              <Download className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sales</CardTitle>
        </CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No sales yet. Upload some beats to get started!
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Beat</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Platform Fee</TableHead>
                  <TableHead>Your Earnings</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">
                      {sale.beats?.title || 'Unknown Beat'}
                    </TableCell>
                    <TableCell>{sale.buyer_email}</TableCell>
                    <TableCell>${formatCurrency(sale.amount_received)}</TableCell>
                    <TableCell className="text-red-600">
                      -${formatCurrency(sale.platform_fee)}
                    </TableCell>
                    <TableCell className="text-green-600 font-medium">
                      ${formatCurrency(sale.amount_received - sale.platform_fee)}
                    </TableCell>
                    <TableCell>{formatDate(sale.created_at)}</TableCell>
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
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { GlassMorphismSection } from '@/components/futuristic/GlassMorphismSection';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Crown, DollarSign, TrendingUp, Eye, ShoppingCart, Plus, Percent } from 'lucide-react';

interface RoyaltyShare {
  id: string;
  collaboration_id: string;
  seller_id: string;
  percentage_for_sale: number;
  asking_price_cents: number;
  status: string;
  created_at: string;
  collaboration_projects: {
    name: string;
    joint_artist_name?: string;
    cover_art_url?: string;
  };
  seller_profile: {
    producer_name?: string;
    verification_status?: string;
  };
}

interface CollabProject {
  id: string;
  name: string;
  joint_artist_name?: string;
  members: Array<{
    user_id: string;
    royalty_percentage: number;
    status: string;
  }>;
}

export const RoyaltyMarketplace: React.FC = () => {
  const [shares, setShares] = useState<RoyaltyShare[]>([]);
  const [myProjects, setMyProjects] = useState<CollabProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSellDialog, setShowSellDialog] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [saleData, setSaleData] = useState({
    percentage: '',
    price: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    loadMarketplaceData();
  }, []);

  const loadMarketplaceData = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      
      // Load available royalty shares
      const { data: sharesData, error: sharesError } = await supabase
        .from('royalty_shares')
        .select(`
          *,
          collaboration_projects(name, joint_artist_name, cover_art_url),
          seller_profile:profiles!royalty_shares_seller_id_fkey(producer_name, verification_status)
        `)
        .eq('status', 'available')
        .order('created_at', { ascending: false });

      if (sharesError) throw sharesError;

      // Load user's collaboration projects
      let myProjectsData = [];
      if (user.user) {
        const { data, error: projectsError } = await supabase
          .from('collaboration_projects')
          .select(`
            id,
            name,
            joint_artist_name,
            members:collaboration_members(user_id, royalty_percentage, status)
          `)
          .eq('members.user_id', user.user.id)
          .eq('members.status', 'accepted')
          .eq('status', 'active');

        if (projectsError) throw projectsError;
        myProjectsData = data || [];
      }

      setShares(sharesData || []);
      setMyProjects(myProjectsData);
    } catch (error) {
      console.error('Error loading marketplace data:', error);
      toast({
        title: "Error",
        description: "Failed to load royalty marketplace data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createRoyaltyShare = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const percentage = parseFloat(saleData.percentage);
      const priceCents = Math.round(parseFloat(saleData.price) * 100);

      if (percentage <= 0 || percentage > 100) {
        throw new Error('Percentage must be between 0 and 100');
      }

      const { error } = await supabase
        .from('royalty_shares')
        .insert({
          collaboration_id: selectedProject,
          seller_id: user.user.id,
          percentage_for_sale: percentage,
          asking_price_cents: priceCents,
          status: 'available'
        });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Your royalty share is now listed in the marketplace"
      });

      setShowSellDialog(false);
      setSaleData({ percentage: '', price: '' });
      setSelectedProject('');
      loadMarketplaceData();
    } catch (error) {
      console.error('Error creating royalty share:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to list royalty share",
        variant: "destructive"
      });
    }
  };

  const purchaseRoyaltyShare = async (shareId: string) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('royalty_shares')
        .update({
          status: 'sold',
          buyer_id: user.user.id,
          sold_at: new Date().toISOString()
        })
        .eq('id', shareId);

      if (error) throw error;

      toast({
        title: "Purchase Successful!",
        description: "You've successfully purchased the royalty share"
      });

      loadMarketplaceData();
    } catch (error) {
      console.error('Error purchasing royalty share:', error);
      toast({
        title: "Error",
        description: "Failed to purchase royalty share",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <GlassMorphismSection>
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading royalty marketplace...</p>
        </div>
      </GlassMorphismSection>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-neon-cyan">Royalty Marketplace</h2>
          <p className="text-muted-foreground">Buy and sell royalty shares from collaboration projects</p>
        </div>
        
        {myProjects.length > 0 && (
          <Dialog open={showSellDialog} onOpenChange={setShowSellDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-neon-cyan to-electric-blue hover:from-neon-cyan/80 hover:to-electric-blue/80">
                <Plus className="w-4 h-4 mr-2" />
                Sell Royalty
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-background/95 backdrop-blur-xl border-neon-cyan/30">
              <DialogHeader>
                <DialogTitle className="text-neon-cyan">Sell Royalty Share</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Select Project</label>
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="w-full px-3 py-2 bg-background/50 border border-border/50 rounded-md focus:border-neon-cyan/50"
                  >
                    <option value="">Choose a collaboration project</option>
                    {myProjects.map(project => (
                      <option key={project.id} value={project.id}>
                        {project.name} {project.joint_artist_name && `(${project.joint_artist_name})`}
                      </option>
                    ))}
                  </select>
                </div>
                
                <Input
                  placeholder="Percentage to sell (e.g., 10)"
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.1"
                  value={saleData.percentage}
                  onChange={(e) => setSaleData({ ...saleData, percentage: e.target.value })}
                  className="border-border/50 focus:border-neon-cyan/50"
                />
                
                <Input
                  placeholder="Asking price in USD"
                  type="number"
                  min="1"
                  step="0.01"
                  value={saleData.price}
                  onChange={(e) => setSaleData({ ...saleData, price: e.target.value })}
                  className="border-border/50 focus:border-neon-cyan/50"
                />
                
                <Button 
                  onClick={createRoyaltyShare}
                  className="w-full bg-gradient-to-r from-neon-cyan to-electric-blue"
                  disabled={!selectedProject || !saleData.percentage || !saleData.price}
                >
                  List for Sale
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Marketplace Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-morphism border-neon-cyan/30">
          <CardContent className="p-4 text-center">
            <Crown className="w-8 h-8 text-neon-cyan mx-auto mb-2" />
            <p className="text-2xl font-bold text-neon-cyan">{shares.length}</p>
            <p className="text-sm text-muted-foreground">Available Shares</p>
          </CardContent>
        </Card>
        <Card className="glass-morphism border-electric-blue/30">
          <CardContent className="p-4 text-center">
            <DollarSign className="w-8 h-8 text-electric-blue mx-auto mb-2" />
            <p className="text-2xl font-bold text-electric-blue">
              ${shares.reduce((sum, share) => sum + (share.asking_price_cents / 100), 0).toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">Total Value</p>
          </CardContent>
        </Card>
        <Card className="glass-morphism border-neon-magenta/30">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-8 h-8 text-neon-magenta mx-auto mb-2" />
            <p className="text-2xl font-bold text-neon-magenta">
              {shares.length > 0 ? (shares.reduce((sum, share) => sum + share.percentage_for_sale, 0) / shares.length).toFixed(1) : 0}%
            </p>
            <p className="text-sm text-muted-foreground">Avg Share Size</p>
          </CardContent>
        </Card>
      </div>

      {/* Available Shares */}
      {shares.length === 0 ? (
        <GlassMorphismSection>
          <div className="text-center py-12">
            <Crown className="w-16 h-16 text-neon-cyan mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold text-neon-cyan mb-2">No Shares Available</h3>
            <p className="text-muted-foreground">
              Be the first to list a royalty share in the marketplace!
            </p>
          </div>
        </GlassMorphismSection>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shares.map((share) => (
            <Card key={share.id} className="glass-morphism border-border/50 hover:border-neon-cyan/50 transition-all duration-300 group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between mb-2">
                  <CardTitle className="text-lg text-neon-cyan group-hover:text-electric-blue transition-colors">
                    {share.collaboration_projects?.name}
                  </CardTitle>
                  <Badge className="bg-neon-cyan/20 text-neon-cyan">
                    {share.percentage_for_sale}%
                  </Badge>
                </div>
                {share.collaboration_projects?.joint_artist_name && (
                  <p className="text-sm text-muted-foreground">
                    as {share.collaboration_projects.joint_artist_name}
                  </p>
                )}
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Seller</p>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{share.seller_profile?.producer_name || 'Unknown'}</span>
                      {share.seller_profile?.verification_status === 'verified' && (
                        <Badge variant="outline" className="text-xs">
                          Verified
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Price</p>
                    <p className="text-xl font-bold text-neon-cyan">
                      ${(share.asking_price_cents / 100).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-center text-sm">
                  <div className="p-2 rounded-lg bg-background/20">
                    <Percent className="w-4 h-4 text-neon-cyan mx-auto mb-1" />
                    <p className="font-medium">{share.percentage_for_sale}%</p>
                    <p className="text-xs text-muted-foreground">Share</p>
                  </div>
                  <div className="p-2 rounded-lg bg-background/20">
                    <DollarSign className="w-4 h-4 text-electric-blue mx-auto mb-1" />
                    <p className="font-medium">${((share.asking_price_cents / 100) / share.percentage_for_sale * 100).toFixed(0)}</p>
                    <p className="text-xs text-muted-foreground">Per %</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-neon-cyan/30 hover:bg-neon-cyan/20"
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    Details
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => purchaseRoyaltyShare(share.id)}
                    className="flex-1 bg-neon-cyan/10 hover:bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30"
                  >
                    <ShoppingCart className="w-3 h-3 mr-1" />
                    Buy
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
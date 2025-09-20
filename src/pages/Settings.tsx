import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Settings, CreditCard, AlertTriangle, CheckCircle, XCircle, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface SubscriptionInfo {
  subscribed: boolean;
  product_id?: string;
  subscription_end?: string;
}

export default function SettingsPage() {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (error || !profile) {
        console.error("Error fetching profile:", error);
        navigate("/dashboard");
        return;
      }

      setProfile(profile);

      // Only allow producers to access settings
      if (profile.role !== "producer") {
        toast({
          title: "Access Denied",
          description: "Settings page is only available for producer accounts",
          variant: "destructive"
        });
        navigate("/dashboard");
        return;
      }

      await fetchSubscriptionStatus();
    } catch (error) {
      console.error("Error checking user role:", error);
      navigate("/dashboard");
    }
  };

  const fetchSubscriptionStatus = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('check-subscription');

      if (error) {
        console.error("Error checking subscription:", error);
        toast({
          title: "Error",
          description: "Failed to load subscription status",
          variant: "destructive"
        });
        return;
      }

      setSubscription(data);
    } catch (error) {
      console.error("Error fetching subscription:", error);
      toast({
        title: "Error",
        description: "Failed to load subscription status",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setCanceling(true);
      const { data, error } = await supabase.functions.invoke('cancel-subscription');

      if (error) {
        throw new Error(error.message || "Failed to cancel subscription");
      }

      if (data.success) {
        toast({
          title: "Subscription Canceled",
          description: "Your subscription has been canceled successfully. You'll retain access until the end of your billing period.",
        });
        
        // Refresh subscription status
        await fetchSubscriptionStatus();
      } else {
        throw new Error(data.message || "Failed to cancel subscription");
      }
    } catch (error) {
      console.error("Error canceling subscription:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel subscription",
        variant: "destructive"
      });
    } finally {
      setCanceling(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold">Producer Settings</h1>
      </div>

      <div className="grid gap-6">
        {/* Subscription Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Subscription Management
            </CardTitle>
            <CardDescription>
              Manage your producer subscription and billing preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {subscription ? (
              <>
                {/* Subscription Status */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {subscription.subscribed ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-muted-foreground" />
                    )}
                    <div>
                      <h3 className="font-semibold">
                        {subscription.subscribed ? "Active Subscription" : "No Active Subscription"}
                      </h3>
                      {subscription.subscribed && subscription.subscription_end && (
                        <p className="text-sm text-muted-foreground">
                          Active until {formatDate(subscription.subscription_end)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {subscription.subscribed ? (
                      <Badge variant="default">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                </div>

                {/* Subscription Actions */}
                {subscription.subscribed ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-orange-900 dark:text-orange-100">
                          Cancel Subscription
                        </h4>
                        <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                          Canceling your subscription will prevent automatic renewal. You'll retain access to producer features until the end of your current billing period.
                        </p>
                      </div>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={canceling}>
                          {canceling ? "Canceling..." : "Cancel Subscription"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to cancel your subscription? This action cannot be undone. 
                            You'll lose access to producer features when your current billing period ends
                            {subscription.subscription_end && ` on ${formatDate(subscription.subscription_end)}`}.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleCancelSubscription}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Yes, Cancel Subscription
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <DollarSign className="w-5 h-5 text-blue-500 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-blue-900 dark:text-blue-100">
                          Upgrade to Producer Plan
                        </h4>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                          Get access to beat upload, sales tracking, analytics, and more producer features.
                        </p>
                      </div>
                    </div>

                    <Button
                      onClick={() => navigate("/pricing")}
                      className="w-full"
                    >
                      View Pricing Plans
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Unable to load subscription information</p>
                <Button 
                  variant="outline" 
                  onClick={fetchSubscriptionStatus}
                  className="mt-2"
                >
                  Retry
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>
              View and manage your account details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Profile Settings</h3>
                <p className="text-sm text-muted-foreground">
                  Update your producer profile, logo, and preferences
                </p>
              </div>
              <Button 
                variant="outline"
                onClick={() => navigate("/account")}
              >
                Edit Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
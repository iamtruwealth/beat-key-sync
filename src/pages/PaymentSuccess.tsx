import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Download, ArrowLeft } from 'lucide-react';
import { MetaTags } from '@/components/MetaTags';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading state for user experience
    const timer = setTimeout(() => {
      setIsLoading(false);
      
      // Redirect back to original page after a short delay
      const returnUrl = localStorage.getItem('beatpackz_return_url');
      if (returnUrl) {
        localStorage.removeItem('beatpackz_return_url');
        setTimeout(() => {
          window.location.href = returnUrl;
        }, 3000); // Redirect after 3 seconds to show success message
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <MetaTags 
          title="Processing Payment | BeatPackz"
          description="Processing your payment and preparing your beats for download."
        />
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p className="text-center">Processing your payment...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <MetaTags 
        title="Payment Successful | BeatPackz"
        description="Your payment was successful! Check your email for download links."
      />
      
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <CardTitle className="text-2xl font-bold">Payment Successful!</CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              Your payment has been processed successfully.
            </p>
            
            <div className="bg-secondary/50 p-4 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Download className="h-5 w-5 text-primary" />
                <span className="font-semibold">Check Your Email</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Download links for your beats have been sent to your email address.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                You will be redirected back to where you were shopping in a few seconds...
              </p>
            </div>
            
            {sessionId && (
              <p className="text-xs text-muted-foreground mt-4">
                Transaction ID: {sessionId}
              </p>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button asChild variant="outline" className="flex-1">
              <Link to="/explore">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Continue Shopping
              </Link>
            </Button>
            
            <Button asChild className="flex-1">
              <Link to="/library">
                View Library
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
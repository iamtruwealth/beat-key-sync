import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Music, Upload, AlertCircle, User, Headphones } from "lucide-react";

type UserRole = 'artist' | 'producer';

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [artistLogo, setArtistLogo] = useState<File | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('artist');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in and redirect based on role
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // Get user profile to determine role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        
        const role = profile?.role || 'artist';
        navigate(role === 'artist' ? '/artist-dashboard' : '/producer-dashboard');
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        // Get user profile to determine role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        
        const role = profile?.role || 'artist';
        navigate(role === 'artist' ? '/artist-dashboard' : '/producer-dashboard');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please choose an image under 5MB",
          variant: "destructive"
        });
        return;
      }
      setArtistLogo(file);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!termsAccepted) {
      toast({
        title: "Terms acceptance required",
        description: "Please accept the Terms of Service to continue",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);

    try {
      let logoUrl = null;
      
      // Upload artist logo if provided
      if (artistLogo) {
        const fileExt = artistLogo.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('artwork')
          .upload(fileName, artistLogo);
          
        if (uploadError) {
          toast({
            title: "Logo upload failed",
            description: uploadError.message,
            variant: "destructive"
          });
          setLoading(false);
          return;
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('artwork')
          .getPublicUrl(fileName);
        logoUrl = publicUrl;
      }

      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            artist_logo: logoUrl,
            role: userRole
          }
        }
      });

      if (error) {
        toast({
          title: "Sign up failed",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Check your email",
          description: "We've sent you a confirmation link"
        });
      }
    } catch (error: any) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address first",
        variant: "destructive"
      });
      return;
    }

    setResetLoading(true);
    const redirectUrl = `${window.location.origin}/auth`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });

    if (error) {
      toast({
        title: "Reset failed",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Check your email",
        description: "We've sent you a password reset link"
      });
    }
    setResetLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <Music className="w-8 h-8 text-primary mr-2" />
          <h1 className="text-2xl font-bold">BeatPackz</h1>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>
              Join the all-in-one music collaboration platform for artists and producers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing In..." : "Sign In"}
                  </Button>
                  <div className="flex items-center justify-center mt-4">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleForgotPassword}
                      disabled={resetLoading}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {resetLoading ? "Sending..." : "Forgot Password?"}
                    </Button>
                  </div>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <Label htmlFor="user-role">I am a</Label>
                    <Select value={userRole} onValueChange={(value: UserRole) => setUserRole(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="artist">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Artist - Create music, manage projects, handle business
                          </div>
                        </SelectItem>
                        <SelectItem value="producer">
                          <div className="flex items-center gap-2">
                            <Headphones className="w-4 h-4" />
                            Producer - Create beats, sell beat packs, collaborate
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                  </div>
                  <div>
                    <Label htmlFor="artist-logo">{userRole === 'artist' ? 'Artist' : 'Producer'} Logo (Optional)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="artist-logo"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('artist-logo')?.click()}
                        className="w-full"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {artistLogo ? artistLogo.name : "Choose Logo"}
                      </Button>
                    </div>
                    {artistLogo && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Selected: {artistLogo.name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-start space-x-3">
                    <Checkbox 
                      id="terms" 
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                      required
                    />
                    <div className="space-y-1 leading-none">
                      <Label
                        htmlFor="terms"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        I agree to the{" "}
                        <Link 
                          to="/terms" 
                          className="text-primary hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Terms of Service
                        </Link>
                      </Label>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading || !termsAccepted}>
                    {loading ? "Creating Account..." : `Create ${userRole === 'artist' ? 'Artist' : 'Producer'} Account`}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
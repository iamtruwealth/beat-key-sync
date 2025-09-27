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
import { MetaTags } from "@/components/MetaTags";

type UserRole = 'artist' | 'producer';

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [artistLogo, setArtistLogo] = useState<File | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('artist');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [displayNameError, setDisplayNameError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in and redirect based on role or intended path
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const redirectTo = (() => { try { return sessionStorage.getItem('redirectTo'); } catch { return null; } })();
        if (redirectTo) {
          try { sessionStorage.removeItem('redirectTo'); } catch {}
          navigate(redirectTo);
          return;
        }
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        const redirectTo = (() => { try { return sessionStorage.getItem('redirectTo'); } catch { return null; } })();
        if (redirectTo) {
          try { sessionStorage.removeItem('redirectTo'); } catch {}
          navigate(redirectTo);
          return;
        }
        
        // Defer Supabase calls with setTimeout to prevent deadlock
        setTimeout(async () => {
          try {
            console.log('Auth state changed, fetching profile for user:', session.user.id);
            
            // Get user profile to determine role
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', session.user.id)
              .single();
            
            console.log('Profile fetch result:', { profile, profileError });
            
            if (profileError) {
              console.error('Error fetching profile:', profileError);
              // Default to artist dashboard if profile fetch fails
              navigate('/artist-dashboard');
              return;
            }
            
            const role = profile?.role || 'artist';
            console.log('Redirecting user to dashboard based on role:', role);
            navigate(role === 'artist' ? '/artist-dashboard' : '/producer-dashboard');
          } catch (error) {
            console.error('Error in auth state change handler:', error);
            // Default to artist dashboard if anything fails
            navigate('/artist-dashboard');
          }
        }, 0);
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

  const validateUsername = (username: string) => {
    if (!username) return "Username is required";
    if (username.length < 3) return "Username must be at least 3 characters";
    if (username.length > 30) return "Username must be less than 30 characters";
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) return "Username can only contain letters, numbers, hyphens, and underscores";
    if (username.startsWith('-') || username.endsWith('-')) return "Username cannot start or end with a hyphen";
    return "";
  };

  const validateDisplayName = (name: string) => {
    if (!name) return `${userRole === 'artist' ? 'Artist' : 'Producer'} name is required`;
    if (name.length < 2) return "Name must be at least 2 characters";
    if (name.length > 50) return "Name must be less than 50 characters";
    return "";
  };

  const checkUsernameAvailability = async (username: string) => {
    if (!username || validateUsername(username)) return;

    setIsCheckingUsername(true);
    try {
      const { data, error } = await supabase.rpc('check_username_availability', {
        username_param: username.toLowerCase()
      });

      if (error) throw error;

      if (!data) {
        setUsernameError("Username is already taken");
      } else {
        setUsernameError("");
      }
    } catch (error) {
      console.error('Error checking username:', error);
      setUsernameError("Error checking username availability");
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    const validationError = validateUsername(value);
    setUsernameError(validationError);
    
    if (!validationError && value) {
      // Debounce username check
      const timer = setTimeout(() => {
        checkUsernameAvailability(value);
      }, 500);
      return () => clearTimeout(timer);
    }
  };

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    const validationError = validateDisplayName(value);
    setDisplayNameError(validationError);
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

    if (!username || usernameError) {
      toast({
        title: "Username required",
        description: usernameError || "Please enter a valid username",
        variant: "destructive"
      });
      return;
    }

    if (!displayName || displayNameError) {
      toast({
        title: `${userRole === 'artist' ? 'Artist' : 'Producer'} name required`,
        description: displayNameError || `Please enter your ${userRole === 'artist' ? 'artist' : 'producer'} name`,
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);

    try {
      let logoUrl = null;
      
      // Upload logo first if provided
      if (artistLogo) {
        const fileExt = artistLogo.name.split('.').pop();
        const fileName = `temp/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('artwork')
          .upload(fileName, artistLogo);
          
        if (uploadError) {
          console.warn("Logo upload failed:", uploadError.message);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('artwork')
            .getPublicUrl(fileName);
          logoUrl = publicUrl;
        }
      }

      // Create account without email confirmation using edge function
      const { data, error } = await supabase.functions.invoke('signup-without-confirmation', {
        body: {
          email,
          password,
          username: username.toLowerCase(),
          role: userRole,
          producerLogoUrl: logoUrl,
          displayName: displayName
        }
      });

      if (error) {
        toast({
          title: "Sign up failed",
          description: error.message,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      if (data?.error) {
        toast({
          title: "Sign up failed",
          description: data.error,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      toast({
        title: "Account created successfully!",
        description: "Welcome to BeatPackz! Setting up your account..."
      });

      // Sign in the newly created user
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        console.error('Auto sign-in failed:', signInError);
        toast({
          title: "Account created",
          description: "Please sign in with your new credentials"
        });
      } else {
        // Redirect based on role
        if (userRole === 'producer') {
          navigate('/onboarding');
        } else {
          navigate('/artist-dashboard');
        }
        return;
      }

      // Clear form only if auto sign-in failed
      setEmail("");
      setPassword("");
      setUsername("");
      setDisplayName("");
      setArtistLogo(null);
      setTermsAccepted(false);

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

    try {
      console.log('Attempting to sign in with email:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      console.log('Sign in response:', { data, error });

      if (error) {
        console.error('Sign in error:', error);
        toast({
          title: "Sign in failed",
          description: error.message,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      console.log('Sign in successful, session:', data.session);
      
      // Don't set loading to false here - let the auth state change handle the redirect
      // The onAuthStateChange callback will handle navigation
      
    } catch (error: any) {
      console.error('Unexpected sign in error:', error);
      toast({
        title: "Sign in failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <MetaTags 
        title="Sign Up or Login | BeatPackz - Join the Music Producer Community"
        description="Create your BeatPackz account today. Artists sign up free, producers get premium features. Join thousands of music creators sharing and selling beats worldwide."
        url="https://beatpackz.com/auth"
      />
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
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => handleUsernameChange(e.target.value)}
                      placeholder="your_username"
                      required
                      className={usernameError ? "border-destructive" : ""}
                    />
                    {isCheckingUsername && (
                      <p className="text-sm text-muted-foreground mt-1">Checking availability...</p>
                    )}
                    {usernameError && (
                      <p className="text-sm text-destructive mt-1">{usernameError}</p>
                    )}
                    {username && !usernameError && !isCheckingUsername && (
                      <p className="text-sm text-green-600 mt-1">✓ Username available</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="display-name">
                      {userRole === 'artist' ? 'Artist Name' : 'Producer Name'}
                    </Label>
                    <Input
                      id="display-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => handleDisplayNameChange(e.target.value)}
                      placeholder={`Your ${userRole === 'artist' ? 'artist' : 'producer'} name`}
                      required
                      className={displayNameError ? "border-destructive" : ""}
                    />
                    {displayNameError && (
                      <p className="text-sm text-destructive mt-1">{displayNameError}</p>
                    )}
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
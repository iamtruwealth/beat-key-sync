import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Terms = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10">
      {/* Navigation */}
      <nav className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-primary">
            Beatpackz
          </Link>
          <div className="flex space-x-6">
            <Link to="/about" className="text-foreground/80 hover:text-primary transition-colors">
              About
            </Link>
            <Link to="/faq" className="text-foreground/80 hover:text-primary transition-colors">
              FAQ
            </Link>
            <Link to="/terms" className="text-foreground/80 hover:text-primary transition-colors">
              Terms
            </Link>
            <Link to="/auth">
              <Button variant="default">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-6">
          Terms of Service
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Please read our terms and conditions carefully
        </p>
      </section>

      {/* Terms Content */}
      <section className="container mx-auto px-4 pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="bg-card border rounded-lg p-8 shadow-sm">
            <div className="space-y-8">
              <div className="text-center border-b pb-6">
                <h2 className="text-3xl font-bold text-primary mb-2">
                  Beatpackz.store Terms of Service (Producer)
                </h2>
                <p className="text-muted-foreground">
                  By signing up for a Beatpackz.store account as a producer, you agree to the following Terms of Service:
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-3">1. Account Registration</h3>
                  <div className="space-y-2 text-muted-foreground">
                    <p>1.1 You must provide accurate and complete information when registering.</p>
                    <p>1.2 Free users are limited to 1 account per IP address. Pro users may create up to 3 accounts.</p>
                    <p>1.3 You are responsible for maintaining the confidentiality of your account credentials and are responsible for all activity under your account.</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-3">2. Beat Uploads & Content</h3>
                  <div className="space-y-2 text-muted-foreground">
                    <p>2.1 Producers may upload beats and create beat packs for distribution on Beatpackz.store.</p>
                    <p>2.2 Uploaded beats must not violate copyright, intellectual property rights, or contain illegal content.</p>
                    <p>2.3 You retain ownership of your beats, but by uploading, you grant Beatpackz.store a license to display and distribute your content on the platform.</p>
                    <p>2.4 Each beat upload will automatically be analyzed by AI for BPM and musical key.</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-3">3. Pricing & Platform Fees</h3>
                  <div className="space-y-2 text-muted-foreground">
                    <p>3.1 Producers may set individual prices for each beat or offer them as free downloads.</p>
                    <p>3.2 A 12% platform fee is added on top of each paid beat price and is paid by the buyer.</p>
                    <p>3.3 Free beats do not incur any platform fee.</p>
                    <p>3.4 Beat prices and free/download status can be updated at any time; paid beats automatically update corresponding Stripe products.</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-3">4. Payments & Payouts</h3>
                  <div className="space-y-2 text-muted-foreground">
                    <p>4.1 Producers may receive payouts via Stripe, PayPal, Venmo, or Cash App.</p>
                    <p>4.2 Beatpackz.store is not responsible for delays in payouts caused by third-party payment providers.</p>
                    <p>4.3 The platform automatically tracks sales, revenue, and payout requests.</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-3">5. Beat Packs & Links</h3>
                  <div className="space-y-2 text-muted-foreground">
                    <p>5.1 Producers may bundle multiple beats into beat packs.</p>
                    <p>5.2 Beat packs are shared via links that include an interactive audio player displaying pricing and free/download availability.</p>
                    <p>5.3 Beat pack links are mobile-friendly and accessible on phones, tablets, and computers.</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-3">6. Messaging & Community</h3>
                  <div className="space-y-2 text-muted-foreground">
                    <p>6.1 Producers may use the platform to message and communicate with other producers.</p>
                    <p>6.2 Harassment, spam, or illegal activity is strictly prohibited. Violation may result in account suspension or termination.</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-3">7. Prohibited Conduct</h3>
                  <div className="space-y-2 text-muted-foreground">
                    <p>7.1 You may not upload content that violates copyright or infringes on intellectual property.</p>
                    <p>7.2 You may not create multiple free accounts to circumvent platform limits.</p>
                    <p>7.3 You may not use the platform for illegal activities or fraudulent transactions.</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-3">8. Account Termination</h3>
                  <div className="space-y-2 text-muted-foreground">
                    <p>8.1 Beatpackz.store reserves the right to suspend or terminate accounts for violation of these Terms of Service, including copyright infringement, harassment, fraud, or repeated abuse of free/pro account limits.</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-3">9. Limitation of Liability</h3>
                  <div className="space-y-2 text-muted-foreground">
                    <p>9.1 Beatpackz.store is not liable for loss of earnings, sales, or data resulting from your use of the platform.</p>
                    <p>9.2 Beatpackz.store is not responsible for the actions of other users or third-party payment providers.</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-3">10. Changes to Terms</h3>
                  <div className="space-y-2 text-muted-foreground">
                    <p>10.1 Beatpackz.store reserves the right to modify or update these Terms at any time.</p>
                    <p>10.2 Users will be notified of changes via email or through the platform. Continued use after changes constitutes acceptance.</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-3">11. Governing Law</h3>
                  <div className="space-y-2 text-muted-foreground">
                    <p>11.1 These Terms are governed by and construed under the laws of Atlanta, Georgia.</p>
                    <p>11.2 Any disputes will be resolved in the appropriate courts of Atlanta, Georgia.</p>
                  </div>
                </div>

                <div className="border-t pt-6 text-center">
                  <p className="text-muted-foreground font-medium">
                    By signing up for Beatpackz.store, you acknowledge that you have read, understood, and agree to these Terms of Service.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Terms;
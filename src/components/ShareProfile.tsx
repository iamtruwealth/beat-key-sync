import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Share2, Copy, Twitter, Facebook, Instagram, Link } from 'lucide-react';

interface ShareProfileProps {
  username: string;
  producerName: string;
}

export function ShareProfile({ username, producerName }: ShareProfileProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const profileUrl = username.startsWith('producer/') 
    ? `${window.location.origin}/${username}`
    : `${window.location.origin}/${username}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast({
        title: "Link copied!",
        description: "Profile link has been copied to your clipboard."
      });
      setIsOpen(false);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy link to clipboard.",
        variant: "destructive"
      });
    }
  };

  const shareToTwitter = () => {
    const text = `Check out ${producerName}'s beats and production skills!`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(profileUrl)}`;
    window.open(url, '_blank', 'width=600,height=400');
  };

  const shareToFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}`;
    window.open(url, '_blank', 'width=600,height=400');
  };

  const shareToInstagram = () => {
    // Instagram doesn't have a direct sharing URL, so we copy the link and inform the user
    copyToClipboard();
    toast({
      title: "Link copied for Instagram",
      description: "Paste this link in your Instagram bio or story!"
    });
  };

  const useNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${producerName} - BeatPackz`,
          text: `Check out ${producerName}'s beats and production skills!`,
          url: profileUrl
        });
        setIsOpen(false);
      } catch (error) {
        // User cancelled or error occurred, fall back to copy
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="w-4 h-4 mr-2" />
          Share Profile
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="text-sm font-medium">Share {producerName}'s Profile</div>
            
            {/* Copy Link */}
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={copyToClipboard}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Link
            </Button>

            {/* Native Share (if available) */}
            {navigator.share && (
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                onClick={useNativeShare}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            )}

            <div className="border-t pt-3">
              <div className="text-xs text-muted-foreground mb-2">Share to social media</div>
              <div className="grid grid-cols-3 gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="p-2" 
                  onClick={shareToTwitter}
                >
                  <Twitter className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="p-2" 
                  onClick={shareToFacebook}
                >
                  <Facebook className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="p-2" 
                  onClick={shareToInstagram}
                >
                  <Instagram className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
              <div className="flex items-center gap-2">
                <Link className="w-3 h-3" />
                <span className="truncate">{profileUrl}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
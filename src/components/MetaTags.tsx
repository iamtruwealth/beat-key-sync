import { useEffect } from 'react';

interface MetaTagsProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
}

export const MetaTags = ({ title, description, image, url }: MetaTagsProps) => {
  useEffect(() => {
    // Update document title
    document.title = title;

    // Function to update or create meta tag
    const updateMetaTag = (property: string, content: string) => {
      let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    const updateNameMetaTag = (name: string, content: string) => {
      let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', name);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    // Update Open Graph tags
    updateMetaTag('og:title', title);
    if (description) {
      updateMetaTag('og:description', description);
      updateNameMetaTag('description', description);
    }
    if (image) {
      updateMetaTag('og:image', image);
    } else {
      const ogImg = document.querySelector('meta[property="og:image"]');
      if (ogImg) ogImg.parentNode?.removeChild(ogImg);
    }
    if (url) {
      updateMetaTag('og:url', url);
    }
    updateMetaTag('og:type', 'website');

    // Update Twitter Card tags
    updateNameMetaTag('twitter:card', 'summary_large_image');
    updateNameMetaTag('twitter:title', title);
    if (description) {
      updateNameMetaTag('twitter:description', description);
    }
    if (image) {
      updateNameMetaTag('twitter:image', image);
    } else {
      const twImg = document.querySelector('meta[name="twitter:image"]');
      if (twImg) twImg.parentNode?.removeChild(twImg);
    }

    // Cleanup function to restore original meta tags when component unmounts
    return () => {
      document.title = 'BeatPackz - Music Producer Platform';
    };
  }, [title, description, image, url]);

  return null; // This component doesn't render anything
};
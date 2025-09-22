import { ReactNode, useEffect, useRef, useState } from "react";

interface ScrollAnimationWrapperProps {
  children: ReactNode;
  animation?: "slide-up" | "slide-left" | "slide-right" | "scale-in" | "fade-in";
  delay?: number;
  className?: string;
}

export function ScrollAnimationWrapper({ 
  children, 
  animation = "slide-up", 
  delay = 0,
  className = "" 
}: ScrollAnimationWrapperProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            setIsVisible(true);
          }, delay);
        }
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
      }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      if (elementRef.current) {
        observer.unobserve(elementRef.current);
      }
    };
  }, [delay]);

  const animationClasses = {
    "slide-up": isVisible ? "animate-slide-up opacity-100" : "opacity-0 translate-y-8",
    "slide-left": isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8",
    "slide-right": isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8",
    "scale-in": isVisible ? "animate-scale-in opacity-100" : "opacity-0 scale-95",
    "fade-in": isVisible ? "opacity-100" : "opacity-0"
  };

  return (
    <div 
      ref={elementRef}
      className={`transition-all duration-700 ease-out ${animationClasses[animation]} ${className}`}
    >
      {children}
    </div>
  );
}
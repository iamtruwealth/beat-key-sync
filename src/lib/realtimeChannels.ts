/**
 * Utility to create environment-isolated channel names
 * Prevents dev environment from interfering with production
 */

const getEnvironment = (): string => {
  const hostname = window.location.hostname;
  
  // Lovable preview environments
  if (hostname.includes('lovableproject.com') || hostname.includes('localhost')) {
    return 'dev';
  }
  
  // Production (custom domains or lovable.app)
  return 'prod';
};

/**
 * Create an environment-prefixed channel name
 * This ensures dev and prod environments have separate real-time channels
 */
export const createChannelName = (baseName: string): string => {
  const env = getEnvironment();
  return `${env}-${baseName}`;
};

/**
 * Helper to get environment info for debugging
 */
export const getRealtimeEnvironment = () => {
  return {
    env: getEnvironment(),
    hostname: window.location.hostname,
  };
};

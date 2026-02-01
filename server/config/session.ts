// Session Management Configuration
interface SessionConfig {
  TIMEOUT_DURATION: number;
  WARNING_DURATION: number;
  CHECK_INTERVAL: number;
  STORAGE_KEY: string;
  JWT_EXPIRES_IN: string;
  COOKIE_MAX_AGE: number;
  DEV_MODE?: {
    TIMEOUT_DURATION: number;
    WARNING_DURATION: number;
    CHECK_INTERVAL: number;
    JWT_EXPIRES_IN: string;
    COOKIE_MAX_AGE: number;
  };
}

// Helper to get env variable (works in both Vite client and Node.js server)
const getEnv = (key: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
};

export const SESSION_CONFIG: SessionConfig = {
  // Session timeout duration in milliseconds (default: 30 minutes)
  TIMEOUT_DURATION: getEnv('SESSION_TIMEOUT') ? 
    parseInt(getEnv('SESSION_TIMEOUT')!) * 60 * 1000 : 
    30 * 60 * 1000,
  
  // Warning duration before session expires (default: 5 minutes)
  WARNING_DURATION: getEnv('SESSION_WARNING') ? 
    parseInt(getEnv('SESSION_WARNING')!) * 60 * 1000 : 
    5 * 60 * 1000,
  
  // How often to check for session expiry (default: 1 minute)
  CHECK_INTERVAL: getEnv('SESSION_CHECK_INTERVAL') ? 
    parseInt(getEnv('SESSION_CHECK_INTERVAL')!) * 1000 : 
    60 * 1000,
  
  // Local storage key for session activity
  STORAGE_KEY: 'sessionActivity',
  
  // JWT token expiration (should match session timeout)
  JWT_EXPIRES_IN: getEnv('SESSION_TIMEOUT') ? 
    `${getEnv('SESSION_TIMEOUT')}m` : 
    '30m',
  
  // Cookie max age in seconds
  COOKIE_MAX_AGE: getEnv('SESSION_TIMEOUT') ? 
    parseInt(getEnv('SESSION_TIMEOUT')!) * 60 : 
    30 * 60,
  
  // Development mode settings
  DEV_MODE: {
    // Shorter timeouts for testing (5 minutes)
    TIMEOUT_DURATION: 2 * 60 * 1000,
    WARNING_DURATION: 1 * 60 * 1000,
    CHECK_INTERVAL: 30 * 1000,
    JWT_EXPIRES_IN: '2m',
    COOKIE_MAX_AGE: 2 * 60
  }
};

// Activity events to track for session management
export const ACTIVITY_EVENTS: string[] = [
  'mousedown',
  'mousemove', 
  'keypress',
  'keydown',
  'scroll',
  'touchstart',
  'touchmove',
  'click',
  'focus',
  'blur'
];

// Get session config based on environment
export const getSessionConfig = (): SessionConfig => {
  const devMode = getEnv('DEVMODE') || getEnv('VITE_DEVMODE');
  const isDevelopment = devMode === 'true';

  if (isDevelopment) {
    console.log('Using development session configuration (shorter timeouts)');
    return {
      ...SESSION_CONFIG,
      ...SESSION_CONFIG.DEV_MODE
    };
  }
  
  return SESSION_CONFIG;
};

// Format time for display
export const formatTime = (ms: number): string => {
  if (!ms || ms <= 0) return '0m';
  
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
};

// Validate session configuration
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const validateSessionConfig = (config: SessionConfig = SESSION_CONFIG): ValidationResult => {
  const errors: string[] = [];
  
  if (config.TIMEOUT_DURATION < 60000) { // Less than 1 minute
    errors.push('Session timeout must be at least 1 minute');
  }
  
  if (config.WARNING_DURATION >= config.TIMEOUT_DURATION) {
    errors.push('Warning duration must be less than timeout duration');
  }
  
  if (config.CHECK_INTERVAL > config.WARNING_DURATION) {
    errors.push('Check interval should be less than warning duration for better UX');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};


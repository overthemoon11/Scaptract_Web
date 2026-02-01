import { useEffect, useRef, useCallback, ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@shared/types';

// Session config - client-side only, no server dependency
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

export const getSessionConfig = () => {
  // Client-side session config
  const devMode = import.meta.env.VITE_DEVMODE === 'true' || import.meta.env.DEVMODE === 'true';
  
  if (devMode) {
    return {
      TIMEOUT_DURATION: 2 * 60 * 1000,
      WARNING_DURATION: 1 * 60 * 1000,
      CHECK_INTERVAL: 30 * 1000,
    };
  }
  
  return {
    TIMEOUT_DURATION: 30 * 60 * 1000,
    WARNING_DURATION: 5 * 60 * 1000,
    CHECK_INTERVAL: 60 * 1000,
  };
};

type WarningCallback = (remainingSeconds: number) => void;
type ExpiredCallback = () => void;

class SessionManager {
  private lastActivity: number;
  private warningShown: boolean;
  private timeoutWarningCallback: WarningCallback | null;
  private sessionExpiredCallback: ExpiredCallback | null;
  private checkInterval: NodeJS.Timeout | null;
  private isActive: boolean;
  private config: ReturnType<typeof getSessionConfig>;

  constructor() {
    this.lastActivity = Date.now();
    this.warningShown = false;
    this.timeoutWarningCallback = null;
    this.sessionExpiredCallback = null;
    this.checkInterval = null;
    this.isActive = false;
    this.config = getSessionConfig();
  }

  init(onWarning: WarningCallback, onExpired: ExpiredCallback): void {
    this.timeoutWarningCallback = onWarning;
    this.sessionExpiredCallback = onExpired;
    this.lastActivity = Date.now();
    this.isActive = true;

    this.loadLastActivity();
    this.addActivityListeners();
    this.startChecking();

    console.log('Session manager initialized');
  }

  private loadLastActivity(): void {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(this.config.STORAGE_KEY);
      if (stored) {
        this.lastActivity = parseInt(stored, 10);
      }
    }
  }

  private saveLastActivity(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.config.STORAGE_KEY, this.lastActivity.toString());
    }
  }

  recordActivity(): void {
    this.lastActivity = Date.now();
    this.warningShown = false;
    this.saveLastActivity();
  }

  private addActivityListeners(): void {
    if (typeof window !== 'undefined') {
      ACTIVITY_EVENTS.forEach(event => {
        document.addEventListener(event, this.recordActivity.bind(this), true);
      });
    }
  }

  private removeActivityListeners(): void {
    if (typeof window !== 'undefined') {
      ACTIVITY_EVENTS.forEach(event => {
        document.removeEventListener(event, this.recordActivity.bind(this), true);
      });
    }
  }

  private startChecking(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.checkSession();
    }, this.config.CHECK_INTERVAL);
  }

  private checkSession(): void {
    if (!this.isActive) return;

    const now = Date.now();
    const timeSinceActivity = now - this.lastActivity;
    const timeUntilExpiry = this.config.TIMEOUT_DURATION - timeSinceActivity;

    if (timeSinceActivity >= this.config.TIMEOUT_DURATION) {
      this.handleSessionExpired();
      return;
    }

    if (timeUntilExpiry <= this.config.WARNING_DURATION && !this.warningShown) {
      this.warningShown = true;
      if (this.timeoutWarningCallback) {
        this.timeoutWarningCallback(Math.ceil(timeUntilExpiry / 1000));
      }
    }
  }

  private handleSessionExpired(): void {
    console.log('Session expired due to inactivity');
    this.cleanup();
    if (this.sessionExpiredCallback) {
      this.sessionExpiredCallback();
    }
  }

  async extendSession(): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/extend-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (response.ok) {
        this.recordActivity();
        this.warningShown = false;
        console.log('Session extended successfully');
        return true;
      } else {
        console.error('Failed to extend session:', response.statusText);
        return false;
      }
    } catch (error) {
      console.error('Error extending session:', error);
      return false;
    }
  }

  cleanup(): void {
    this.isActive = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.removeActivityListeners();

    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.config.STORAGE_KEY);
    }
  }

  getRemainingTime(): number {
    const timeSinceActivity = Date.now() - this.lastActivity;
    return Math.max(0, this.config.TIMEOUT_DURATION - timeSinceActivity);
  }

  isNearExpiry(): boolean {
    return this.getRemainingTime() <= this.config.WARNING_DURATION;
  }
}

const sessionManager = new SessionManager();

interface UseSessionManagerReturn {
  initializeSession: () => void;
  cleanupSession: () => void;
  extendSession: () => Promise<boolean>;
  getRemainingTime: () => number;
  isNearExpiry: () => boolean;
}

export const useSessionManager = (): UseSessionManagerReturn => {
  const navigate = useNavigate();
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSessionExpired = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      navigate('/auth/login?message=Session expired due to inactivity. Please login again.');
    }
  }, [navigate]);

  const handleSessionWarning = useCallback((remainingSeconds: number) => {
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    // SessionStatus component will handle showing the notification popup
    // This callback is kept for compatibility but the UI is handled by SessionStatus
    // The warning will be displayed by SessionStatus's useEffect that watches isNearExpiry
    console.log(`Session warning: ${Math.ceil(remainingSeconds / 60)} minutes remaining`);
  }, []);

  const initializeSession = useCallback(() => {
    sessionManager.init(handleSessionWarning, handleSessionExpired);
  }, [handleSessionWarning, handleSessionExpired]);

  const cleanupSession = useCallback(() => {
    sessionManager.cleanup();
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }
  }, []);

  const extendSession = useCallback(async () => {
    return await sessionManager.extendSession();
  }, []);

  const getRemainingTime = useCallback(() => {
    return sessionManager.getRemainingTime();
  }, []);

  return {
    initializeSession,
    cleanupSession,
    extendSession,
    getRemainingTime,
    isNearExpiry: sessionManager.isNearExpiry.bind(sessionManager)
  };
};

interface WithSessionManagementProps {
  user?: User | null;
  [key: string]: any;
}

export const withSessionManagement = <P extends object>(
  WrappedComponent: ComponentType<P>
): ComponentType<P & WithSessionManagementProps> => {
  const SessionManagedComponent = (props: P & WithSessionManagementProps) => {
    const { initializeSession, cleanupSession } = useSessionManager();

    useEffect(() => {
      if (props.user) {
        initializeSession();
      }

      return () => {
        cleanupSession();
      };
    }, [props.user, initializeSession, cleanupSession]);

    return <WrappedComponent {...(props as P)} />;
  };

  SessionManagedComponent.displayName = `withSessionManagement(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return SessionManagedComponent;
};

export default sessionManager;


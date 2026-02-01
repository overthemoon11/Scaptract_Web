import { useState, useEffect } from 'react';
import { useSessionManager } from '@/lib/sessionManager';
import NotificationCard, { NotificationType } from '@/components/NotificationCard';
import styles from '@/styles/SessionStatus.module.css';
import { User } from '@shared/types';

// Format time helper - client-side only
const formatTime = (ms: number): string => {
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

interface SessionStatusProps {
  user: User | null;
  showDetails?: boolean;
}

export default function SessionStatus({ user, showDetails = false }: SessionStatusProps) {
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [isNearExpiry, setIsNearExpiry] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [notification, setNotification] = useState<{
    type: NotificationType;
    title: string;
    message: string;
    remainingTime: number;
  } | null>(null);
  const [isManualNotification, setIsManualNotification] = useState(false);
  const { getRemainingTime, isNearExpiry: checkNearExpiry, extendSession } = useSessionManager();

  useEffect(() => {
    if (!user) return;

    const updateSessionInfo = () => {
      const remaining = getRemainingTime();
      setRemainingTime(remaining);
      setIsNearExpiry(checkNearExpiry());
    };

    updateSessionInfo();

    const interval = setInterval(updateSessionInfo, 30000);

    return () => clearInterval(interval);
  }, [user, getRemainingTime, checkNearExpiry]);

  useEffect(() => {
    // Don't interfere with manually triggered notifications
    if (isManualNotification) return;

    if (isNearExpiry && remainingTime !== null && remainingTime > 0) {
      setShowWarning(true);
      // Only show warning notification if we don't already have a notification showing
      // (to avoid replacing success/error notifications)
      setNotification(prev => {
        if (!prev || prev.type === 'warning') {
          const minutes = Math.ceil(remainingTime / 60000);
          return {
            type: 'warning' as NotificationType,
            title: 'Session Expiring Soon',
            message: `Your session will expire in ${minutes} minute${minutes !== 1 ? 's' : ''} due to inactivity. Click "Extend Session" to continue or "Logout" to logout now.`,
            remainingTime: remainingTime
          };
        }
        return prev; // Keep existing notification if it's success/error
      });
    } else {
      setShowWarning(false);
      // Only clear notification if it's a warning (keep success/error notifications)
      setNotification(prev => {
        if (prev?.type === 'warning') {
          return null;
        }
        return prev;
      });
    }
  }, [isNearExpiry, remainingTime, isManualNotification]);

  // Debug: Log when notification changes
  useEffect(() => {
    if (notification) {
      console.log('Notification state:', notification);
    }
  }, [notification]);

  const handleExtendSession = async () => {
    const success = await extendSession();
    if (success) {
      setShowWarning(false);
      // Show success notification
      setNotification({
        type: 'success',
        title: 'Session Extended',
        message: 'Your session has been extended successfully.',
        remainingTime: 0
      });
      // Auto-close success notification after 3 seconds
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    } else {
      setNotification({
        type: 'error',
        title: 'Failed to Extend Session',
        message: 'Failed to extend session. You will be logged out.',
        remainingTime: 0
      });
    }
  };

  const handleLogout = async () => {
    setNotification(null);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      window.location.href = '/auth/login?message=You have been logged out.';
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect to login even if logout request fails
      window.location.href = '/auth/login?message=You have been logged out.';
    }
  };

  // Test function to manually trigger the warning notification (dev mode only)
  const handleTestWarning = () => {
    console.log('Test button clicked - setting manual notification');
    setIsManualNotification(true);
    setNotification({
      type: 'warning',
      title: 'Session Expiring Soon',
      message: 'Your session will expire in 1 minute due to inactivity. Click "Extend Session" to continue or "Logout" to logout now.',
      remainingTime: 60000
    });
    console.log('Notification state set:', {
      type: 'warning',
      title: 'Session Expiring Soon',
      message: 'Your session will expire in 1 minute due to inactivity. Click "Extend Session" to continue or "Logout" to logout now.',
      remainingTime: 60000
    });
  };

  if (!user) return null;

  // Check if in dev mode
  const isDevMode = import.meta.env.DEV || import.meta.env.VITE_DEVMODE === 'true';

  return (
    <>
      {/* Test button - hidden */}
      {false && isDevMode && (
        <button
          onClick={handleTestWarning}
          style={{
            position: 'fixed',
            bottom: '100px',
            right: '20px',
            zIndex: 10000,
            padding: '10px 20px',
            backgroundColor: '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
          title="Test Session Warning (Dev Mode Only)"
        >
          Test Session Warning
        </button>
      )}

      {notification && (
        <NotificationCard
          type={notification.type}
          title={notification.title}
          message={notification.message}
          primaryButtonText={notification.type === 'warning' ? 'Extend Session' : 'OK'}
          secondaryButtonText={notification.type === 'warning' ? 'Logout' : undefined}
          onPrimaryClick={() => {
            if (notification.type === 'warning') {
              setIsManualNotification(false);
              handleExtendSession();
            } else {
              setIsManualNotification(false);
              setNotification(null);
            }
          }}
          onSecondaryClick={() => {
            if (notification.type === 'warning') {
              setIsManualNotification(false);
              handleLogout();
            } else {
              setIsManualNotification(false);
              setNotification(null);
            }
          }}
          onClose={() => {
            if (notification.type === 'warning') {
              // If user closes warning, treat as logout
              setIsManualNotification(false);
              handleLogout();
            } else {
              setIsManualNotification(false);
              setNotification(null);
            }
          }}
        />
      )}

      {showDetails && remainingTime !== null && (
        <div className={`${styles.statusBar} ${isNearExpiry ? styles.warning : ''}`}>
          <div className={styles.statusContent}>
            <span className={styles.statusText}>
              Session: {formatTime(remainingTime)} remaining
            </span>
            {isNearExpiry && (
              <button
                onClick={handleExtendSession}
                className={styles.extendButton}
              >
                Extend
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}


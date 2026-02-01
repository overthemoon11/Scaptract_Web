import { useEffect, useState } from 'react';
import styles from '@/styles/NotificationDropdown.module.css';
import { useNavigate } from 'react-router-dom';
import { User, Notification } from '@shared/types';

interface NotificationDropdownProps {
  user: User | null;
  open: boolean;
  onClose: () => void;
}

interface NotificationItem extends Notification {
  _id?: string | number;
  createdAt?: Date | string;
}

export default function NotificationDropdown({ user, open, onClose }: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (open && (user?._id || user?.id)) {
      setLoading(true);
      const userId = user._id || user.id;
      // const isDevelopment = import.meta.env.DEV || import.meta.env.VITE_DEVMODE === 'true';
      const isDevelopment = false;

      if (isDevelopment) {
        console.log('🔧 DEVELOPMENT MODE: Loading sample notifications');
        const sampleNotifications: NotificationItem[] = [
          {
            _id: 'sample-1',
            id: 'sample-1',
            user_id: userId as string,
            title: 'Document Processed',
            message: 'Your document "Invoice_2024.pdf" has been successfully processed.',
            type: 'success',
            is_read: false,
            created_at: new Date().toISOString(),
            createdAt: new Date()
          },
          {
            _id: 'sample-2',
            id: 'sample-2',
            user_id: userId as string,
            title: 'Document Failed',
            message: 'Your document "Receipt_scan.jpg" failed processing. Low-contrast image detected.',
            type: 'error',
            is_read: false,
            created_at: new Date().toISOString(),
            createdAt: new Date()
          },
          {
            _id: 'sample-3',
            id: 'sample-3',
            user_id: userId as string,
            title: 'Welcome!',
            message: 'Welcome to Scaptract! Your account has been successfully created.',
            type: 'info',
            is_read: true,
            created_at: new Date().toISOString(),
            createdAt: new Date()
          },
          {
            _id: 'sample-4',
            id: 'sample-4',
            user_id: userId as string,
            title: 'System Maintenance',
            message: 'Scheduled maintenance will occur tonight from 2-4 AM EST.',
            type: 'warning',
            is_read: false,
            created_at: new Date().toISOString(),
            createdAt: new Date()
          }
        ];

        setTimeout(() => {
          setNotifications(sampleNotifications);
          setLoading(false);
        }, 500);
      } else {
        fetch(`/api/notifications?userId=${userId}`, { credentials: 'include' })
          .then(res => res.json())
          .then(data => {
            setNotifications(Array.isArray(data) ? data : []);
            setLoading(false);
          })
          .catch(() => {
            setLoading(false);
          });
      }
    }
  }, [open, user]);

  // Listen for notification read events and refresh if dropdown is open
  useEffect(() => {
    const handleNotificationRead = () => {
      if (open && (user?._id || user?.id)) {
        setLoading(true);
        const userId = user._id || user.id;
        fetch(`/api/notifications?userId=${userId}`, { credentials: 'include' })
          .then(res => res.json())
          .then(data => {
            setNotifications(Array.isArray(data) ? data : []);
            setLoading(false);
          })
          .catch(() => {
            setLoading(false);
          });
      }
    };

    window.addEventListener('notification-read', handleNotificationRead);
    return () => {
      window.removeEventListener('notification-read', handleNotificationRead);
    };
  }, [open, user]);

  const markAllAsRead = async () => {
    // const isDevelopment = import.meta.env.DEV || import.meta.env.VITE_DEVMODE === 'true';
    const isDevelopment = false;
    const userId = user?._id || user?.id;

    if (!userId) {
      console.error('No user ID available');
      return;
    }

    if (isDevelopment) {
      console.log('🔧 DEVELOPMENT MODE: Marking all notifications as read (local only)');
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      window.dispatchEvent(new CustomEvent('notification-read'));
    } else {
      try {
        setLoading(true);
        const response = await fetch(`/api/notifications/mark-all?userId=${userId}`, { 
          method: 'POST',
          credentials: 'include'
        });

        if (response.ok) {
          // Refresh notifications from server to get updated state
          const refreshResponse = await fetch(`/api/notifications?userId=${userId}`, { credentials: 'include' });
          if (refreshResponse.ok) {
            const data = await refreshResponse.json();
            setNotifications(Array.isArray(data) ? data : []);
          } else {
            console.error('Failed to refresh notifications:', await refreshResponse.text());
          }
          // Dispatch event to notify other components (like header badge)
          window.dispatchEvent(new CustomEvent('notification-read'));
        } else {
          const errorText = await response.text();
          console.error('Failed to mark all notifications as read:', response.status, errorText);
          alert('Failed to mark all notifications as read. Please try again.');
        }
        setLoading(false);
      } catch (err) {
        console.error('Error marking all notifications as read:', err);
        setLoading(false);
        alert('An error occurred while marking notifications as read. Please try again.');
      }
    }
  };

  const handleNotificationClick = async (id: string | number, read: boolean) => {
    if (!read) {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id })
      });
      // Update both is_read and read for compatibility
      setNotifications(notifications.map(n => (n._id === id || n.id === id ? { ...n, is_read: true } : n)));
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('notification-read'));
    }
    navigate(`/notifications/${id}`);
    if (onClose) onClose();
  };


  if (!open) return null;

  return (
    <div className={styles.dropdown}>
      <div className={styles.header}>
        <span style={{ color: '#000', fontSize: '1em', fontWeight: 600 }}>Notification</span>
        <button className={styles.markAll} onClick={markAllAsRead}>Mark all as read</button>
      </div>
      <div className={styles.list}>
        {loading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.threeBody}>
              <div className={styles.threeBodyDot}></div>
              <div className={styles.threeBodyDot}></div>
              <div className={styles.threeBodyDot}></div>
            </div>
          </div>
        ) : notifications.length === 0 ? (
          <div className={styles.empty}>No notifications</div>
        ) : notifications.map((n, i) => (
          <div
            key={n._id || n.id || i}
            className={`${styles.item} ${(n.is_read) ? styles.read : styles.unread}`}
            onClick={() => handleNotificationClick(n._id || n.id || '', n.is_read || false)}
            style={{ cursor: 'pointer' }}
          >
            {/* <span className={styles.icon}>{renderIcon(n)}</span> */}
            <div>
              <div style={{ fontWeight: 600, color: '#000', fontSize: '14px' }}>{n.title}</div>
              <div className={styles.message} style={{ fontSize: '12px', color: '#444' }}>{n.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


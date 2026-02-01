import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SessionStatus from '@/components/SessionStatus';
import { Notification, User } from '@shared/types';
import Loading from '@/components/Loading';
import styles from '@/styles/DocumentViewer.module.css';

export default function NotificationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [notification, setNotification] = useState<Notification | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const userRes = await fetch('/api/profile', { credentials: 'include' });
        const userData = await userRes.json();
        if (userData.user) {
          setUser(userData.user);
        }

        if (id) {
          const notifRes = await fetch(`/api/notifications/detail?id=${id}`, { credentials: 'include' });
          const notifData = await notifRes.json();
          setNotification(notifData);

          // Mark notification as read if it's not already read
          // Check is_read (database field) first, fallback to read for compatibility
          const isUnread = !(notifData.is_read ?? notifData.read ?? false);
          if (notifData && isUnread) {
            try {
              const response = await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ id })
              });
              
              if (response.ok) {
                // Update local state to reflect read status
                setNotification({ ...notifData, read: true, is_read: true });
                // Dispatch event to notify other components
                window.dispatchEvent(new CustomEvent('notification-read'));
              } else {
                console.error('Failed to mark notification as read:', await response.text());
              }
            } catch (err) {
              console.error('Error marking notification as read:', err);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className={styles.fullScreenLayout}>
        <SessionStatus user={user} showDetails={false} />
        <Header user={user} />
        <div className={styles.documentsContainer}>
          <div className={styles.titleSection} style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: 'calc(100vh - 200px)'
          }}>
            <Loading text="Loading" />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!notification) {
    return (
      <div className={styles.fullScreenLayout}>
        <SessionStatus user={user} showDetails={false} />
        <Header user={user} />
        <div className={styles.documentsContainer}>
          <div className={styles.titleSection}>
            <button
              onClick={() => navigate(-1)}
              className={styles.backButton}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" className="bi bi-arrow-left-short" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M12 8a.5.5 0 0 1-.5.5H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5a.5.5 0 0 1 .5.5" />
              </svg>
            </button>
            <h1 className={styles.mainTitle}>Notification Not Found</h1>
            <p className={styles.mainDescription}>The requested notification could not be found.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className={styles.fullScreenLayout}>
      <SessionStatus user={user} showDetails={false} />
      <Header user={user} />
      <div className={styles.notificationsContainer}>
        <div className={styles.notificationsContent} style={{ maxWidth: 800, margin: '0 auto' }}>
          <div className={styles.documentHeader} style={{ paddingTop: '48px' }}>
            <div className={styles.headerLeft}>
              <button
                onClick={() => navigate(-1)}
                className={styles.backButton}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" className="bi bi-arrow-left-short" viewBox="0 0 16 16">
                  <path fillRule="evenodd" d="M12 8a.5.5 0 0 1-.5.5H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5a.5.5 0 0 1 .5.5" />
                </svg>
              </button>
              <h1 className={styles.documentTitle}>
                {notification.title || 'Notification'}
              </h1>
            </div>
          </div>

          <div style={{ 
            background: '#fff', 
            borderRadius: 16, 
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)', 
            padding: 48,
            marginTop: 5
          }}>
            <div style={{ fontSize: '1.1rem', marginBottom: 24, lineHeight: 1.6, color: '#333' }}>
              {notification.message}
            </div>
            <div style={{ marginBottom: 24 }}>
              <span style={{ 
                padding: '6px 18px', 
                borderRadius: 16, 
                background: (notification.is_read) ? '#e0e0e0' : '#f0f0f0', 
                color: '#222', 
                fontWeight: 500,
                fontSize: '14px'
              }}>
                {(notification.is_read) ? 'Read' : 'Unread'}
              </span>
            </div>
            {notification.created_at && (
              <div style={{ fontSize: '0.9rem', color: '#666', marginTop: 16 }}>
                {new Date(notification.created_at).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}


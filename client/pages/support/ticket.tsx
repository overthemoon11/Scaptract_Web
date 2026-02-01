import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import NotificationCard, { NotificationType } from '@/components/NotificationCard';
import styles from '@/styles/SupportTicket.module.css';
import { User, ApiError } from '@shared/types';

interface TicketResponse {
  success?: boolean;
  message?: string;
  error?: string;
}

export default function SupportTicket() {
  const [user, setUser] = useState<User | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    type: NotificationType;
    title: string;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/profile', { credentials: 'include' });
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
        }
      } catch (err) {
        console.error('Error fetching user:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setNotification(null);
    try {
      const userId = user?._id || user?.id;
      const res = await fetch('/api/support/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title, description: desc, userId })
      });
      const data: TicketResponse | ApiError = await res.json();
      if (res.ok) {
        setNotification({
          type: 'success',
          title: 'Success!',
          message: 'Ticket submitted successfully!'
        });
        setTitle('');
        setDesc('');
      } else {
        setNotification({
          type: 'error',
          title: 'Error',
          message: 'error' in data ? data.error || 'Failed to submit ticket.' : 'Failed to submit ticket.'
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to submit ticket. Please try again.'
      });
    }
    setSubmitting(false);
  };


  return (
    <Layout user={user} loading={loading} loadingText="Loading">
      <div className={styles.container}>
        <h1 className={styles.title}>Support Ticket</h1>
        <hr className={styles.divider} />
        <form onSubmit={handleSubmit} className={styles.form} data-tg-tour="📝 Support Request - Fill out this form with your issue details. Be specific and include any error messages or screenshots.">
          <div>
            <label className={styles.label}>Ticket title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Enter ticket title"
              required
              className={styles.input}
            />
          </div>
          <div>
            <label className={styles.label}>Ticket description</label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Enter your description here..."
              required
              rows={6}
              className={styles.textarea}
            />
          </div>
          <div className={styles.buttonWrapper}>
            <button
              type="submit"
              disabled={submitting}
              className={styles.button}
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
        {notification && (
          <NotificationCard
            type={notification.type}
            title={notification.title}
            message={notification.message}
            primaryButtonText="OK"
            onPrimaryClick={() => setNotification(null)}
            onClose={() => setNotification(null)}
          />
        )}
      </div>
    </Layout>
  );
}


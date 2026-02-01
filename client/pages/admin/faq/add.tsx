import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import NotificationCard, { NotificationType } from '@/components/NotificationCard';
import styles from '@/styles/AdminFAQAdd.module.css';
import { User, ApiError } from '@shared/types';
import Loading from '@/components/Loading';

interface FAQResponse {
  success?: boolean;
  error?: string;
}

export default function AddFAQPage() {
  const [user, setUser] = useState<User | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('active');
  const [notification, setNotification] = useState<{
    type: NotificationType;
    title: string;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const navigate = useNavigate();

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
        setLoadingUser(false);
      }
    }
    fetchUser();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNotification(null);
    if (!title.trim() || !description.trim()) {
      setNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Title and description are required.'
      });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title, description, status })
      });
      const data: FAQResponse | ApiError = await res.json();
      if (res.ok) {
        navigate('/admin/faq');
      } else {
        setNotification({
          type: 'error',
          title: 'Failed',
          message: 'error' in data ? data.error || 'Failed to add FAQ.' : 'Failed to add FAQ.'
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to add FAQ.'
      });
    } finally {
      setLoading(false);
    }
  }

  if (loadingUser) {
    return (
      <Layout user={user}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: 'calc(100vh - 200px)'
        }}>
          <Loading text="Loading" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user}>
      <div className={styles.container}>
        <h1 className={styles.title}>Create FAQ</h1>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label}>
            Title
            <input className={styles.input} value={title} onChange={e => setTitle(e.target.value)} required placeholder="Enter ticket title" />
          </label>
          <label className={styles.label}>
            Description
            <textarea className={styles.textarea} value={description} onChange={e => setDescription(e.target.value)} required placeholder="Enter your description here..." />
          </label>
          <label className={styles.label}>
            Status
            <select className={styles.input} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="banned">Banned</option>
            </select>
          </label>
          <div className={styles.buttonWrapper}>
            <button className={styles.submitBtn} type="submit" disabled={loading}>{loading ? 'Adding...' : 'Create'}</button>
            <button className={styles.deleteBtn} type="button" onClick={() => navigate('/admin/faq')}>Cancel</button>
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


import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import NotificationCard, { NotificationType } from '@/components/NotificationCard';
import styles from '@/styles/AdminFAQAdd.module.css';
import { User, FAQ, ApiError } from '@shared/types';
import Loading from '@/components/Loading';

interface FAQResponse {
  success?: boolean;
  error?: string;
}

export default function EditFAQPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [faq, setFaq] = useState<FAQ | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('active');
  const [notification, setNotification] = useState<{
    type: NotificationType;
    title: string;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const userRes = await fetch('/api/profile', { credentials: 'include' });
        const userData = await userRes.json();
        if (userData.user) {
          setUser(userData.user);
        }

        if (id) {
          const faqRes = await fetch(`/api/admin/faq?id=${id}`, { credentials: 'include' });
          const faqData = await faqRes.json();
          if (faqData) {
            setFaq(faqData);
            setTitle(faqData.question || faqData.title || '');
            setDescription(faqData.answer || faqData.description || '');
            setStatus(faqData.status || 'active');
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoadingData(false);
      }
    }
    fetchData();
  }, [id]);

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
      const res = await fetch(`/api/admin/faq?id=${id}`, {
        method: 'PUT',
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
          title: 'Update Failed',
          message: 'error' in data ? data.error || 'Failed to update FAQ.' : 'Failed to update FAQ.'
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to update FAQ.'
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Are you sure you want to delete this FAQ?')) return;
    setLoading(true);
    setNotification(null);
    try {
      const res = await fetch(`/api/admin/faq?id=${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data: FAQResponse | ApiError = await res.json();
      if (res.ok) {
        navigate('/admin/faq');
      } else {
        setNotification({
          type: 'error',
          title: 'Delete Failed',
          message: 'error' in data ? data.error || 'Failed to delete FAQ.' : 'Failed to delete FAQ.'
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete FAQ.'
      });
    } finally {
      setLoading(false);
    }
  }

  if (loadingData) {
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

  if (!faq) {
    return <div>FAQ not found</div>;
  }

  return (
    <Layout user={user}>
      <div className={styles.container}>
        <h1 className={styles.title}>Edit FAQ</h1>
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
            <button className={styles.submitBtn} type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</button>
            <button type="button" className={styles.deleteBtn} style={{ background: '#dc3545', marginLeft: 16 }} onClick={handleDelete} disabled={loading}>Delete</button>
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


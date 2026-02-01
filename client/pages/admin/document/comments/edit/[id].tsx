import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import styles from '@/styles/SupportTicket.module.css';
import { User, ApiError } from '@shared/types';

interface CommentData {
  id: string;
  content: string;
  reply?: string | null;
  document_id: string;
}

export default function EditReplyPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [comment, setComment] = useState<CommentData | null>(null);
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const userRes = await fetch('/api/profile', { credentials: 'include' });
        const userData = await userRes.json();
        if (userData.user) {
          setUser(userData.user);
        }

        if (id) {
          const commentRes = await fetch(`/api/admin/comment/${id}`, { credentials: 'include' });
          const commentData = await commentRes.json();
          if (commentData.comment) {
            setComment(commentData.comment);
            setReply(commentData.comment.reply || '');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess(false);

    if (!reply.trim()) {
      setError('Please enter a reply');
      setSubmitting(false);
      return;
    }

    if (!id) {
      setError('Comment ID is missing');
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`/api/admin/comment/${id}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          reply: reply.trim()
        })
      });

      const data: { success?: boolean; error?: string } | ApiError = await response.json();

      if (response.ok && 'success' in data && data.success) {
        setSuccess(true);
        // Redirect after a short delay to show success message
        setTimeout(() => {
          if (comment?.document_id) {
            navigate(`/admin/document/comments/${comment.document_id}`);
          } else {
            navigate('/admin/document');
          }
        }, 1500);
      } else {
        setError('error' in data ? data.error || 'Failed to update reply' : 'Failed to update reply');
      }
    } catch (err) {
      console.error('Error submitting reply:', err);
      setError('Failed to update reply. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <Layout user={user} loading={loading} loadingText="Loading">
      <div className={styles.container}>
        <h1 className={styles.title}>Edit Reply</h1>
        <hr className={styles.divider} />
        <form onSubmit={handleSubmit} className={styles.form}>
          <div>
            <label className={styles.label}>Comment</label>
            <textarea
              readOnly
              value={comment?.content || ''}
              className={styles.textarea}
              rows={4}
              style={{ backgroundColor: '#f0f0f0', cursor: 'not-allowed' }}
            />
          </div>
          <div>
            <label className={styles.label}>Reply</label>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Enter your reply here..."
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
          {success && (
            <div className={styles.success}>
              Reply updated successfully!
            </div>
          )}
          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}
        </form>
      </div>
    </Layout>
  );
}

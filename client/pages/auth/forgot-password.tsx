import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Logo from '@/components/Logo';
import NotificationCard, { NotificationType } from '@/components/NotificationCard';
import styles from '@/styles/Register.module.css';
import { AuthResponse, ApiError } from '@shared/types';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [notification, setNotification] = useState<{
    type: NotificationType;
    title: string;
    message: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });

      const data: AuthResponse | ApiError = await res.json();

      if (!res.ok) {
        setNotification({
          type: 'error',
          title: 'Failed',
          message: 'error' in data ? data.error : 'Failed to send reset code'
        });
      } else {
        setIsSuccess(true);
        setMessage('message' in data ? data.message : 'Reset code sent');
        setTimeout(() => {
          navigate(`/auth/reset-password?email=${encodeURIComponent(email)}`);
        }, 2000);
      }
    } catch (error) {
      setNotification({
        type: 'error',
        title: 'Network Error',
        message: 'Network error. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className={styles.container}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '64px',
            marginBottom: '20px',
            color: '#007bff'
          }}>
            📧
          </div>
          <h2 className={styles.title} style={{ color: '#007bff' }}>
            Reset Code Sent!
          </h2>
          <div style={{
            backgroundColor: '#d1ecf1',
            color: '#0c5460',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #bee5eb',
            marginBottom: '30px'
          }}>
            <p style={{ margin: 0, fontSize: '16px' }}>
              {message}
            </p>
          </div>
          <div style={{
            backgroundColor: '#e2e3e5',
            color: '#383d41',
            padding: '15px',
            borderRadius: '8px',
            border: '1px solid #d6d8db'
          }}>
            <p style={{ margin: 0, fontSize: '14px' }}>
              🔄 Redirecting to password reset page in 2 seconds...
            </p>
            <button
              onClick={() => navigate(`/auth/reset-password?email=${encodeURIComponent(email)}`)}
              style={{
                marginTop: '15px',
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Continue to Reset Password
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.bg}>
      <header className={styles.header}>
        <Logo />
        <div>
          Does not have an account yet?{' '}
          <Link to="/auth/register">
            <button className={`${styles.blackButton} ${styles.loginButton}`} type="button">
              Sign Up
            </button>
          </Link>
        </div>
      </header>
      <div className={styles.container}>
        <h2 className={styles.title}>Forgot Password</h2>
        <p style={{ textAlign: 'center', marginBottom: '30px', color: '#666' }}>
          Enter your email address and we'll send you a code to reset your password.
        </p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${styles.input} ${styles.customInput}`}
            required
          />
          <div className={styles.buttonContainer}>
            <button
              type="submit"
              className={styles.blackButton}
              disabled={isLoading}
            >
              {isLoading ? 'Sending...' : 'Send Reset Code'}
            </button>
          </div>
        </form>
        <div style={{ textAlign: 'center', marginTop: '30px' }}>
          <button
            type="button"
            onClick={() => navigate('/auth/login')}
            style={{
              background: 'none',
              border: 'none',
              color: '#000',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ← Back to Login
          </button>
        </div>

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
    </div>
  );
}


import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Logo from '@/components/Logo';
import NotificationCard, { NotificationType } from '@/components/NotificationCard';
import styles from '@/styles/Register.module.css';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { AuthResponse, ApiError } from '@shared/types';

interface ResetPasswordForm {
  email: string;
  otp: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ResetPasswordPage() {
  const [form, setForm] = useState<ResetPasswordForm>({
    email: '',
    otp: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [notification, setNotification] = useState<{
    type: NotificationType;
    title: string;
    message: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [message, setMessage] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setForm(prev => ({ ...prev, email: emailParam }));
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);

    if (form.otp.length !== 6) {
      setNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Please enter a valid 6-digit code'
      });
      return;
    }

    if (form.newPassword.length < 6) {
      setNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Password must be at least 6 characters long'
      });
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Passwords do not match'
      });
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: form.email,
          otp: form.otp,
          newPassword: form.newPassword
        }),
      });

      const data: AuthResponse | ApiError = await res.json();

      if (!res.ok) {
        setNotification({
          type: 'error',
          title: 'Reset Failed',
          message: 'error' in data ? data.error : 'Password reset failed'
        });
      } else {
        setIsSuccess(true);
        setMessage('message' in data ? data.message : 'Password reset successful');
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Password Reset Successful! 🔑', {
            body: 'Your password has been updated. You can now login with your new password.',
            icon: '/favicon.ico'
          });
        }
        setTimeout(() => {
          navigate('/auth/login?message=Password reset successful! Please login with your new password.');
        }, 3000);
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

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 6) {
      setForm(prev => ({ ...prev, otp: value }));
    }
  };

  if (isSuccess) {
    return (
      <div className={styles.container}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '64px',
            marginBottom: '20px',
            color: '#28a745',
          }}>
            🔑
          </div>
          <h2 className={styles.title} style={{ color: '#28a745' }}>
            Password Reset Successful!
          </h2>
          <div style={{
            backgroundColor: '#d4edda',
            color: '#155724',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #c3e6cb',
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
              🔄 Redirecting to login page in 3 seconds...
            </p>
            <button
              onClick={() => navigate('/auth/login')}
              style={{
                marginTop: '15px',
                padding: '10px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Go to Login Now
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
        <h2 className={styles.title}>Reset Your Password</h2>
        <p style={{ textAlign: 'center', marginBottom: '20px', color: '#666' }}>
          Enter the 6-digit code sent to<br />
          <strong>{form.email}</strong>
        </p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="text"
            placeholder="Enter 6-digit OTP"
            value={form.otp}
            onChange={handleOtpChange}
            className={`${styles.input} ${styles.customInput}`}
            style={{ textAlign: 'center', fontSize: '18px', letterSpacing: '1px', fontWeight: 'bold' }}
            maxLength={6}
            required
          />
          <div className={styles.passwordWrapper}>
            <input
              type={showNewPassword ? 'text' : 'password'}
              placeholder="Enter new password"
              value={form.newPassword}
              onChange={e => setForm(prev => ({ ...prev, newPassword: e.target.value }))}
              className={`${styles.input} ${styles.customInput}`}
              minLength={6}
              required
            />
            <span
              className={styles.eyeIcon}
              onClick={() => setShowNewPassword(v => !v)}
              tabIndex={0}
              role="button"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setShowNewPassword(v => !v);
                }
              }}
            >
              {showNewPassword ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>
          <div className={styles.passwordWrapper}>
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm new password"
              value={form.confirmPassword}
              onChange={e => setForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
              className={`${styles.input} ${styles.customInput}`}
              minLength={6}
              required
            />
            <span
              className={styles.eyeIcon}
              onClick={() => setShowConfirmPassword(v => !v)}
              tabIndex={0}
              role="button"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setShowConfirmPassword(v => !v);
                }
              }}
            >
              {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>
          <div className={styles.buttonContainer}>
            <button
              type="submit"
              className={styles.blackButton}
              disabled={isLoading || form.otp.length !== 6 || form.newPassword.length < 6}
            >
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
        <div style={{ textAlign: 'center', marginTop: '30px' }}>
          <button
            type="button"
            onClick={() => navigate('/auth/forgot-password')}
            style={{
              background: 'none',
              border: 'none',
              color: '#000',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ← Back to Forgot Password
          </button>
          <br /><br />
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
            Back to Login
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


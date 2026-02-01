import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Logo from '@/components/Logo';
import NotificationCard, { NotificationType } from '@/components/NotificationCard';
import styles from '@/styles/Register.module.css';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { AuthResponse, ApiError } from '@shared/types';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [notification, setNotification] = useState<{
    type: NotificationType;
    title: string;
    message: string;
  } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const message = searchParams.get('message');
    if (message) {
      setNotification({
        type: 'success',
        title: 'Success',
        message: message
      });
      navigate('/auth/login', { replace: true });
    }
  }, [searchParams, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      
      // Check if response has content and is JSON
      const contentType = res.headers.get('content-type');
      let data: AuthResponse | ApiError;
      
      if (contentType && contentType.includes('application/json')) {
        try {
          const text = await res.text();
          if (!text || text.trim() === '') {
            setNotification({
              type: 'error',
              title: 'Server Error',
              message: 'Empty response from server'
            });
            return;
          }
          data = JSON.parse(text);
        } catch (parseError) {
          setNotification({
            type: 'error',
            title: 'Server Error',
            message: 'Invalid JSON response from server'
          });
          return;
        }
      } else {
        const text = await res.text();
        setNotification({
          type: 'error',
          title: 'Login Failed',
          message: text || 'Login failed: Invalid response from server'
        });
        return;
      }

      if (!res.ok) {
        setNotification({
          type: 'error',
          title: 'Login Failed',
          message: 'error' in data ? data.error : 'Login failed'
        });
      } else {
        if ('user' in data && data.user) {
          if (data.user.role === 'admin') {
            navigate('/admin/user');
          } else {
            // navigate('/home');
            navigate('/documents');
          }
        } else {
          setNotification({
            type: 'error',
            title: 'Login Failed',
            message: 'Login failed: Invalid response'
          });
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setNotification({
        type: 'error',
        title: 'Network Error',
        message: error.message || 'Network error. Please try again.'
      });
    }
  };

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
        <h2 className={styles.title}>Login to your Scaptract account</h2>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>Email</label>
          <input
            placeholder="Enter your email address"
            required
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            className={`${styles.input} ${styles.customInput}`}
          />
          <label className={styles.label}>Password</label>
          <div className={styles.passwordWrapper}>
            <input
              placeholder="Enter your password"
              required
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className={styles.input}
            />
            <span
              className={styles.eyeIcon}
              onClick={() => setShowPassword(v => !v)}
              tabIndex={0}
              role="button"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setShowPassword(v => !v);
                }
              }}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>
          <div style={{ textAlign: 'right', marginTop: '4px', marginBottom: '8px' }}>
            <Link to="/auth/forgot-password" style={{
              color: '#000',
              textDecoration: 'none',
              fontSize: '14px'
            }}>
              Forgot password?
            </Link>
          </div>
          <div className={styles.buttonContainer}>
            <button type="submit" className={styles.blackButton}>Login</button>
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
    </div>
  );
}


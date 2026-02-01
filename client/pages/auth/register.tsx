import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import styles from '@/styles/Register.module.css';
import Logo from '@/components/Logo';
import NotificationCard, { NotificationType } from '@/components/NotificationCard';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { AuthResponse, ApiError } from '@shared/types';

interface RegisterForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterPage() {
  const [form, setForm] = useState<RegisterForm>({ 
    name: '', 
    email: '', 
    password: '', 
    confirmPassword: '' 
  });
  const [notification, setNotification] = useState<{
    type: NotificationType;
    title: string;
    message: string;
  } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);
    if (form.password !== form.confirmPassword) {
      setNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Passwords do not match'
      });
      return;
    }
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
    });
    const data: AuthResponse | ApiError = await res.json();
    if (!res.ok) {
      setNotification({
        type: 'error',
        title: 'Registration Failed',
        message: 'error' in data ? data.error : 'Registration failed'
      });
    } else {
      navigate(`/auth/verify-otp?email=${encodeURIComponent(form.email)}`);
    }
  };

  return (
    <div className={styles.bg}>
      <header className={styles.header}>
        <Logo />
        <div>
          Already have an account?{' '}
          <Link to="/auth/login">
            <button className={`${styles.blackButton} ${styles.loginButton}`} type="button">
              Log In
            </button>
          </Link>
        </div>
      </header>
      <div className={styles.container}>
        <h2 className={styles.title}>Create your Scaptract account</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>Username</label>
          <input
            placeholder="Enter your username"
            required
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className={`${styles.input} ${styles.customInput}`}
          />
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
          <label className={styles.label}>Confirm Password</label>
          <div className={styles.passwordWrapper}>
            <input
              placeholder="Re-enter your password"
              required
              type={showConfirm ? "text" : "password"}
              value={form.confirmPassword}
              onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
              className={styles.input}
            />
            <span
              className={styles.eyeIcon}
              onClick={() => setShowConfirm(v => !v)}
              tabIndex={0}
              role="button"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setShowConfirm(v => !v);
                }
              }}
            >
              {showConfirm ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>
          <div className={styles.buttonContainer}>
            <button type="submit" className={styles.blackButton}>Register</button>
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


import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import styles from '@/styles/Register.module.css';
import Logo from '@/components/Logo';
import NotificationCard, { NotificationType } from '@/components/NotificationCard';
import { AuthResponse, ApiError } from '@shared/types';

export default function VerifyOTPPage() {
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [notification, setNotification] = useState<{
    type: NotificationType;
    title: string;
    message: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);
    setIsLoading(true);

    if (otp.length !== 6) {
      setNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Please enter a valid 6-digit OTP'
      });
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, otp }),
      });

      const data: AuthResponse | ApiError = await res.json();

      if (!res.ok) {
        setNotification({
          type: 'error',
          title: 'Verification Failed',
          message: 'error' in data ? data.error : 'Verification failed'
        });
      } else {
        setIsSuccess(true);
        setSuccessMessage('message' in data ? data.message : 'Email verified successfully! Registration completed.');
        setNotification(null);

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Registration Successful! 🎉', {
            body: 'Your email has been verified. You can now login to your account.',
            icon: '/favicon.ico'
          });
        } else if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              new Notification('Registration Successful! 🎉', {
                body: 'Your email has been verified. You can now login to your account.',
                icon: '/favicon.ico'
              });
            }
          });
        }

        setTimeout(() => {
          navigate('/auth/login?message=Registration completed! Please login.');
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

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;

    setNotification(null);
    setResendCooldown(60);

    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });

      const data: AuthResponse | ApiError = await res.json();
      if (res.ok) {
        setNotification({
          type: 'success',
          title: 'OTP Sent',
          message: 'message' in data ? data.message : 'New OTP sent to your email!'
        });
      } else {
        setNotification({
          type: 'error',
          title: 'Failed',
          message: 'error' in data ? data.error : 'Failed to resend OTP'
        });
        setResendCooldown(0);
      }
    } catch (error) {
      setNotification({
        type: 'error',
        title: 'Network Error',
        message: 'Failed to resend OTP. Please try again.'
      });
      setResendCooldown(0);
    }
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 6) {
      setOtp(value);
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
            ✅
          </div>
          <h2 className={styles.title} style={{ color: '#28a745' }}>
            Verification Successful!
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
              {successMessage}
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
                backgroundColor: '#007bff',
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
          Already have an account?{' '}
          <Link to="/auth/login">
            <button className={`${styles.blackButton} ${styles.loginButton}`} type="button">
              Log In
            </button>
          </Link>
        </div>
      </header>
      <div className={styles.container}>
        <h2 className={styles.title}>Verify Your Email</h2>
        <p style={{ textAlign: 'center', marginBottom: '20px', color: '#666' }}>
          We've sent a 6-digit verification code to<br />
          <strong>{email}</strong>
        </p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="text"
            placeholder="Enter 6-digit OTP"
            value={otp}
            onChange={handleOtpChange}
            className={`${styles.input} ${styles.customInput}`}
            style={{
              textAlign: 'center',
              fontSize: '18px',
              letterSpacing: '1px',
              fontWeight: 'bold'
            }}
            maxLength={6}
            required
          />
          <div className={styles.buttonContainer}>
            <button
              type="submit"
              className={styles.blackButton}
              disabled={isLoading || otp.length !== 6}
            >
              {isLoading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </div>
        </form>
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <p style={{ color: '#666', fontSize: '14px' }}>
            Didn't receive the code?
          </p>
          <button
            type="button"
            onClick={handleResendOTP}
            disabled={resendCooldown > 0}
            style={{
              background: 'none',
              border: 'none',
              color: resendCooldown > 0 ? '#ccc' : '#007bff',
              cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
              textDecoration: 'underline',
              fontSize: '14px'
            }}
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
          </button>
        </div>
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            type="button"
            onClick={() => navigate('/auth/register')}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ← Back to Registration
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


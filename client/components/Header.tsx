import { Link, useNavigate, useLocation } from 'react-router-dom';
import Logo from './Logo';
import styles from '@/styles/Header.module.css';
import { useState, useRef, useEffect } from 'react';
import NotificationDropdown from './NotificationDropdown';
import { User } from '@shared/types';

interface HeaderProps {
  user: User | null;
  onMenuClick?: () => void;
  sidebarOpen?: boolean;
}

export default function Header({ user, onMenuClick, sidebarOpen }: HeaderProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const notifBtnRef = useRef<HTMLButtonElement>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const notifDropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const profileDropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const refreshUnreadCount = () => {
    if (user?._id || user?.id) {
      const userId = user._id || user.id;
      fetch(`/api/notifications?userId=${userId}`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          // Check is_read (database field) first, fallback to read for compatibility
          const count = Array.isArray(data) ? data.filter((n: { is_read?: boolean; read?: boolean }) => {
            return !(n.is_read ?? n.read ?? false);
          }).length : 0;
          setUnreadCount(count);
        })
        .catch(err => console.error('Error fetching notifications:', err));
    }
  };

  useEffect(() => {
    refreshUnreadCount();
  }, [user, notifOpen, location.pathname]);

  // Listen for notification read events
  useEffect(() => {
    const handleNotificationRead = () => {
      refreshUnreadCount();
    };

    window.addEventListener('notification-read', handleNotificationRead);
    return () => {
      window.removeEventListener('notification-read', handleNotificationRead);
    };
  }, [user]);

  const handleNotifMouseEnter = () => {
    if (notifDropdownTimeoutRef.current) {
      clearTimeout(notifDropdownTimeoutRef.current);
      notifDropdownTimeoutRef.current = null;
    }
    setNotifOpen(true);
  };

  const handleNotifMouseLeave = () => {
    notifDropdownTimeoutRef.current = setTimeout(() => {
      setNotifOpen(false);
    }, 200); // Small delay to allow moving to dropdown
  };

  const handleProfileMouseEnter = () => {
    if (profileDropdownTimeoutRef.current) {
      clearTimeout(profileDropdownTimeoutRef.current);
      profileDropdownTimeoutRef.current = null;
    }
    setProfileDropdownOpen(true);
  };

  const handleProfileMouseLeave = () => {
    profileDropdownTimeoutRef.current = setTimeout(() => {
      setProfileDropdownOpen(false);
    }, 200); // Small delay to allow moving to dropdown
  };

  useEffect(() => {
    return () => {
      if (profileDropdownTimeoutRef.current) {
        clearTimeout(profileDropdownTimeoutRef.current);
      }
      if (notifDropdownTimeoutRef.current) {
        clearTimeout(notifDropdownTimeoutRef.current);
      }
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      navigate('/auth/login');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/auth/login');
    }
  };

  return (
    <header className={styles.header} data-tg-tour="Welcome aboard 👋 This is your main navigation header. Here you can access notifications and your profile.">
      <div className={styles.navContainer}>
        {user && (
          <button 
            className={styles.mobileMenuButton}
            onClick={onMenuClick}
            aria-label="Toggle menu"
          >
            {sidebarOpen ? (
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="24" 
                height="24" 
                fill="currentColor" 
                viewBox="0 0 16 16"
              >
                <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z"/>
              </svg>
            ) : (
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="24" 
                height="24" 
                fill="currentColor" 
                viewBox="0 0 16 16"
              >
                <path fillRule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5"/>
              </svg>
            )}
          </button>
        )}
        <Logo />
      </div>
      <div className={styles.rightSection}>
        {user ? (
          <>
            <div 
              ref={notifDropdownRef}
              className={styles.notificationDropdownWrapper}
              onMouseEnter={handleNotifMouseEnter}
              onMouseLeave={handleNotifMouseLeave}
              data-tg-tour="🔔 Notifications - Click the bell icon to view your notifications. You'll see updates about document processing, profile changes, and system announcements."
            >
              <button ref={notifBtnRef} className={styles.iconButton} onClick={() => setNotifOpen(v => !v)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" className="bi bi-bell" viewBox="0 0 16 16">
                  <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2M8 1.918l-.797.161A4 4 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4 4 0 0 0-3.203-3.92zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5 5 0 0 1 13 6c0 .88.32 4.2 1.22 6" />
                </svg>
                {unreadCount > 0 && (
                  <span className={styles.notificationBadge}>{unreadCount}</span>
                )}
              </button>
              <NotificationDropdown user={user} open={notifOpen} onClose={() => setNotifOpen(false)} />
            </div>
            <div 
              ref={profileDropdownRef}
              className={styles.profileDropdownWrapper}
              onMouseEnter={handleProfileMouseEnter}
              onMouseLeave={handleProfileMouseLeave}
              data-tg-tour="👤 Profile Access - Click your profile avatar to quickly access your profile page and account settings."
            >
              <div className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-person-circle" viewBox="0 0 16 16">
                    <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0" />
                    <path fillRule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1" />
                  </svg>
                </div>
              </div>
              {profileDropdownOpen && (
                <div className={styles.profileDropdown}>
                  <Link to="/profile" className={styles.profileDropdownItem} onClick={() => setProfileDropdownOpen(false)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '8px' }}>
                      <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0" />
                      <path fillRule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1" />
                    </svg>
                    Profile
                  </Link>
                  <button className={styles.profileDropdownItem} onClick={handleLogout}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '8px' }}>
                      <path fillRule="evenodd" d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0z" />
                      <path fillRule="evenodd" d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3z" />
                    </svg>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-4">
            <Link to="/auth/login" className={styles.link}>
              <button className={`${styles.leftButton}`} type="button">
                <p className={styles.leftbuttontext}>Sign In</p>
              </button>
            </Link>
            <Link to="/auth/register" className={styles.link}>
              <button className={`${styles.blackButton} ${styles.loginButton}`} type="button">
                Sign Up
              </button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}


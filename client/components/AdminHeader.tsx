import { useState, useRef, useEffect } from 'react';
import styles from '@/styles/AdminHeader.module.css';
import Logo from '@/components/Logo';
import { User } from '@shared/types';

interface AdminHeaderProps {
  user: User | null;
  onLogout: () => void;
}

export default function AdminHeader({ user, onLogout }: AdminHeaderProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className={styles.adminHeader} data-tg-tour="🛡️ Welcome Admin! - Welcome to the Scaptract admin panel. You have access to additional management features." style={{ position: 'fixed', top: 0, left: 0, right: 0, width: '98%', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Logo />
      </div>
      <div className={styles.profileWrapper} ref={dropdownRef}>
        <button
          onClick={() => setOpen(v => !v)}
          className={styles.profileButton}
        >
          <svg className="w-7 h-7" fill="white" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12 20a7.966 7.966 0 0 1-5.002-1.756l.002.001v-.683c0-1.794 1.492-3.25 3.333-3.25h3.334c1.84 0 3.333 1.456 3.333 3.25v.683A7.966 7.966 0 0 1 12 20ZM2 12C2 6.477 6.477 2 12 2s10 4.477 10 10c0 5.5-4.44 9.963-9.932 10h-.138C6.438 21.962 2 17.5 2 12Zm10-5c-1.84 0-3.333 1.455-3.333 3.25S10.159 13.5 12 13.5c1.84 0 3.333-1.455 3.333-3.25S13.841 7 12 7Z" clipRule="evenodd" />
          </svg>
        </button>
        {open && (
          <div className={styles.dropdown}>
            <div className={styles.userName}>{user?.name}</div>
            <div className={styles.userEmail}>{user?.email}</div>
            <button
              onClick={onLogout}
              className={styles.logoutButton}
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}


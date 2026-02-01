import { ReactNode } from 'react';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import TourButton from './TourButton';
import AIAssistant from './AIAssistant';
import styles from '@/styles/AdminLayout.module.css';
import { User } from '@shared/types';

interface AdminLayoutProps {
  children: ReactNode;
  user?: User | null;
}

export default function AdminLayout({ children, user }: AdminLayoutProps) {
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      window.location.href = '/auth/login';
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/auth/login';
    }
  };

  return (
    <div className={styles.layout}>
      {user?.role === 'admin' && <AdminSidebar />}
      <div className={user?.role === 'admin' ? styles.contentWithSidebar : styles.content}>
        <AdminHeader user={user || null} onLogout={handleLogout} />
        <main className={styles.main}>
          {children}
        </main>
      </div>
      {user && <TourButton user={user} />}
      {user && <AIAssistant user={user} />}
    </div>
  );
}


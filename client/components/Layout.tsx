import { ReactNode, useState, useEffect } from 'react';
import Header from './Header';
import Footer from './Footer';
import Sidebar from './Sidebar';
import SessionStatus from './SessionStatus';
import TourButton from './TourButton';
import Loading from './Loading';
import AIAssistant from './AIAssistant';
import { useMinLoading } from './useMinLoading';
import { useSessionManager } from '@/lib/sessionManager';
import styles from '@/styles/Layout.module.css';
import { User } from '@shared/types';

interface LayoutProps {
  children?: ReactNode;
  user?: User | null;
  loading?: boolean;
  loadingText?: string;
}

function Layout({ children, user, loading = false, loadingText = 'Loading' }: LayoutProps) {
  useSessionManager();
  // Use minimum loading duration to prevent flickering
  const showLoading = useMinLoading(loading, 500);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleResize = () => {
      // Close sidebar when window is resized to desktop size
      if (window.innerWidth > 768) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen && window.innerWidth <= 768) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  return (
    <div className={styles.layoutRoot}>
      <SessionStatus user={user || null} showDetails={false} />
      <Header 
        user={user || null} 
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
      />
      <div className={styles.layoutFlex}>
        <Sidebar 
          user={user || null} 
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className={`${styles.layoutMain} ${!user ? styles.layoutMainNoSidebar : ''}`}>
          {showLoading ? (
            <div className={styles.fadeIn} style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              minHeight: 'calc(100vh - 200px)'
            }}>
              <Loading text={loadingText} />
            </div>
          ) : (
            <div className={styles.fadeIn}>
              {children}
            </div>
          )}
        </main>
      </div>
      <Footer />
      {user && <TourButton user={user} />}
      {user && <AIAssistant user={user} />}
    </div>
  );
}

export default Layout;

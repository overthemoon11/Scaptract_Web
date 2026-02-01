import { Link, useLocation } from 'react-router-dom';
import styles from '@/styles/Sidebar.module.css';
import { User } from '@shared/types';
import { 
  FaUsers, 
  FaUserShield, 
  FaFileAlt, 
  FaQuestionCircle, 
  FaTicketAlt,
  FaFolder,
  FaQrcode,
  FaUser,
  FaHeadset,
  FaPaperPlane,
  FaChartBar,
  FaHome
} from 'react-icons/fa';
import { IconType } from 'react-icons';

interface SidebarProps {
  user: User | null;
  isOpen?: boolean;
  onClose?: () => void;
}

interface MenuItem {
  label: string;
  path: string;
  tourId: string;
  icon: IconType;
}

interface MenuCategory {
  label: string;
  items: MenuItem[];
}

const getTourText = (tourId: string, label: string): string => {
  const tourTexts: Record<string, string> = {
    'sidebar-home': `🏠 ${label} - Your home dashboard with AI assistant and insights.`,
    'sidebar-documents': `📁 ${label} - Here you can view and manage all your scanned and uploaded documents. This is where your processed files will be stored.`,
    'sidebar-scanner': `📷 ${label} - The Scanner is where you can upload documents or use your camera to scan physical documents for OCR processing.`,
    'sidebar-support': `🆘 ${label} - Need help? The Support section contains FAQs and answers to common questions.`,
    'sidebar-submit-ticket': `🎫 ${label} - Submit a support ticket if you need assistance.`,
    'sidebar-user-mgmt': `👥 ${label} - Manage all user accounts, view user statistics, and handle user-related administrative tasks.`,
    'sidebar-admin-mgmt': `🛡️ ${label} - Manage administrator accounts and permissions.`,
    'sidebar-document-mgmt': `📄 ${label} - Overview of all documents in the system, storage usage, and processing status.`,
    'sidebar-faq-mgmt': `❓ ${label} - Create, edit, and manage FAQ content that users see in the support section.`,
    'sidebar-support-tickets': `🎫 ${label} - Handle customer support requests, respond to tickets, and track resolution status.`,
    'sidebar-analytics': `📊 ${label} - View analytics and insights about your system usage.`,
  };
  return tourTexts[tourId] || `${label} - Click to navigate to ${label}.`;
};

export default function Sidebar({ user, isOpen = false, onClose }: SidebarProps) {
  const location = useLocation();

  if (!user) return null;

  const menuCategories: MenuCategory[] = user.role === 'admin' ? [
    {
      label: 'Management',
      items: [
        { label: 'User', path: '/admin/user', tourId: 'sidebar-user-mgmt', icon: FaUsers },
        { label: 'Admin', path: '/admin/admin', tourId: 'sidebar-admin-mgmt', icon: FaUserShield },
        { label: 'Documents', path: '/admin/document', tourId: 'sidebar-document-mgmt', icon: FaFileAlt },
        { label: 'FAQ', path: '/admin/faq', tourId: 'sidebar-faq-mgmt', icon: FaQuestionCircle },
        { label: 'Support Tickets', path: '/admin/support-ticket', tourId: 'sidebar-support-tickets', icon: FaTicketAlt },
      ],
    },
    {
      label: 'Analytics',
      items: [
        { label: 'Analytics', path: '/admin/analytics', tourId: 'sidebar-analytics', icon: FaChartBar },
        // Add analytics items here when you have analytics pages
        // { label: 'Dashboard', path: '/admin/analytics', tourId: 'sidebar-analytics', icon: FaChartBar },
      ],
    },
    
  ] : [
    {
      label: 'Data Extraction',
      items: [
        // { label: 'Home', path: '/home', tourId: 'sidebar-home', icon: FaHome },
        { label: 'Documents', path: '/documents', tourId: 'sidebar-documents', icon: FaFolder },
        { label: 'Scanner', path: '/scanner', tourId: 'sidebar-scanner', icon: FaQrcode },
      ],
    },
    {
      label: 'Support',
      items: [
        { label: 'FAQ', path: '/support', tourId: 'sidebar-support', icon: FaHeadset },
        { label: 'Submit Ticket', path: '/support/ticket', tourId: 'sidebar-submit-ticket', icon: FaPaperPlane },
        // { label: 'Profile', path: '/profile', tourId: 'sidebar-profile', icon: FaUser },
      ],
    },
  ];

  const handleLinkClick = () => {
    // Close sidebar on mobile when a link is clicked
    if (window.innerWidth <= 768 && onClose) {
      onClose();
    }
  };

  return (
    <>
      {isOpen && <div className={styles.sidebarOverlay} onClick={onClose} />}
      <aside 
        className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`} 
        data-tg-tour={user.role === 'admin' ? '🛡️ Admin Navigation - Your admin sidebar contains powerful management tools for users, documents, FAQs, and support tickets.' : '📋 Navigation Menu - This sidebar contains all the main features of Scaptract. Let\'s explore each section!'}
      >
        <nav>
          <ul className={styles.menuList}>
            {menuCategories.map((category, categoryIndex) => (
              <li key={categoryIndex}>
                {category.label && (
                  <div className={styles.categoryLabel}>{category.label}</div>
                )}
                {category.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.path} className={styles.menuItem}>
                      <Link
                        to={item.path}
                        className={`${styles.menuButton} ${location.pathname === item.path ? styles.active : ''}`}
                        data-tg-tour={getTourText(item.tourId, item.label)}
                        onClick={handleLinkClick}
                      >
                        <Icon className={styles.icon} />
                        <span className={styles.label}>{item.label}</span>
                      </Link>
                    </div>
                  );
                })}
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}


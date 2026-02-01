import { Link, useLocation } from 'react-router-dom';
import styles from '@/styles/AdminSidebar.module.css';

interface MenuItem {
  label: string;
  path: string;
}

const adminMenu: MenuItem[] = [
  { label: 'User', path: '/admin/user' },
  { label: 'Admin', path: '/admin/admin' },
  { label: 'Document', path: '/admin/document' },
  { label: 'FAQ', path: '/admin/faq' },
  { label: 'Support Ticket', path: '/admin/support-ticket' },
];

export default function AdminSidebar() {
  const location = useLocation();

  const getTourText = (label: string, path: string): string => {
    const tourTexts: Record<string, string> = {
      '/admin/user': `👥 ${label} - Manage all user accounts, view user statistics, and handle user-related administrative tasks.`,
      '/admin/admin': `🛡️ ${label} - Manage administrator accounts and permissions.`,
      '/admin/document': `📄 ${label} - Overview of all documents in the system, storage usage, and processing status.`,
      '/admin/faq': `❓ ${label} - Create, edit, and manage FAQ content that users see in the support section.`,
      '/admin/support-ticket': `🎫 ${label} - Handle customer support requests, respond to tickets, and track resolution status.`,
    };
    return tourTexts[path] || `${label} - Click to navigate to ${label}.`;
  };

  return (
    <aside className={styles.adminSidebar} data-tg-tour="🛡️ Admin Navigation - Your admin sidebar contains powerful management tools for users, documents, FAQs, and support tickets.">
      <nav>
        <ul className={styles.menuList}>
          {adminMenu.map(item => (
            <li key={item.path} className={styles.menuItem}>
              <Link
                to={item.path}
                className={`${styles.menuLink} ${location.pathname === item.path ? styles.menuLinkActive : ''}`}
                data-tg-tour={getTourText(item.label, item.path)}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}


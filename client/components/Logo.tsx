import { Link } from 'react-router-dom';
import styles from '@/styles/Logo.module.css';

export default function Logo() {
  return (
    <Link to="/" className={styles.logoLink}>
      <div className={styles.logoContainer}>
        <img
          src="/logo.png"
          alt="Scaptract Logo"
          className={styles.logoImage}
        />
      </div>
    </Link>
  );
}

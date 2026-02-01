import React from 'react';
import styles from '@/styles/NotificationCard.module.css';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface NotificationCardProps {
  type: NotificationType;
  title: string;
  message: string;
  primaryButtonText?: string;
  secondaryButtonText?: string;
  onPrimaryClick?: () => void;
  onSecondaryClick?: () => void;
  onClose?: () => void;
  showCloseButton?: boolean;
}

const getIcon = (type: NotificationType) => {
  switch (type) {
    case 'success':
      return (
        <svg className={styles.icon} viewBox="0 0 448 512">
          <path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/>
        </svg>
      );
    case 'error':
      return (
        <svg className={styles.icon} viewBox="0 0 384 512">
          <path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/>
        </svg>
      );
    case 'warning':
      return (
        <svg className={styles.icon} viewBox="0 0 512 512">
          <path d="M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480H40c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24V296c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z"/>
        </svg>
      );
    case 'info':
      return (
        <svg className={styles.icon} viewBox="0 0 448 512">
          <path d="M224 96a160 160 0 1 0 0 320 160 160 0 1 0 0-320zM224 0C100.3 0 0 100.3 0 224S100.3 448 224 448 448 347.7 448 224 347.7 0 224 0zM200 344V280H184c-13.3 0-24-10.7-24-24s10.7-24 24-24h16c22.1 0 40 17.9 40 40v40c0 13.3-10.7 24-24 24s-24-10.7-24-24zm32-144c0-17.7-14.3-32-32-32s-32 14.3-32 32 14.3 32 32 32 32-14.3 32-32z"/>
        </svg>
      );
    default:
      return (
        <svg className={styles.icon} viewBox="0 0 448 512">
          <path d="M224 0c-17.7 0-32 14.3-32 32V51.2C119 66 64 130.6 64 208v18.8c0 47-17.3 92.4-48.5 127.6l-7.4 8.3c-8.4 9.4-10.4 22.9-5.3 34.4S19.4 416 32 416H416c12.6 0 24-7.4 29.2-18.9s3.1-25-5.3-34.4l-7.4-8.3C401.3 319.2 384 273.9 384 226.8V208c0-77.4-55-142-128-156.8V32c0-17.7-14.3-32-32-32zm45.3 493.3c12-12 18.7-28.3 18.7-45.3H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7z"/>
        </svg>
      );
  }
};

export default function NotificationCard({
  type,
  title,
  message,
  primaryButtonText,
  secondaryButtonText,
  onPrimaryClick,
  onSecondaryClick,
  onClose,
  showCloseButton = true
}: NotificationCardProps) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.notificationCard} ${styles[type]}`} onClick={(e) => e.stopPropagation()}>
        {showCloseButton && onClose && (
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 384 512" width="16" height="16">
              <path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/>
            </svg>
          </button>
        )}
        <p className={styles.notificationHeading}>{title}</p>
        <div className={styles.iconContainer}>
          {getIcon(type)}
        </div>
        <p className={styles.notificationPara}>{message}</p>
        {(primaryButtonText || secondaryButtonText) && (
          <div className={styles.buttonContainer}>
            {primaryButtonText && (
              <button className={styles.primaryBtn} onClick={onPrimaryClick}>
                {primaryButtonText}
              </button>
            )}
            {secondaryButtonText && (
              <button className={styles.secondaryBtn} onClick={onSecondaryClick || onClose}>
                {secondaryButtonText}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

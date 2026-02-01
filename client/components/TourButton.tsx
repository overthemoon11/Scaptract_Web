import { useTour } from '@/contexts/TourContext';
import WebsiteGuide from './WebsiteGuide';
import styles from '@/styles/WebsiteGuide.module.css';
import { User } from '@shared/types';

interface TourButtonProps {
  user: User;
}

const TourButton = ({ user }: TourButtonProps) => {
  const { isActive, startTour, isTourCompleted } = useTour();
  
  // Check if in developer mode
  const isDevMode = import.meta.env.DEV || import.meta.env.VITE_DEVMODE === 'true';
  
  // In dev mode, always show button. Otherwise, only show if tour not completed
  const hasCompletedTour = isTourCompleted(user);
  const shouldShowButton = isDevMode || !hasCompletedTour;

  const handleStartTour = () => {
    startTour(user);
  };

  // Don't show button if tour is active or if it shouldn't be shown
  if (isActive || !shouldShowButton) {
    return isActive ? <WebsiteGuide /> : null;
  }

  return (
    <>
      <button 
        className={styles.startTourButton}
        onClick={handleStartTour}
        style={{
          position: 'fixed',
          bottom: '30px',
          right: '90px',
          zIndex: 1000,
          borderRadius: '50px',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 20px rgba(59, 130, 246, 0.4)',
        }}
        title="Start Website Tour"
      >
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        Start Tour
      </button>
      
      {isActive && <WebsiteGuide />}
    </>
  );
};

export default TourButton;


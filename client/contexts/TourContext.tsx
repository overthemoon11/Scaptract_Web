import { createContext, useContext, useState, ReactNode } from 'react';
import { User } from '@shared/types';

interface TourState {
  isActive: boolean;
  user: User | null;
}

interface TourContextType extends TourState {
  startTour: (user: User) => void;
  closeTour: () => void;
  completeTour: (user: User) => void;
  isTourCompleted: (user: User | null) => boolean;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export const useTour = (): TourContextType => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
};

interface TourProviderProps {
  children: ReactNode;
}

export const TourProvider = ({ children }: TourProviderProps) => {
  const [tourState, setTourState] = useState<TourState>({
    isActive: false,
    user: null
  });
  const [tourCompleted, setTourCompleted] = useState<Record<string, boolean>>({});

  const startTour = (user: User) => {
    setTourState({
      isActive: true,
      user: user
    });
  };

  const closeTour = () => {
    setTourState({
      isActive: false,
      user: null
    });
  };

  const completeTour = (user: User) => {
    // Mark tour as completed in localStorage
    const userId = user._id || user.id;
    if (userId) {
      localStorage.setItem(`tour_completed_${userId}`, 'true');
      // Update state to trigger re-render
      setTourCompleted(prev => ({ ...prev, [userId]: true }));
    }
    closeTour();
  };

  const isTourCompleted = (user: User | null): boolean => {
    if (!user) return false;
    const userId = user._id || user.id;
    if (!userId) return false;
    // Check state first, then localStorage
    if (tourCompleted[userId]) return true;
    const completed = localStorage.getItem(`tour_completed_${userId}`) === 'true';
    if (completed && !tourCompleted[userId]) {
      setTourCompleted(prev => ({ ...prev, [userId]: true }));
    }
    return completed;
  };

  const value: TourContextType = {
    ...tourState,
    startTour,
    closeTour,
    completeTour,
    isTourCompleted
  };

  return (
    <TourContext.Provider value={value}>
      {children}
    </TourContext.Provider>
  );
};

export default TourContext;


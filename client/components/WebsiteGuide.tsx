import { useEffect, useRef } from 'react';
import { useTour } from '@/contexts/TourContext';
// Style
import "@sjmc11/tourguidejs/src/scss/tour.scss";
// JS
import { TourGuideClient } from "@sjmc11/tourguidejs/src/Tour";
import './WebsiteGuide.css';

// Global tour instance to prevent duplicates
let globalTourInstance: TourGuideClient | null = null;
let globalTourActive = false;

const WebsiteGuide = () => {
  const { isActive, user, closeTour } = useTour();
  const tourInstanceRef = useRef<TourGuideClient | null>(null);

  useEffect(() => {
    if (!isActive || !user) {
      // Clean up if tour is not active
      if (globalTourInstance) {
        globalTourInstance = null;
        globalTourActive = false;
      }
      tourInstanceRef.current = null;
      return;
    }

    // Prevent duplicate initialization - check global state
    if (globalTourActive || globalTourInstance) {
      return;
    }

    // Small delay to ensure DOM is ready and prevent race conditions
    const initTimer = setTimeout(() => {
      // Double-check to prevent duplicates
      if (globalTourActive || globalTourInstance) {
        return;
      }

      // Initialize TourGuideJS
      const tg = new TourGuideClient({
        // Tour options
        backdropColor: 'rgba(0, 0, 0, 0.85)',
        // Padding around highlighted element for better appearance
        targetPadding: 12,
        // Customize button labels
        nextLabel: 'Next',
        prevLabel: 'Previous',
        finishLabel: 'Finish',
        // Auto scroll to highlighted element
        autoScroll: true,
        // Additional styling options
        dialogZ: 10000,
        dialogClass: 'custom-tour-dialog',
      });

      // Set global and local references
      globalTourInstance = tg;
      globalTourActive = true;
      tourInstanceRef.current = tg;

      // Handle tour events
      tg.onFinish(() => {
        globalTourInstance = null;
        globalTourActive = false;
        tourInstanceRef.current = null;
        closeTour();
      });

      // Start the tour
      tg.start();
    }, 150);

    // Cleanup
    return () => {
      clearTimeout(initTimer);
    };
  }, [isActive, user, closeTour]);

  return null; // TourGuideJS handles the UI
};

export default WebsiteGuide;

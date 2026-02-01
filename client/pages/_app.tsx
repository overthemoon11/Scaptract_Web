import { TourProvider } from '@/contexts/TourContext';
import '@/app/globals.css';
import { ComponentType } from 'react';

interface AppProps {
  Component: ComponentType<any>;
  pageProps: any;
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <TourProvider>
      <Component {...pageProps} />
    </TourProvider>
  );
}


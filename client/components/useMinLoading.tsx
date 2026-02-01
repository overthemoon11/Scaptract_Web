import { useEffect, useState } from 'react';

export function useMinLoading(isLoading: boolean, minDuration = 500) {
  const [show, setShow] = useState(isLoading);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isLoading) {
      setShow(true);
    } else {
      // Keep showing loading for minimum duration even after isLoading becomes false
      timer = setTimeout(() => {
        setShow(false);
      }, minDuration);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isLoading, minDuration]);

  return show;
}


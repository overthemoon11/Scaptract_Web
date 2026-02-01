import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@shared/types';

interface UseAuthReturn {
  user: User | null;
  loading: boolean;
}

export default function useAuth(redirectIfNoUser = true): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function checkSession() {
      const res = await fetch('/api/profile', { credentials: 'include' });
      const data = await res.json();

      if (data.user) {
        setUser(data.user);
      } else if (redirectIfNoUser) {
        navigate('/auth/login');
      }

      setLoading(false);
    }

    checkSession();
  }, [redirectIfNoUser, navigate]);

  return { user, loading };
}


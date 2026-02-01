import React from 'react';
import { useLocation, Link } from 'react-router-dom';

interface SetNavProps {
  className?: string;
}

export function SetNav({ className = '' }: SetNavProps): React.JSX.Element {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  return (
    <nav className={`flex items-center space-x-2 text-sm ${className}`}>
      <Link
        to="/"
        className="text-gray-500 hover:text-gray-700 dark:text-dark-200 dark:hover:text-dark-50"
      >
        Home
      </Link>
      {pathnames.map((name, index) => {
        const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        return (
          <React.Fragment key={routeTo}>
            <span className="text-gray-400 dark:text-dark-400">/</span>
            {isLast ? (
              <span className="text-gray-900 dark:text-dark-50 font-medium">
                {name.charAt(0).toUpperCase() + name.slice(1)}
              </span>
            ) : (
              <Link
                to={routeTo}
                className="text-gray-500 hover:text-gray-700 dark:text-dark-200 dark:hover:text-dark-50"
              >
                {name.charAt(0).toUpperCase() + name.slice(1)}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}


import React, { ReactNode } from 'react';

interface TagProps {
  children: ReactNode;
  color?: 'primary' | 'error' | 'success' | 'warning' | 'info' | 'neutral';
  variant?: 'filled' | 'outlined' | 'soft';
  className?: string;
}

export function Tag({
  children,
  color = 'neutral',
  variant = 'soft',
  className = '',
}: TagProps): React.JSX.Element {
  const baseClasses = 'inline-flex items-center font-medium text-xs';
  
  const colorClasses = {
    primary: {
      filled: 'bg-primary-600 text-white',
      outlined: 'border border-primary-600 text-primary-600',
      soft: 'bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-200',
    },
    error: {
      filled: 'bg-red-600 text-white',
      outlined: 'border border-red-600 text-red-600',
      soft: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-200',
    },
    success: {
      filled: 'bg-green-600 text-white',
      outlined: 'border border-green-600 text-green-600',
      soft: 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-200',
    },
    warning: {
      filled: 'bg-yellow-600 text-white',
      outlined: 'border border-yellow-600 text-yellow-600',
      soft: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-200',
    },
    info: {
      filled: 'bg-blue-600 text-white',
      outlined: 'border border-blue-600 text-blue-600',
      soft: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-200',
    },
    neutral: {
      filled: 'bg-gray-600 text-white',
      outlined: 'border border-gray-600 text-gray-600',
      soft: 'bg-gray-50 text-gray-600 dark:bg-gray-500/10 dark:text-gray-200',
    },
  };

  const classes = `${baseClasses} ${colorClasses[color][variant]} ${className}`;

  return (
    <span className={classes}>
      {children}
    </span>
  );
}


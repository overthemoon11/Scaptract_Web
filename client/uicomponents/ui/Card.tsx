import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  skin?: 'default' | 'shadow' | 'bordered';
  className?: string;
}

export function Card({ children, skin = 'default', className = '' }: CardProps): React.JSX.Element {
  const baseClasses = 'bg-white dark:bg-dark-700 rounded-lg';
  
  const skinClasses = {
    default: '',
    shadow: 'shadow-md',
    bordered: 'border border-gray-200 dark:border-dark-500',
  };

  const classes = `${baseClasses} ${skinClasses[skin]} ${className}`;

  return (
    <div className={classes}>
      {children}
    </div>
  );
}


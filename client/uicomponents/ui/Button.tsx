import React, { ReactNode, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  isIcon?: boolean;
  color?: 'primary' | 'neutral' | 'error' | 'success' | 'warning' | 'info';
  variant?: 'filled' | 'outlined' | 'flat' | 'soft';
  className?: string;
}

export function Button({
  children,
  isIcon = false,
  color = 'primary',
  variant = 'filled',
  className = '',
  ...props
}: ButtonProps): React.JSX.Element {
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const colorClasses = {
    primary: {
      filled: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
      outlined: 'border-2 border-primary-600 text-primary-600 hover:bg-primary-50 focus:ring-primary-500',
      flat: 'text-primary-600 hover:bg-primary-50 focus:ring-primary-500',
      soft: 'bg-primary-50 text-primary-600 hover:bg-primary-100 focus:ring-primary-500',
    },
    neutral: {
      filled: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
      outlined: 'border-2 border-gray-600 text-gray-600 hover:bg-gray-50 focus:ring-gray-500',
      flat: 'text-gray-600 hover:bg-gray-50 focus:ring-gray-500',
      soft: 'bg-gray-50 text-gray-600 hover:bg-gray-100 focus:ring-gray-500',
    },
    error: {
      filled: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
      outlined: 'border-2 border-red-600 text-red-600 hover:bg-red-50 focus:ring-red-500',
      flat: 'text-red-600 hover:bg-red-50 focus:ring-red-500',
      soft: 'bg-red-50 text-red-600 hover:bg-red-100 focus:ring-red-500',
    },
    success: {
      filled: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
      outlined: 'border-2 border-green-600 text-green-600 hover:bg-green-50 focus:ring-green-500',
      flat: 'text-green-600 hover:bg-green-50 focus:ring-green-500',
      soft: 'bg-green-50 text-green-600 hover:bg-green-100 focus:ring-green-500',
    },
    warning: {
      filled: 'bg-yellow-600 text-white hover:bg-yellow-700 focus:ring-yellow-500',
      outlined: 'border-2 border-yellow-600 text-yellow-600 hover:bg-yellow-50 focus:ring-yellow-500',
      flat: 'text-yellow-600 hover:bg-yellow-50 focus:ring-yellow-500',
      soft: 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100 focus:ring-yellow-500',
    },
    info: {
      filled: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
      outlined: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500',
      flat: 'text-blue-600 hover:bg-blue-50 focus:ring-blue-500',
      soft: 'bg-blue-50 text-blue-600 hover:bg-blue-100 focus:ring-blue-500',
    },
  };

  const sizeClasses = isIcon ? 'p-2' : 'px-4 py-2';
  const roundedClasses = isIcon ? 'rounded-full' : 'rounded-md';

  const classes = `${baseClasses} ${sizeClasses} ${roundedClasses} ${colorClasses[color][variant]} ${className}`;

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}


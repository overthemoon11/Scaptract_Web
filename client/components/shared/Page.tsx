import React, { ReactNode } from 'react';

interface PageProps {
  title?: string;
  children: ReactNode;
}

export function Page({ title, children }: PageProps): React.JSX.Element {
  return (
    <div className="w-full h-full">
      {title && (
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-50 mb-4">
          {title}
        </h1>
      )}
      {children}
    </div>
  );
}


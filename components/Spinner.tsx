import React from 'react';
import { LoaderCircle } from 'lucide-react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-10 w-10',
};

/**
 * A reusable spinner component for indicating loading states.
 */
const Spinner: React.FC<SpinnerProps> = ({ size = 'md' }) => {
  return (
    <LoaderCircle 
      className={`${sizeClasses[size]} animate-spin text-primary`}
    />
  );
};

export default Spinner;

import { motion } from 'framer-motion';

interface GroupBadgeProps {
  name: string;
  color: string;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export function GroupBadge({ name, color, size = 'medium', className = '' }: GroupBadgeProps) {
  const sizeClasses = {
    small: 'w-6 h-6 text-xs',
    medium: 'w-8 h-8 text-sm',
    large: 'w-10 h-10 text-base'
  };

  const textSizeClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base'
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-bold shadow-md`}
        style={{ backgroundColor: color }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
      <span className={`font-semibold text-gray-800 ${textSizeClasses[size]}`}>
        {name}
      </span>
    </div>
  );
}



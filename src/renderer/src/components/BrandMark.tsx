import React from 'react';

interface BrandMarkProps {
  compact?: boolean;
  className?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ compact = false, className = '' }) => {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div className={`relative flex items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm ${
        compact ? 'h-9 w-9' : 'h-16 w-16'
      }`}>
        <svg className={compact ? 'h-5 w-5' : 'h-9 w-9'} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            d="M7 4.75h10L13.5 10 17 19.25H7L10.5 10 7 4.75Z"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <path d="M9.5 8.5h5" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </div>
      <div className="min-w-0">
        <div className={`font-semibold tracking-tight text-gray-900 ${compact ? 'text-base' : 'text-3xl'}`}>
          AuroraTex
        </div>
        {!compact && (
          <div className="text-sm text-gray-500">
            Offline LaTeX workspace
          </div>
        )}
      </div>
    </div>
  );
};

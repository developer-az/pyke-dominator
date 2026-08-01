import React from 'react';

/** Clean thorn / dagger mark — chrome aesthetic without the star burst. */
export const ChromeMark: React.FC<{
  className?: string;
  size?: number;
  style?: React.CSSProperties;
}> = ({ className = '', size = 14, style }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
    style={style}
  >
    {/* Vertical thorn blade */}
    <path
      fill="currentColor"
      d="M12 1.5 L13.4 9.2 L12.6 16.5 L12 22.5 L11.4 16.5 L10.6 9.2 Z"
    />
    {/* Horizontal crossbar / thorns */}
    <path
      fill="currentColor"
      opacity="0.9"
      d="M4.5 10.2 L9.8 11.2 L9.8 12.8 L4.5 13.8 L3 12 Z"
    />
    <path
      fill="currentColor"
      opacity="0.9"
      d="M19.5 10.2 L21 12 L19.5 13.8 L14.2 12.8 L14.2 11.2 Z"
    />
    {/* Small side barbs */}
    <path fill="currentColor" opacity="0.65" d="M12 6.2 L14.2 7.4 L12 7.1 L9.8 7.4 Z" />
    <circle cx="12" cy="11.8" r="1.35" fill="#070708" />
    <circle cx="12" cy="11.8" r="0.55" fill="currentColor" />
  </svg>
);

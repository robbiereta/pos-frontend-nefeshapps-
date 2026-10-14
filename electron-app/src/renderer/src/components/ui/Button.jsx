import React from 'react';
import './Button.css';

/**
 * Modern button.
 * Variants: primary | secondary | ghost | danger
 * Sizes:    sm | md | lg
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  leftIcon = null,
  rightIcon = null,
  children,
  className = '',
  disabled,
  ...rest
}) {
  const classes = [
    'btn-modern',
    `btn-modern--${variant}`,
    `btn-modern--${size}`,
    fullWidth ? 'btn-modern--full' : '',
    loading ? 'btn-modern--loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading ? <span className="btn-modern__spinner" aria-hidden /> : leftIcon}
      <span className="btn-modern__label">{children}</span>
      {rightIcon}
    </button>
  );
}

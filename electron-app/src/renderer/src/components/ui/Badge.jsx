import React from 'react';

/**
 * Status pill / badge.
 * tone: success | warning | danger | info | neutral
 */
export default function Badge({ tone = 'neutral', icon = null, children, className = '', ...rest }) {
  return (
    <span className={`pill pill--${tone} ${className}`} {...rest}>
      {icon && <span aria-hidden>{icon}</span>}
      {children}
    </span>
  );
}

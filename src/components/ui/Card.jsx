import React from 'react';
import './Card.css';

export default function Card({
  title,
  subtitle,
  action = null,
  elevated = false,
  padding = 'md',
  className = '',
  children,
  ...rest
}) {
  const classes = [
    'card-modern',
    `card-modern--pad-${padding}`,
    elevated ? 'card-modern--elevated' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={classes} {...rest}>
      {(title || action) && (
        <header className="card-modern__header">
          <div>
            {title && <h3 className="card-modern__title">{title}</h3>}
            {subtitle && <p className="card-modern__subtitle">{subtitle}</p>}
          </div>
          {action && <div className="card-modern__action">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

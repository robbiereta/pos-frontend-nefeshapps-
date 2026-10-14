import React from 'react';

export function Skeleton({ width = '100%', height = 14, radius = 6, className = '', style = {} }) {
  return (
    <span
      className={`skeleton ${className}`}
      style={{ display: 'inline-block', width, height, borderRadius: radius, ...style }}
      aria-hidden
    />
  );
}

export function SkeletonStack({ rows = 3, gap = 12, lastWidth = '60%' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} width={i === rows - 1 ? lastWidth : '100%'} height={14} />
      ))}
    </div>
  );
}

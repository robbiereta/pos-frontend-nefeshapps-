import React from 'react';

export default function EmptyState({ icon = '📭', title = 'Sin datos', description, action = null }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden>{icon}</div>
      <div className="empty-state__title">{title}</div>
      {description && <div className="empty-state__desc">{description}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

import React from 'react';

interface TopbarProps {
  title: string;
  hasUnsavedChanges?: boolean;
  canInstall?: boolean;
  onApply?: () => void;
  onInstallApp?: () => void;
  onToggleSidebar?: () => void;
  applying?: boolean;
}

export function Topbar({ title, hasUnsavedChanges, canInstall, onApply, onInstallApp, onToggleSidebar, applying }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar-title-row">
        <button type="button" className="topbar-menu-btn" aria-label="Open menu" onClick={onToggleSidebar}>
          ☰
        </button>
        <h1 className="topbar-title">{title}</h1>
      </div>
      <div className="topbar-actions">
        {canInstall && (
          <button
            className="btn btn-secondary"
            onClick={onInstallApp}
          >
            Install app
          </button>
        )}
        {hasUnsavedChanges && (
          <button
            className="btn btn-primary"
            onClick={onApply}
            disabled={applying}
          >
            {applying ? 'Applying...' : 'Apply Changes'}
          </button>
        )}
      </div>
    </header>
  );
}

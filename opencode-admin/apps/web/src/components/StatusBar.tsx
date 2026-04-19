import React from 'react';

interface StatusBarProps {
  hasUnsavedChanges: boolean;
  lastApplied: string | null;
}

export function StatusBar({ hasUnsavedChanges, lastApplied }: StatusBarProps) {
  return (
    <div className={`status-bar ${hasUnsavedChanges ? 'unsaved' : ''}`}>
      <div className="status-indicator">
        <span className={`status-dot ${hasUnsavedChanges ? 'warning' : 'success'}`}></span>
        <span>{hasUnsavedChanges ? 'Unsaved changes' : 'All changes applied'}</span>
      </div>
      {lastApplied && (
        <div className="status-indicator">
          <span className="status-dot success"></span>
          <span>Last applied: {new Date(lastApplied).toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

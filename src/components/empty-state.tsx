"use client";

type EmptyStateProps = {
  emoji: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ emoji, title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="empty-state-full">
      <span className="empty-state-emoji">{emoji}</span>
      <strong className="empty-state-title">{title}</strong>
      {message ? <p className="empty-state-message">{message}</p> : null}
      {actionLabel && onAction ? (
        <button type="button" className="empty-state-action" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

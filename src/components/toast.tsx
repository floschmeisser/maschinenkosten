"use client";

export type ToastType = "success" | "error";

export type Toast = {
  id: string;
  message: string;
  type: ToastType;
};

type ToastContainerProps = {
  toasts: Toast[];
};

export function ToastContainer({ toasts }: ToastContainerProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}

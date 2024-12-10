import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import React, { useEffect } from 'react';

interface ToastNotificationProps {
  /** The message to display */
  message: string;
  /** The type of the notification. 'success' (default) or 'error' */
  type?: 'success' | 'error';
  /** The duration in milliseconds to display the notification. Default is 2000ms */
  duration?: number;
  /** Callback function to close the notification */
  onClose: () => void;
}

/**
 * Toast notification component.
 * @param message - The message to display.
 * @param type - The type of the notification. 'success' (default) or 'error'.
 * @param duration - The duration in milliseconds to display the notification. Default is 2000ms.
 * @param onClose - Callback function to close the notification.
 */
export const ToastNotification: React.FC<ToastNotificationProps> = ({
  message,
  type = 'success',
  duration = 2000,
  onClose,
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className="toast-container">
      <div className={`toast ${type}`}>
        {type === 'error' ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        <span>{message}</span>
        <button onClick={onClose} className="toast-close-button">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

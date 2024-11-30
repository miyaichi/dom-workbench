import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface ToastNotificationProps {
  /** The message to display */
  message: string;
  /** The type of the notification. 'success' (default) or 'error' */
  type?: 'success' | 'error';
  /** The duration in milliseconds to display the notification. Default is 2000ms */
  duration?: number;
}

/**
 * Toast notification component.
 * @param message - The message to display.
 * @param type - The type of the notification. 'success' (default) or 'error'.
 * @param duration - The duration in milliseconds to display the notification. Default is 2000ms.
 */
export const ToastNotification: React.FC<ToastNotificationProps> = ({
  message,
  type = 'success',
  duration = 2000,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`tooltip ${type} flex items-center gap-2`}>
        {type === 'error' ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        <span>{message}</span>
        <button onClick={() => setIsVisible(false)} className="ml-2 hover:opacity-80">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

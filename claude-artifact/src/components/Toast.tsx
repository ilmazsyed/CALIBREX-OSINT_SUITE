import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 bg-calibrex-surface/95 text-calibrex-text px-6 py-4 rounded border-l-4 border-calibrex-gold shadow-2xl z-[100] animate-in slide-in-from-right duration-300 max-w-sm backdrop-blur-sm">
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
};

export default Toast;
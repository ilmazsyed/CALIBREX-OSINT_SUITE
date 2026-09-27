
import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-calibrex-surface border border-calibrex-surface-light rounded-lg w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="p-3 sm:p-4 border-b border-calibrex-surface-light flex justify-between items-center">
          <h3 className="text-base sm:text-lg font-bold text-calibrex-gold">{title}</h3>
          <button onClick={onClose} className="text-calibrex-muted hover:text-calibrex-gold transition-colors p-1">
            <X size={20} sm:size={24} />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
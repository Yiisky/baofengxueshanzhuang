//提示弹窗

import React from 'react';

type AlertType = 'info' | 'warning' | 'error';

interface AlertDialogProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  onConfirm: () => void;
  type?: AlertType;
}

export const AlertDialog: React.FC<AlertDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  type = 'info'
}) => {
  if (!isOpen) return null;

  const colors: Record<AlertType, string> = {
    info: '#d4a853',
    warning: '#FF9800',
    error: '#c9302c'
  };

  return (
    <div 
      className="fixed inset-0 bg-black/85 flex items-center justify-center z-[60] p-4"
      onClick={onConfirm}
    >
      <div 
        className="bg-[#1a1a1a] border-2 rounded-xl max-w-sm w-full p-6 shadow-2xl"
        style={{ borderColor: colors[type] }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-4 text-center" style={{ color: colors[type] }}>
          {title}
        </h3>
        <div className="text-[#cccccc] text-center mb-6 leading-relaxed">
          {message}
        </div>
        <button
          onClick={onConfirm}
          className="w-full py-3 rounded-lg font-bold active:opacity-80 transition-opacity"
          style={{ backgroundColor: colors[type], color: type === 'error' ? '#fff' : '#0a0a0a' }}
        >
          我知道了
        </button>
      </div>
    </div>
  );
};
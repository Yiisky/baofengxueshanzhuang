// src/components/player/dialogs/ConfirmDialog.tsx
import React from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'info' | 'warning' | 'danger';
  singleButton?: boolean; // 添加 singleButton 属性
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
  type = 'info',
  singleButton = false // 默认为 false
}) => {
  if (!isOpen) return null;

  const colors = {
    info: { border: '#d4a853', bg: '#d4a853', text: '#0a0a0a' },
    warning: { border: '#FF9800', bg: '#FF9800', text: '#0a0a0a' },
    danger: { border: '#c9302c', bg: '#c9302c', text: '#ffffff' }
  };

  const theme = colors[type];

  return (
    <div 
      className="fixed inset-0 bg-black/85 flex items-center justify-center z-[60] p-4"
      onClick={onCancel}
    >
      <div 
        className="bg-[#1a1a1a] border-2 rounded-xl max-w-sm w-full p-6 shadow-2xl"
        style={{ borderColor: theme.border }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-4 text-center" style={{ color: theme.border }}>
          {title}
        </h3>
        <div className="text-[#cccccc] text-center mb-6 leading-relaxed">
          {message}
        </div>
        <div className={singleButton ? "flex justify-center" : "flex gap-3"}>
          {!singleButton && (
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-lg bg-[#2a2a2a] text-[#aaaaaa] font-bold active:bg-[#333] transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={singleButton ? "px-12 py-3 rounded-lg font-bold active:opacity-80 transition-opacity" : "flex-1 py-3 rounded-lg font-bold active:opacity-80 transition-opacity"}
            style={{ backgroundColor: theme.bg, color: theme.text }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
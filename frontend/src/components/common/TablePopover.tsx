import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

interface TablePopoverProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  width?: string;
  estimatedHeight?: number;
  className?: string;
  open?: boolean;
  onClose?: () => void;
  onOpen?: () => void;
}

export function TablePopover({
  trigger,
  children,
  width = 'w-64',
  estimatedHeight = 220,
  className = '',
  open: controlledOpen,
  onClose,
  onOpen,
}: TablePopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const triggerRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  const handleOpen = useCallback(() => {
    if (isControlled) {
      onOpen?.();
    } else {
      setInternalOpen(true);
    }
  }, [isControlled, onOpen]);

  const handleClose = useCallback(() => {
    if (isControlled) {
      onClose?.();
    } else {
      setInternalOpen(false);
    }
  }, [isControlled, onClose]);

  const handleToggle = useCallback(() => {
    if (isOpen) {
      handleClose();
    } else {
      handleOpen();
    }
  }, [isOpen, handleOpen, handleClose]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceRight = window.innerWidth - rect.left;
    const openUpward = spaceBelow < estimatedHeight && rect.top > estimatedHeight;

    // If not enough space to the right, align to the right edge of trigger
    const popoverWidth = 256; // approx w-64 = 16rem = 256px
    const alignRight = spaceRight < popoverWidth;

    const style: React.CSSProperties = {
      position: 'fixed',
      zIndex: 9999,
    };

    if (alignRight) {
      style.right = window.innerWidth - rect.right;
    } else {
      style.left = rect.left;
    }

    if (openUpward) {
      style.bottom = window.innerHeight - rect.top + 4;
    } else {
      style.top = rect.bottom + 4;
    }

    setPopoverStyle(style);
  }, [estimatedHeight]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen, updatePosition]);

  return (
    <div className="relative inline-block" ref={triggerRef}>
      <div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleToggle();
        }}
      >
        {trigger}
      </div>

      {isOpen &&
        ReactDOM.createPortal(
          <>
            {/* Backdrop to catch outside clicks */}
            <div
              className="fixed inset-0"
              style={{ zIndex: 9998 }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                handleClose();
              }}
            />
            {/* Popover content */}
            <div
              className={`${width} bg-white border border-gray-200 rounded-lg shadow-xl text-left ${className}`}
              style={popoverStyle}
              onClick={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
            >
              {children}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

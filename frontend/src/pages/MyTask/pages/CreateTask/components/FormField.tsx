import React from 'react';
import { LABEL_STYLE } from '../createTaskConstants';

interface FormFieldProps {
  label: string;
  icon?: React.ReactNode;
  required?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function FormField({ label, icon, required, action, children }: FormFieldProps) {
  return (
    <div>
      <div style={{ ...LABEL_STYLE, justifyContent: action ? 'space-between' : undefined }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {icon}
          {label}
          {required && <span style={{ color: '#ef4444' }}>*</span>}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}
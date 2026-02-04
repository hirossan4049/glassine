import { ReactNode } from 'react';
import { Button } from '@carbon/react';

interface FullscreenModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  footerText?: string;
}

export default function FullscreenModal({
  title,
  isOpen,
  onClose,
  children,
  footerText,
}: FullscreenModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        background: 'var(--cds-background)',
        backgroundColor: '#fff',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '1rem',
          borderBottom: '1px solid var(--cds-border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2 className="cds--type-productive-heading-03">{title}</h2>
        <Button kind="ghost" size="sm" onClick={onClose}>
          ✕
        </Button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
        {children}
      </div>
      <div style={{ padding: '1rem', borderTop: '1px solid var(--cds-border-subtle)' }}>
        <Button kind="primary" size="lg" onClick={onClose} style={{ width: '100%' }}>
          {footerText || '完了'}
        </Button>
      </div>
    </div>
  );
}

import { ReactNode } from 'react';
import { Button } from '@carbon/react';
import { X } from 'lucide-react';

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

  const viewportHeight = '100dvh';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        height: viewportHeight,
        maxHeight: viewportHeight,
        zIndex: 9999,
        background: 'var(--cds-background, #fff)',
        overflow: 'hidden',
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
          <X size={20} />
        </Button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '1rem' }}>
        {children}
      </div>
      <div
        style={{
          padding: '1rem',
          paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
          borderTop: '1px solid var(--cds-border-subtle)',
        }}
      >
        <Button kind="primary" size="lg" onClick={onClose} style={{ width: '100%' }}>
          {footerText || '完了'}
        </Button>
      </div>
    </div>
  );
}

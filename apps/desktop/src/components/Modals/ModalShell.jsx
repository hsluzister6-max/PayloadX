import PayloadX from '@/components/core/logo';

/**
 * Theme-aware modal shell — uses CSS variables from :root / .light (index.css).
 */
export function ModalOverlay({ onClose, zIndex = 50, className = '' }) {
  return (
    <div
      className={`modal-overlay animate-in fade-in duration-300 ${className}`}
      style={{ zIndex }}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      role="presentation"
    />
  );
}

export function ModalPanel({
  children,
  wide = false,
  maxWidth,
  className = '',
}) {
  const widthClass = maxWidth
    ? maxWidth
    : wide
      ? 'max-w-4xl'
      : 'max-w-md';

  return (
    <div
      className={`modal-panel animate-in zoom-in-95 duration-300 w-full ${widthClass} ${className}`}
    >
      {children}
    </div>
  );
}

export function ModalHeader({ title, subtitle, onClose, showLogo = false, icon = null }) {
  return (
    <div className="modal-header">
      <div className="flex items-center gap-4 min-w-0">
        {showLogo && (
          <div className="flex items-center gap-3 flex-shrink-0">
            <PayloadX className="w-8 h-8" fontSize="10px" />
            <div className="w-px h-6 bg-[var(--border-2)]" />
          </div>
        )}
        {icon && !showLogo && (
          <div className="modal-header-icon flex-shrink-0">{icon}</div>
        )}
        <div className="flex flex-col min-w-0">
          <h2 className="modal-title">{title}</h2>
          {subtitle && <p className="modal-subtitle">{subtitle}</p>}
        </div>
      </div>
      {onClose && (
        <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Close">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function ModalBody({ children, className = '' }) {
  return <div className={`modal-body ${className}`}>{children}</div>;
}

/** Full-screen centered modal (overlay + panel). */
export default function ModalShell({
  onClose,
  title,
  subtitle = 'PayloadX Studio Context',
  wide = false,
  showLogo = false,
  icon = null,
  maxWidth,
  zIndex = 50,
  children,
  className = '',
  bodyClassName = '',
}) {
  return (
    <div
      className="modal-overlay flex items-center justify-center p-4 animate-in fade-in duration-300"
      style={{ zIndex }}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <ModalPanel wide={wide} maxWidth={maxWidth} className={className}>
        {(title || onClose) && (
          <ModalHeader
            title={title}
            subtitle={subtitle}
            onClose={onClose}
            showLogo={showLogo}
            icon={icon}
          />
        )}
        <ModalBody className={bodyClassName}>{children}</ModalBody>
      </ModalPanel>
    </div>
  );
}

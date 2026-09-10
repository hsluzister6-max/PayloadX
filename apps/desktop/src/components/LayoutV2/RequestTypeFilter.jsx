import { useEffect, useRef, useState } from 'react';

/** Request type filters shown in the collection sidebar (Postman-style). */
export const REQUEST_TYPE_FILTERS = [
  { id: 'all', label: 'All types', protocol: null, available: true },
  { id: 'http', label: 'HTTP', protocol: 'http', available: true, color: '#14b8a6' },
  { id: 'graphql', label: 'GraphQL', protocol: 'graphql', available: false, color: '#e879f9' },
  { id: 'ai', label: 'AI', protocol: 'ai', available: false, color: '#86efac' },
  { id: 'mcp', label: 'MCP', protocol: 'mcp', available: false, color: '#e2e8f0' },
  { id: 'grpc', label: 'gRPC', protocol: 'grpc', available: false, color: '#60a5fa' },
  { id: 'ws', label: 'WebSocket', protocol: 'ws', available: true, color: '#fb923c' },
  { id: 'socketio', label: 'Socket.IO', protocol: 'socketio', available: true, color: '#f97316' },
  { id: 'mqtt', label: 'MQTT', protocol: 'mqtt', available: false, color: '#a78bfa' },
  { id: 'data', label: 'Data', protocol: 'data', available: false, color: '#f472b6' },
];

/**
 * @param {{ protocol?: string }} request
 * @param {string} filterId
 */
export function matchesRequestTypeFilter(request, filterId) {
  if (!filterId || filterId === 'all') return true;
  const proto = request?.protocol || 'http';
  if (filterId === 'http') return proto === 'http';
  return proto === filterId;
}

export function TypeIcon({ id, color }) {
  const stroke = color || 'currentColor';
  const common = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke, strokeWidth: 1.7 };

  switch (id) {
    case 'http':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 12H3m18 0h-4M8 12l-2-2m2 2l-2 2m10-2l2-2m-2 2l2 2" />
          <path strokeLinecap="round" d="M9 8h6M9 16h6" />
        </svg>
      );
    case 'graphql':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7.5 4.5v9L12 21l-7.5-4.5v-9L12 3z" />
          <circle cx="12" cy="12" r="2.2" />
        </svg>
      );
    case 'ai':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.2 3.6L17 8l-3.8 1.4L12 13l-1.2-3.6L7 8l3.8-1.4L12 3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 14l.7 2.1L21 17l-2.3.8L18 20l-.7-2.2L15 17l2.3-.9L18 14z" />
        </svg>
      );
    case 'mcp':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4c3 2 5 4.5 5 8s-2 6-5 8c-3-2-5-4.5-5-8s2-6 5-8z" />
          <path strokeLinecap="round" d="M12 8v8" />
        </svg>
      );
    case 'grpc':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v10M16 7v10M12 4v16" />
          <path strokeLinecap="round" d="M6 12h12" />
        </svg>
      );
    case 'ws':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 8a5 5 0 017.07 0M5 10a8 8 0 0111.31 0" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16a5 5 0 01-7.07 0M19 14a8 8 0 00-11.31 0" />
        </svg>
      );
    case 'socketio':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path strokeLinecap="round" d="M9 8l6 4-6 4" />
        </svg>
      );
    case 'mqtt':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 19a9 9 0 0114 0M8 16a5 5 0 018 0M12 13v.01" />
        </svg>
      );
    case 'data':
      return (
        <svg {...common}>
          <ellipse cx="12" cy="6" rx="7" ry="2.5" />
          <path strokeLinecap="round" d="M5 6v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6" />
          <path strokeLinecap="round" d="M5 10v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4" />
          <path strokeLinecap="round" d="M5 14v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4" />
        </svg>
      );
    default:
      return (
        <svg {...common} width={12} height={12}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M6 12h12M10 19h4" />
        </svg>
      );
  }
}

/**
 * Compact icon filter for separating collection requests by protocol/type.
 * Hover an available type to reveal a thin Create button.
 * @param {{
 *   value: string,
 *   onChange: (id: string) => void,
 *   counts?: Record<string, number>,
 *   onCreateRequestType?: (type: { id: string, label: string, protocol: string }) => void,
 * }} props
 */
export default function RequestTypeFilter({ value = 'all', onChange, counts = {}, onCreateRequestType }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const rootRef = useRef(null);
  const selected = REQUEST_TYPE_FILTERS.find((t) => t.id === value) || REQUEST_TYPE_FILTERS[0];
  const isFiltered = value !== 'all';

  useEffect(() => {
    if (!open) return undefined;

    const placeMenu = () => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 6,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };

    placeMenu();

    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('resize', placeMenu);
    window.addEventListener('scroll', placeMenu, true);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', placeMenu);
      window.removeEventListener('scroll', placeMenu, true);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleCreate = (e, type) => {
    e.preventDefault();
    e.stopPropagation();
    if (!type.available || type.id === 'all' || !onCreateRequestType) return;
    setOpen(false);
    onCreateRequestType({ id: type.id, label: type.label, protocol: type.protocol });
  };

  return (
    <div className="sdbv2-type-filter" ref={rootRef}>
      <button
        type="button"
        className={`sdbv2-type-filter-trigger ${isFiltered ? 'sdbv2-type-filter-trigger--active' : ''} ${open ? 'sdbv2-type-filter-trigger--open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title={isFiltered ? `Filtered: ${selected.label}` : 'Filter by request type'}
        aria-label={isFiltered ? `Filtered: ${selected.label}` : 'Filter by request type'}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {isFiltered ? (
          <TypeIcon id={selected.id} color={selected.color} />
        ) : (
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M6 12h12M10 19h4" />
          </svg>
        )}
        {isFiltered && <span className="sdbv2-type-filter-dot" aria-hidden />}
      </button>

      {open && (
        <div
          className="sdbv2-type-filter-menu"
          role="listbox"
          aria-label="Request type filter"
          style={{ top: menuPos.top, right: menuPos.right }}
        >
          <div className="sdbv2-type-filter-menu-head">Request type</div>
          {REQUEST_TYPE_FILTERS.map((type) => {
            const count = type.id === 'all' ? undefined : counts[type.id];
            const isActive = value === type.id;
            const canCreate = type.available && type.id !== 'all' && !!onCreateRequestType;
            return (
              <div
                key={type.id}
                role="option"
                aria-selected={isActive}
                aria-disabled={!type.available && type.id !== 'all'}
                className={`sdbv2-type-filter-item ${isActive ? 'sdbv2-type-filter-item--active' : ''} ${
                  !type.available ? 'sdbv2-type-filter-item--soon' : ''
                } ${canCreate ? 'sdbv2-type-filter-item--creatable' : ''}`}
                onClick={() => {
                  if (!type.available && type.id !== 'all') return;
                  onChange(type.id);
                  setOpen(false);
                }}
              >
                <span className="sdbv2-type-filter-item-icon">
                  {type.id === 'all' ? (
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" />
                    </svg>
                  ) : (
                    <TypeIcon id={type.id} color={type.color} />
                  )}
                </span>
                <span className="sdbv2-type-filter-item-label">{type.label}</span>
                {!type.available && type.id !== 'all' && (
                  <span className="sdbv2-type-filter-soon">Soon</span>
                )}
                {type.available && typeof count === 'number' && count > 0 && (
                  <span className="sdbv2-type-filter-count">{count}</span>
                )}
                {isActive && !canCreate && (
                  <svg className="sdbv2-type-filter-check" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {canCreate && (
                  <button
                    type="button"
                    className="sdbv2-type-filter-create"
                    title={`Create ${type.label} request`}
                    onClick={(e) => handleCreate(e, type)}
                  >
                    Create
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef } from 'react';
import { useUIStore } from '@/store/uiStore';

export default function ContextMenu() {
  const { contextMenu, closeContextMenu } = useUIStore();
  const menuRef = useRef(null);

  useEffect(() => {
    if (!contextMenu) return;

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        closeContextMenu();
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeContextMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu, closeContextMenu]);

  if (!contextMenu) return null;

  const { x, y, items } = contextMenu;

  // Adjust position to keep menu within viewport
  const adjustPosition = () => {
    const menuWidth = 200;
    const menuHeight = items.length * 26 + 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;

    if (x + menuWidth > viewportWidth) {
      adjustedX = x - menuWidth;
    }
    if (y + menuHeight > viewportHeight) {
      adjustedY = Math.max(8, y - menuHeight);
    }

    return { left: adjustedX, top: adjustedY };
  };

  const position = adjustPosition();

  return (
    <div
      ref={menuRef}
      className="v2-context-menu"
      style={{
        left: position.left,
        top: position.top,
      }}
    >
      {items.map((item, index) => {
        if (item.divider) {
          return <div key={item.id || index} className="v2-context-menu-divider" />;
        }

        if (item.section) {
          return (
            <div key={item.id || index} className="v2-context-menu-section">
              {item.label}
            </div>
          );
        }

        if (item.creatable || item.soon) {
          return (
            <div
              key={item.id || index}
              className={`v2-context-menu-item v2-context-menu-item--row ${
                item.soon ? 'v2-context-menu-item--soon' : 'v2-context-menu-item--creatable'
              }`}
              onClick={() => {
                if (item.soon || !item.onClick) return;
                item.onClick();
                closeContextMenu();
              }}
            >
              {item.icon && <span className="v2-context-menu-icon">{item.icon}</span>}
              <span className="v2-context-menu-label">{item.label}</span>
              {item.soon ? (
                <span className="v2-context-menu-soon">Soon</span>
              ) : (
                <button
                  type="button"
                  className="v2-context-menu-create"
                  onClick={(e) => {
                    e.stopPropagation();
                    item.onClick?.();
                    closeContextMenu();
                  }}
                >
                  Create
                </button>
              )}
            </div>
          );
        }

        return (
          <button
            key={item.id || index}
            type="button"
            onClick={() => {
              item.onClick?.();
              closeContextMenu();
            }}
            className={`v2-context-menu-item ${item.danger ? 'v2-context-menu-item--danger' : ''}`}
          >
            {item.icon && (
              <span className="v2-context-menu-icon">
                {item.icon}
              </span>
            )}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

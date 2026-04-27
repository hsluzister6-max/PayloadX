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
    const menuWidth = 180;
    const menuHeight = items.length * 36 + 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;

    if (x + menuWidth > viewportWidth) {
      adjustedX = x - menuWidth;
    }
    if (y + menuHeight > viewportHeight) {
      adjustedY = y - menuHeight;
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
      {items.map((item, index) => (
        <div key={item.id || index}>
          {item.divider ? (
            <div className="v2-context-menu-divider" />
          ) : (
            <button
              onClick={() => {
                item.onClick();
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
          )}
        </div>
      ))}
    </div>
  );
}

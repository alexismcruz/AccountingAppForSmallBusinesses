import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function Tooltip({ content, children, maxWidth = 300 }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef(null);

  const show = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      let left = rect.left;
      // Nudge left if it would overflow right edge
      if (left + maxWidth > window.innerWidth - 16) {
        left = window.innerWidth - maxWidth - 16;
      }
      setPos({ top: rect.bottom + 6, left });
    }
    setVisible(true);
  };

  return (
    <>
      <span ref={ref} onMouseEnter={show} onMouseLeave={() => setVisible(false)} style={{ display: 'inline-flex' }}>
        {children}
      </span>
      {visible && createPortal(
        <div style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          zIndex: 9999,
          background: '#1e293b',
          color: '#f1f5f9',
          borderRadius: 7,
          padding: '10px 14px',
          maxWidth,
          fontSize: 12.5,
          lineHeight: 1.55,
          boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
          pointerEvents: 'none',
        }}>
          {content}
        </div>,
        document.body
      )}
    </>
  );
}

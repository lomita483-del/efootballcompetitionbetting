// src/client/components/admin/QuickActions/WagerQuickAction.tsx
import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import './WagerQuickAction.css';

export default function WagerQuickAction() {
  const history = useHistory();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchCount() {
      try {
        const res = await fetch('/api/admin/wagers/summary');
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          setCount(data.pendingApproval || 0);
        }
      } catch (e) {
        console.warn('WagerQuickAction summary fetch failed', e);
      }
    }
    fetchCount();
    const iv = setInterval(fetchCount, 15000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  return (
    <button
      className="quick-action quick-action-wager"
      onClick={() => history.push('/admin/wagers')}
      aria-label="WAGER"
      title="WAGER — Manage P2P Wagers"
    >
      <div className="wager-icon" aria-hidden>🏆</div>
      <div className="wager-label">WAGER</div>
      {count !== null && (
        <div className="wager-badge" aria-hidden>{count}</div>
      )}
    </button>
  );
}

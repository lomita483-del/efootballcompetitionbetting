// src/client/pages/admin/WagersPage.tsx
import React, { useEffect, useState } from 'react';

export default function WagersPage() {
  const [tab, setTab] = useState('pending_approval');
  const [list, setList] = useState<any[]>([]);

  useEffect(() => {
    fetchList();
  }, [tab]);

  async function fetchList() {
    const res = await fetch(`/api/admin/wagers?status=${tab}`);
    if (res.ok) {
      const data = await res.json();
      setList(data.items || []);
    }
  }

  return (
    <div style={{ padding:20 }}>
      <h1>Wagers</h1>
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <button onClick={() => setTab('pending_approval')} className={tab==='pending_approval'? 'active':''}>Pending Approval</button>
        <button onClick={() => setTab('awaiting_payment')} className={tab==='awaiting_payment'? 'active':''}>Awaiting Payment</button>
        <button onClick={() => setTab('awaiting_funding')} className={tab==='awaiting_funding'? 'active':''}>Awaiting Funding</button>
        <button onClick={() => setTab('active')} className={tab==='active'? 'active':''}>Active</button>
        <button onClick={() => setTab('live')} className={tab==='live'? 'active':''}>Live</button>
        <button onClick={() => setTab('awaiting_settlement')} className={tab==='awaiting_settlement'? 'active':''}>Awaiting Settlement</button>
      </div>

      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr>
            <th>Bet ID</th>
            <th>Challenger</th>
            <th>Opponent</th>
            <th>Match</th>
            <th>Stake</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((w:any) => (
            <tr key={w.id}>
              <td>{w.wager_uuid || w.id}</td>
              <td>{w.challenger_name || w.challenger_id}</td>
              <td>{w.opponent_name || w.opponent_id}</td>
              <td>{w.match_id || '-'}</td>
              <td>{w.total_pot || '-'}</td>
              <td>{w.status}</td>
              <td><button onClick={() => window.location.href=`/admin/wagers/${w.id}`}>Review</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

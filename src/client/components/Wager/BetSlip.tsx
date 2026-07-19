// src/client/components/Wager/BetSlip.tsx
import React from 'react';
import QRCode from 'qrcode.react';

export default function BetSlip({ wager }: { wager: any }) {
  if (!wager) return null;
  const verificationUrl = `${window.location.origin}/wager/verify/${wager.wager_uuid}`;
  return (
    <div className="betslip" style={{ padding:20, borderRadius:16, background:'rgba(255,255,255,0.03)', maxWidth:800 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h2>Bet Slip</h2>
          <div>Bet ID: <strong>{wager.wager_uuid}</strong></div>
          <div>Wager ID: <strong>{wager.id}</strong></div>
          <div>Challenger: {wager.challenger_name}</div>
          <div>Opponent: {wager.opponent_name}</div>
        </div>
        <div>
          <QRCode value={verificationUrl} size={120} />
        </div>
      </div>

      <hr />
      <div>Match: {wager.match_id} — {wager.league}</div>
      <div>Bet Type: {wager.bet_type} — Category: {wager.bet_category}</div>
      <div>Stake Per User: {wager.stake}</div>
      <div>Total Pot: {wager.total_pot}</div>
      <div>Platform Fee: {wager.platform_fee}</div>
      <div>Potential Prize: {wager.potential_prize}</div>

      <div style={{ marginTop:12 }}>
        <strong>Funding Status:</strong> {wager.status}
      </div>

      {/* After settlement */}
      {wager.settlement && (
        <div style={{ marginTop:12 }}>
          <div>Final Score: {wager.settlement.final_score}</div>
          <div>Winner: {wager.settlement.winner_name}</div>
        </div>
      )}
    </div>
  );
}

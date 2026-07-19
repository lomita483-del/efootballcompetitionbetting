// src/server/jobs/wagerTimeoutJob.ts
// Periodic job that cancels wagers where payment deadline passed
import cron from 'node-cron';
import db from '../lib/db';

// Runs every minute
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date().toISOString();
    // Find wagers that are awaiting_payment and past funding_deadline
    const res = await db.query(`SELECT id FROM wagers WHERE status = 'awaiting_payment' AND funding_deadline IS NOT NULL AND funding_deadline < $1`, [now]);
    for (const row of res.rows) {
      const wagerId = row.id;
      // Set status to cancelled and insert audit log
      await db.query(`UPDATE wagers SET status = 'cancelled', updated_at = now() WHERE id = $1`, [wagerId]);
      await db.query(`INSERT INTO wager_audit_logs (wager_id, admin_id, action, reason) VALUES ($1, NULL, 'auto_cancel_payment_deadline', 'Auto-cancelled due to funding deadline')`, [wagerId]);
      // TODO: notify users, handle partial payments per policy
    }
  } catch (err) {
    console.error('wagerTimeoutJob error', err);
  }
});

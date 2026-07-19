// src/server/routes/wagers.ts
import express from 'express';
import asyncHandler from 'express-async-handler';
import * as wagerService from '../services/wagerService';

const router = express.Router();

// Create a challenge
router.post('/challenge', asyncHandler(async (req, res) => {
  const payload = req.body;
  // payload: opponent_id, match_provider, match_id, bet_type, bet_category, stake, match_start, expires_at, agreement
  const userId = req.user?.id; // assumes authentication middleware
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const challenge = await wagerService.createChallenge(userId, payload);
  res.status(201).json(challenge);
}));

// Respond to a challenge: accept/reject/request_changes
router.post('/:challengeId/respond', asyncHandler(async (req, res) => {
  const { challengeId } = req.params;
  const { action, changes } = req.body;
  const userId = req.user?.id;
  const result = await wagerService.respondToChallenge(userId, Number(challengeId), action, changes);
  res.json(result);
}));

// Get wager / bet slip
router.get('/:wagerId', asyncHandler(async (req, res) => {
  const { wagerId } = req.params;
  const userId = req.user?.id;
  const wager = await wagerService.getWagerById(Number(wagerId), userId);
  res.json(wager);
}));

// Participant posts a payment record (external payment reference). Payments must be verified by admin.
router.post('/:wagerId/payments', asyncHandler(async (req, res) => {
  const { wagerId } = req.params;
  const userId = req.user?.id;
  const { amount, payment_method, external_reference } = req.body;
  const payment = await wagerService.createPayment(Number(wagerId), userId, { amount, payment_method, external_reference });
  res.status(201).json(payment);
}));

export default router;

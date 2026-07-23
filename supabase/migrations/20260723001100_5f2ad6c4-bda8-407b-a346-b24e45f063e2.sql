DROP POLICY IF EXISTS "user submits own payment" ON public.wager_payments;
CREATE POLICY "party submits one exact wager payment"
ON public.wager_payments
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.wagers w
    WHERE w.id = wager_id
      AND auth.uid() IN (w.challenger_id, w.opponent_id)
      AND w.status IN ('awaiting_payment', 'awaiting_funding')
      AND amount = w.stake
  )
);
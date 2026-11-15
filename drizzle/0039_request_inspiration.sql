-- Booking requests (brief 02, part 3): the portfolio photo a family picked as inspiration ("Book a memory like this
-- one") travels from /book to the booking the owner confirms. Add-only, safe to run twice.
ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "inspiration_id" text;

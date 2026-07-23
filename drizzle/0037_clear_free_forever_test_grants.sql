-- Subscription paywall, fix 5 (Ross's review pass) — clear every existing
-- `free_forever_granted_at` grant. These were all stamped by the
-- testing-period "submit feedback, get free-forever tester access" flow
-- (now removed — see docs/SUBSCRIPTION_PAYWALL.md), so every current holder
-- is a test/beta account, not a real comp grant. Paywall applies to
-- everyone from here on; the column is repurposed as an admin-only "comp
-- access" flag (grantCompAccess/revokeCompAccess in
-- src/lib/actions/adminComp.ts) — this clears the slate so the only people
-- who show up as comped going forward are ones Ross explicitly granted.
UPDATE `user` SET `free_forever_granted_at` = NULL WHERE `free_forever_granted_at` IS NOT NULL;

-- Drop legacy single-column indexes; composite indexes cover user_id and test_id prefixes.
DROP INDEX "attempts_test_id_idx";
DROP INDEX "attempts_user_id_idx";

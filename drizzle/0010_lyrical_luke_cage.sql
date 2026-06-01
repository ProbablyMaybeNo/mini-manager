-- P13.11 — Focus recipe widget schema migration.
--
-- Two additive changes for the dashboard FOCUS section:
--   1. user.focus_project_id — nullable FK to project, ON DELETE SET NULL
--      so deleting the focused project nulls the user's focus rather
--      than cascading the user row.
--   2. recipe_step.notes — text, nullable. Per-step painting notes the
--      painter scribbles inline on the dashboard FOCUS panel.
--
-- Both columns are nullable + have no default, so the migration is
-- safe to apply on a populated database — existing rows simply read
-- NULL for the new columns.

ALTER TABLE `recipe_step` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `user` ADD `focus_project_id` text REFERENCES `project`(`id`) ON DELETE SET NULL;

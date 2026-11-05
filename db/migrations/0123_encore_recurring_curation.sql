CREATE TABLE encore_curations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 collection_id uuid NOT NULL REFERENCES encore_collections(id) ON DELETE CASCADE,
 name text NOT NULL, recipe jsonb NOT NULL, schedule jsonb NOT NULL, enabled boolean NOT NULL DEFAULT false,
 revision integer NOT NULL DEFAULT 1, source text NOT NULL, source_id text,
 next_run_at timestamptz, last_run_at timestamptz, last_error text, lease_id uuid, lease_expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,collection_id)
);
CREATE INDEX encore_curations_due ON encore_curations(next_run_at) WHERE enabled;
CREATE TABLE encore_curation_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), curation_id uuid NOT NULL REFERENCES encore_curations(id) ON DELETE CASCADE,
 scheduled_for timestamptz NOT NULL, status text NOT NULL DEFAULT 'running' CHECK(status IN ('running','succeeded','failed')),
 action_id uuid REFERENCES encore_actions(id) ON DELETE SET NULL, result jsonb, error text, attempts integer NOT NULL DEFAULT 1,
 started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 UNIQUE(curation_id,scheduled_for)
);
CREATE INDEX encore_curation_runs_recent ON encore_curation_runs(curation_id,started_at DESC);
ALTER TABLE encore_collections ADD COLUMN manual_exclusions jsonb NOT NULL DEFAULT '[]';
ALTER TABLE encore_actions ADD COLUMN intent jsonb;

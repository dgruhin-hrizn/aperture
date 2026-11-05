CREATE TABLE encore_memories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 fact_key text NOT NULL, fact text NOT NULL, kind text NOT NULL CHECK(kind IN ('preference','constraint','context','spoiler')),
 source text NOT NULL, source_id text, interest_id uuid REFERENCES user_custom_interests(id) ON DELETE SET NULL,
 expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,fact_key)
);
CREATE INDEX encore_memories_user ON encore_memories(user_id,updated_at DESC);
CREATE TABLE encore_watch_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name text NOT NULL, status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','saved')),
 revision integer NOT NULL DEFAULT 1, input jsonb NOT NULL, schedule jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX encore_watch_plans_user ON encore_watch_plans(user_id,updated_at DESC);
CREATE TABLE encore_collections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name text NOT NULL, server_id text NOT NULL, provider_playlist_id text, section_id text,
 baseline jsonb NOT NULL DEFAULT '[]', revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,server_id,name)
);
CREATE TABLE encore_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 collection_id uuid NOT NULL REFERENCES encore_collections(id) ON DELETE CASCADE,
 operation text NOT NULL CHECK(operation IN ('create','update','pin','unpin')),
 status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','running','succeeded','failed','unknown','cancelled')),
 fingerprint text NOT NULL, payload jsonb NOT NULL, receipt jsonb, error text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,fingerprint)
);
CREATE INDEX encore_actions_user ON encore_actions(user_id,updated_at DESC);

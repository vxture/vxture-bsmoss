-- Optional synthetic dataset storage. No product identities or live evidence.
CREATE SCHEMA IF NOT EXISTS bsmoss_demo;
CREATE TABLE bsmoss_demo.dataset (
  id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'),
  source_digest text NOT NULL,
  manifest jsonb NOT NULL,
  metadata jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('seeded','ready')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE bsmoss_demo.daily_fact (
  dataset_id text NOT NULL REFERENCES bsmoss_demo.dataset(id) ON DELETE CASCADE,
  relation integer NOT NULL CHECK (relation >= 0),
  day integer NOT NULL CHECK (day >= 0),
  quantity bigint NOT NULL CHECK (quantity >= 0),
  PRIMARY KEY (dataset_id,relation,day)
);
CREATE TABLE bsmoss_demo.period_rollup (
  dataset_id text NOT NULL REFERENCES bsmoss_demo.dataset(id) ON DELETE CASCADE,
  period_id text NOT NULL,
  city text NOT NULL,
  county text NOT NULL,
  operator text NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (dataset_id,period_id,city,county,operator)
);
CREATE TABLE bsmoss_demo.artifact (
  dataset_id text NOT NULL REFERENCES bsmoss_demo.dataset(id) ON DELETE CASCADE,
  path text NOT NULL,
  digest text NOT NULL,
  content text NOT NULL,
  PRIMARY KEY (dataset_id,path)
);
REVOKE ALL ON SCHEMA bsmoss_demo FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA bsmoss_demo FROM PUBLIC;
GRANT USAGE ON SCHEMA bsmoss_demo TO bsmoss_svc;
GRANT SELECT ON ALL TABLES IN SCHEMA bsmoss_demo TO bsmoss_svc;

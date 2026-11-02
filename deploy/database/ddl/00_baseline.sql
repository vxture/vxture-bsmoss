-- Empty-database baseline only. No upgrade or legacy compatibility path.
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE SCHEMA bsmoss_resource;
CREATE SCHEMA bsmoss_integration;
CREATE SCHEMA bsmoss_catalog;
CREATE SCHEMA bsmoss_metering;
CREATE SCHEMA bsmoss_views;

CREATE TABLE bsmoss_resource.station (
  workspace_id text NOT NULL,
  id text NOT NULL,
  name text NOT NULL,
  owner_code text NOT NULL CHECK (owner_code = 'tower'),
  province_code text NOT NULL CHECK (province_code = '610000'),
  city_code text NOT NULL,
  PRIMARY KEY (workspace_id,id)
);

CREATE TABLE bsmoss_resource.operator_entity (
  workspace_id text NOT NULL,
  id text NOT NULL,
  category text NOT NULL CHECK (category IN ('telecom','unicom','mobile','broadcast','other')),
  name text NOT NULL,
  PRIMARY KEY (workspace_id,id)
);

CREATE TABLE bsmoss_resource.station_service (
  workspace_id text NOT NULL,
  id text NOT NULL,
  station_id text NOT NULL,
  operator_entity_id text NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_to timestamptz NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,id,station_id),
  FOREIGN KEY (workspace_id,station_id) REFERENCES bsmoss_resource.station(workspace_id,id),
  FOREIGN KEY (workspace_id,operator_entity_id) REFERENCES bsmoss_resource.operator_entity(workspace_id,id),
  CHECK (valid_to > valid_from)
);

CREATE TABLE bsmoss_resource.device (
  workspace_id text NOT NULL,
  id text NOT NULL,
  station_id text NOT NULL,
  device_type text NOT NULL,
  ownership text NOT NULL CHECK (ownership IN ('tower','operator','shared','unknown')),
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,id,station_id),
  FOREIGN KEY (workspace_id,station_id) REFERENCES bsmoss_resource.station(workspace_id,id)
);

CREATE TABLE bsmoss_resource.network_object (
  workspace_id text NOT NULL,
  id text NOT NULL,
  station_id text NOT NULL,
  service_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('base_station','cell','statistic_point')),
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,id,station_id,service_id),
  FOREIGN KEY (workspace_id,service_id,station_id) REFERENCES bsmoss_resource.station_service(workspace_id,id,station_id)
);

CREATE TABLE bsmoss_integration.source (
  workspace_id text NOT NULL,
  id text NOT NULL,
  name text NOT NULL,
  protocol text NOT NULL,
  PRIMARY KEY (workspace_id,id)
);

CREATE TABLE bsmoss_catalog.metric_version (
  code text NOT NULL,
  version numeric(30,0) NOT NULL CHECK (version > 0),
  category text NOT NULL CHECK (category IN ('business_service','operational_status','runtime_parameter')),
  semantic text NOT NULL CHECK (semantic IN ('interval_delta','derived','ratio','state')),
  unit text NOT NULL,
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  PRIMARY KEY (code,version)
);

CREATE TABLE bsmoss_integration.source_mapping (
  workspace_id text NOT NULL,
  id text NOT NULL,
  source_id text NOT NULL,
  external_type text NOT NULL,
  external_id text NOT NULL,
  station_id text NOT NULL,
  service_id text,
  network_object_id text,
  device_id text,
  version numeric(30,0) NOT NULL CHECK (version > 0),
  valid_from timestamptz NOT NULL,
  valid_to timestamptz NOT NULL,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,id,station_id,source_id),
  FOREIGN KEY (workspace_id,source_id) REFERENCES bsmoss_integration.source(workspace_id,id),
  FOREIGN KEY (workspace_id,station_id) REFERENCES bsmoss_resource.station(workspace_id,id),
  FOREIGN KEY (workspace_id,service_id,station_id) REFERENCES bsmoss_resource.station_service(workspace_id,id,station_id),
  FOREIGN KEY (workspace_id,network_object_id,station_id,service_id) REFERENCES bsmoss_resource.network_object(workspace_id,id,station_id,service_id),
  FOREIGN KEY (workspace_id,device_id,station_id) REFERENCES bsmoss_resource.device(workspace_id,id,station_id),
  CHECK (network_object_id IS NULL OR service_id IS NOT NULL),
  CHECK (network_object_id IS NULL OR device_id IS NULL),
  CHECK (valid_to > valid_from),
  EXCLUDE USING gist (workspace_id WITH =, source_id WITH =, external_type WITH =, external_id WITH =, tstzrange(valid_from,valid_to,'[)') WITH &&)
);

CREATE TABLE bsmoss_integration.raw_event (
  workspace_id text NOT NULL,
  source_id text NOT NULL,
  event_id text NOT NULL,
  revision numeric(30,0) NOT NULL CHECK (revision > 0),
  previous_revision numeric(30,0),
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  payload_uri text NOT NULL,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id,source_id,event_id,revision),
  FOREIGN KEY (workspace_id,source_id) REFERENCES bsmoss_integration.source(workspace_id,id),
  FOREIGN KEY (workspace_id,source_id,event_id,previous_revision) REFERENCES bsmoss_integration.raw_event(workspace_id,source_id,event_id,revision),
  CHECK (previous_revision IS NULL OR previous_revision < revision)
);

CREATE TABLE bsmoss_integration.source_capability (
  workspace_id text NOT NULL,
  id text NOT NULL,
  source_id text NOT NULL,
  metric_code text NOT NULL,
  metric_version numeric(30,0) NOT NULL,
  native_grain text NOT NULL CHECK (native_grain IN ('event','5m','15m','hour','day')),
  status text NOT NULL CHECK (status IN ('planned','mapped','validated','active','retired')),
  validation_ref text,
  rules jsonb NOT NULL CHECK (jsonb_typeof(rules) = 'object'),
  valid_from timestamptz NOT NULL,
  valid_to timestamptz NOT NULL,
  PRIMARY KEY (workspace_id,id),
  FOREIGN KEY (workspace_id,source_id) REFERENCES bsmoss_integration.source(workspace_id,id),
  FOREIGN KEY (metric_code,metric_version) REFERENCES bsmoss_catalog.metric_version(code,version),
  CHECK (status NOT IN ('validated','active') OR validation_ref IS NOT NULL),
  CHECK (valid_to > valid_from)
);

CREATE TABLE bsmoss_metering.measurement (
  workspace_id text NOT NULL,
  id text NOT NULL,
  source_id text NOT NULL,
  event_id text NOT NULL,
  event_revision numeric(30,0) NOT NULL,
  metric_code text NOT NULL,
  metric_version numeric(30,0) NOT NULL,
  component_key text NOT NULL,
  station_id text NOT NULL,
  mapping_id text NOT NULL,
  transform_version text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  value_kind text NOT NULL CHECK (value_kind IN ('integer_delta','ratio_parts','fixed_point','state_event')),
  integer_value numeric(30,0),
  numerator numeric(30,0),
  denominator numeric(30,0),
  unscaled numeric(30,0),
  scale numeric(30,0),
  state_value text,
  valid_until timestamptz,
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,source_id,event_id,event_revision,metric_code,metric_version,component_key),
  FOREIGN KEY (workspace_id,source_id,event_id,event_revision) REFERENCES bsmoss_integration.raw_event(workspace_id,source_id,event_id,revision),
  FOREIGN KEY (metric_code,metric_version) REFERENCES bsmoss_catalog.metric_version(code,version),
  FOREIGN KEY (workspace_id,mapping_id,station_id,source_id) REFERENCES bsmoss_integration.source_mapping(workspace_id,id,station_id,source_id),
  CHECK (period_end > period_start),
  CHECK (
    (value_kind = 'integer_delta' AND integer_value IS NOT NULL AND integer_value >= 0 AND numerator IS NULL AND denominator IS NULL AND unscaled IS NULL AND scale IS NULL AND state_value IS NULL AND valid_until IS NULL) OR
    (value_kind = 'ratio_parts' AND integer_value IS NULL AND numerator IS NOT NULL AND denominator IS NOT NULL AND numerator >= 0 AND denominator >= numerator AND unscaled IS NULL AND scale IS NULL AND state_value IS NULL AND valid_until IS NULL) OR
    (value_kind = 'fixed_point' AND integer_value IS NULL AND numerator IS NULL AND denominator IS NULL AND unscaled IS NOT NULL AND scale IS NOT NULL AND scale BETWEEN 0 AND 9 AND state_value IS NULL AND valid_until IS NULL) OR
    (value_kind = 'state_event' AND integer_value IS NULL AND numerator IS NULL AND denominator IS NULL AND unscaled IS NULL AND scale IS NULL AND state_value IS NOT NULL AND state_value IN ('running','standby','fault','offline','maintenance','unknown') AND valid_until IS NOT NULL AND valid_until = period_end)
  )
);

CREATE TABLE bsmoss_metering.quality_decision (
  workspace_id text NOT NULL,
  id text NOT NULL,
  measurement_id text NOT NULL,
  revision numeric(30,0) NOT NULL CHECK (revision > 0),
  quality text NOT NULL CHECK (quality IN ('verified','pending','rejected')),
  rule_version text NOT NULL,
  reason text NOT NULL,
  decided_by text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id,id),
  UNIQUE (workspace_id,measurement_id,revision),
  FOREIGN KEY (workspace_id,measurement_id) REFERENCES bsmoss_metering.measurement(workspace_id,id)
);

CREATE TABLE bsmoss_views.template_version (
  workspace_id text NOT NULL,
  code text NOT NULL,
  version numeric(30,0) NOT NULL CHECK (version > 0),
  template_kind text NOT NULL CHECK (template_kind IN ('workspace','role','page','report')),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  published_by text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id,code,version)
);

CREATE TABLE bsmoss_views.template_selection (
  workspace_id text NOT NULL,
  scope_key text NOT NULL,
  template_code text NOT NULL,
  template_version numeric(30,0) NOT NULL,
  changed_by text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id,scope_key),
  FOREIGN KEY (workspace_id,template_code,template_version) REFERENCES bsmoss_views.template_version(workspace_id,code,version)
);

CREATE TABLE bsmoss_views.user_preference (
  workspace_id text NOT NULL,
  subject text NOT NULL,
  template_code text NOT NULL,
  template_version numeric(30,0) NOT NULL,
  revision numeric(30,0) NOT NULL CHECK (revision > 0),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id,subject,template_code,template_version,revision),
  FOREIGN KEY (workspace_id,template_code,template_version) REFERENCES bsmoss_views.template_version(workspace_id,code,version)
);

CREATE INDEX measurement_station_period ON bsmoss_metering.measurement(workspace_id,station_id,period_start);
CREATE INDEX measurement_metric_period ON bsmoss_metering.measurement(workspace_id,metric_code,metric_version,period_start);
CREATE INDEX quality_measurement_revision ON bsmoss_metering.quality_decision(workspace_id,measurement_id,revision);
-- Neutral platform contract schemas adapted from yucer.
CREATE EXTENSION IF NOT EXISTS pgcrypto; 




CREATE SCHEMA IF NOT EXISTS vx_provision;

CREATE TABLE vx_provision.app_instance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,                       
  tenant_id uuid,                                
  product_code varchar(32) NOT NULL,                
  status varchar(32) NOT NULL DEFAULT 'pending'
                   CONSTRAINT chk_app_instance_status
                   CHECK (status IN ('pending', 'provisioned', 'deprovisioned')),
  env varchar(32) NOT NULL DEFAULT 'prod'
                   CONSTRAINT chk_app_instance_env CHECK (env IN ('beta', 'prod')),
  provisioned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uidx_app_instance_ws_product UNIQUE (workspace_id, product_code)
);


CREATE TABLE vx_provision.webhook_delivery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id varchar(128) NOT NULL,                 
  type varchar(64) NOT NULL,
  occurred_at timestamptz,
  result varchar(32) NOT NULL DEFAULT 'processed'
                 CONSTRAINT chk_webhook_delivery_result
                 CHECK (result IN ('processed', 'duplicate', 'stale', 'ignored')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uidx_webhook_delivery_delivery_id UNIQUE (delivery_id)
);


CREATE TABLE vx_provision.provision_seq (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,                         
  product_code varchar(32) NOT NULL,                  
  last_seq bigint NOT NULL DEFAULT 0,             
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uidx_provision_seq_ws_product UNIQUE (workspace_id, product_code)
);





CREATE SCHEMA IF NOT EXISTS local_authz;



CREATE TABLE local_authz.member (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,                       
  sub varchar(128) NOT NULL,               
  display_name varchar(255),                        
  avatar_hash varchar(128),                        
  status varchar(32) NOT NULL DEFAULT 'active'
                   CONSTRAINT chk_member_status CHECK (status IN ('active', 'inactive')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uidx_member_ws_sub UNIQUE (workspace_id, sub)
);



CREATE TABLE local_authz.role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code varchar(64) NOT NULL,
  name varchar(255) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uidx_role_role_code UNIQUE (role_code)
);

CREATE TABLE local_authz.permission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perm_code varchar(64) NOT NULL,
  name varchar(255) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uidx_permission_perm_code UNIQUE (perm_code)
);

CREATE TABLE local_authz.member_role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  role_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_member_role_member FOREIGN KEY (member_id) REFERENCES local_authz.member (id) ON DELETE CASCADE,
  CONSTRAINT fk_member_role_role FOREIGN KEY (role_id) REFERENCES local_authz.role (id) ON DELETE CASCADE,
  CONSTRAINT uidx_member_role_member_role UNIQUE (member_id, role_id)
);

CREATE TABLE local_authz.role_permission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL,
  permission_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_role_permission_role FOREIGN KEY (role_id) REFERENCES local_authz.role (id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permission_permission FOREIGN KEY (permission_id) REFERENCES local_authz.permission (id) ON DELETE CASCADE,
  CONSTRAINT uidx_role_permission_role_perm UNIQUE (role_id, permission_id)
);




CREATE SCHEMA IF NOT EXISTS local_usage;



CREATE TABLE local_usage.raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,                     
  metric varchar(128) NOT NULL,             
  amount bigint NOT NULL,
  idempotency_key varchar(128) NOT NULL,
  flushed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_raw_amount CHECK (amount > 0),
  CONSTRAINT uidx_raw_idempotency_key UNIQUE (idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_raw_unflushed ON local_usage.raw (flushed) WHERE flushed = false;


CREATE TABLE local_usage.checkpoint (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,                        
  metric varchar(128) NOT NULL,
  flushed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uidx_checkpoint_ws_metric UNIQUE (workspace_id, metric)
);


-- Product data scope is explicit even for workspace owners.
ALTER TABLE local_authz.member ADD CONSTRAINT uidx_member_ws_id UNIQUE(workspace_id,id);
CREATE TABLE local_authz.data_scope (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  member_id uuid NOT NULL,
  scope jsonb NOT NULL CHECK(jsonb_typeof(scope)='object'),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,member_id),
  FOREIGN KEY(workspace_id,member_id) REFERENCES local_authz.member(workspace_id,id)
);
INSERT INTO local_authz.permission(perm_code,name) VALUES ('metering.view','Read measurement evidence'),('metering.ingest','Append measurement evidence'),('metering.aggregate','Publish aggregate revisions');

-- Versioned interval aggregates. Empty baseline only; no legacy upgrade path.
CREATE SCHEMA bsmoss_analysis;
CREATE TABLE bsmoss_analysis.aggregate_series (
  workspace_id text NOT NULL,
  id text NOT NULL,
  source_id text NOT NULL,
  subject_key text NOT NULL,
  metric_code text NOT NULL,
  metric_version numeric(30,0) NOT NULL CHECK(metric_version > 0),
  grain text NOT NULL CHECK(grain IN ('15m','hour','day','week','month')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL CHECK(period_end > period_start),
  current_revision numeric(30,0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,id),
  UNIQUE(workspace_id,source_id,subject_key,metric_code,metric_version,grain,period_start,period_end),
  FOREIGN KEY(workspace_id,source_id) REFERENCES bsmoss_integration.source(workspace_id,id),
  FOREIGN KEY(metric_code,metric_version) REFERENCES bsmoss_catalog.metric_version(code,version)
);
CREATE TABLE bsmoss_analysis.aggregate_revision (
  workspace_id text NOT NULL,
  series_id text NOT NULL,
  revision numeric(30,0) NOT NULL CHECK(revision > 0),
  input_fingerprint text NOT NULL CHECK(input_fingerprint ~ '^[a-f0-9]{64}$'),
  aggregation_version text NOT NULL CHECK(length(aggregation_version) > 0),
  watermark timestamptz NOT NULL,
  completeness text NOT NULL CHECK(completeness IN ('complete','preliminary','partial','missing','not_applicable')),
  value_kind text NOT NULL CHECK(value_kind IN ('none','integer','ratio','state')),
  integer_value numeric(30,0),
  numerator numeric(30,0),
  denominator numeric(30,0),
  state_value jsonb,
  result_payload jsonb NOT NULL CHECK(jsonb_typeof(result_payload)='object'),
  input_manifest jsonb NOT NULL CHECK(jsonb_typeof(input_manifest)='object'),
  published_by text NOT NULL CHECK(length(published_by) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,series_id,revision),
  UNIQUE(workspace_id,series_id,input_fingerprint),
  FOREIGN KEY(workspace_id,series_id) REFERENCES bsmoss_analysis.aggregate_series(workspace_id,id),
  CHECK((value_kind='none' AND integer_value IS NULL AND numerator IS NULL AND denominator IS NULL AND state_value IS NULL) OR
        (value_kind='integer' AND integer_value IS NOT NULL AND integer_value >= 0 AND numerator IS NULL AND denominator IS NULL AND state_value IS NULL) OR
        (value_kind='ratio' AND integer_value IS NULL AND numerator IS NOT NULL AND denominator IS NOT NULL AND numerator >= 0 AND denominator > 0 AND numerator <= denominator AND state_value IS NULL) OR
        (value_kind='state' AND integer_value IS NULL AND numerator IS NULL AND denominator IS NULL AND state_value IS NOT NULL AND jsonb_typeof(state_value)='object' AND state_value->>'kind' IS NOT DISTINCT FROM 'state')),
  CHECK(value_kind <> 'state' OR (
    jsonb_typeof(state_value->'durationMilliseconds')='object' AND
    jsonb_typeof(state_value->'durationMilliseconds'->'running')='string' AND (state_value->'durationMilliseconds'->>'running') ~ '^(0|[1-9][0-9]{0,29})$' AND
    jsonb_typeof(state_value->'durationMilliseconds'->'standby')='string' AND (state_value->'durationMilliseconds'->>'standby') ~ '^(0|[1-9][0-9]{0,29})$' AND
    jsonb_typeof(state_value->'durationMilliseconds'->'fault')='string' AND (state_value->'durationMilliseconds'->>'fault') ~ '^(0|[1-9][0-9]{0,29})$' AND
    jsonb_typeof(state_value->'durationMilliseconds'->'offline')='string' AND (state_value->'durationMilliseconds'->>'offline') ~ '^(0|[1-9][0-9]{0,29})$' AND
    jsonb_typeof(state_value->'durationMilliseconds'->'maintenance')='string' AND (state_value->'durationMilliseconds'->>'maintenance') ~ '^(0|[1-9][0-9]{0,29})$' AND
    jsonb_typeof(state_value->'durationMilliseconds'->'unknown')='string' AND (state_value->'durationMilliseconds'->>'unknown') ~ '^(0|[1-9][0-9]{0,29})$' AND
    jsonb_typeof(state_value->'knownTransitions')='number' AND (state_value->>'knownTransitions') ~ '^(0|[1-9][0-9]*)$' AND
    jsonb_typeof(state_value->'gapTransitions')='number' AND (state_value->>'gapTransitions') ~ '^(0|[1-9][0-9]*)$' AND
    state_value->>'endState' IN ('running','standby','fault','offline','maintenance','unknown')
  ) IS TRUE),
  CHECK(result_payload ? 'value' AND result_payload->'value' = CASE value_kind
    WHEN 'none' THEN 'null'::jsonb
    WHEN 'integer' THEN jsonb_build_object('kind','integer','value',integer_value::text)
    WHEN 'state' THEN state_value
    ELSE jsonb_build_object('kind','ratio','numerator',numerator::text,'denominator',denominator::text) END),
  CHECK(result_payload->>'inputFingerprint' IS NOT DISTINCT FROM input_fingerprint),
  CHECK(result_payload->>'aggregationVersion' IS NOT DISTINCT FROM aggregation_version),
  CHECK(result_payload->>'completeness' IS NOT DISTINCT FROM completeness),
  CHECK(result_payload->>'workspaceId' IS NOT DISTINCT FROM workspace_id)
);
ALTER TABLE bsmoss_analysis.aggregate_series ADD CONSTRAINT aggregate_current_revision_fk
  FOREIGN KEY(workspace_id,id,current_revision) REFERENCES bsmoss_analysis.aggregate_revision(workspace_id,series_id,revision);
CREATE TABLE bsmoss_analysis.aggregate_outbox (
  workspace_id text NOT NULL,
  id text NOT NULL,
  series_id text NOT NULL,
  revision numeric(30,0) NOT NULL,
  event_type text NOT NULL CHECK(event_type='aggregate.revised'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,id),
  UNIQUE(workspace_id,series_id,revision),
  FOREIGN KEY(workspace_id,series_id,revision) REFERENCES bsmoss_analysis.aggregate_revision(workspace_id,series_id,revision)
);

-- Reviewed source completion/revocation evidence, append-only even to runtime.
-- The connector approval path is not yet enabled; runtime has SELECT only.
CREATE TABLE bsmoss_integration.source_completion (
  workspace_id text NOT NULL,
  source_id text NOT NULL,
  mapping_id text NOT NULL,
  station_id text NOT NULL,
  metric_code text NOT NULL,
  metric_version numeric(30,0) NOT NULL,
  grain text NOT NULL CHECK(grain IN ('15m','hour','day','week','month')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL CHECK(period_end > period_start),
  revision numeric(30,0) NOT NULL CHECK(revision > 0),
  status text NOT NULL CHECK(status IN ('confirmed','revoked')),
  input_fingerprint text NOT NULL CHECK(input_fingerprint ~ '^[a-f0-9]{64}$'),
  watermark timestamptz NOT NULL CHECK(watermark >= period_start AND (status <> 'confirmed' OR watermark >= period_end)),
  evidence_ref text NOT NULL CHECK(length(trim(evidence_ref)) > 0),
  evidence_sha256 text NOT NULL CHECK(evidence_sha256 ~ '^[a-f0-9]{64}$'),
  recorded_by text NOT NULL CHECK(length(trim(recorded_by)) > 0),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,source_id,mapping_id,metric_code,metric_version,grain,period_start,period_end,revision),
  FOREIGN KEY(workspace_id,mapping_id,station_id,source_id) REFERENCES bsmoss_integration.source_mapping(workspace_id,id,station_id,source_id),
  FOREIGN KEY(metric_code,metric_version) REFERENCES bsmoss_catalog.metric_version(code,version)
);

-- Reviewed whole-object completion, including adjacent mapping versions.
-- One revision stream per stable object/metric/window; NULL object parts compare equal.
-- No runtime INSERT grant: computation cannot approve its own source evidence.
CREATE TABLE bsmoss_integration.source_completion_set (
  workspace_id text NOT NULL,
  id text NOT NULL,
  source_id text NOT NULL,
  station_id text NOT NULL,
  service_id text,
  network_object_id text,
  device_id text,
  metric_code text NOT NULL,
  metric_version numeric(30,0) NOT NULL,
  grain text NOT NULL CHECK(grain IN ('15m','hour','day','week','month')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL CHECK(period_end > period_start),
  revision numeric(30,0) NOT NULL CHECK(revision > 0),
  status text NOT NULL CHECK(status IN ('confirmed','revoked')),
  input_fingerprint text NOT NULL CHECK(input_fingerprint ~ '^[a-f0-9]{64}$'),
  mapping_manifest_sha256 text NOT NULL CHECK(mapping_manifest_sha256 ~ '^[a-f0-9]{64}$'),
  watermark timestamptz NOT NULL CHECK(watermark >= period_start AND (status <> 'confirmed' OR watermark >= period_end)),
  evidence_ref text NOT NULL CHECK(length(trim(evidence_ref)) > 0),
  evidence_sha256 text NOT NULL CHECK(evidence_sha256 ~ '^[a-f0-9]{64}$'),
  recorded_by text NOT NULL CHECK(length(trim(recorded_by)) > 0),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,id),
  UNIQUE NULLS NOT DISTINCT(workspace_id,source_id,station_id,service_id,network_object_id,device_id,metric_code,metric_version,grain,period_start,period_end,revision),
  FOREIGN KEY(workspace_id,source_id) REFERENCES bsmoss_integration.source(workspace_id,id),
  FOREIGN KEY(workspace_id,station_id) REFERENCES bsmoss_resource.station(workspace_id,id),
  FOREIGN KEY(workspace_id,service_id,station_id) REFERENCES bsmoss_resource.station_service(workspace_id,id,station_id),
  FOREIGN KEY(workspace_id,network_object_id,station_id,service_id) REFERENCES bsmoss_resource.network_object(workspace_id,id,station_id,service_id),
  FOREIGN KEY(workspace_id,device_id,station_id) REFERENCES bsmoss_resource.device(workspace_id,id,station_id),
  FOREIGN KEY(metric_code,metric_version) REFERENCES bsmoss_catalog.metric_version(code,version),
  CHECK(network_object_id IS NULL OR service_id IS NOT NULL),
  CHECK(network_object_id IS NULL OR device_id IS NULL)
);

-- Internal durable refresh requests and append-only attempt receipts.
CREATE TABLE bsmoss_analysis.refresh_job (
  workspace_id text NOT NULL,
  id text NOT NULL,
  dedupe_key text NOT NULL CHECK(dedupe_key ~ '^[a-f0-9]{64}$'),
  source_id text NOT NULL,
  subject_key text NOT NULL CHECK(length(trim(subject_key)) > 0),
  metric_key text NOT NULL CHECK(length(trim(metric_key)) > 0),
  mapping_id text NOT NULL,
  trigger_ref text NOT NULL CHECK(length(trim(trigger_ref)) > 0),
  target jsonb NOT NULL CHECK(jsonb_typeof(target)='object'),
  max_attempts numeric(30,0) NOT NULL CHECK(max_attempts BETWEEN 1 AND 8),
  attempt numeric(30,0) NOT NULL DEFAULT 0 CHECK(attempt BETWEEN 0 AND max_attempts),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','leased','succeeded','dead')),
  lease_token uuid,
  lease_until timestamptz,
  available_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,id),
  UNIQUE(workspace_id,dedupe_key),
  FOREIGN KEY(workspace_id,source_id) REFERENCES bsmoss_integration.source(workspace_id,id),
  FOREIGN KEY(workspace_id,mapping_id) REFERENCES bsmoss_integration.source_mapping(workspace_id,id),
  CHECK((target->>'sourceId') IS NOT DISTINCT FROM source_id),
  CHECK((target->>'mappingId') IS NOT DISTINCT FROM mapping_id),
  CHECK((target->'metric'->>'code') || '@' || (target->'metric'->>'version') IS NOT DISTINCT FROM metric_key),
  CHECK((status='leased' AND lease_token IS NOT NULL AND lease_until IS NOT NULL AND attempt>0) OR
    (status<>'leased' AND lease_token IS NULL AND lease_until IS NULL))
);
CREATE INDEX refresh_job_ready ON bsmoss_analysis.refresh_job(workspace_id,available_at,created_at,id) WHERE status IN ('pending','leased');
CREATE TABLE bsmoss_analysis.refresh_attempt (
  workspace_id text NOT NULL,
  job_id text NOT NULL,
  attempt numeric(30,0) NOT NULL CHECK(attempt BETWEEN 1 AND 8),
  lease_token uuid NOT NULL,
  outcome text NOT NULL CHECK(outcome IN ('succeeded','retry','dead','expired')),
  failure_code text,
  result_ref text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,job_id,attempt),
  UNIQUE(workspace_id,lease_token),
  FOREIGN KEY(workspace_id,job_id) REFERENCES bsmoss_analysis.refresh_job(workspace_id,id),
  CHECK((outcome='succeeded' AND result_ref IS NOT NULL AND length(trim(result_ref))>0 AND failure_code IS NULL) OR
    (outcome<>'succeeded' AND result_ref IS NULL AND failure_code IS NOT NULL AND failure_code ~ '^[a-z][a-z0-9_]{0,63}$'))
);

-- Database-captured fact/quality changes. No global sequence cursor: receipts
-- identify individual committed events, including late-committing transactions.
CREATE TABLE bsmoss_metering.input_change (
  workspace_id text NOT NULL,
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  measurement_id text NOT NULL,
  change_kind text NOT NULL CHECK(change_kind IN ('measurement','quality')),
  quality_revision numeric(30,0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,id),
  UNIQUE NULLS NOT DISTINCT(workspace_id,measurement_id,change_kind,quality_revision),
  FOREIGN KEY(workspace_id,measurement_id) REFERENCES bsmoss_metering.measurement(workspace_id,id),
  FOREIGN KEY(workspace_id,measurement_id,quality_revision) REFERENCES bsmoss_metering.quality_decision(workspace_id,measurement_id,revision),
  CHECK((change_kind='measurement' AND quality_revision IS NULL) OR (change_kind='quality' AND quality_revision IS NOT NULL AND quality_revision>0))
);
CREATE INDEX input_change_pending ON bsmoss_metering.input_change(workspace_id,created_at,id);
CREATE TABLE bsmoss_analysis.input_refresh_receipt (
  workspace_id text NOT NULL,
  change_id text NOT NULL,
  subscription_sha256 text NOT NULL CHECK(subscription_sha256 ~ '^[a-f0-9]{64}$'),
  manifest_sha256 text NOT NULL CHECK(manifest_sha256 ~ '^[a-f0-9]{64}$'),
  manifest jsonb NOT NULL CHECK(jsonb_typeof(manifest)='object'),
  recorded_by text NOT NULL CHECK(length(trim(recorded_by))>0),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,change_id,subscription_sha256),
  FOREIGN KEY(workspace_id,change_id) REFERENCES bsmoss_metering.input_change(workspace_id,id),
  CHECK(manifest->>'subscriptionSha256' IS NOT DISTINCT FROM subscription_sha256),
  CHECK(manifest->>'changeId' IS NOT DISTINCT FROM change_id)
);
-- Runtime cannot inject changes outside these fixed triggers.
CREATE FUNCTION bsmoss_metering.capture_input_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF TG_TABLE_NAME='measurement' AND TG_TABLE_SCHEMA='bsmoss_metering' THEN
    INSERT INTO bsmoss_metering.input_change(workspace_id,measurement_id,change_kind)
      VALUES(NEW.workspace_id,NEW.id,'measurement');
  ELSIF TG_TABLE_NAME='quality_decision' AND TG_TABLE_SCHEMA='bsmoss_metering' THEN
    INSERT INTO bsmoss_metering.input_change(workspace_id,measurement_id,change_kind,quality_revision)
      VALUES(NEW.workspace_id,NEW.measurement_id,'quality',NEW.revision);
  ELSE RAISE EXCEPTION 'unsupported input change table'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bsmoss_metering.capture_input_change() FROM PUBLIC;
CREATE TRIGGER measurement_input_change AFTER INSERT ON bsmoss_metering.measurement
  FOR EACH ROW EXECUTE FUNCTION bsmoss_metering.capture_input_change();
CREATE TRIGGER quality_input_change AFTER INSERT ON bsmoss_metering.quality_decision
  FOR EACH ROW EXECUTE FUNCTION bsmoss_metering.capture_input_change();

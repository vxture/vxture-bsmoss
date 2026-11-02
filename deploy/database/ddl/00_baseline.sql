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
  semantic text NOT NULL CHECK (semantic IN ('interval_delta','derived','ratio','state','gauge')),
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
INSERT INTO local_authz.permission(perm_code,name) VALUES ('metering.view','Read measurement evidence'),('metering.ingest','Append measurement evidence'),('metering.aggregate','Publish aggregate revisions'),('reports.generate','Generate report snapshots');

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
  value_kind text NOT NULL CHECK(value_kind IN ('none','integer','ratio','state','gauge')),
  integer_value numeric(30,0),
  numerator numeric(30,0),
  denominator numeric(30,0),
  state_value jsonb,
  gauge_value jsonb,
  result_payload jsonb NOT NULL CHECK(jsonb_typeof(result_payload)='object'),
  input_manifest jsonb NOT NULL CHECK(jsonb_typeof(input_manifest)='object'),
  published_by text NOT NULL CHECK(length(published_by) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,series_id,revision),
  UNIQUE(workspace_id,series_id,input_fingerprint),
  FOREIGN KEY(workspace_id,series_id) REFERENCES bsmoss_analysis.aggregate_series(workspace_id,id),
  CHECK((value_kind='none' AND integer_value IS NULL AND numerator IS NULL AND denominator IS NULL AND state_value IS NULL AND gauge_value IS NULL) OR
        (value_kind='integer' AND integer_value IS NOT NULL AND integer_value >= 0 AND numerator IS NULL AND denominator IS NULL AND state_value IS NULL AND gauge_value IS NULL) OR
        (value_kind='ratio' AND integer_value IS NULL AND numerator IS NOT NULL AND denominator IS NOT NULL AND numerator >= 0 AND denominator > 0 AND numerator <= denominator AND state_value IS NULL AND gauge_value IS NULL) OR
        (value_kind='state' AND integer_value IS NULL AND numerator IS NULL AND denominator IS NULL AND state_value IS NOT NULL AND gauge_value IS NULL AND jsonb_typeof(state_value)='object' AND state_value->>'kind' IS NOT DISTINCT FROM 'state') OR
        (value_kind='gauge' AND integer_value IS NULL AND numerator IS NULL AND denominator IS NULL AND state_value IS NULL AND gauge_value IS NOT NULL AND jsonb_typeof(gauge_value)='object' AND gauge_value->>'kind' IS NOT DISTINCT FROM 'gauge')),
  CHECK(value_kind <> 'gauge' OR (
    gauge_value->>'mode' IN ('sample_mean','time_weighted') AND
    jsonb_typeof(gauge_value->'scale')='number' AND (gauge_value->>'scale') ~ '^[0-9]$' AND
    jsonb_typeof(gauge_value->'mean')='object' AND
    jsonb_typeof(gauge_value->'mean'->'numerator')='string' AND (gauge_value->'mean'->>'numerator') ~ '^(0|-?[1-9][0-9]{0,49})$' AND
    jsonb_typeof(gauge_value->'mean'->'denominator')='string' AND (gauge_value->'mean'->>'denominator') ~ '^[1-9][0-9]{0,29}$' AND
    jsonb_typeof(gauge_value->'minimum')='object' AND jsonb_typeof(gauge_value->'maximum')='object' AND
    jsonb_typeof(gauge_value->'minimum'->'unscaled')='string' AND (gauge_value->'minimum'->>'unscaled') ~ '^(0|-?[1-9][0-9]{0,29})$' AND
    jsonb_typeof(gauge_value->'maximum'->'unscaled')='string' AND (gauge_value->'maximum'->>'unscaled') ~ '^(0|-?[1-9][0-9]{0,29})$' AND
    jsonb_typeof(gauge_value->'minimum'->'observedAt')='string' AND length(gauge_value->'minimum'->>'observedAt')>0 AND
    jsonb_typeof(gauge_value->'maximum'->'observedAt')='string' AND length(gauge_value->'maximum'->>'observedAt')>0
  ) IS TRUE),
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
    WHEN 'gauge' THEN gauge_value
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
  id text NOT NULL DEFAULT gen_random_uuid()::text,
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
  UNIQUE(workspace_id,id),
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
-- Reviewed authority mutations retain their full old/new evidence in the same
-- transaction. No live-row foreign key: deletion must not erase the history.
CREATE TABLE bsmoss_integration.authority_change (
  workspace_id text NOT NULL,
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  entity_kind text NOT NULL CHECK(entity_kind IN ('source_mapping','source_capability','station_service')),
  entity_id text NOT NULL CHECK(length(trim(entity_id))>0),
  revision numeric(30,0) NOT NULL CHECK(revision>0),
  operation text NOT NULL CHECK(operation IN ('insert','update','delete')),
  before_snapshot jsonb,
  after_snapshot jsonb,
  evidence_sha256 text NOT NULL CHECK(evidence_sha256 ~ '^[a-f0-9]{64}$'),
  database_actor text NOT NULL CHECK(length(trim(database_actor))>0),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,id),
  UNIQUE(workspace_id,entity_kind,entity_id,revision),
  CHECK((operation='insert' AND before_snapshot IS NULL AND after_snapshot IS NOT NULL) OR
    (operation='update' AND before_snapshot IS NOT NULL AND after_snapshot IS NOT NULL AND before_snapshot<>after_snapshot) OR
    (operation='delete' AND before_snapshot IS NOT NULL AND after_snapshot IS NULL)),
  CHECK(before_snapshot IS NULL OR (jsonb_typeof(before_snapshot)='object' AND
    before_snapshot->>'workspace_id'=workspace_id AND before_snapshot->>'id'=entity_id) IS TRUE),
  CHECK(after_snapshot IS NULL OR (jsonb_typeof(after_snapshot)='object' AND
    after_snapshot->>'workspace_id'=workspace_id AND after_snapshot->>'id'=entity_id) IS TRUE),
  CHECK(evidence_sha256=encode(sha256(convert_to(jsonb_build_object('before',before_snapshot,'after',after_snapshot)::text,'UTF8')),'hex'))
);
CREATE INDEX authority_change_pending ON bsmoss_integration.authority_change(workspace_id,recorded_at,id);
CREATE TABLE bsmoss_metering.input_change (
  workspace_id text NOT NULL,
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  measurement_id text,
  legacy_completion_id text,
  completion_set_id text,
  authority_change_id text,
  change_kind text NOT NULL CHECK(change_kind IN ('measurement','quality','completion','completion_set','authority')),
  quality_revision numeric(30,0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,id),
  UNIQUE NULLS NOT DISTINCT(workspace_id,measurement_id,change_kind,quality_revision,legacy_completion_id,completion_set_id,authority_change_id),
  UNIQUE(workspace_id,legacy_completion_id),
  UNIQUE(workspace_id,completion_set_id),
  UNIQUE(workspace_id,authority_change_id),
  FOREIGN KEY(workspace_id,authority_change_id) REFERENCES bsmoss_integration.authority_change(workspace_id,id),
  FOREIGN KEY(workspace_id,measurement_id) REFERENCES bsmoss_metering.measurement(workspace_id,id),
  FOREIGN KEY(workspace_id,measurement_id,quality_revision) REFERENCES bsmoss_metering.quality_decision(workspace_id,measurement_id,revision),
  FOREIGN KEY(workspace_id,legacy_completion_id) REFERENCES bsmoss_integration.source_completion(workspace_id,id),
  FOREIGN KEY(workspace_id,completion_set_id) REFERENCES bsmoss_integration.source_completion_set(workspace_id,id),
  CHECK((authority_change_id IS NULL AND measurement_id IS NOT NULL AND legacy_completion_id IS NULL AND completion_set_id IS NULL AND
      ((change_kind='measurement' AND quality_revision IS NULL) OR (change_kind='quality' AND quality_revision IS NOT NULL AND quality_revision>0))) OR
    (authority_change_id IS NULL AND measurement_id IS NULL AND quality_revision IS NULL AND change_kind='completion' AND legacy_completion_id IS NOT NULL AND completion_set_id IS NULL) OR
    (authority_change_id IS NULL AND measurement_id IS NULL AND quality_revision IS NULL AND change_kind='completion_set' AND legacy_completion_id IS NULL AND completion_set_id IS NOT NULL) OR
    (change_kind='authority' AND authority_change_id IS NOT NULL AND measurement_id IS NULL AND quality_revision IS NULL AND legacy_completion_id IS NULL AND completion_set_id IS NULL))
);
CREATE INDEX input_change_pending ON bsmoss_metering.input_change(workspace_id,created_at,id);
CREATE TABLE bsmoss_analysis.aggregate_authority_invalidation (
  workspace_id text NOT NULL,
  series_id text NOT NULL,
  invalidated_revision numeric(30,0) NOT NULL,
  authority_change_id text NOT NULL,
  subscription_sha256 text NOT NULL CHECK(subscription_sha256 ~ '^[a-f0-9]{64}$'),
  reason text NOT NULL CHECK(reason IN ('awaiting_recompute','authority_unavailable')),
  recorded_by text NOT NULL CHECK(length(trim(recorded_by))>0),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,series_id,invalidated_revision,authority_change_id,subscription_sha256),
  FOREIGN KEY(workspace_id,series_id,invalidated_revision) REFERENCES bsmoss_analysis.aggregate_revision(workspace_id,series_id,revision),
  FOREIGN KEY(workspace_id,authority_change_id) REFERENCES bsmoss_integration.authority_change(workspace_id,id)
);
CREATE TABLE bsmoss_analysis.input_refresh_receipt (
  workspace_id text NOT NULL,
  change_id text NOT NULL,
  subscription_sha256 text NOT NULL CHECK(subscription_sha256 ~ '^[a-f0-9]{64}$'),
  partition_id text,
  partition_revision numeric(30,0),
  manifest_sha256 text NOT NULL CHECK(manifest_sha256 ~ '^[a-f0-9]{64}$'),
  manifest jsonb NOT NULL CHECK(jsonb_typeof(manifest)='object'),
  recorded_by text NOT NULL CHECK(length(trim(recorded_by))>0),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,change_id,subscription_sha256),
  FOREIGN KEY(workspace_id,change_id) REFERENCES bsmoss_metering.input_change(workspace_id,id),
  CHECK(manifest->>'subscriptionSha256' IS NOT DISTINCT FROM subscription_sha256),
  CHECK(manifest->>'changeId' IS NOT DISTINCT FROM change_id),
  CHECK((partition_id IS NULL)=(partition_revision IS NULL)),
  CHECK((partition_id IS NULL AND NOT manifest ? 'registration') OR
    (partition_id IS NOT NULL AND jsonb_typeof(manifest->'registration')='object' AND
      manifest->'registration'->>'partitionId'=partition_id AND
      manifest->'registration'->>'revision'=partition_revision::text) IS TRUE)
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
  ELSIF TG_TABLE_NAME='source_completion' AND TG_TABLE_SCHEMA='bsmoss_integration' THEN
    INSERT INTO bsmoss_metering.input_change(workspace_id,legacy_completion_id,change_kind)
      VALUES(NEW.workspace_id,NEW.id,'completion');
  ELSIF TG_TABLE_NAME='source_completion_set' AND TG_TABLE_SCHEMA='bsmoss_integration' THEN
    INSERT INTO bsmoss_metering.input_change(workspace_id,completion_set_id,change_kind)
      VALUES(NEW.workspace_id,NEW.id,'completion_set');
  ELSE RAISE EXCEPTION 'unsupported input change table'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bsmoss_metering.capture_input_change() FROM PUBLIC;
CREATE TRIGGER measurement_input_change AFTER INSERT ON bsmoss_metering.measurement
  FOR EACH ROW EXECUTE FUNCTION bsmoss_metering.capture_input_change();
CREATE TRIGGER quality_input_change AFTER INSERT ON bsmoss_metering.quality_decision
  FOR EACH ROW EXECUTE FUNCTION bsmoss_metering.capture_input_change();
CREATE TRIGGER completion_input_change AFTER INSERT ON bsmoss_integration.source_completion
  FOR EACH ROW EXECUTE FUNCTION bsmoss_metering.capture_input_change();
CREATE TRIGGER completion_set_input_change AFTER INSERT ON bsmoss_integration.source_completion_set
  FOR EACH ROW EXECUTE FUNCTION bsmoss_metering.capture_input_change();

-- Append-only consumption retry/quarantine/reopen history. A receipt, not a
-- retry state, is the sole evidence that changes were durably dispatched.
CREATE TABLE bsmoss_analysis.input_dispatch_event (
  workspace_id text NOT NULL,
  change_id text NOT NULL,
  subscription_sha256 text NOT NULL CHECK(subscription_sha256 ~ '^[a-f0-9]{64}$'),
  partition_id text,
  partition_revision numeric(30,0),
  revision numeric(30,0) NOT NULL CHECK(revision>0),
  attempt numeric(30,0) NOT NULL CHECK(attempt BETWEEN 0 AND 5),
  state text NOT NULL CHECK(state IN ('retry','quarantined','reopened')),
  failure_code text CHECK(failure_code IN ('serialization_conflict','database_unavailable','capacity_limit','source_unavailable','evidence_invalid')),
  reason_ref text,
  available_at timestamptz NOT NULL,
  recorded_by text NOT NULL CHECK(length(trim(recorded_by))>0),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,change_id,subscription_sha256,revision),
  UNIQUE(workspace_id,change_id,subscription_sha256,reason_ref),
  FOREIGN KEY(workspace_id,change_id) REFERENCES bsmoss_metering.input_change(workspace_id,id),
  CHECK((state='retry' AND attempt BETWEEN 1 AND 4 AND failure_code IS NOT NULL AND reason_ref IS NULL) OR
    (state='quarantined' AND attempt=5 AND failure_code IS NOT NULL AND reason_ref IS NULL) OR
    (state='reopened' AND attempt=0 AND failure_code IS NULL AND reason_ref IS NOT NULL AND length(trim(reason_ref))>0)),
  CHECK((partition_id IS NULL)=(partition_revision IS NULL))
);

CREATE FUNCTION bsmoss_integration.capture_authority_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog SET TimeZone='UTC' AS $$
DECLARE
  prior jsonb;
  next jsonb;
  anchor jsonb;
  next_revision numeric(30,0);
  previous_identity jsonb;
  identity_keys text[];
  identity_key text;
  change_id text;
BEGIN
  IF NOT ((TG_TABLE_SCHEMA='bsmoss_integration' AND TG_TABLE_NAME IN ('source_mapping','source_capability')) OR
    (TG_TABLE_SCHEMA='bsmoss_resource' AND TG_TABLE_NAME='station_service')) THEN
    RAISE EXCEPTION 'unsupported_authority_table';
  END IF;
  IF TG_OP='TRUNCATE' THEN RAISE EXCEPTION 'authority_truncate_forbidden'; END IF;
  IF TG_OP NOT IN ('INSERT','UPDATE','DELETE') THEN RAISE EXCEPTION 'unsupported_authority_operation'; END IF;
  IF TG_OP<>'INSERT' THEN prior=to_jsonb(OLD); END IF;
  IF TG_OP<>'DELETE' THEN next=to_jsonb(NEW); END IF;
  IF TG_OP='UPDATE' AND (prior->>'workspace_id' IS DISTINCT FROM next->>'workspace_id' OR prior->>'id' IS DISTINCT FROM next->>'id') THEN
    RAISE EXCEPTION 'authority_identity_immutable';
  END IF;
  IF prior IS NOT DISTINCT FROM next THEN RETURN NULL; END IF;
  -- PostgreSQL JSON numbers must not truncate 30-digit revisions in JS readers.
  IF TG_TABLE_NAME='source_mapping' THEN
    IF prior IS NOT NULL THEN prior=jsonb_set(prior,'{version}',to_jsonb(prior->>'version')); END IF;
    IF next IS NOT NULL THEN next=jsonb_set(next,'{version}',to_jsonb(next->>'version')); END IF;
  ELSIF TG_TABLE_NAME='source_capability' THEN
    IF prior IS NOT NULL THEN prior=jsonb_set(prior,'{metric_version}',to_jsonb(prior->>'metric_version')); END IF;
    IF next IS NOT NULL THEN next=jsonb_set(next,'{metric_version}',to_jsonb(next->>'metric_version')); END IF;
  END IF;
  anchor=coalesce(next,prior);
  PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array('bsmoss-authority',anchor->>'workspace_id',TG_TABLE_NAME,anchor->>'id')::text,0));
  SELECT coalesce(after_snapshot,before_snapshot) INTO previous_identity FROM bsmoss_integration.authority_change
    WHERE workspace_id=anchor->>'workspace_id' AND entity_kind=TG_TABLE_NAME AND entity_id=anchor->>'id' ORDER BY revision DESC LIMIT 1;
  identity_keys=CASE TG_TABLE_NAME
    WHEN 'source_mapping' THEN ARRAY['source_id','external_type','external_id','station_id','service_id','network_object_id','device_id']
    WHEN 'source_capability' THEN ARRAY['source_id','metric_code','metric_version']
    ELSE ARRAY['station_id','operator_entity_id'] END;
  IF next IS NOT NULL AND previous_identity IS NOT NULL THEN
    FOREACH identity_key IN ARRAY identity_keys LOOP
      IF previous_identity->identity_key IS DISTINCT FROM next->identity_key THEN RAISE EXCEPTION 'authority_object_immutable'; END IF;
    END LOOP;
  END IF;
  SELECT coalesce(max(revision),0)+1 INTO next_revision FROM bsmoss_integration.authority_change
    WHERE workspace_id=anchor->>'workspace_id' AND entity_kind=TG_TABLE_NAME AND entity_id=anchor->>'id';
  INSERT INTO bsmoss_integration.authority_change(workspace_id,entity_kind,entity_id,revision,operation,before_snapshot,after_snapshot,evidence_sha256,database_actor)
    VALUES(anchor->>'workspace_id',TG_TABLE_NAME,anchor->>'id',next_revision,lower(TG_OP),prior,next,
      encode(sha256(convert_to(jsonb_build_object('before',prior,'after',next)::text,'UTF8')),'hex'),session_user) RETURNING id INTO change_id;
  INSERT INTO bsmoss_metering.input_change(workspace_id,authority_change_id,change_kind)
    VALUES(anchor->>'workspace_id',change_id,'authority');
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION bsmoss_integration.capture_authority_change() FROM PUBLIC;
CREATE TRIGGER source_mapping_authority_change AFTER INSERT OR UPDATE OR DELETE ON bsmoss_integration.source_mapping
  FOR EACH ROW EXECUTE FUNCTION bsmoss_integration.capture_authority_change();
CREATE TRIGGER source_capability_authority_change AFTER INSERT OR UPDATE OR DELETE ON bsmoss_integration.source_capability
  FOR EACH ROW EXECUTE FUNCTION bsmoss_integration.capture_authority_change();
CREATE TRIGGER station_service_authority_change AFTER INSERT OR UPDATE OR DELETE ON bsmoss_resource.station_service
  FOR EACH ROW EXECUTE FUNCTION bsmoss_integration.capture_authority_change();
CREATE TRIGGER source_mapping_no_truncate BEFORE TRUNCATE ON bsmoss_integration.source_mapping
  FOR EACH STATEMENT EXECUTE FUNCTION bsmoss_integration.capture_authority_change();
CREATE TRIGGER source_capability_no_truncate BEFORE TRUNCATE ON bsmoss_integration.source_capability
  FOR EACH STATEMENT EXECUTE FUNCTION bsmoss_integration.capture_authority_change();
CREATE TRIGGER station_service_no_truncate BEFORE TRUNCATE ON bsmoss_resource.station_service
  FOR EACH STATEMENT EXECUTE FUNCTION bsmoss_integration.capture_authority_change();

-- Reviewed periodic partitions. Runtime reads configuration and only appends
-- scan receipts. New revisions atomically advance a lockable head.
CREATE TABLE bsmoss_integration.refresh_partition_revision (
  workspace_id text NOT NULL CHECK(length(trim(workspace_id))>0),
  id text NOT NULL CHECK(length(trim(id))>0),
  revision numeric(30,0) NOT NULL CHECK(revision>0),
  config jsonb NOT NULL CHECK(jsonb_typeof(config)='object' AND
    config ?& ARRAY['subject','status','scope','policy','seeds'] AND
    config-ARRAY['subject','status','scope','policy','seeds']='{}'::jsonb AND
    (jsonb_typeof(config->'subject')='string' AND length(trim(config->>'subject'))>0 AND
      config->>'status' IN ('active','paused') AND jsonb_typeof(config->'scope')='object' AND
      jsonb_typeof(config->'policy')='object' AND jsonb_typeof(config->'seeds')='array' AND
      jsonb_array_length(config->'seeds') BETWEEN 1 AND 12) IS TRUE),
  config_sha256 text NOT NULL DEFAULT '' CHECK(config_sha256=encode(sha256(convert_to(config::text,'UTF8')),'hex')),
  review_ref text NOT NULL CHECK(length(trim(review_ref))>0),
  database_actor text NOT NULL DEFAULT session_user CHECK(length(trim(database_actor))>0),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,id,revision)
);
CREATE TABLE bsmoss_integration.refresh_partition_head (
  workspace_id text NOT NULL,
  id text NOT NULL,
  revision numeric(30,0) NOT NULL,
  PRIMARY KEY(workspace_id,id),
  FOREIGN KEY(workspace_id,id,revision) REFERENCES bsmoss_integration.refresh_partition_revision(workspace_id,id,revision) DEFERRABLE INITIALLY DEFERRED
);
-- Row locking normally requires UPDATE privilege. Expose only the fixed read
-- lock, never head mutation, to the runtime role.
CREATE FUNCTION bsmoss_integration.lock_refresh_partition(text,text) RETURNS numeric
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT revision FROM bsmoss_integration.refresh_partition_head WHERE workspace_id=$1 AND id=$2 FOR SHARE
$$;
REVOKE ALL ON FUNCTION bsmoss_integration.lock_refresh_partition(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bsmoss_integration.lock_refresh_partition(text,text) TO bsmoss_svc;
CREATE FUNCTION bsmoss_integration.advance_refresh_partition() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE current_revision numeric(30,0);
BEGIN
  IF TG_TABLE_SCHEMA<>'bsmoss_integration' OR TG_TABLE_NAME<>'refresh_partition_revision' THEN RAISE EXCEPTION 'invalid_partition_trigger'; END IF;
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'partition_revision_append_only'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array('bsmoss-partition',NEW.workspace_id,NEW.id)::text,0));
  SELECT revision INTO current_revision FROM bsmoss_integration.refresh_partition_head WHERE workspace_id=NEW.workspace_id AND id=NEW.id FOR UPDATE;
  IF NEW.revision<>coalesce(current_revision,0)+1 THEN RAISE EXCEPTION 'partition_revision_conflict'; END IF;
  NEW.config_sha256=encode(sha256(convert_to(NEW.config::text,'UTF8')),'hex');
  NEW.database_actor=session_user;
  INSERT INTO bsmoss_integration.refresh_partition_head(workspace_id,id,revision) VALUES(NEW.workspace_id,NEW.id,NEW.revision)
    ON CONFLICT(workspace_id,id) DO UPDATE SET revision=excluded.revision;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bsmoss_integration.advance_refresh_partition() FROM PUBLIC;
CREATE TRIGGER refresh_partition_revision_capture BEFORE INSERT OR UPDATE OR DELETE ON bsmoss_integration.refresh_partition_revision
  FOR EACH ROW EXECUTE FUNCTION bsmoss_integration.advance_refresh_partition();
CREATE TRIGGER refresh_partition_revision_no_truncate BEFORE TRUNCATE ON bsmoss_integration.refresh_partition_revision
  FOR EACH STATEMENT EXECUTE FUNCTION bsmoss_integration.advance_refresh_partition();
CREATE TABLE bsmoss_analysis.refresh_scan_receipt (
  workspace_id text NOT NULL,
  partition_id text NOT NULL,
  partition_revision numeric(30,0) NOT NULL,
  scan_hour timestamptz NOT NULL CHECK(scan_hour=date_trunc('hour',scan_hour AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),
  manifest jsonb NOT NULL CHECK(jsonb_typeof(manifest)='object' AND
    (manifest->>'partitionId'=partition_id AND manifest->>'partitionRevision'=partition_revision::text) IS TRUE),
  manifest_sha256 text NOT NULL CHECK(manifest_sha256 ~ '^[a-f0-9]{64}$'),
  recorded_by text NOT NULL CHECK(length(trim(recorded_by))>0),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,partition_id,partition_revision,scan_hour),
  FOREIGN KEY(workspace_id,partition_id,partition_revision) REFERENCES bsmoss_integration.refresh_partition_revision(workspace_id,id,revision)
);

-- Configuration references are part of the empty baseline, not an upgrade.
ALTER TABLE bsmoss_analysis.input_refresh_receipt ADD FOREIGN KEY(workspace_id,partition_id,partition_revision)
  REFERENCES bsmoss_integration.refresh_partition_revision(workspace_id,id,revision);
ALTER TABLE bsmoss_analysis.input_dispatch_event ADD FOREIGN KEY(workspace_id,partition_id,partition_revision)
  REFERENCES bsmoss_integration.refresh_partition_revision(workspace_id,id,revision);

-- Reviewed finite coverage, never runtime-authored source authority.
CREATE TABLE bsmoss_integration.object_rollup_revision (
  workspace_id text NOT NULL CHECK(length(trim(workspace_id))>0),
  id text NOT NULL CHECK(length(trim(id))>0),
  revision numeric(30,0) NOT NULL CHECK(revision>0),
  config jsonb NOT NULL CHECK(jsonb_typeof(config)='object' AND
    config ?& ARRAY['status','metric','validPeriod','basis','atoms','members'] AND
    config-ARRAY['status','metric','validPeriod','basis','atoms','members']='{}'::jsonb AND
    (config->>'status' IN ('active','paused') AND jsonb_typeof(config->'metric')='object' AND
      jsonb_typeof(config->'validPeriod')='object' AND jsonb_typeof(config->'atoms')='array' AND
      jsonb_array_length(config->'atoms') BETWEEN 1 AND 256 AND jsonb_typeof(config->'members')='array' AND
      jsonb_array_length(config->'members')<=64) IS TRUE),
  config_sha256 text NOT NULL DEFAULT '' CHECK(config_sha256=encode(sha256(convert_to(config::text,'UTF8')),'hex')),
  review_ref text NOT NULL CHECK(length(trim(review_ref))>0),
  database_actor text NOT NULL DEFAULT session_user CHECK(length(trim(database_actor))>0),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,id,revision)
);
CREATE FUNCTION bsmoss_integration.capture_object_rollup_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE prior numeric(30,0);
BEGIN
  IF TG_TABLE_SCHEMA<>'bsmoss_integration' OR TG_TABLE_NAME<>'object_rollup_revision' THEN RAISE EXCEPTION 'invalid_rollup_trigger'; END IF;
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'rollup_revision_append_only'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array('bsmoss-object-rollup',NEW.workspace_id,NEW.id)::text,0));
  SELECT max(revision) INTO prior FROM bsmoss_integration.object_rollup_revision WHERE workspace_id=NEW.workspace_id AND id=NEW.id;
  IF NEW.revision<>coalesce(prior,0)+1 THEN RAISE EXCEPTION 'rollup_revision_conflict'; END IF;
  NEW.config_sha256=encode(sha256(convert_to(NEW.config::text,'UTF8')),'hex');
  NEW.database_actor=session_user;
  NEW.recorded_at=clock_timestamp();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bsmoss_integration.capture_object_rollup_revision() FROM PUBLIC;
CREATE TRIGGER object_rollup_revision_capture BEFORE INSERT OR UPDATE OR DELETE ON bsmoss_integration.object_rollup_revision
  FOR EACH ROW EXECUTE FUNCTION bsmoss_integration.capture_object_rollup_revision();
CREATE TRIGGER object_rollup_revision_no_truncate BEFORE TRUNCATE ON bsmoss_integration.object_rollup_revision
  FOR EACH STATEMENT EXECUTE FUNCTION bsmoss_integration.capture_object_rollup_revision();

CREATE TABLE bsmoss_analysis.report_series (
  workspace_id text NOT NULL,
  id text NOT NULL,
  template_code text NOT NULL,
  template_version numeric(30,0) NOT NULL,
  grain text NOT NULL CHECK(grain IN ('day','week','month')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL CHECK(period_end>period_start),
  current_revision numeric(30,0) CHECK(current_revision>0),
  PRIMARY KEY(workspace_id,id),
  UNIQUE(workspace_id,template_code,template_version,grain,period_start,period_end),
  FOREIGN KEY(workspace_id,template_code,template_version) REFERENCES bsmoss_views.template_version(workspace_id,code,version)
);
CREATE TABLE bsmoss_analysis.report_revision (
  workspace_id text NOT NULL,
  report_id text NOT NULL,
  revision numeric(30,0) NOT NULL CHECK(revision>0),
  manifest_sha256 text NOT NULL CHECK(manifest_sha256 ~ '^[a-f0-9]{64}$'),
  manifest jsonb NOT NULL CHECK(jsonb_typeof(manifest)='object' AND
    (manifest->>'version'='bsmoss-report-snapshot-v1' AND manifest->>'status'='generated' AND
      manifest->>'workspaceId'=workspace_id AND jsonb_typeof(manifest->'items')='array' AND
      jsonb_array_length(manifest->'items') BETWEEN 1 AND 16 AND jsonb_typeof(manifest->'requiredScope')='object' AND
      manifest->'requiredScope'->>'workspaceId'=workspace_id) IS TRUE),
  generated_by text NOT NULL CHECK(length(trim(generated_by))>0),
  generated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,report_id,revision),
  UNIQUE(workspace_id,report_id,manifest_sha256),
  FOREIGN KEY(workspace_id,report_id) REFERENCES bsmoss_analysis.report_series(workspace_id,id)
);
ALTER TABLE bsmoss_analysis.report_series ADD FOREIGN KEY(workspace_id,id,current_revision)
  REFERENCES bsmoss_analysis.report_revision(workspace_id,report_id,revision) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE bsmoss_analysis.report_outbox (
  workspace_id text NOT NULL,
  id text NOT NULL,
  report_id text NOT NULL,
  revision numeric(30,0) NOT NULL,
  event_type text NOT NULL CHECK(event_type='report.generated'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,id),
  UNIQUE(workspace_id,report_id,revision,event_type),
  FOREIGN KEY(workspace_id,report_id,revision) REFERENCES bsmoss_analysis.report_revision(workspace_id,report_id,revision)
);

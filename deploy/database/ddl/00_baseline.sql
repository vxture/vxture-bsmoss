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
  definition_sha256 text NOT NULL CHECK (definition_sha256 ~ '^[a-f0-9]{64}$'),
  database_sha256 text NOT NULL DEFAULT '' CHECK (database_sha256 ~ '^[a-f0-9]{64}$'),
  recorded_by text NOT NULL DEFAULT session_user,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id,subject,template_code,template_version,revision),
  FOREIGN KEY (workspace_id,template_code,template_version) REFERENCES bsmoss_views.template_version(workspace_id,code,version)
);

CREATE INDEX measurement_station_period ON bsmoss_metering.measurement(workspace_id,station_id,period_start);
CREATE INDEX measurement_metric_period ON bsmoss_metering.measurement(workspace_id,metric_code,metric_version,period_start);
CREATE INDEX quality_measurement_revision ON bsmoss_metering.quality_decision(workspace_id,measurement_id,revision);
-- Neutral platform contract schemas adapted from yucer.
CREATE EXTENSION IF NOT EXISTS pgcrypto; 

-- Reviewed template publication and default selection. Empty baseline only.
CREATE FUNCTION bsmoss_views.immutable_template_version() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN
  RAISE EXCEPTION 'immutable_template_version' USING ERRCODE='42501';
END $$;
CREATE TRIGGER immutable_template_version BEFORE UPDATE OR DELETE ON bsmoss_views.template_version
  FOR EACH ROW EXECUTE FUNCTION bsmoss_views.immutable_template_version();
CREATE TRIGGER immutable_template_version_truncate BEFORE TRUNCATE ON bsmoss_views.template_version
  FOR EACH STATEMENT EXECUTE FUNCTION bsmoss_views.immutable_template_version();

CREATE TABLE bsmoss_views.template_publication (
  workspace_id text NOT NULL,
  code text NOT NULL,
  version numeric(30,0) NOT NULL CHECK(version>0),
  subject text NOT NULL CHECK(length(subject) BETWEEN 1 AND 200),
  command_id text NOT NULL CHECK(length(command_id) BETWEEN 1 AND 200),
  manifest jsonb NOT NULL CHECK(jsonb_typeof(manifest)='object'),
  manifest_sha256 text NOT NULL CHECK(manifest_sha256 ~ '^[a-f0-9]{64}$'),
  database_sha256 text NOT NULL DEFAULT '' CHECK(database_sha256 ~ '^[a-f0-9]{64}$'),
  recorded_by text NOT NULL DEFAULT session_user,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,code,version), UNIQUE(workspace_id,subject,command_id),
  FOREIGN KEY(workspace_id,code,version) REFERENCES bsmoss_views.template_version(workspace_id,code,version)
);
CREATE TABLE bsmoss_views.template_selection_event (
  workspace_id text NOT NULL,
  scope_key text NOT NULL CHECK(scope_key='analysis:default'),
  revision numeric(30,0) NOT NULL CHECK(revision>0),
  subject text NOT NULL CHECK(length(subject) BETWEEN 1 AND 200),
  command_id text NOT NULL CHECK(length(command_id) BETWEEN 1 AND 200),
  template_code text NOT NULL,
  template_version numeric(30,0) NOT NULL,
  manifest jsonb NOT NULL CHECK(jsonb_typeof(manifest)='object'),
  manifest_sha256 text NOT NULL CHECK(manifest_sha256 ~ '^[a-f0-9]{64}$'),
  database_sha256 text NOT NULL DEFAULT '' CHECK(database_sha256 ~ '^[a-f0-9]{64}$'),
  recorded_by text NOT NULL DEFAULT session_user,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,scope_key,revision), UNIQUE(workspace_id,subject,command_id),
  FOREIGN KEY(workspace_id,template_code,template_version) REFERENCES bsmoss_views.template_version(workspace_id,code,version)
);
-- SQL independently checks the minimum real object footprint, including hidden
-- bindings and uncovered atoms. Application validation also checks semantics,
-- topology and derived-metric dependencies, with the final platform gates.
CREATE FUNCTION bsmoss_views.template_minimum_scope(w text, d jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$
DECLARE p jsonb; b jsonb; a jsonb; member jsonb; cfg jsonb; m bsmoss_integration.source_mapping%ROWTYPE;
  sources jsonb='[]'; stations jsonb='[]'; services jsonb='[]'; devices jsonb='[]'; metrics jsonb='[]'; site boolean=false;
BEGIN
  FOR p IN SELECT value FROM jsonb_array_elements(d->'panels') LOOP
    metrics=metrics||jsonb_build_array((p->'metricRef'->>'code')||'@'||(p->'metricRef'->>'version'));
  END LOOP;
  FOR b IN SELECT value FROM jsonb_array_elements(d->'bindings') LOOP
    IF b->>'kind'='rollup' THEN
      SELECT config INTO cfg FROM bsmoss_integration.object_rollup_revision WHERE workspace_id=w AND id=b->>'rollupId' ORDER BY revision DESC LIMIT 1;
      IF cfg IS NULL THEN RAISE EXCEPTION 'template_binding_unavailable' USING ERRCODE='23514'; END IF;
      FOR a IN SELECT value FROM jsonb_array_elements(cfg->'atoms') LOOP
        stations=stations||jsonb_build_array(a->>'stationId');
        IF a->>'serviceId' IS NOT NULL THEN services=services||jsonb_build_array(a->>'serviceId'); END IF;
        IF a->>'deviceId' IS NOT NULL THEN devices=devices||jsonb_build_array(a->>'deviceId'); END IF;
        IF a->>'serviceId' IS NULL AND a->>'deviceId' IS NULL THEN site=true; END IF;
      END LOOP;
    ELSE cfg=jsonb_build_object('members',jsonb_build_array(b)); END IF;
    IF b->>'kind'<>'not_connected' THEN
      FOR member IN SELECT value FROM jsonb_array_elements(cfg->'members') LOOP
        SELECT * INTO m FROM bsmoss_integration.source_mapping WHERE workspace_id=w AND id=member->>'mappingId' AND source_id=member->>'sourceId';
        IF m.id IS NULL THEN RAISE EXCEPTION 'template_binding_unavailable' USING ERRCODE='23514'; END IF;
        sources=sources||jsonb_build_array(m.source_id); stations=stations||jsonb_build_array(m.station_id);
        IF m.service_id IS NOT NULL THEN services=services||jsonb_build_array(m.service_id); END IF;
        IF m.device_id IS NOT NULL THEN devices=devices||jsonb_build_array(m.device_id); END IF;
        IF m.service_id IS NULL AND m.device_id IS NULL THEN site=true; END IF;
      END LOOP;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('workspaceId',w,'sourceIds',sources,'stationIds',stations,'serviceIds',services,'deviceIds',devices,'metricKeys',metrics)
    || CASE WHEN site THEN jsonb_build_object('allowSiteParameters',true) ELSE '{}'::jsonb END;
END $$;

CREATE FUNCTION bsmoss_views.capture_template_publication() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jsonb; prior numeric; previous_kind text; required jsonb;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'immutable_template_publication' USING ERRCODE='42501'; END IF;
  c=NEW.manifest->'command'; required=NEW.manifest->'requiredScope';
  PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array('bsmoss-template-publication',NEW.workspace_id,NEW.code)::text,0));
  SELECT version,template_kind INTO prior,previous_kind FROM bsmoss_views.template_version WHERE workspace_id=NEW.workspace_id AND code=NEW.code ORDER BY version DESC LIMIT 1;
  IF NEW.manifest->>'schema' IS DISTINCT FROM 'template-publication-v1' OR
    (c->>'templateCode',c->>'commandId') IS DISTINCT FROM (NEW.code,NEW.command_id) OR
    c->'candidate'->>'kind' NOT IN ('page','report') OR c->'candidate'->>'kind' IS NULL OR
    (previous_kind IS NOT NULL AND previous_kind<>c->'candidate'->>'kind') OR
    (c->>'expectedVersion') IS DISTINCT FROM prior::text OR NEW.version<>coalesce(prior,0)+1 OR
    length(coalesce(c->>'reviewRef','')) NOT BETWEEN 1 AND 200 OR
    NEW.manifest->'validation'->>'validationSha256' IS DISTINCT FROM c->>'validationSha256' OR
    NEW.manifest->'validation'->>'candidateSha256' IS DISTINCT FROM c->>'candidateSha256' OR
    required IS DISTINCT FROM NEW.manifest->'validation'->'requiredScope' OR
    required->>'workspaceId' IS DISTINCT FROM NEW.workspace_id OR
    NOT coalesce(required @> bsmoss_views.template_minimum_scope(NEW.workspace_id,c->'candidate'->'definition'),false) THEN
    RAISE EXCEPTION 'invalid_template_publication' USING ERRCODE='23514';
  END IF;
  NEW.database_sha256=encode(sha256(convert_to(NEW.manifest::text,'UTF8')),'hex'); NEW.recorded_by=session_user; NEW.created_at=clock_timestamp();
  INSERT INTO bsmoss_views.template_version(workspace_id,code,version,template_kind,definition,published_by,published_at)
    VALUES(NEW.workspace_id,NEW.code,NEW.version,c->'candidate'->>'kind',c->'candidate'->'definition',NEW.subject,NEW.created_at);
  RETURN NEW;
END $$;
CREATE TRIGGER capture_template_publication BEFORE INSERT OR UPDATE OR DELETE ON bsmoss_views.template_publication
  FOR EACH ROW EXECUTE FUNCTION bsmoss_views.capture_template_publication();
CREATE TRIGGER capture_template_publication_truncate BEFORE TRUNCATE ON bsmoss_views.template_publication
  FOR EACH STATEMENT EXECUTE FUNCTION bsmoss_views.capture_template_publication();

CREATE FUNCTION bsmoss_views.capture_template_selection() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jsonb; prior numeric; s bsmoss_views.template_selection%ROWTYPE; t bsmoss_views.template_version%ROWTYPE; required jsonb; old_definition jsonb;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'immutable_template_selection_event' USING ERRCODE='42501'; END IF;
  c=NEW.manifest->'command'; required=NEW.manifest->'requiredScope';
  PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array('bsmoss-template-selection',NEW.workspace_id,NEW.scope_key)::text,0));
  SELECT * INTO s FROM bsmoss_views.template_selection WHERE workspace_id=NEW.workspace_id AND scope_key=NEW.scope_key FOR UPDATE;
  SELECT max(revision) INTO prior FROM bsmoss_views.template_selection_event WHERE workspace_id=NEW.workspace_id AND scope_key=NEW.scope_key;
  SELECT * INTO t FROM bsmoss_views.template_version WHERE workspace_id=NEW.workspace_id AND code=NEW.template_code AND version=NEW.template_version;
  IF NEW.manifest->>'schema' IS DISTINCT FROM 'template-selection-v1' OR t.template_kind IS DISTINCT FROM 'page' OR
    (c->>'templateCode',c->>'templateVersion',c->>'scopeKey',c->>'commandId') IS DISTINCT FROM (NEW.template_code,NEW.template_version::text,NEW.scope_key,NEW.command_id) OR
    (c->'expected'->>'revision') IS DISTINCT FROM prior::text OR NEW.revision<>coalesce(prior,0)+1 OR
    (c->'expected'->>'code',c->'expected'->>'version') IS DISTINCT FROM (s.template_code,s.template_version::text) OR
    (s.workspace_id IS NULL AND c->'expected' IS DISTINCT FROM 'null'::jsonb) OR
    length(coalesce(c->>'reviewRef','')) NOT BETWEEN 1 AND 200 OR
    NEW.manifest->'validation'->>'validationSha256' IS DISTINCT FROM c->>'validationSha256' OR
    required->>'workspaceId' IS DISTINCT FROM NEW.workspace_id OR
    NOT coalesce((required-'allowSiteParameters') @> ((NEW.manifest->'validation'->'requiredScope')-'allowSiteParameters'),false) OR
    (NEW.manifest->'validation'->'requiredScope'->>'allowSiteParameters'='true' AND required->>'allowSiteParameters' IS DISTINCT FROM 'true') OR
    NOT coalesce(required @> bsmoss_views.template_minimum_scope(NEW.workspace_id,t.definition),false) THEN
    RAISE EXCEPTION 'invalid_template_selection_event' USING ERRCODE='23514';
  END IF;
  IF s.workspace_id IS NOT NULL THEN
    SELECT definition INTO old_definition FROM bsmoss_views.template_version WHERE workspace_id=s.workspace_id AND code=s.template_code AND version=s.template_version;
    IF NOT coalesce(required @> bsmoss_views.template_minimum_scope(NEW.workspace_id,old_definition),false) THEN
      RAISE EXCEPTION 'invalid_template_selection_scope' USING ERRCODE='23514';
    END IF;
  END IF;
  NEW.database_sha256=encode(sha256(convert_to(NEW.manifest::text,'UTF8')),'hex'); NEW.recorded_by=session_user; NEW.created_at=clock_timestamp();
  INSERT INTO bsmoss_views.template_selection(workspace_id,scope_key,template_code,template_version,changed_by,changed_at)
    VALUES(NEW.workspace_id,NEW.scope_key,NEW.template_code,NEW.template_version,NEW.subject,NEW.created_at)
    ON CONFLICT(workspace_id,scope_key) DO UPDATE SET template_code=excluded.template_code,template_version=excluded.template_version,changed_by=excluded.changed_by,changed_at=excluded.changed_at;
  RETURN NEW;
END $$;
CREATE TRIGGER capture_template_selection BEFORE INSERT OR UPDATE OR DELETE ON bsmoss_views.template_selection_event
  FOR EACH ROW EXECUTE FUNCTION bsmoss_views.capture_template_selection();
CREATE TRIGGER capture_template_selection_truncate BEFORE TRUNCATE ON bsmoss_views.template_selection_event
  FOR EACH STATEMENT EXECUTE FUNCTION bsmoss_views.capture_template_selection();
-- A preference save can share-lock the default pointer without acquiring any
-- direct UPDATE privilege on it. This function has no write capability.
CREATE FUNCTION bsmoss_views.lock_analysis_selection(w text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT scope_key FROM bsmoss_views.template_selection WHERE workspace_id=w AND scope_key='analysis:default' FOR SHARE
$$;
REVOKE ALL ON FUNCTION bsmoss_views.capture_template_publication(),bsmoss_views.capture_template_selection(),bsmoss_views.template_minimum_scope(text,jsonb),bsmoss_views.lock_analysis_selection(text) FROM PUBLIC;

CREATE UNIQUE INDEX analysis_preference_command ON bsmoss_views.user_preference
  (workspace_id,subject,template_code,template_version,(definition->'command'->>'commandId'))
  WHERE definition->>'schema'='analysis-preference-v1';
CREATE FUNCTION bsmoss_views.capture_user_preference() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,bsmoss_views AS $$
DECLARE prior numeric; c jsonb;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'immutable_user_preference' USING ERRCODE='42501'; END IF;
  c=NEW.definition->'command';
  IF NEW.definition->>'schema' IS DISTINCT FROM 'analysis-preference-v1' OR
    (c->>'templateCode',c->>'templateVersion') IS DISTINCT FROM (NEW.template_code,NEW.template_version::text) OR
    NEW.definition->'requiredScope'->>'workspaceId' IS DISTINCT FROM NEW.workspace_id OR
    jsonb_typeof(c->'preferences') IS DISTINCT FROM 'array' OR
    length(coalesce(c->>'commandId','')) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'invalid_user_preference' USING ERRCODE='23514';
  END IF;
  SELECT max(revision) INTO prior FROM bsmoss_views.user_preference WHERE
    workspace_id=NEW.workspace_id AND subject=NEW.subject AND template_code=NEW.template_code AND template_version=NEW.template_version;
  IF NEW.revision<>coalesce(prior,0)+1 OR
    (c->>'expectedRevision') IS DISTINCT FROM prior::text THEN RAISE EXCEPTION 'invalid_user_preference_revision' USING ERRCODE='23514'; END IF;
  NEW.database_sha256=encode(sha256(convert_to(NEW.definition::text,'UTF8')),'hex');
  NEW.recorded_by=session_user; NEW.created_at=clock_timestamp(); RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bsmoss_views.capture_user_preference() FROM PUBLIC;
CREATE TRIGGER user_preference_capture BEFORE INSERT OR UPDATE OR DELETE ON bsmoss_views.user_preference
  FOR EACH ROW EXECUTE FUNCTION bsmoss_views.capture_user_preference();
CREATE TRIGGER user_preference_no_truncate BEFORE TRUNCATE ON bsmoss_views.user_preference
  FOR EACH STATEMENT EXECUTE FUNCTION bsmoss_views.capture_user_preference();




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
INSERT INTO local_authz.permission(perm_code,name) VALUES ('metering.view','Read measurement evidence'),('metering.ingest','Append measurement evidence'),('metering.aggregate','Publish aggregate revisions'),('metering.jobs.view','Inspect scoped aggregate jobs'),('metering.jobs.recover','Review and replace terminal aggregate jobs'),('reports.jobs.view','Inspect scoped report jobs'),('reports.generate','Generate report snapshots'),('reports.publish','Publish or withdraw report snapshots'),('reports.export','Request and download report exports'),('reports.export.execute','Execute report export jobs'),('views.templates.view','Inspect reviewed templates'),('views.templates.publish','Publish immutable template versions'),('views.templates.select','Review and switch default template');

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
  current_publication_revision numeric(30,0) CHECK(current_publication_revision>0),
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
  UNIQUE(workspace_id,report_id,revision,manifest_sha256),
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

CREATE TABLE bsmoss_analysis.report_publication_event (
  workspace_id text NOT NULL,
  report_id text NOT NULL,
  event_revision numeric(30,0) NOT NULL CHECK(event_revision>0),
  previous_event_revision numeric(30,0),
  report_revision numeric(30,0) NOT NULL,
  manifest_sha256 text NOT NULL,
  command_id text NOT NULL CHECK(length(trim(command_id)) BETWEEN 1 AND 2048),
  action text NOT NULL CHECK(action IN ('published','withdrawn')),
  reason_ref text NOT NULL CHECK(length(trim(reason_ref)) BETWEEN 1 AND 2048),
  recorded_by text NOT NULL CHECK(length(trim(recorded_by)) BETWEEN 1 AND 2048),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,report_id,event_revision),
  UNIQUE(workspace_id,report_id,command_id),
  UNIQUE(workspace_id,report_id,event_revision,action),
  UNIQUE(workspace_id,report_id,event_revision,report_revision,manifest_sha256,action),
  CHECK((CASE WHEN event_revision=1 THEN previous_event_revision IS NULL ELSE previous_event_revision=event_revision-1 END) IS TRUE),
  FOREIGN KEY(workspace_id,report_id,report_revision,manifest_sha256) REFERENCES bsmoss_analysis.report_revision(workspace_id,report_id,revision,manifest_sha256),
  FOREIGN KEY(workspace_id,report_id,previous_event_revision) REFERENCES bsmoss_analysis.report_publication_event(workspace_id,report_id,event_revision)
);
ALTER TABLE bsmoss_analysis.report_series ADD FOREIGN KEY(workspace_id,id,current_publication_revision)
  REFERENCES bsmoss_analysis.report_publication_event(workspace_id,report_id,event_revision) DEFERRABLE INITIALLY DEFERRED;
CREATE FUNCTION bsmoss_analysis.capture_report_publication() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE prior bsmoss_analysis.report_publication_event%ROWTYPE;
BEGIN
  IF TG_TABLE_SCHEMA<>'bsmoss_analysis' OR TG_TABLE_NAME<>'report_publication_event' THEN RAISE EXCEPTION 'invalid_publication_trigger'; END IF;
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'publication_append_only'; END IF;
  PERFORM 1 FROM bsmoss_analysis.report_series WHERE workspace_id=NEW.workspace_id AND id=NEW.report_id FOR UPDATE;
  SELECT * INTO prior FROM bsmoss_analysis.report_publication_event WHERE workspace_id=NEW.workspace_id AND report_id=NEW.report_id ORDER BY event_revision DESC LIMIT 1;
  IF NEW.event_revision<>coalesce(prior.event_revision,0)+1 OR NEW.previous_event_revision IS DISTINCT FROM prior.event_revision THEN RAISE EXCEPTION 'publication_revision_conflict'; END IF;
  IF NEW.action='withdrawn' AND (prior.action IS DISTINCT FROM 'published' OR NEW.report_revision IS DISTINCT FROM prior.report_revision OR NEW.manifest_sha256 IS DISTINCT FROM prior.manifest_sha256) THEN RAISE EXCEPTION 'publication_withdrawal_conflict'; END IF;
  IF NEW.action='published' AND prior.action='published' AND NEW.report_revision=prior.report_revision THEN RAISE EXCEPTION 'report_already_published'; END IF;
  UPDATE bsmoss_analysis.report_series SET current_publication_revision=NEW.event_revision WHERE workspace_id=NEW.workspace_id AND id=NEW.report_id;
  NEW.recorded_at=clock_timestamp();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bsmoss_analysis.capture_report_publication() FROM PUBLIC;
CREATE TRIGGER report_publication_capture BEFORE INSERT OR UPDATE OR DELETE ON bsmoss_analysis.report_publication_event
  FOR EACH ROW EXECUTE FUNCTION bsmoss_analysis.capture_report_publication();
CREATE TRIGGER report_publication_no_truncate BEFORE TRUNCATE ON bsmoss_analysis.report_publication_event
  FOR EACH STATEMENT EXECUTE FUNCTION bsmoss_analysis.capture_report_publication();
CREATE TABLE bsmoss_analysis.report_publication_outbox (
  workspace_id text NOT NULL,
  id text NOT NULL,
  report_id text NOT NULL,
  event_revision numeric(30,0) NOT NULL,
  action text NOT NULL CHECK(action IN ('published','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,id),
  UNIQUE(workspace_id,report_id,event_revision),
  FOREIGN KEY(workspace_id,report_id,event_revision,action) REFERENCES bsmoss_analysis.report_publication_event(workspace_id,report_id,event_revision,action)
);

CREATE TABLE bsmoss_analysis.report_export_job (
  workspace_id text NOT NULL,
  id text NOT NULL,
  report_id text NOT NULL,
  publication_revision numeric(30,0) NOT NULL,
  publication_action text NOT NULL DEFAULT 'published' CHECK(publication_action='published'),
  report_revision numeric(30,0) NOT NULL,
  manifest_sha256 text NOT NULL,
  renderer_version text NOT NULL CHECK(length(trim(renderer_version))>0),
  command_id text NOT NULL CHECK(length(trim(command_id)) BETWEEN 1 AND 2048),
  requested_by text NOT NULL CHECK(length(trim(requested_by)) BETWEEN 1 AND 2048),
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','succeeded','dead')),
  attempt numeric(30,0) NOT NULL DEFAULT 0 CHECK(attempt BETWEEN 0 AND 5),
  available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  artifact_sha256 text,
  PRIMARY KEY(workspace_id,id),
  UNIQUE(workspace_id,command_id),
  UNIQUE(workspace_id,id,renderer_version),
  CHECK((status='succeeded' AND artifact_sha256 IS NOT NULL AND attempt>0) OR (status<>'succeeded' AND artifact_sha256 IS NULL)),
  CHECK(status<>'dead' OR attempt>0),
  FOREIGN KEY(workspace_id,report_id,publication_revision,report_revision,manifest_sha256,publication_action)
    REFERENCES bsmoss_analysis.report_publication_event(workspace_id,report_id,event_revision,report_revision,manifest_sha256,action)
);
CREATE INDEX report_export_due ON bsmoss_analysis.report_export_job(workspace_id,available_at,id) WHERE status='pending';
CREATE TABLE bsmoss_analysis.report_export_artifact (
  workspace_id text NOT NULL,
  job_id text NOT NULL,
  renderer_version text NOT NULL,
  html text NOT NULL CHECK(octet_length(html) BETWEEN 1 AND 2097152),
  content_sha256 text NOT NULL CHECK(content_sha256=encode(sha256(convert_to(html,'UTF8')),'hex')),
  created_by text NOT NULL CHECK(length(trim(created_by))>0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,job_id),
  UNIQUE(workspace_id,job_id,content_sha256),
  FOREIGN KEY(workspace_id,job_id,renderer_version) REFERENCES bsmoss_analysis.report_export_job(workspace_id,id,renderer_version)
);
ALTER TABLE bsmoss_analysis.report_export_job ADD FOREIGN KEY(workspace_id,id,artifact_sha256)
  REFERENCES bsmoss_analysis.report_export_artifact(workspace_id,job_id,content_sha256) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE bsmoss_analysis.report_export_attempt (
  workspace_id text NOT NULL,
  job_id text NOT NULL,
  attempt numeric(30,0) NOT NULL CHECK(attempt BETWEEN 1 AND 5),
  outcome text NOT NULL CHECK(outcome IN ('succeeded','retry','dead')),
  failure_code text CHECK(failure_code IN ('report_not_active','report_stale','report_incomplete','export_too_large','export_renderer_unavailable','render_failed','storage_failed')),
  artifact_sha256 text,
  recorded_by text NOT NULL CHECK(length(trim(recorded_by))>0),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,job_id,attempt),
  CHECK((outcome='succeeded' AND failure_code IS NULL AND artifact_sha256 IS NOT NULL) OR (outcome<>'succeeded' AND failure_code IS NOT NULL AND artifact_sha256 IS NULL)),
  FOREIGN KEY(workspace_id,job_id) REFERENCES bsmoss_analysis.report_export_job(workspace_id,id),
  FOREIGN KEY(workspace_id,job_id,artifact_sha256) REFERENCES bsmoss_analysis.report_export_artifact(workspace_id,job_id,content_sha256)
    DEFERRABLE INITIALLY DEFERRED
);

-- Reviewed report calendars and durable generation. Runtime cannot create
-- delegation or advance the reviewed configuration head.
CREATE TABLE bsmoss_integration.report_schedule_revision (
  workspace_id text NOT NULL CHECK(length(trim(workspace_id))>0),
  id text NOT NULL CHECK(length(trim(id))>0),
  revision numeric(30,0) NOT NULL CHECK(revision>0),
  config jsonb NOT NULL CHECK(jsonb_typeof(config)='object' AND
    config ?& ARRAY['subject','status','scope','templateCode','templateVersion','templateSha256','grain','notBefore','delayMinutes','lookbackHours'] AND
    config-ARRAY['subject','status','scope','templateCode','templateVersion','templateSha256','grain','notBefore','delayMinutes','lookbackHours']='{}'::jsonb AND
    (jsonb_typeof(config->'subject')='string' AND length(trim(config->>'subject'))>0 AND config->>'status' IN ('active','paused') AND
      jsonb_typeof(config->'scope')='object' AND config->'scope'->>'workspaceId'=workspace_id AND config->>'templateSha256' ~ '^[a-f0-9]{64}$' AND
      config->>'grain' IN ('day','week','month') AND jsonb_typeof(config->'templateVersion')='number' AND
      jsonb_typeof(config->'delayMinutes')='number' AND jsonb_typeof(config->'lookbackHours')='number') IS TRUE),
  template_code text NOT NULL DEFAULT '',
  template_version numeric(30,0) NOT NULL DEFAULT 1,
  grain text NOT NULL DEFAULT '' CHECK(grain IN ('day','week','month')),
  config_sha256 text NOT NULL DEFAULT '' CHECK(config_sha256=encode(sha256(convert_to(config::text,'UTF8')),'hex')),
  review_ref text NOT NULL CHECK(length(trim(review_ref))>0),
  database_actor text NOT NULL DEFAULT session_user CHECK(length(trim(database_actor))>0),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,id,revision),
  UNIQUE(workspace_id,id,revision,grain),
  CHECK((template_code=config->>'templateCode' AND template_version::text=config->>'templateVersion' AND grain=config->>'grain') IS TRUE),
  FOREIGN KEY(workspace_id,template_code,template_version) REFERENCES bsmoss_views.template_version(workspace_id,code,version)
);
CREATE TABLE bsmoss_integration.report_schedule_head (
  workspace_id text NOT NULL,
  id text NOT NULL,
  revision numeric(30,0) NOT NULL,
  PRIMARY KEY(workspace_id,id),
  FOREIGN KEY(workspace_id,id,revision) REFERENCES bsmoss_integration.report_schedule_revision(workspace_id,id,revision) DEFERRABLE INITIALLY DEFERRED
);
CREATE FUNCTION bsmoss_integration.lock_report_schedule(text,text) RETURNS numeric
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT revision FROM bsmoss_integration.report_schedule_head WHERE workspace_id=$1 AND id=$2 FOR SHARE
$$;
REVOKE ALL ON FUNCTION bsmoss_integration.lock_report_schedule(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bsmoss_integration.lock_report_schedule(text,text) TO bsmoss_svc;
CREATE FUNCTION bsmoss_integration.advance_report_schedule() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE current_revision numeric(30,0);
BEGIN
  IF TG_TABLE_SCHEMA<>'bsmoss_integration' OR TG_TABLE_NAME<>'report_schedule_revision' THEN RAISE EXCEPTION 'invalid_report_schedule_trigger'; END IF;
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'report_schedule_append_only'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array('bsmoss-report-schedule',NEW.workspace_id,NEW.id)::text,0));
  SELECT revision INTO current_revision FROM bsmoss_integration.report_schedule_head WHERE workspace_id=NEW.workspace_id AND id=NEW.id FOR UPDATE;
  IF NEW.revision<>coalesce(current_revision,0)+1 THEN RAISE EXCEPTION 'report_schedule_revision_conflict'; END IF;
  NEW.template_code=NEW.config->>'templateCode'; NEW.template_version=(NEW.config->>'templateVersion')::numeric; NEW.grain=NEW.config->>'grain';
  NEW.config_sha256=encode(sha256(convert_to(NEW.config::text,'UTF8')),'hex'); NEW.database_actor=session_user;
  INSERT INTO bsmoss_integration.report_schedule_head(workspace_id,id,revision) VALUES(NEW.workspace_id,NEW.id,NEW.revision)
    ON CONFLICT(workspace_id,id) DO UPDATE SET revision=excluded.revision;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bsmoss_integration.advance_report_schedule() FROM PUBLIC;
CREATE TRIGGER report_schedule_revision_capture BEFORE INSERT OR UPDATE OR DELETE ON bsmoss_integration.report_schedule_revision
  FOR EACH ROW EXECUTE FUNCTION bsmoss_integration.advance_report_schedule();
CREATE TRIGGER report_schedule_revision_no_truncate BEFORE TRUNCATE ON bsmoss_integration.report_schedule_revision
  FOR EACH STATEMENT EXECUTE FUNCTION bsmoss_integration.advance_report_schedule();
CREATE TABLE bsmoss_analysis.report_schedule_scan (
  workspace_id text NOT NULL,
  schedule_id text NOT NULL,
  schedule_revision numeric(30,0) NOT NULL,
  scan_hour timestamptz NOT NULL CHECK(scan_hour=date_trunc('hour',scan_hour AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),
  manifest jsonb NOT NULL CHECK(jsonb_typeof(manifest)='object' AND
    (manifest->>'version'='bsmoss-report-calendar-v1' AND manifest->>'scheduleId'=schedule_id AND manifest->>'scheduleRevision'=schedule_revision::text AND
      jsonb_typeof(manifest->'jobs')='array' AND jsonb_array_length(manifest->'jobs')<=16) IS TRUE),
  manifest_sha256 text NOT NULL CHECK(manifest_sha256 ~ '^[a-f0-9]{64}$'),
  recorded_by text NOT NULL CHECK(length(trim(recorded_by))>0),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,schedule_id,schedule_revision,scan_hour),
  FOREIGN KEY(workspace_id,schedule_id,schedule_revision) REFERENCES bsmoss_integration.report_schedule_revision(workspace_id,id,revision)
);
CREATE TABLE bsmoss_analysis.report_generation_job (
  workspace_id text NOT NULL,
  id text NOT NULL,
  schedule_id text NOT NULL,
  schedule_revision numeric(30,0) NOT NULL,
  schedule_sha256 text NOT NULL CHECK(schedule_sha256 ~ '^[a-f0-9]{64}$'),
  scan_hour timestamptz NOT NULL CHECK(scan_hour=date_trunc('hour',scan_hour AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),
  grain text NOT NULL CHECK(grain IN ('day','week','month')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  due_at timestamptz NOT NULL CHECK(due_at>=period_end),
  requested_by text NOT NULL CHECK(length(trim(requested_by))>0),
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','succeeded','dead')),
  attempt numeric(30,0) NOT NULL DEFAULT 0 CHECK(attempt BETWEEN 0 AND 5),
  available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  result_report_id text,
  result_report_revision numeric(30,0),
  result_current_revision numeric(30,0),
  result_manifest_sha256 text,
  result_outcome text NOT NULL DEFAULT 'succeeded' CHECK(result_outcome='succeeded'),
  recovery_of text,
  scan_job_id text,
  PRIMARY KEY(workspace_id,id),
  CHECK((recovery_of IS NULL AND scan_job_id IS NULL) OR (recovery_of IS NOT NULL AND scan_job_id IS NOT NULL AND recovery_of<>id AND scan_job_id<>id)),
  FOREIGN KEY(workspace_id,recovery_of) REFERENCES bsmoss_analysis.report_generation_job(workspace_id,id),
  FOREIGN KEY(workspace_id,scan_job_id) REFERENCES bsmoss_analysis.report_generation_job(workspace_id,id),
  CHECK(period_start=date_trunc(grain,period_start AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai' AND
    period_end=((period_start AT TIME ZONE 'Asia/Shanghai')+CASE grain WHEN 'day' THEN interval '1 day' WHEN 'week' THEN interval '1 week' ELSE interval '1 month' END) AT TIME ZONE 'Asia/Shanghai'),
  CHECK((status='succeeded' AND attempt>0 AND result_report_id IS NOT NULL AND result_report_revision IS NOT NULL AND result_current_revision IS NOT NULL AND result_manifest_sha256 IS NOT NULL) OR
    (status<>'succeeded' AND result_report_id IS NULL AND result_report_revision IS NULL AND result_current_revision IS NULL AND result_manifest_sha256 IS NULL)),
  CHECK(status<>'dead' OR attempt>0),
  FOREIGN KEY(workspace_id,schedule_id,schedule_revision,grain) REFERENCES bsmoss_integration.report_schedule_revision(workspace_id,id,revision,grain),
  FOREIGN KEY(workspace_id,schedule_id,schedule_revision,scan_hour) REFERENCES bsmoss_analysis.report_schedule_scan(workspace_id,schedule_id,schedule_revision,scan_hour) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX report_generation_due ON bsmoss_analysis.report_generation_job(workspace_id,schedule_id,schedule_revision,available_at,id) WHERE status='pending';
CREATE UNIQUE INDEX report_generation_scan_window ON bsmoss_analysis.report_generation_job(workspace_id,schedule_id,schedule_revision,scan_hour,period_start) WHERE recovery_of IS NULL;
CREATE TABLE bsmoss_analysis.report_generation_attempt (
  workspace_id text NOT NULL,
  job_id text NOT NULL,
  attempt numeric(30,0) NOT NULL CHECK(attempt BETWEEN 1 AND 5),
  outcome text NOT NULL CHECK(outcome IN ('succeeded','retry','dead')),
  failure_code text CHECK(failure_code IN ('storage_failed','report_binding_unavailable')),
  generation_status text CHECK(generation_status IN ('inserted','duplicate')),
  report_id text,
  report_revision numeric(30,0),
  report_current_revision numeric(30,0),
  manifest_sha256 text,
  recorded_by text NOT NULL CHECK(length(trim(recorded_by))>0),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,job_id,attempt),
  UNIQUE(workspace_id,job_id,attempt,outcome,report_id,report_revision,report_current_revision,manifest_sha256),
  CHECK((outcome='succeeded' AND failure_code IS NULL AND generation_status IS NOT NULL AND report_id IS NOT NULL AND report_revision IS NOT NULL AND report_current_revision IS NOT NULL AND manifest_sha256 IS NOT NULL) OR
    (outcome<>'succeeded' AND failure_code IS NOT NULL AND generation_status IS NULL AND report_id IS NULL AND report_revision IS NULL AND report_current_revision IS NULL AND manifest_sha256 IS NULL)),
  FOREIGN KEY(workspace_id,job_id) REFERENCES bsmoss_analysis.report_generation_job(workspace_id,id),
  FOREIGN KEY(workspace_id,report_id,report_revision,manifest_sha256) REFERENCES bsmoss_analysis.report_revision(workspace_id,report_id,revision,manifest_sha256),
  FOREIGN KEY(workspace_id,report_id,report_current_revision) REFERENCES bsmoss_analysis.report_revision(workspace_id,report_id,revision)
);
ALTER TABLE bsmoss_analysis.report_generation_job ADD FOREIGN KEY(workspace_id,id,attempt,result_outcome,result_report_id,result_report_revision,result_current_revision,result_manifest_sha256)
  REFERENCES bsmoss_analysis.report_generation_attempt(workspace_id,job_id,attempt,outcome,report_id,report_revision,report_current_revision,manifest_sha256) DEFERRABLE INITIALLY DEFERRED;
CREATE FUNCTION bsmoss_analysis.protect_report_schedule_evidence() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF TG_TABLE_SCHEMA<>'bsmoss_analysis' OR TG_TABLE_NAME NOT IN ('report_schedule_scan','report_generation_attempt') THEN RAISE EXCEPTION 'invalid_report_schedule_evidence_trigger'; END IF;
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'report_schedule_evidence_append_only'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bsmoss_analysis.protect_report_schedule_evidence() FROM PUBLIC;
CREATE TRIGGER report_scan_evidence_lock BEFORE UPDATE OR DELETE ON bsmoss_analysis.report_schedule_scan FOR EACH ROW EXECUTE FUNCTION bsmoss_analysis.protect_report_schedule_evidence();
CREATE TRIGGER report_scan_no_truncate BEFORE TRUNCATE ON bsmoss_analysis.report_schedule_scan FOR EACH STATEMENT EXECUTE FUNCTION bsmoss_analysis.protect_report_schedule_evidence();
CREATE TRIGGER report_attempt_evidence_lock BEFORE UPDATE OR DELETE ON bsmoss_analysis.report_generation_attempt FOR EACH ROW EXECUTE FUNCTION bsmoss_analysis.protect_report_schedule_evidence();
CREATE TRIGGER report_attempt_no_truncate BEFORE TRUNCATE ON bsmoss_analysis.report_generation_attempt FOR EACH STATEMENT EXECUTE FUNCTION bsmoss_analysis.protect_report_schedule_evidence();

-- Reviewed recovery creates a new job. Never reset terminal attempt history.
CREATE INDEX refresh_job_history ON bsmoss_analysis.refresh_job(workspace_id,created_at DESC,id COLLATE "C" DESC);
CREATE INDEX refresh_job_state_history ON bsmoss_analysis.refresh_job(workspace_id,status,created_at DESC,id COLLATE "C" DESC);
ALTER TABLE bsmoss_analysis.refresh_attempt ADD UNIQUE(workspace_id,job_id,attempt,outcome);
CREATE TABLE bsmoss_analysis.refresh_recovery (
  workspace_id text NOT NULL,
  command_id text NOT NULL CHECK(length(trim(command_id))>0),
  original_job_id text NOT NULL,
  original_attempt numeric(30,0) NOT NULL CHECK(original_attempt BETWEEN 1 AND 8),
  original_outcome text NOT NULL CHECK(original_outcome IN ('dead','expired')),
  replacement_job_id text NOT NULL,
  reason_ref text NOT NULL CHECK(length(trim(reason_ref))>0),
  requested_by text NOT NULL CHECK(length(trim(requested_by))>0),
  manifest jsonb NOT NULL CHECK(jsonb_typeof(manifest)='object'),
  manifest_sha256 text NOT NULL CHECK(manifest_sha256 ~ '^[a-f0-9]{64}$'),
  database_sha256 text NOT NULL,
  database_actor text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,command_id),
  UNIQUE(workspace_id,original_job_id),
  UNIQUE(workspace_id,replacement_job_id),
  CHECK(original_job_id<>replacement_job_id),
  FOREIGN KEY(workspace_id,original_job_id,original_attempt,original_outcome) REFERENCES bsmoss_analysis.refresh_attempt(workspace_id,job_id,attempt,outcome),
  FOREIGN KEY(workspace_id,replacement_job_id) REFERENCES bsmoss_analysis.refresh_job(workspace_id,id)
);
CREATE FUNCTION bsmoss_analysis.capture_refresh_recovery() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE p bsmoss_analysis.refresh_job%ROWTYPE; n bsmoss_analysis.refresh_job%ROWTYPE; m jsonb;
BEGIN
  IF TG_TABLE_SCHEMA<>'bsmoss_analysis' OR TG_TABLE_NAME<>'refresh_recovery' THEN RAISE EXCEPTION 'invalid_refresh_recovery_trigger'; END IF;
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'refresh_recovery_append_only'; END IF;
  SELECT * INTO p FROM bsmoss_analysis.refresh_job WHERE workspace_id=NEW.workspace_id AND id=NEW.original_job_id FOR SHARE;
  SELECT * INTO n FROM bsmoss_analysis.refresh_job WHERE workspace_id=NEW.workspace_id AND id=NEW.replacement_job_id FOR SHARE;
  m:=NEW.manifest;
  IF p.id IS NULL OR n.id IS NULL OR p.status<>'dead' OR p.attempt<>NEW.original_attempt OR n.status<>'pending' OR n.attempt<>0 OR n.max_attempts<>p.max_attempts OR
    (p.source_id,p.subject_key,p.metric_key,p.mapping_id,p.target) IS DISTINCT FROM (n.source_id,n.subject_key,n.metric_key,n.mapping_id,n.target) OR
    m->>'version' IS DISTINCT FROM 'aggregate-recovery-v1' OR m->>'workspaceId' IS DISTINCT FROM NEW.workspace_id OR
    m->>'commandId' IS DISTINCT FROM NEW.command_id OR m->>'reasonRef' IS DISTINCT FROM NEW.reason_ref OR m->>'requestedBy' IS DISTINCT FROM NEW.requested_by OR
    m->'original'->>'id' IS DISTINCT FROM NEW.original_job_id OR m->'original'->'attempt' IS DISTINCT FROM to_jsonb(NEW.original_attempt) OR
    m->'original'->'maxAttempts' IS DISTINCT FROM to_jsonb(p.max_attempts) OR m->'original'->'terminal'->>'outcome' IS DISTINCT FROM NEW.original_outcome OR
    m->'original'->'terminal'->'attempt' IS DISTINCT FROM to_jsonb(NEW.original_attempt) OR m->'replacement'->>'id' IS DISTINCT FROM NEW.replacement_job_id OR
    m->'original'->'job' IS DISTINCT FROM jsonb_build_object('workspaceId',p.workspace_id,'sourceId',p.source_id,'subjectKey',p.subject_key,'metricKey',p.metric_key,'target',p.target,'triggerRef',p.trigger_ref,'dedupeKey',p.dedupe_key) OR
    m->'replacement'->'job' IS DISTINCT FROM jsonb_build_object('workspaceId',n.workspace_id,'sourceId',n.source_id,'subjectKey',n.subject_key,'metricKey',n.metric_key,'target',n.target,'triggerRef',n.trigger_ref,'dedupeKey',n.dedupe_key) OR
    m->'requiredScope'->>'workspaceId' IS DISTINCT FROM NEW.workspace_id THEN RAISE EXCEPTION 'invalid_refresh_recovery_binding';
  END IF;
  NEW.database_sha256:=encode(sha256(convert_to(m::text,'UTF8')),'hex'); NEW.database_actor:=session_user; NEW.recorded_at:=clock_timestamp();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bsmoss_analysis.capture_refresh_recovery() FROM PUBLIC;
CREATE TRIGGER refresh_recovery_capture BEFORE INSERT OR UPDATE OR DELETE ON bsmoss_analysis.refresh_recovery FOR EACH ROW EXECUTE FUNCTION bsmoss_analysis.capture_refresh_recovery();
CREATE TRIGGER refresh_recovery_no_truncate BEFORE TRUNCATE ON bsmoss_analysis.refresh_recovery FOR EACH STATEMENT EXECUTE FUNCTION bsmoss_analysis.capture_refresh_recovery();

-- Inspection indexes do not change queue execution or retry semantics.
CREATE INDEX report_generation_history ON bsmoss_analysis.report_generation_job(workspace_id,requested_at DESC,id COLLATE "C" DESC);
CREATE INDEX report_generation_state_history ON bsmoss_analysis.report_generation_job(workspace_id,status,requested_at DESC,id COLLATE "C" DESC);
CREATE INDEX report_export_history ON bsmoss_analysis.report_export_job(workspace_id,requested_at DESC,id COLLATE "C" DESC);
CREATE INDEX report_export_state_history ON bsmoss_analysis.report_export_job(workspace_id,status,requested_at DESC,id COLLATE "C" DESC);

-- Recovery is an append-only command receipt; the original dead job remains.
INSERT INTO local_authz.permission(perm_code,name) VALUES ('reports.jobs.recover','Review and replace terminal report export jobs');
ALTER TABLE bsmoss_analysis.report_export_attempt ADD UNIQUE(workspace_id,job_id,attempt,outcome);
CREATE TABLE bsmoss_analysis.report_export_recovery (
  workspace_id text NOT NULL,
  command_id text NOT NULL CHECK(length(trim(command_id)) BETWEEN 1 AND 2048),
  original_job_id text NOT NULL,
  original_attempt numeric(30,0) NOT NULL CHECK(original_attempt BETWEEN 1 AND 5),
  original_outcome text NOT NULL DEFAULT 'dead' CHECK(original_outcome='dead'),
  replacement_job_id text NOT NULL,
  reason_ref text NOT NULL CHECK(length(trim(reason_ref)) BETWEEN 1 AND 2048),
  requested_by text NOT NULL CHECK(length(trim(requested_by)) BETWEEN 1 AND 2048),
  manifest jsonb NOT NULL CHECK(jsonb_typeof(manifest)='object'),
  manifest_sha256 text NOT NULL CHECK(manifest_sha256 ~ '^[a-f0-9]{64}$'),
  database_sha256 text NOT NULL,
  database_actor text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,command_id),
  UNIQUE(workspace_id,original_job_id),
  UNIQUE(workspace_id,replacement_job_id),
  CHECK(original_job_id<>replacement_job_id),
  FOREIGN KEY(workspace_id,original_job_id,original_attempt,original_outcome) REFERENCES bsmoss_analysis.report_export_attempt(workspace_id,job_id,attempt,outcome),
  FOREIGN KEY(workspace_id,replacement_job_id) REFERENCES bsmoss_analysis.report_export_job(workspace_id,id)
);
CREATE FUNCTION bsmoss_analysis.capture_report_export_recovery() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE p bsmoss_analysis.report_export_job%ROWTYPE; n bsmoss_analysis.report_export_job%ROWTYPE;
  a bsmoss_analysis.report_export_attempt%ROWTYPE; m jsonb; b jsonb; s jsonb; cmd text;
BEGIN
  IF TG_TABLE_SCHEMA<>'bsmoss_analysis' OR TG_TABLE_NAME<>'report_export_recovery' THEN RAISE EXCEPTION 'invalid_report_recovery_trigger'; END IF;
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'report_export_recovery_append_only'; END IF;
  SELECT * INTO p FROM bsmoss_analysis.report_export_job WHERE workspace_id=NEW.workspace_id AND id=NEW.original_job_id FOR SHARE;
  SELECT * INTO n FROM bsmoss_analysis.report_export_job WHERE workspace_id=NEW.workspace_id AND id=NEW.replacement_job_id FOR SHARE;
  SELECT * INTO a FROM bsmoss_analysis.report_export_attempt WHERE workspace_id=NEW.workspace_id AND job_id=NEW.original_job_id AND attempt=NEW.original_attempt;
  SELECT manifest->'requiredScope' INTO s FROM bsmoss_analysis.report_revision WHERE workspace_id=p.workspace_id AND report_id=p.report_id AND revision=p.report_revision AND manifest_sha256=p.manifest_sha256;
  b:=jsonb_build_object('reportId',p.report_id,'publicationRevision',p.publication_revision::text,'reportRevision',p.report_revision::text,'manifestSha256',p.manifest_sha256,'rendererVersion',p.renderer_version);
  cmd:='reviewed-export-recovery:'||encode(sha256(convert_to('['||to_json(NEW.workspace_id)::text||','||to_json(NEW.original_job_id)::text||','||to_json(NEW.command_id)::text||']','UTF8')),'hex');
  m:=NEW.manifest;
  IF p.id IS NULL OR n.id IS NULL OR a.job_id IS NULL OR p.status<>'dead' OR p.attempt<>NEW.original_attempt OR a.outcome<>'dead' OR n.status<>'pending' OR n.attempt<>0 OR
    n.artifact_sha256 IS NOT NULL OR n.requested_by<>NEW.requested_by OR n.command_id<>cmd OR
    (p.report_id,p.publication_revision,p.report_revision,p.manifest_sha256,p.renderer_version) IS DISTINCT FROM (n.report_id,n.publication_revision,n.report_revision,n.manifest_sha256,n.renderer_version) OR
    m IS DISTINCT FROM jsonb_build_object('version','report-export-recovery-v1','workspaceId',NEW.workspace_id,'commandId',NEW.command_id,'reasonRef',NEW.reason_ref,'requestedBy',NEW.requested_by,
      'requiredScope',s,'binding',b,'replacement',jsonb_build_object('id',n.id,'commandId',n.command_id),
      'original',jsonb_build_object('id',p.id,'attempt',p.attempt,'commandId',p.command_id,'requestedBy',p.requested_by,
        'terminal',jsonb_build_object('attempt',a.attempt,'outcome',a.outcome,'failureCode',a.failure_code,'recordedAt',to_char(a.recorded_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'recordedBy',a.recorded_by,'result',NULL,'generationStatus',NULL,'artifactSha256',NULL))) THEN RAISE EXCEPTION 'invalid_report_recovery_binding';
  END IF;
  NEW.database_sha256:=encode(sha256(convert_to(m::text,'UTF8')),'hex'); NEW.database_actor:=session_user; NEW.recorded_at:=clock_timestamp();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bsmoss_analysis.capture_report_export_recovery() FROM PUBLIC;
CREATE TRIGGER report_export_recovery_capture BEFORE INSERT OR UPDATE OR DELETE ON bsmoss_analysis.report_export_recovery FOR EACH ROW EXECUTE FUNCTION bsmoss_analysis.capture_report_export_recovery();
CREATE TRIGGER report_export_recovery_no_truncate BEFORE TRUNCATE ON bsmoss_analysis.report_export_recovery FOR EACH STATEMENT EXECUTE FUNCTION bsmoss_analysis.capture_report_export_recovery();

ALTER TABLE bsmoss_analysis.report_generation_attempt ADD UNIQUE(workspace_id,job_id,attempt,outcome);
CREATE TABLE bsmoss_analysis.report_generation_recovery (
  workspace_id text NOT NULL,
  command_id text NOT NULL CHECK(length(trim(command_id)) BETWEEN 1 AND 2048),
  original_job_id text NOT NULL,
  original_attempt numeric(30,0) NOT NULL CHECK(original_attempt BETWEEN 1 AND 5),
  original_outcome text NOT NULL DEFAULT 'dead' CHECK(original_outcome='dead'),
  replacement_job_id text NOT NULL,
  reason_ref text NOT NULL CHECK(length(trim(reason_ref)) BETWEEN 1 AND 2048),
  requested_by text NOT NULL CHECK(length(trim(requested_by)) BETWEEN 1 AND 2048),
  manifest jsonb NOT NULL CHECK(jsonb_typeof(manifest)='object'),
  manifest_sha256 text NOT NULL CHECK(manifest_sha256 ~ '^[a-f0-9]{64}$'),
  database_sha256 text NOT NULL,
  database_actor text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,command_id),
  UNIQUE(workspace_id,original_job_id),
  UNIQUE(workspace_id,replacement_job_id),
  UNIQUE(workspace_id,original_job_id,replacement_job_id),
  CHECK(original_job_id<>replacement_job_id),
  FOREIGN KEY(workspace_id,original_job_id,original_attempt,original_outcome) REFERENCES bsmoss_analysis.report_generation_attempt(workspace_id,job_id,attempt,outcome),
  FOREIGN KEY(workspace_id,replacement_job_id) REFERENCES bsmoss_analysis.report_generation_job(workspace_id,id)
);
ALTER TABLE bsmoss_analysis.report_generation_job ADD FOREIGN KEY(workspace_id,recovery_of,id)
  REFERENCES bsmoss_analysis.report_generation_recovery(workspace_id,original_job_id,replacement_job_id) DEFERRABLE INITIALLY DEFERRED;
CREATE FUNCTION bsmoss_analysis.capture_report_generation_recovery() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE p bsmoss_analysis.report_generation_job%ROWTYPE; n bsmoss_analysis.report_generation_job%ROWTYPE; root bsmoss_analysis.report_generation_job%ROWTYPE;
  a bsmoss_analysis.report_generation_attempt%ROWTYPE; m jsonb; b jsonb; s jsonb;
BEGIN
  IF TG_TABLE_SCHEMA<>'bsmoss_analysis' OR TG_TABLE_NAME<>'report_generation_recovery' THEN RAISE EXCEPTION 'invalid_report_recovery_trigger'; END IF;
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'report_generation_recovery_append_only'; END IF;
  SELECT * INTO p FROM bsmoss_analysis.report_generation_job WHERE workspace_id=NEW.workspace_id AND id=NEW.original_job_id FOR SHARE;
  SELECT * INTO n FROM bsmoss_analysis.report_generation_job WHERE workspace_id=NEW.workspace_id AND id=NEW.replacement_job_id FOR SHARE;
  SELECT * INTO root FROM bsmoss_analysis.report_generation_job WHERE workspace_id=NEW.workspace_id AND id=n.scan_job_id FOR SHARE;
  SELECT * INTO a FROM bsmoss_analysis.report_generation_attempt WHERE workspace_id=NEW.workspace_id AND job_id=NEW.original_job_id AND attempt=NEW.original_attempt;
  SELECT config->'scope' INTO s FROM bsmoss_integration.report_schedule_revision WHERE workspace_id=p.workspace_id AND id=p.schedule_id AND revision=p.schedule_revision;
  b:=jsonb_build_object('scheduleId',p.schedule_id,'scheduleRevision',p.schedule_revision::text,'scheduleSha256',p.schedule_sha256,
    'scanHour',to_char(p.scan_hour AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'scanJobId',n.scan_job_id,'grain',p.grain,
    'period',jsonb_build_object('start',to_char(p.period_start AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'end',to_char(p.period_end AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
    'dueAt',to_char(p.due_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'requestedBy',p.requested_by);
  m:=NEW.manifest;
  IF p.id IS NULL OR n.id IS NULL OR root.id IS NULL OR a.job_id IS NULL OR p.status<>'dead' OR p.attempt<>NEW.original_attempt OR a.outcome<>'dead' OR n.status<>'pending' OR n.attempt<>0 OR
    n.recovery_of IS DISTINCT FROM p.id OR n.scan_job_id IS DISTINCT FROM coalesce(p.scan_job_id,p.id) OR root.recovery_of IS NOT NULL OR root.scan_job_id IS NOT NULL OR
    (p.schedule_id,p.schedule_revision,p.schedule_sha256,p.scan_hour,p.grain,p.period_start,p.period_end,p.due_at,p.requested_by) IS DISTINCT FROM
      (n.schedule_id,n.schedule_revision,n.schedule_sha256,n.scan_hour,n.grain,n.period_start,n.period_end,n.due_at,n.requested_by) OR
    (p.schedule_id,p.schedule_revision,p.schedule_sha256,p.scan_hour,p.grain,p.period_start,p.period_end,p.due_at,p.requested_by) IS DISTINCT FROM
      (root.schedule_id,root.schedule_revision,root.schedule_sha256,root.scan_hour,root.grain,root.period_start,root.period_end,root.due_at,root.requested_by) OR
    ((m->'requiredScope') @> s AND s @> (m->'requiredScope')) IS DISTINCT FROM TRUE OR
    m IS DISTINCT FROM jsonb_build_object('version','report-generation-recovery-v1','workspaceId',NEW.workspace_id,'commandId',NEW.command_id,'reasonRef',NEW.reason_ref,'requestedBy',NEW.requested_by,
      'requiredScope',m->'requiredScope','binding',b,'replacement',jsonb_build_object('id',n.id),
      'original',jsonb_build_object('id',p.id,'attempt',p.attempt,'terminal',jsonb_build_object('attempt',a.attempt,'outcome',a.outcome,'failureCode',a.failure_code,
        'recordedAt',to_char(a.recorded_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'recordedBy',a.recorded_by,'result',NULL,'generationStatus',NULL,'artifactSha256',NULL))) THEN RAISE EXCEPTION 'invalid_report_recovery_binding';
  END IF;
  NEW.database_sha256:=encode(sha256(convert_to(m::text,'UTF8')),'hex'); NEW.database_actor:=session_user; NEW.recorded_at:=clock_timestamp();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bsmoss_analysis.capture_report_generation_recovery() FROM PUBLIC;
CREATE TRIGGER report_generation_recovery_capture BEFORE INSERT OR UPDATE OR DELETE ON bsmoss_analysis.report_generation_recovery FOR EACH ROW EXECUTE FUNCTION bsmoss_analysis.capture_report_generation_recovery();
CREATE TRIGGER report_generation_recovery_no_truncate BEFORE TRUNCATE ON bsmoss_analysis.report_generation_recovery FOR EACH STATEMENT EXECUTE FUNCTION bsmoss_analysis.capture_report_generation_recovery();

CREATE TABLE bsmoss_analysis.report_history_check (
  workspace_id text NOT NULL,
  schedule_id text NOT NULL,
  schedule_revision numeric(30,0) NOT NULL,
  scan_hour timestamptz NOT NULL CHECK(scan_hour=date_trunc('hour',scan_hour AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),
  report_id text NOT NULL,
  original_revision numeric(30,0) NOT NULL,
  original_sha256 text NOT NULL,
  result_revision numeric(30,0) NOT NULL,
  result_sha256 text NOT NULL,
  result_current_revision numeric(30,0) NOT NULL,
  outcome text NOT NULL CHECK(outcome IN ('unchanged','inserted','duplicate','blocked')),
  failure_code text CHECK(failure_code='report_binding_unavailable'),
  manifest jsonb NOT NULL CHECK(jsonb_typeof(manifest)='object'),
  manifest_sha256 text NOT NULL CHECK(manifest_sha256 ~ '^[a-f0-9]{64}$'),
  database_sha256 text NOT NULL,
  database_actor text NOT NULL,
  recorded_by text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,schedule_id,schedule_revision,scan_hour,report_id),
  CHECK((outcome='blocked')=(failure_code IS NOT NULL)),
  CHECK(outcome NOT IN ('unchanged','blocked') OR (original_revision,original_sha256,original_revision)=(result_revision,result_sha256,result_current_revision)),
  CHECK(outcome<>'inserted' OR (result_revision=original_revision+1 AND result_current_revision=result_revision)),
  CHECK(outcome<>'duplicate' OR (result_current_revision=original_revision AND result_revision<=original_revision)),
  FOREIGN KEY(workspace_id,schedule_id,schedule_revision) REFERENCES bsmoss_integration.report_schedule_revision(workspace_id,id,revision),
  FOREIGN KEY(workspace_id,report_id,original_revision,original_sha256) REFERENCES bsmoss_analysis.report_revision(workspace_id,report_id,revision,manifest_sha256),
  FOREIGN KEY(workspace_id,report_id,result_revision,result_sha256) REFERENCES bsmoss_analysis.report_revision(workspace_id,report_id,revision,manifest_sha256),
  FOREIGN KEY(workspace_id,report_id,result_current_revision) REFERENCES bsmoss_analysis.report_revision(workspace_id,report_id,revision)
);
CREATE INDEX report_history_last_check ON bsmoss_analysis.report_history_check(workspace_id,schedule_id,schedule_revision,report_id,scan_hour DESC);
CREATE FUNCTION bsmoss_analysis.capture_report_history_check() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE c bsmoss_integration.report_schedule_revision%ROWTYPE; s bsmoss_analysis.report_series%ROWTYPE;
  p jsonb; n jsonb; m jsonb; required jsonb; k text;
BEGIN
  IF TG_TABLE_SCHEMA<>'bsmoss_analysis' OR TG_TABLE_NAME<>'report_history_check' THEN RAISE EXCEPTION 'invalid_report_history_trigger'; END IF;
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'report_history_append_only'; END IF;
  SELECT r.* INTO c FROM bsmoss_integration.report_schedule_revision r JOIN bsmoss_integration.report_schedule_head h
    ON (h.workspace_id,h.id,h.revision)=(r.workspace_id,r.id,r.revision) WHERE (r.workspace_id,r.id,r.revision)=(NEW.workspace_id,NEW.schedule_id,NEW.schedule_revision);
  SELECT * INTO s FROM bsmoss_analysis.report_series WHERE workspace_id=NEW.workspace_id AND id=NEW.report_id FOR SHARE;
  SELECT manifest INTO p FROM bsmoss_analysis.report_revision WHERE (workspace_id,report_id,revision,manifest_sha256)=(NEW.workspace_id,NEW.report_id,NEW.original_revision,NEW.original_sha256);
  SELECT manifest INTO n FROM bsmoss_analysis.report_revision WHERE (workspace_id,report_id,revision,manifest_sha256)=(NEW.workspace_id,NEW.report_id,NEW.result_revision,NEW.result_sha256);
  m:=NEW.manifest; required:=m->'requiredScope';
  IF c.id IS NULL OR s.id IS NULL OR p IS NULL OR n IS NULL OR c.config->>'status'<>'active' OR NEW.recorded_by IS DISTINCT FROM c.config->>'subject' OR
    (s.template_code,s.template_version,s.grain) IS DISTINCT FROM (c.template_code,c.template_version,c.grain) OR s.current_revision<>NEW.result_current_revision OR
    s.period_start<(c.config->>'notBefore')::timestamptz OR s.period_end+make_interval(mins=>(c.config->>'delayMinutes')::int)>(m->>'scanAt')::timestamptz OR
    date_trunc('hour',(m->>'scanAt')::timestamptz AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' IS DISTINCT FROM NEW.scan_hour OR
    (m->'before'->>'freshness' IN ('current','stale','unavailable') AND jsonb_typeof(m->'before'->'reasons')='array') IS DISTINCT FROM TRUE OR
    ((m->'before'->>'freshness'='current')=(jsonb_array_length(m->'before'->'reasons')=0)) IS DISTINCT FROM TRUE OR
    (NEW.outcome='unchanged') IS DISTINCT FROM (m->'before'->>'freshness'='current') OR
    (NEW.outcome<>'blocked' AND m->'before'->>'freshness'='unavailable') OR
    required->>'workspaceId' IS DISTINCT FROM NEW.workspace_id OR
    (required->>'allowSiteParameters')::boolean IS DISTINCT FROM ((p->'requiredScope'->>'allowSiteParameters')::boolean OR (n->'requiredScope'->>'allowSiteParameters')::boolean) OR
    m IS DISTINCT FROM jsonb_build_object('version','bsmoss-report-history-v1','workspaceId',NEW.workspace_id,'scheduleId',NEW.schedule_id,'scheduleRevision',NEW.schedule_revision::text,
      'scheduleSha256',m->>'scheduleSha256','configSha256',c.config_sha256,'scanAt',m->>'scanAt','scanHour',to_char(NEW.scan_hour AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'requestedBy',NEW.recorded_by,'reportId',NEW.report_id,'grain',s.grain,'period',p->'period',
      'original',jsonb_build_object('revision',NEW.original_revision::text,'manifestSha256',NEW.original_sha256),
      'before',m->'before','outcome',NEW.outcome,'failureCode',NEW.failure_code,
      'result',jsonb_build_object('revision',NEW.result_revision::text,'currentRevision',NEW.result_current_revision::text,'manifestSha256',NEW.result_sha256),'requiredScope',required)
    THEN RAISE EXCEPTION 'invalid_report_history_binding'; END IF;
  FOREACH k IN ARRAY ARRAY['sourceIds','stationIds','serviceIds','deviceIds','metricKeys'] LOOP
    IF (jsonb_typeof(required->k)='array' AND ((required->k) @> (p->'requiredScope'->k)) AND ((required->k) @> (n->'requiredScope'->k)) AND
      (((p->'requiredScope'->k) || (n->'requiredScope'->k)) @> (required->k)) AND ((c.config->'scope'->k) @> (required->k))) IS DISTINCT FROM TRUE
      THEN RAISE EXCEPTION 'invalid_report_history_scope'; END IF;
  END LOOP;
  IF (required->>'allowSiteParameters')::boolean AND NOT (c.config->'scope'->>'allowSiteParameters')::boolean THEN RAISE EXCEPTION 'invalid_report_history_scope'; END IF;
  NEW.database_sha256:=encode(sha256(convert_to(m::text,'UTF8')),'hex'); NEW.database_actor:=session_user; NEW.recorded_at:=clock_timestamp();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bsmoss_analysis.capture_report_history_check() FROM PUBLIC;
CREATE TRIGGER report_history_check_capture BEFORE INSERT OR UPDATE OR DELETE ON bsmoss_analysis.report_history_check FOR EACH ROW EXECUTE FUNCTION bsmoss_analysis.capture_report_history_check();
CREATE TRIGGER report_history_check_no_truncate BEFORE TRUNCATE ON bsmoss_analysis.report_history_check FOR EACH STATEMENT EXECUTE FUNCTION bsmoss_analysis.capture_report_history_check();

-- Immutable handles over already-received input evidence. Existing registered
-- workers own dispatch and result leases; no browser-owned background queue.
CREATE TABLE bsmoss_analysis.data_update_request (
  workspace_id text NOT NULL,
  id text NOT NULL CHECK(id ~ '^[a-f0-9]{64}$'),
  partition_id text NOT NULL,
  partition_revision numeric(30,0) NOT NULL,
  manifest jsonb NOT NULL CHECK(jsonb_typeof(manifest)='object' AND
    (manifest->>'version'='received-data-update-v1' AND manifest->>'partitionId'=partition_id AND
      manifest->>'partitionRevision'=partition_revision::text AND manifest->'scope'->>'workspaceId'=workspace_id AND
      jsonb_typeof(manifest->'changeIds')='array' AND jsonb_array_length(manifest->'changeIds') BETWEEN 1 AND 64) IS TRUE),
  manifest_sha256 text NOT NULL CHECK(manifest_sha256 ~ '^[a-f0-9]{64}$'),
  database_sha256 text NOT NULL CHECK(database_sha256=encode(sha256(convert_to(manifest::text,'UTF8')),'hex')),
  requested_by text NOT NULL CHECK(length(trim(requested_by))>0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,id),
  FOREIGN KEY(workspace_id,partition_id,partition_revision) REFERENCES bsmoss_integration.refresh_partition_revision(workspace_id,id,revision)
);
CREATE INDEX data_update_request_latest ON bsmoss_analysis.data_update_request(workspace_id,partition_id,partition_revision,created_at DESC,id DESC);

-- Source intake registration is reviewed administration, not runtime config.
CREATE TABLE bsmoss_integration.source_binding_revision (
  workspace_id text NOT NULL,
  id text NOT NULL CHECK(length(trim(id))>0),
  revision numeric(30,0) NOT NULL CHECK(revision>0),
  source_id text NOT NULL,
  status text NOT NULL CHECK(status IN ('active','paused')),
  binding jsonb NOT NULL CHECK(jsonb_typeof(binding)='object' AND
    (binding->>'id'=id AND binding->>'revision'=revision::text AND binding->>'sourceId'=source_id AND binding->'scope'->>'workspaceId'=workspace_id) IS TRUE),
  binding_sha256 text NOT NULL CHECK(binding_sha256 ~ '^[a-f0-9]{64}$'),
  database_sha256 text NOT NULL DEFAULT '' CHECK(database_sha256=encode(sha256(convert_to(binding::text,'UTF8')),'hex')),
  review_ref text NOT NULL CHECK(length(trim(review_ref))>0),
  database_actor text NOT NULL DEFAULT session_user,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,id,revision),
  FOREIGN KEY(workspace_id,source_id) REFERENCES bsmoss_integration.source(workspace_id,id)
);
CREATE TABLE bsmoss_integration.source_binding_head (
  workspace_id text NOT NULL,
  id text NOT NULL,
  revision numeric(30,0) NOT NULL,
  PRIMARY KEY(workspace_id,id),
  FOREIGN KEY(workspace_id,id,revision) REFERENCES bsmoss_integration.source_binding_revision(workspace_id,id,revision) DEFERRABLE INITIALLY DEFERRED
);
CREATE FUNCTION bsmoss_integration.lock_source_binding(text,text) RETURNS numeric
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT revision FROM bsmoss_integration.source_binding_head WHERE workspace_id=$1 AND id=$2 FOR SHARE
$$;
REVOKE ALL ON FUNCTION bsmoss_integration.lock_source_binding(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bsmoss_integration.lock_source_binding(text,text) TO bsmoss_svc;
CREATE FUNCTION bsmoss_integration.advance_source_binding() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE current_revision numeric(30,0);
BEGIN
  IF TG_TABLE_SCHEMA<>'bsmoss_integration' OR TG_TABLE_NAME<>'source_binding_revision' OR TG_OP<>'INSERT' THEN RAISE EXCEPTION 'source_binding_append_only'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array('bsmoss-source-binding',NEW.workspace_id,NEW.id)::text,0));
  SELECT revision INTO current_revision FROM bsmoss_integration.source_binding_head WHERE workspace_id=NEW.workspace_id AND id=NEW.id FOR UPDATE;
  IF NEW.revision<>coalesce(current_revision,0)+1 THEN RAISE EXCEPTION 'source_binding_revision_conflict'; END IF;
  NEW.database_sha256=encode(sha256(convert_to(NEW.binding::text,'UTF8')),'hex'); NEW.database_actor=session_user;
  INSERT INTO bsmoss_integration.source_binding_head(workspace_id,id,revision) VALUES(NEW.workspace_id,NEW.id,NEW.revision)
    ON CONFLICT(workspace_id,id) DO UPDATE SET revision=excluded.revision;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bsmoss_integration.advance_source_binding() FROM PUBLIC;
CREATE TRIGGER source_binding_capture BEFORE INSERT OR UPDATE OR DELETE ON bsmoss_integration.source_binding_revision
  FOR EACH ROW EXECUTE FUNCTION bsmoss_integration.advance_source_binding();
CREATE TRIGGER source_binding_no_truncate BEFORE TRUNCATE ON bsmoss_integration.source_binding_revision
  FOR EACH STATEMENT EXECUTE FUNCTION bsmoss_integration.advance_source_binding();

-- The append-only receipt is the received-input cursor. No analysis watermark
-- or source completion attestation is written by this transaction.
CREATE TABLE bsmoss_integration.source_intake_receipt (
  workspace_id text NOT NULL,
  id text NOT NULL CHECK(id ~ '^[a-f0-9]{64}$'),
  binding_id text NOT NULL,
  binding_revision numeric(30,0) NOT NULL,
  sequence numeric(30,0) NOT NULL CHECK(sequence>0),
  previous_id text,
  manifest jsonb NOT NULL CHECK(jsonb_typeof(manifest)='object'),
  manifest_sha256 text NOT NULL CHECK(manifest_sha256 ~ '^[a-f0-9]{64}$'),
  database_sha256 text NOT NULL CHECK(database_sha256=encode(sha256(convert_to(manifest::text,'UTF8')),'hex')),
  received_by text NOT NULL CHECK(length(trim(received_by))>0),
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,id),
  UNIQUE(workspace_id,binding_id,id),
  UNIQUE(workspace_id,binding_id,sequence),
  CHECK((sequence=1 AND previous_id IS NULL) OR (sequence>1 AND previous_id IS NOT NULL AND previous_id<>id)),
  FOREIGN KEY(workspace_id,binding_id,binding_revision) REFERENCES bsmoss_integration.source_binding_revision(workspace_id,id,revision),
  FOREIGN KEY(workspace_id,binding_id,previous_id) REFERENCES bsmoss_integration.source_intake_receipt(workspace_id,binding_id,id)
);
CREATE INDEX source_intake_latest ON bsmoss_integration.source_intake_receipt(workspace_id,binding_id,sequence DESC);

-- Internal intake execution journal, distinct from downstream refresh jobs.
CREATE TABLE bsmoss_integration.source_intake_task (
  workspace_id text NOT NULL,
  id text NOT NULL CHECK(id ~ '^[a-f0-9]{64}$'),
  command_id text NOT NULL CHECK(length(trim(command_id)) BETWEEN 1 AND 512),
  binding_id text NOT NULL,
  binding_revision numeric(30,0) NOT NULL,
  binding_sha256 text NOT NULL CHECK(binding_sha256 ~ '^[a-f0-9]{64}$'),
  requested_by text NOT NULL CHECK(length(trim(requested_by))>0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,id),
  UNIQUE(workspace_id,command_id),
  FOREIGN KEY(workspace_id,binding_id,binding_revision) REFERENCES bsmoss_integration.source_binding_revision(workspace_id,id,revision)
);
CREATE TABLE bsmoss_integration.source_intake_task_event (
  workspace_id text NOT NULL,
  task_id text NOT NULL,
  revision numeric(30,0) NOT NULL CHECK(revision>0),
  attempt integer NOT NULL CHECK(attempt BETWEEN 1 AND 5),
  state text NOT NULL CHECK(state IN ('started','received','duplicate','current','failed','terminated')),
  command_id text NOT NULL CHECK(length(trim(command_id)) BETWEEN 1 AND 512),
  reason_ref text CHECK(reason_ref IS NULL OR length(trim(reason_ref)) BETWEEN 1 AND 2048),
  actor text NOT NULL CHECK(length(trim(actor))>0),
  lease_until timestamptz NOT NULL,
  receipt_id text,
  inserted integer NOT NULL DEFAULT 0 CHECK(inserted BETWEEN 0 AND 4096),
  duplicates integer NOT NULL DEFAULT 0 CHECK(duplicates BETWEEN 0 AND 4096),
  failure_code text CHECK(failure_code IN ('cancelled','context_changed','capacity_limit','evidence_invalid','intake_failed')),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,task_id,revision),
  UNIQUE(workspace_id,task_id,command_id,state),
  CHECK((state='failed')=(failure_code IS NOT NULL)),
  CHECK(state NOT IN ('received','duplicate') OR receipt_id IS NOT NULL),
  CHECK(state NOT IN ('started','failed','terminated') OR (receipt_id IS NULL AND inserted=0 AND duplicates=0)),
  FOREIGN KEY(workspace_id,task_id) REFERENCES bsmoss_integration.source_intake_task(workspace_id,id),
  FOREIGN KEY(workspace_id,receipt_id) REFERENCES bsmoss_integration.source_intake_receipt(workspace_id,id)
);
CREATE FUNCTION bsmoss_integration.guard_intake_journal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t bsmoss_integration.source_intake_task%ROWTYPE;
  prior bsmoss_integration.source_intake_task_event%ROWTYPE;
  receipt bsmoss_integration.source_intake_receipt%ROWTYPE;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'intake_journal_append_only'; END IF;
  IF TG_TABLE_NAME='source_intake_task' THEN
    IF NOT EXISTS(SELECT 1 FROM bsmoss_integration.source_binding_revision b WHERE
      (b.workspace_id,b.id,b.revision,b.binding_sha256)=(NEW.workspace_id,NEW.binding_id,NEW.binding_revision,NEW.binding_sha256)) THEN
      RAISE EXCEPTION 'invalid_intake_task_binding'; END IF;
    NEW.created_at=clock_timestamp(); RETURN NEW;
  END IF;
  SELECT * INTO STRICT t FROM bsmoss_integration.source_intake_task WHERE workspace_id=NEW.workspace_id AND id=NEW.task_id FOR UPDATE;
  SELECT * INTO prior FROM bsmoss_integration.source_intake_task_event WHERE workspace_id=NEW.workspace_id AND task_id=NEW.task_id ORDER BY revision DESC LIMIT 1;
  IF NEW.revision<>coalesce(prior.revision,0)+1 THEN RAISE EXCEPTION 'intake_task_revision_conflict'; END IF;
  NEW.recorded_at=clock_timestamp();
  IF NEW.state='started' THEN
    IF prior.revision IS NULL THEN
      IF NEW.attempt<>1 OR NEW.command_id<>t.command_id OR NEW.actor<>t.requested_by OR NEW.reason_ref IS NOT NULL THEN RAISE EXCEPTION 'invalid_intake_task_start'; END IF;
    ELSE
      IF NEW.attempt<>prior.attempt+1 OR prior.state NOT IN ('started','failed') OR
        (prior.state='started' AND prior.lease_until>clock_timestamp()) OR length(trim(coalesce(NEW.reason_ref,'')))=0 THEN
        RAISE EXCEPTION 'intake_task_not_recoverable'; END IF;
    END IF;
    NEW.lease_until=clock_timestamp()+interval '300 seconds';
  ELSIF NEW.state='terminated' THEN
    IF prior.state IS NULL OR prior.state NOT IN ('started','failed') OR NEW.attempt<>prior.attempt OR
      length(trim(coalesce(NEW.reason_ref,'')))=0 OR EXISTS(SELECT 1 FROM bsmoss_integration.source_intake_task_event
        WHERE workspace_id=NEW.workspace_id AND task_id=NEW.task_id AND command_id=NEW.command_id) THEN
      RAISE EXCEPTION 'intake_task_not_terminable'; END IF;
    -- A disposition fences future commits; it does not grant a new lease or
    -- erase facts. The network request may still return after this commits.
    NEW.lease_until=prior.lease_until;
  ELSE
    IF prior.state IS DISTINCT FROM 'started' OR NEW.attempt<>prior.attempt OR NEW.command_id<>prior.command_id OR
      NEW.actor<>prior.actor OR prior.lease_until<=clock_timestamp() OR NEW.reason_ref IS DISTINCT FROM prior.reason_ref THEN
      RAISE EXCEPTION 'intake_task_lease_lost'; END IF;
    NEW.lease_until=prior.lease_until;
    IF NEW.receipt_id IS NOT NULL THEN
      SELECT * INTO STRICT receipt FROM bsmoss_integration.source_intake_receipt WHERE workspace_id=NEW.workspace_id AND id=NEW.receipt_id;
      IF (receipt.binding_id,receipt.binding_revision) IS DISTINCT FROM (t.binding_id,t.binding_revision) THEN RAISE EXCEPTION 'invalid_intake_task_receipt'; END IF;
      IF NEW.state IN ('received','duplicate') AND (NEW.inserted<>((receipt.manifest->>'inserted')::integer) OR NEW.duplicates<>((receipt.manifest->>'duplicates')::integer)) THEN
        RAISE EXCEPTION 'invalid_intake_task_counts'; END IF;
    END IF;
    IF NEW.state='current' AND (NEW.inserted<>0 OR NEW.duplicates<>0) THEN RAISE EXCEPTION 'invalid_intake_task_counts'; END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bsmoss_integration.guard_intake_journal() FROM PUBLIC;
CREATE TRIGGER intake_task_guard BEFORE INSERT OR UPDATE OR DELETE ON bsmoss_integration.source_intake_task
  FOR EACH ROW EXECUTE FUNCTION bsmoss_integration.guard_intake_journal();
CREATE TRIGGER intake_task_no_truncate BEFORE TRUNCATE ON bsmoss_integration.source_intake_task
  FOR EACH STATEMENT EXECUTE FUNCTION bsmoss_integration.guard_intake_journal();
CREATE TRIGGER intake_event_guard BEFORE INSERT OR UPDATE OR DELETE ON bsmoss_integration.source_intake_task_event
  FOR EACH ROW EXECUTE FUNCTION bsmoss_integration.guard_intake_journal();
CREATE TRIGGER intake_event_no_truncate BEFORE TRUNCATE ON bsmoss_integration.source_intake_task_event
  FOR EACH STATEMENT EXECUTE FUNCTION bsmoss_integration.guard_intake_journal();
CREATE INDEX source_intake_task_binding ON bsmoss_integration.source_intake_task(workspace_id,binding_id,created_at DESC,id);
CREATE INDEX source_intake_task_created ON bsmoss_integration.source_intake_task(workspace_id,created_at DESC,id COLLATE "C" DESC);
CREATE FUNCTION bsmoss_integration.lock_intake_task(text,text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT FROM bsmoss_integration.source_intake_task WHERE workspace_id=$1 AND id=$2 FOR UPDATE
$$;
REVOKE ALL ON FUNCTION bsmoss_integration.lock_intake_task(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bsmoss_integration.lock_intake_task(text,text) TO bsmoss_svc;

-- Read-only product management. No automatic role assignment or owner bypass.
INSERT INTO local_authz.permission(perm_code,name) VALUES
 ('admin.members.view','Inspect fully scoped product member grants'),
 ('admin.jurisdiction.view','Inspect authorized station jurisdiction'),
 ('admin.sources.view','Inspect fully scoped source registration'),
 ('admin.configuration_audit.view','Inspect fully scoped source configuration revisions');

-- Mapping inspection is independent from source configuration and runtime ingest.
INSERT INTO local_authz.permission(perm_code,name) VALUES ('admin.mappings.view','Inspect authorized object mapping definitions');
INSERT INTO local_authz.permission(perm_code,name) VALUES ('admin.mappings.preflight','Preview authorized mapping validity changes without applying them');
INSERT INTO local_authz.permission(perm_code,name) VALUES ('admin.sources.preflight','Preview authorized source configuration changes without applying them');

INSERT INTO local_authz.permission(perm_code,name) VALUES ('admin.sources.intake_impact.view','Inspect current source revision intake evidence without executing tasks');

INSERT INTO local_authz.permission(perm_code,name) VALUES ('admin.mappings.aggregate_impact.view','Inspect authorized current aggregate dependencies of mappings without rebuilding them'), ('admin.mappings.report_impact.view','Inspect authorized current report dependencies of mappings without regenerating them');

INSERT INTO local_authz.permission(perm_code,name) VALUES ('admin.sources.position.preview','Preview authorized cross-revision received position without resuming or rebaselining');

-- Operator identity configuration is independent of source and member access.
INSERT INTO local_authz.permission(perm_code,name) VALUES ('admin.operators.view','Inspect workspace operator identities'),('admin.operators.edit','Edit workspace operator identity presentation');

-- Runtime analysis parameter maintenance is independent of branding permissions.
INSERT INTO local_authz.permission(perm_code,name) VALUES ('admin.analysis_rules.view','Inspect workspace analysis parameters'),('admin.analysis_rules.edit','Edit workspace runtime analysis parameters');

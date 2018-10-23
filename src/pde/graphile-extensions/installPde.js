const clog = require('fbkt-clog')

async function InstallPde(builder, options) {
  // clog('InstallPde options', options)
  const client = options.pgConfig._clients[0]

  // clog('client', client.query)

  const schemaQueryResult = await client.query(`SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'pde';`, [])

  if (schemaQueryResult.rows.length === 0) {
    try {
      const installResult = await client.query(installPdeSql, [])
      clog('installResult', installResult)
    } catch (e) {
      clog('install Error', e)
    }
  }
}

module.exports = InstallPde

const installPdeSql = `
drop schema if exists shard_1 cascade;
drop schema if exists pde cascade;

------------------------------------------------
-- shard_1 schema - from https://rob.conery.io/2014/05/28/a-better-id-generator-for-postgresql/
------------------------------------------------

create schema shard_1;
create sequence shard_1.global_id_sequence;

CREATE OR REPLACE FUNCTION shard_1.id_generator(OUT result bigint) AS $$
DECLARE
    our_epoch bigint := 1314220021721;
    seq_id bigint;
    now_millis bigint;
    -- the id of this DB shard, must be set for each
    -- schema shard you have - you could pass this as a parameter too
    shard_id int := 1;
BEGIN
    SELECT nextval('shard_1.global_id_sequence') % 1024 INTO seq_id;

    SELECT FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000) INTO now_millis;
    result := (now_millis - our_epoch) << 23;
    result := result | (shard_id << 10);
    result := result | (seq_id);
END;
$$ LANGUAGE PLPGSQL;

------------------------------------------------
-- pde schema
------------------------------------------------

CREATE SCHEMA pde;
------------------------------------------------
-- app_state
------------------------------------------------
CREATE TABLE pde.pde_app_state (
  id bigint UNIQUE NOT NULL DEFAULT shard_1.id_generator(),
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  CONSTRAINT pk_pde_app_state PRIMARY KEY (id),
  CHECK (key <> ''),
  CHECK (value <> '')
);


------------------------------------------------
-- pde_project
------------------------------------------------
CREATE TABLE pde.pde_project (
  id bigint UNIQUE NOT NULL DEFAULT shard_1.id_generator(),
  name text NOT NULL,
  CONSTRAINT pk_pde_pde_project PRIMARY KEY (id),
  CHECK (name <> '')
);

--||--
CREATE FUNCTION pde.fn_create_project_releases() RETURNS trigger AS $$
BEGIN
  INSERT INTO pde.release(
    project_id
    ,name
    ,number
    ,status
  )
  VALUES
    (
      NEW.id
      ,'FUTURE'
      ,'9999.9999.9999'
      ,'FUTURE'
    ),
    (
      NEW.id
      ,'Next'
      ,'DEVELOPMENT'
      ,'DEVELOPMENT'
    )
  ;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
--||--
CREATE TRIGGER tg_after_insert_pde_project
  AFTER INSERT ON pde.pde_project
  FOR EACH ROW
  EXECUTE PROCEDURE pde.fn_create_project_releases();


------------------------------------------------
-- release
------------------------------------------------
CREATE TYPE pde.release_status AS ENUM
  (
    'CURRENT',           -- singleton.  release to staging will move to HISTORIC any current STAGING release and clone current TESTING release
    'STAGING',           -- singleton.  release to staging will move to Deprecated any current STAGING release and clone current TESTING release
    'TESTING',           -- singleton.  release to testing will move to Deprecated any current TESTING release and clone current DEVELOPMENT release
    'DEVELOPMENT',       -- singleton.  the current release being worked on
    'FUTURE',            -- singleton.  deferred items are placed in this bucket and later promoted to DEVELOPMENT
    'STAGINGLOCKED',     -- singleton.  when a staging release is created, the associated DEVELOPMENT release becomes STAGINGLOCKED
    'STASHED',           -- collection. a place to park releases to support hot-fixes, dev work while testing another release, etc.
    'ARCHIVED',          -- collection. old DEVELOPMENT releases
    'HISTORIC',          -- collection. old CURRENT releasees.  should have 1:1 correspondence to ARCHIVED releases and they could be checksummed 
    'TESTING_DEPRECATED', -- collection. releases discarded during STAGING
    'STAGING_DEPRECATED'  -- collection. releases discarded during TESTING
  );

CREATE TABLE pde.release (
  id bigint UNIQUE NOT NULL DEFAULT shard_1.id_generator(),
  project_id bigint NOT NULL,
  name text NOT NULL,
  number text NOT NULL,
  status pde.release_status NOT NULL DEFAULT 'DEVELOPMENT',
  parent_release_id bigint NULL,
  locked boolean not null default false,
  CONSTRAINT pk_pde_release PRIMARY KEY (id),
  CHECK (name <> '')
);
ALTER TABLE pde.release ADD CONSTRAINT fk_release_project FOREIGN KEY (project_id) REFERENCES pde.pde_project (id);
ALTER TABLE pde.release ADD CONSTRAINT fk_release_parent FOREIGN KEY (parent_release_id) REFERENCES pde.release (id);

------------------------------------------------
-- major
------------------------------------------------
CREATE TABLE pde.major (
  id bigint UNIQUE NOT NULL DEFAULT shard_1.id_generator(),
  name text NOT NULL,
  project_id bigint NOT NULL,
  revision integer,
  CONSTRAINT pk_pde_major PRIMARY KEY (id),
  CHECK (name <> '')
);
ALTER TABLE pde.major ADD CONSTRAINT fk_major_project FOREIGN KEY (project_id) REFERENCES pde.pde_project (id);

------------------------------------------------
-- minor
------------------------------------------------
CREATE TABLE pde.minor (
  id bigint NOT NULL DEFAULT shard_1.id_generator(),
  name text NOT NULL,
  major_id bigint NOT NULL,
  release_id bigint NOT NULL,
  project_id bigint NOT NULL,
  revision integer,
  locked boolean NOT NULL default false,
  number text NOT NULL,
  CONSTRAINT pk_pde_minor PRIMARY KEY (id),
  CHECK (number <> ''),
  CHECK (name <> '')
);
ALTER TABLE pde.minor ADD CONSTRAINT fk_minor_major FOREIGN KEY (major_id) REFERENCES pde.major (id);
ALTER TABLE pde.minor ADD CONSTRAINT fk_minor_release FOREIGN KEY (release_id) REFERENCES pde.release (id);
ALTER TABLE pde.minor ADD CONSTRAINT fk_minor_project FOREIGN KEY (project_id) REFERENCES pde.pde_project (id);

--||--
CREATE FUNCTION pde.fn_timestamp_update_minor() RETURNS trigger AS $$
BEGIN
  NEW.number = (select lpad(mj.revision::text,4,'0') || '.' || lpad(NEW.revision::text,4,'0') from pde.major mj where mj.id = NEW.major_id);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
--||--
CREATE TRIGGER tg_timestamp_update_minor
  BEFORE INSERT OR UPDATE ON pde.minor
  FOR EACH ROW
  EXECUTE PROCEDURE pde.fn_timestamp_update_minor();

------------------------------------------------
-- artifact type
------------------------------------------------
CREATE TABLE pde.artifact_type (
  id bigint UNIQUE NOT NULL DEFAULT shard_1.id_generator(),
  name text NOT NULL,
  requires_schema boolean NOT NULL DEFAULT true,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT pk_pde_artifact_ype PRIMARY KEY (id)
);

------------------------------------------------
--schema
------------------------------------------------
CREATE TABLE pde.schema (
  id bigint UNIQUE NOT NULL DEFAULT shard_1.id_generator(),
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  project_id bigint NOT NULL,
  name text NOT NULL,
  CONSTRAINT pk_schema PRIMARY KEY (id)
);
ALTER TABLE pde.schema ADD CONSTRAINT fk_schema_project FOREIGN KEY (project_id) REFERENCES pde.pde_project (id);

------------------------------------------------
--artifact
------------------------------------------------
CREATE TABLE pde.artifact (
  id bigint UNIQUE NOT NULL DEFAULT shard_1.id_generator(),
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  artifact_type_id bigint NOT NULL,
  project_id bigint NOT NULL,
  schema_id bigint NULL,
  CHECK (name <> ''),
  CONSTRAINT pk_artifact PRIMARY KEY (id)
);
ALTER TABLE pde.artifact ADD CONSTRAINT fk_artifact_project FOREIGN KEY (project_id) REFERENCES pde.pde_project (id);
comment on column pde.artifact.updated_at is E'@omit create';

  --||--
  CREATE FUNCTION pde.fn_timestamp_update_artifact() RETURNS trigger AS $$
  DECLARE
    _artifact_type pde.artifact_type;
    _schema pde.schema;
  BEGIN
    -- SELECT * INTO _artifact_type FROM pde.artifact_type WHERE id = NEW.artifact_type_id;
    -- IF _artifact_type.name = 'schema' THEN
    --   INSERT INTO pde.schema(project_id, name) SELECT NEW.project_id, NEW.name WHERE NOT EXISTS (select * from pde.schema where project_id = NEW.project_id and name = NEW.name) returning * into _schema;
    --   NEW.schema_id = _schema.id;
    -- END IF;

    NEW.updated_at = current_timestamp;
    RETURN NEW;
  END; $$ LANGUAGE plpgsql;
  --||--
  CREATE TRIGGER tg_timestamp_update_artifact
    BEFORE INSERT OR UPDATE ON pde.artifact
    FOR EACH ROW
    EXECUTE PROCEDURE pde.fn_timestamp_update_artifact();

ALTER TABLE pde.artifact ADD CONSTRAINT fk_artifact_type FOREIGN KEY (artifact_type_id) REFERENCES pde.artifact_type (id);
ALTER TABLE pde.artifact ADD CONSTRAINT fk_artifact_schema FOREIGN KEY (schema_id) REFERENCES pde.schema (id);

------------------------------------------------
-- patch type
------------------------------------------------
CREATE TYPE pde.patch_type_action AS ENUM
(
  'Create',
  'Append'
);

CREATE TABLE pde.patch_type (
  id bigint UNIQUE NOT NULL DEFAULT shard_1.id_generator(),
  name text NOT NULL,
  key text NOT NULL,
  action pde.patch_type_action NOT NULL,
  ddl_up_template text,
  ddl_down_template text,
  execution_order integer NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  artifact_type_id bigint NOT NULL,
  documentation_url text,
  CONSTRAINT pk_pde_patch_ype PRIMARY KEY (id)
);
ALTER TABLE pde.patch_type ADD CONSTRAINT fk_patch_type_artifact_type FOREIGN KEY (artifact_type_id) REFERENCES pde.artifact_type (id);
------------------------------------------------
-- dev_deployment
------------------------------------------------
CREATE TYPE pde.dev_deployment_status AS ENUM(
  'DEPLOYED'
  ,'ERROR'
);

CREATE TABLE pde.dev_deployment (
  id bigint UNIQUE NOT NULL DEFAULT shard_1.id_generator(),
  ddl_down text,
  status pde.dev_deployment_status not null default 'DEPLOYED',
  deployed_at timestamp not null default current_timestamp,
  CONSTRAINT pk_dev_deployment PRIMARY KEY (id)
);

------------------------------------------------
-- patch
------------------------------------------------
CREATE TABLE pde.patch (
  id bigint UNIQUE NOT NULL DEFAULT shard_1.id_generator(),
  patch_type_id bigint NOT NULL,
  minor_id bigint NOT NULL,
  artifact_id bigint NOT NULL,
  project_id bigint NOT NULL,
  revision integer,
  ddl_up text NOT NULL DEFAULT '<ddl>',
  ddl_down text NOT NULL DEFAULT '<ddl>',
  number text NOT NULL,
  locked boolean NOT NULL default false,
  dev_deployment_id bigint UNIQUE NULL,
  CHECK (number <> ''),
  CONSTRAINT pk_pde_patch PRIMARY KEY (id)
);
comment on column pde.patch.number is E'@omit create';
ALTER TABLE pde.patch ADD CONSTRAINT fk_patch_minor FOREIGN KEY (minor_id) REFERENCES pde.minor (id);
ALTER TABLE pde.patch ADD CONSTRAINT fk_patch_artifact FOREIGN KEY (artifact_id) REFERENCES pde.artifact (id);
ALTER TABLE pde.patch ADD CONSTRAINT fk_patch_project FOREIGN KEY (project_id) REFERENCES pde.pde_project (id);
ALTER TABLE pde.patch ADD CONSTRAINT fk_patch_patch_type FOREIGN KEY (patch_type_id) REFERENCES pde.patch_type (id);
ALTER TABLE pde.patch ADD CONSTRAINT fk_patch_dev_deployment FOREIGN KEY (dev_deployment_id) REFERENCES pde.dev_deployment (id) ON DELETE SET NULL;
--||--
CREATE FUNCTION pde.fn_timestamp_update_patch() RETURNS trigger AS $$
BEGIN
  NEW.revision := (select count(*) from pde.patch where minor_id = NEW.minor_id);
  NEW.number = (select mi.number || '.' || lpad(NEW.revision::text,4,'0') from pde.minor mi where mi.id = NEW.minor_id);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
--||--
CREATE TRIGGER tg_timestamp_before_update_patch
  BEFORE INSERT ON pde.patch
  FOR EACH ROW
  EXECUTE PROCEDURE pde.fn_timestamp_update_patch();
--||--
CREATE FUNCTION pde.fn_update_release_number() RETURNS trigger AS $$
BEGIN
  WITH max_patch_info AS (
    SELECT 
      max(p.id) max_patch_id
      ,r.id release_id
    FROM pde.patch p
    JOIN pde.minor m ON p.minor_id = m.id
    JOIN pde.release r ON r.id = m.release_id
    WHERE r.id = (SELECT release_id FROM pde.minor WHERE id = NEW.minor_id)
    GROUP BY r.id
  )
  UPDATE pde.release
  SET number = (
    SELECT 
      lpad(ma.revision::text,4,'0') || '.' || lpad(mi.revision::text,4,'0') || '.' || lpad(pa.revision::text,4,'0') || '.development'
    FROM max_patch_info mpi
    JOIN pde.patch pa ON mpi.max_patch_id = pa.id
    JOIN pde.minor mi ON pa.minor_id = mi.id
    JOIN pde.major ma ON mi.major_id = ma.id
  )
  FROM max_patch_info mpi
  WHERE id = mpi.release_id
  AND locked = false
  AND status = 'DEVELOPMENT'
  ;

  RETURN NEW;
END; $$ LANGUAGE plpgsql;
--||--
CREATE TRIGGER tg_timestamp_after_update_patch
  AFTER INSERT OR UPDATE ON pde.patch
  FOR EACH ROW
  EXECUTE PROCEDURE pde.fn_update_release_number();
------------------------------------------------
--psqlQuery
------------------------------------------------
CREATE TABLE pde.psql_query (
  id bigint UNIQUE NOT NULL DEFAULT shard_1.id_generator(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  sql text NOT NULL DEFAULT '',
  minor_id bigint NOT NULL,
  project_id bigint NOT NULL,
  CHECK (name <> ''),
  CONSTRAINT pk_psql_query PRIMARY KEY (id)
);
ALTER TABLE pde.psql_query ADD CONSTRAINT fk_psql_query_project FOREIGN KEY (project_id) REFERENCES pde.pde_project (id);
ALTER TABLE pde.psql_query ADD CONSTRAINT fk_psql_query_minor FOREIGN KEY (minor_id) REFERENCES pde.minor (id);

------------------------------------------------
-- test
------------------------------------------------
CREATE TYPE pde.test_type AS ENUM
   (
    'PgTap',
    'GraphQL'
    );

CREATE TABLE pde.test (
  id bigint UNIQUE NOT NULL DEFAULT shard_1.id_generator(),
  type pde.test_type NOT NULL DEFAULT 'GraphQL',
  name text,
  script text NOT NULL DEFAULT '<test ddl>',
  minor_id bigint NOT NULL,
  CONSTRAINT pk_pde_test PRIMARY KEY (id)
);
ALTER TABLE pde.test ADD CONSTRAINT fk_test_minor FOREIGN KEY (minor_id) REFERENCES pde.minor (id);

------------------------------------------------
-- release_display_name
------------------------------------------------
create or replace function pde.release_display_name(release pde.release)
returns text as $$
  select r.name || ' - ' || r.status::text
  from pde.release r
  ;
$$ language sql stable;

------------------------------------------------
-- minor_schemas
------------------------------------------------
create or replace function pde.minor_schemas(minor pde.minor)
returns setof pde.schema as $$
  select s.*
  from pde.schema s
  join pde.artifact a on a.schema_id = s.id
  join pde.patch p on p.artifact_id = a.id and p.minor_id = minor.id
  ;
$$ language sql stable;

------------------------------------------------
-- defer_minor
------------------------------------------------
CREATE OR REPLACE FUNCTION pde.defer_minor(minor_id bigint)
  RETURNS pde.minor AS
$BODY$
DECLARE
  _minor pde.minor;
  _release pde.release;
BEGIN
  SELECT *
  INTO _minor
  FROM pde.minor
  WHERE id = minor_id
  ;

  IF _minor.id IS NULL THEN
    RAISE EXCEPTION 'Cannot defer because minor does not exist: %', minor_id;
  END IF;

  SELECT *
  INTO _release
  FROM pde.release
  WHERE id = _minor.release_id
  ;

  IF _release.status != 'DEVELOPMENT' THEN
    RAISE EXCEPTION 'Cannot defer because patch is not in development release: %', minor_id;
  END IF;

  SELECT *
  INTO _release
  FROM pde.release
  WHERE project_id = _release.project_id
  AND status = 'FUTURE'
  ;

  IF _release.status != 'FUTURE' THEN
    RAISE EXCEPTION 'Cannot defer because future release does not exist: %', minor_id;
  END IF;
  
  UPDATE pde.minor SET
    release_id = _release.id
  WHERE id = minor_id
  RETURNING *
  INTO _minor
  ;

  return _minor;
END;
$BODY$
  LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER
  COST 100;

------------------------------------------------
-- promote_minor
------------------------------------------------
CREATE OR REPLACE FUNCTION pde.promote_minor(minor_id bigint)
  RETURNS pde.minor AS
$BODY$
DECLARE
  _minor pde.minor;
  _release pde.release;
BEGIN
  SELECT *
  INTO _minor
  FROM pde.minor
  WHERE id = minor_id
  ;

  IF _minor.id IS NULL THEN
    RAISE EXCEPTION 'Cannot promote because minor does not exist: %', minor_id;
  END IF;

  SELECT *
  INTO _release
  FROM pde.release
  WHERE id = _minor.release_id
  ;

  IF _release.status != 'FUTURE' THEN
    RAISE EXCEPTION 'Cannot promote because patch is not in future release: %', _patch_id;
  END IF;

  UPDATE pde.minor SET
    release_id = (SELECT id FROM pde.release WHERE project_id = _release.project_id AND status = 'DEVELOPMENT')
  WHERE id = minor_id
  RETURNING *
  INTO _minor
  ;

  return _minor;
END;
$BODY$
  LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER
  COST 100;


------------------------------------------------
-- build_patch_new_schema
------------------------------------------------
CREATE OR REPLACE FUNCTION pde.build_patch_new_schema(
    _minor_id bigint
    ,_name text
  )
  RETURNS pde.patch AS
$BODY$
DECLARE
  _revision integer;
  _artifact_type pde._artifact_type;
  _minor pde.minor;
  _schema pde.schema;
  _artifact pde.artifact;
  _patch pde.patch;
BEGIN
  IF _name IS NULL OR _name = '' THEN
    RAISE EXCEPTION 'Name cannot be empty';
  END IF;

  SELECT *
  INTO _minor
  FROM pde.minor
  WHERE id = _minor_id
  ;

  IF _minor.id IS NULL THEN
    RAISE EXCEPTION 'Minor does not exist';
  END IF;

  SELECT *
  INTO _schema
  FROM pde.schema
  WHERE id = _artifact_type_id
  ;

  IF _artifact_type.id IS NULL THEN
    RAISE EXCEPTION 'Artifact type does not exists';
  END IF;

  _revision := (SELECT count(*) FROM pde.patch WHERE minor_id = _minor.id) + 1;

  return _patch;
END;
$BODY$
  LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER
  COST 100;


------------------------------------------------
-- build_patch_new_artifact
------------------------------------------------
CREATE OR REPLACE FUNCTION pde.build_patch_new_artifact(
    _minor_id bigint
    ,_artifact_type_id bigint
    ,_schema_id bigint
    ,_name text
  )
  RETURNS pde.patch AS
$BODY$
DECLARE
  _revision integer;
  _artifact_type pde._artifact_type;
  _minor pde.minor;
  _schema pde.schema;
  _artifact pde.artifact;
  _patch pde.patch;
BEGIN
  IF _name IS NULL OR _name = '' THEN
    RAISE EXCEPTION 'Name cannot be empty';
  END IF;

  SELECT *
  INTO _minor
  FROM pde.minor
  WHERE id = _minor_id
  ;

  IF _minor.id IS NULL THEN
    RAISE EXCEPTION 'Minor does not exist';
  END IF;

  SELECT *
  INTO _artifact_type
  FROM pde.artifact_type
  WHERE id = _artifact_type_id
  ;

  IF _artifact_type.id IS NULL THEN
    RAISE EXCEPTION 'Artifact type does not exists';
  END IF;

  _revision := (SELECT count(*) FROM pde.patch WHERE minor_id = _minor.id) + 1;

  return _patch;
END;
$BODY$
  LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER
  COST 100;

------------------------------------------------
-- build_patch_existing_artifact
------------------------------------------------
CREATE OR REPLACE FUNCTION pde.build_patch_existing_artifact(
    _minor_id bigint
    ,_artifact_id bigint
  )
  RETURNS pde.patch AS
$BODY$
DECLARE
  _revision integer;
  _minor pde.minor;
  _artifact pde.artifact;
  _patch pde.patch;
BEGIN
  SELECT *
  INTO _minor
  FROM pde.minor
  WHERE id = _minor_id
  ;

  IF _minor.id IS NULL THEN
    RAISE EXCEPTION 'Minor does not exist';
  END IF;

  SELECT *
  INTO _artifact
  FROM pde.artifact
  WHERE id = _artifact_id
  ;

  IF _artifact.id IS NULL THEN
    RAISE EXCEPTION 'No artifact exists';
  END IF;

  _revision := (SELECT count(*) FROM pde.patch WHERE minor_id = _minor.id) + 1;


  return _patch;
END;
$BODY$
  LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER
  COST 100;


------------------------------------------------
-- build_minor
------------------------------------------------
CREATE OR REPLACE FUNCTION pde.build_minor(
    _release_id bigint
    ,_name text
  )
  RETURNS pde.minor AS
$BODY$
DECLARE
  _release pde.release;
  _current_major pde.major;
  _revision integer;
  _minor pde.minor;
BEGIN
  IF _name IS NULL OR _name = '' THEN
    RAISE EXCEPTION 'Name cannot be empty';
  END IF;

  SELECT *
  INTO _release
  FROM pde.release
  WHERE id = _release_id
  ;

  IF _release.id IS NULL THEN
    RAISE EXCEPTION 'Release does not exist';
  END IF;

  SELECT *
  INTO _current_major
  FROM pde.major
  WHERE project_id = _release.project_id
  AND id = (SELECT max(id) from pde.major where project_id = _release.project_id)
  ;

  IF _current_major.id IS NULL THEN
    INSERT INTO pde.major(project_id, revision, name) SELECT _release.project_id, 1, '0001' RETURNING * INTO _current_major;
  END IF;

  _revision := (SELECT count(*) FROM pde.minor WHERE major_id = _current_major.id and release_id = _release.id) + 1;

  INSERT INTO pde.minor(
    major_id
    ,revision
    ,release_id
    ,name
    ,project_id
    ,locked
  ) 
  SELECT
    _current_major.id
    ,_revision
    ,_release.id
    ,_name
    ,_release.project_id
    ,false
  RETURNING *
  INTO _minor;

  return _minor;
END;
$BODY$
  LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER
  COST 100;


------------------------------------------------
-- build_development_release
------------------------------------------------
CREATE OR REPLACE FUNCTION pde.build_development_release(
    _project_id bigint
    ,_name text
  )
  RETURNS pde.release AS
$BODY$
DECLARE
  _development_release pde.release;
BEGIN
  IF _name IS NULL OR _name = '' THEN
    RAISE EXCEPTION 'Name cannot be empty';
  END IF;

  SELECT *
  INTO _development_release
  FROM pde.release
  WHERE project_id = _project_id
  AND status = 'DEVELOPMENT';

  IF _development_release.id IS NOT NULL THEN
    RAISE EXCEPTION 'This project already has a development release';
  END IF;

  INSERT INTO pde.release(
    name
    ,number
    ,status
    ,project_id
    ,parent_release_id
    ,locked
  )
  SELECT
    _name
    ,'N/A.development'
    ,'DEVELOPMENT'
    ,_project_id
    ,null
    ,false
  RETURNING *
  INTO _development_release
  ;

  return _development_release;
END;
$BODY$
  LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER
  COST 100;


------------------------------------------------
-- release_to_current
------------------------------------------------
CREATE OR REPLACE FUNCTION pde.release_to_current(_project_id bigint)
  RETURNS pde.release AS
$BODY$
DECLARE
  _staging_release pde.release;
  _current_release pde.release;
  _parent_release pde.release;
BEGIN
  SELECT *
  INTO _staging_release
  FROM pde.release
  WHERE project_id = _project_id
  AND status = 'STAGING';

  IF _staging_release.id IS NULL THEN
    RAISE EXCEPTION 'NO STAGING RELEASE FOR PROJECT ID: %', _project_id;
  END IF;

  SELECT *
  INTO _parent_release
  FROM pde.release
  WHERE id = _staging_release.parent_release_id;

  UPDATE pde.release SET
    status = 'HISTORIC'
  WHERE status = 'CURRENT'
  AND project_id = _project_id
  ;

  UPDATE pde.release SET
    status = 'CURRENT'
    ,number = replace(_parent_release.number, '.development', '')
    ,locked = true
  WHERE id = _staging_release.id
  RETURNING *
  INTO _current_release
  ;

  UPDATE pde.release SET
    status = 'ARCHIVED'
  WHERE id = _parent_release.id
  ;

--  PERFORM pde.build_development_release(_project_id);

  return _current_release;
END;
$BODY$
  LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER
  COST 100;

------------------------------------------------
-- release_to_staging
------------------------------------------------
CREATE OR REPLACE FUNCTION pde.release_to_staging(_project_id bigint)
  RETURNS pde.release AS
$BODY$
DECLARE
  _staging_release pde.release;
  _testing_release pde.release;
  _parent_release pde.release;
  _staging_release_count integer;
BEGIN
  SELECT *
  INTO _testing_release
  FROM pde.release
  WHERE project_id = _project_id
  AND status = 'TESTING';

  IF _testing_release.id IS NULL THEN
    RAISE EXCEPTION 'NO TESTING RELEASE FOR PROJECT ID: %', _project_id;
  END IF;

  SELECT *
  INTO _parent_release
  FROM pde.release
  WHERE id = _testing_release.parent_release_id;

  UPDATE pde.release SET
    status = 'STAGING_DEPRECATED'
    ,locked = true
  WHERE status = 'STAGING'
  AND project_id = _project_id
  ;

  _staging_release_count := (SELECT count(*) FROM pde.release WHERE parent_release_id = _parent_release.id); -- AND status = 'STAGING_DEPRECATED');

  UPDATE pde.release SET
    status = 'STAGING'
    ,number = replace (_testing_release.number, 'testing', 'staging')
  WHERE id = _testing_release.id
  RETURNING *
  INTO _staging_release
  ;

  return _staging_release;
END;
$BODY$
  LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER
  COST 100;

------------------------------------------------
-- release_to_test
------------------------------------------------
CREATE OR REPLACE FUNCTION pde.release_to_testing(_project_id bigint)
  RETURNS pde.release AS
$BODY$
DECLARE
  _testing_release pde.release;
  _development_release pde.release;
  _testing_release_count integer;
BEGIN
  UPDATE pde.release SET
    status = 'TESTING_DEPRECATED'
  WHERE status = 'TESTING'
  AND project_id = _project_id
  ;

  SELECT *
  INTO _development_release
  FROM pde.release
  WHERE project_id = _project_id
  AND status = 'DEVELOPMENT';

  IF _development_release.id IS NULL THEN
    RAISE EXCEPTION 'NO DEVELOPMENT RELEASE FOR PROJECT ID: %', _project_id;
  END IF;

  _testing_release_count := (SELECT count(*) FROM pde.release WHERE parent_release_id = _development_release.id); -- AND status = 'TESTING_DEPRECATED');

  INSERT INTO pde.release(
    name
    ,number
    ,status
    ,project_id
    ,parent_release_id
    ,locked
  )
  SELECT
    _development_release.name
    ,(replace(_development_release.number, 'development', 'testing')||'.'||(_testing_release_count+1)::text)
    ,'TESTING'
    ,_project_id
    ,_development_release.id
    ,true
  RETURNING *
  INTO _testing_release
  ;

  INSERT INTO pde.minor(
    major_id
    ,revision
    ,number
    ,name
    ,release_id
    ,project_id
    ,locked
  )
  SELECT
    major_id
    ,revision
    ,number
    ,name
    ,_testing_release.id
    ,_testing_release.project_id
    ,true
  FROM pde.minor
  WHERE release_id = _development_release.id
  ;

  INSERT INTO pde.patch(
    minor_id
    ,revision
    ,artifact_id
    ,number
    ,ddl_up
    ,ddl_down
    ,patch_type_id
    ,locked
    ,project_id
  )
  SELECT
    (SELECT id FROM pde.minor WHERE release_id = _testing_release.id AND number = m.number)
    ,p.revision
    ,p.artifact_id
    ,p.number
    ,p.ddl_up
    ,p.ddl_down
    ,p.patch_type_id
    ,true
    ,_testing_release.project_id
  FROM pde.patch p
  JOIN pde.minor m on m.id = p.minor_id
  WHERE m.release_id = _development_release.id
  ;

  return _testing_release;
END;
$BODY$
  LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER
  COST 100;

------------------------------------------------
-- stash
------------------------------------------------
CREATE OR REPLACE FUNCTION pde.stash()
  RETURNS pde.release AS
$BODY$
DECLARE
  _release pde.release;
BEGIN
  SELECT *
  INTO _release
  FROM pde.release
  WHERE status = 'DEVELOPMENT'
  ;

  IF _release.id IS NULL THEN
    RAISE EXCEPTION 'Cannot stash because there is no development release';
  END IF;
  
  UPDATE pde.release SET
    status = 'STASHED'
  WHERE id = minor_id
  RETURNING *
  INTO _release
  ;

  return _release;
END;
$BODY$
  LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER
  COST 100;


------------------------------------------------
-- release_ddl_up
------------------------------------------------
CREATE OR REPLACE FUNCTION pde.release_ddl_up(
  release pde.release
)
  RETURNS text AS
$BODY$
DECLARE
  _ddl_up text;
  _minor pde.minor;
  _patch pde.patch;
  _artifact pde.artifact;
  _artifact_type pde.artifact_type;
BEGIN
  _ddl_up := '-- phile-de generated script
  -- action:   up
  -- release:  ' || release.number || '  
  ';
  
  for _minor in
    select * from pde.minor where release_id = release.id
  loop
    _ddl_up := _ddl_up || '
---------------------------------------------------------------------------------
---------------------------------------------------------------------------------
--    minor patch set: ' || _minor.name || ' - ' || _minor.number || '  
---------------------------------------------------------------------------------
---------------------------------------------------------------------------------
';

    for _patch in
      select * from pde.patch where minor_id = _minor.id
    loop
      select * into _artifact from pde.artifact where id = _patch.artifact_id;
      select * into _artifact_type from pde.artifact_type where id = _artifact.artifact_type_id;

      _ddl_up := _ddl_up || '
  -------------------------------------------------------------------------------
  --    patch:             ' || _patch.number || '
  --    artifact type:     ' || _artifact_type.name || '
  --    artifact:          ' || _artifact.name || '
  -------------------------------------------------------------------------------
  ';
      _ddl_up := _ddl_up || '

    ' || _patch.ddl_up || '

      ';

      _ddl_up := _ddl_up || '
  ---------------------------------------------------------------------------------
  --    end patch: ' || _patch.number || '
  ---------------------------------------------------------------------------------

  ';
    end loop;

    _ddl_up := _ddl_up || '
---------------------------------------------------------------------------------
---------------------------------------------------------------------------------
--    end minor patch set: ' || _minor.name || ' - ' || _minor.number || '  
---------------------------------------------------------------------------------
---------------------------------------------------------------------------------
';
  end loop;

  return _ddl_up;
END;
$BODY$
  LANGUAGE plpgsql STABLE
  COST 100;

------------------------------------------------
-- release_ddl_down
------------------------------------------------
CREATE OR REPLACE FUNCTION pde.release_ddl_down(
  release pde.release
)
  RETURNS text AS
$BODY$
DECLARE
  _ddl_down text;
  _minor pde.minor;
  _patch pde.patch;
  _artifact pde.artifact;
  _artifact_type pde.artifact_type;
BEGIN
  _ddl_down := '-- phile-de generated script
  -- action:   down
  -- release:  ' || release.number || '  
  ';
  
  for _minor in
    select * from pde.minor where release_id = release.id order by revision desc
  loop
    _ddl_down := _ddl_down || '
---------------------------------------------------------------------------------
---------------------------------------------------------------------------------
--    minor patch set: ' || _minor.name || ' - ' || _minor.number || '  
---------------------------------------------------------------------------------
---------------------------------------------------------------------------------
';

    for _patch in
      select * from pde.patch where minor_id = _minor.id order by revision desc
    loop
      select * into _artifact from pde.artifact where id = _patch.artifact_id;
      select * into _artifact_type from pde.artifact_type where id = _artifact.artifact_type_id;

      _ddl_down := _ddl_down || '
  ---------------------------------------------------------------------------------
  --    patch:             ' || _patch.number || '
  --    artifact type:     ' || _artifact_type.name || '
  --    artifact:          ' || _artifact.name || '
  ---------------------------------------------------------------------------------
  ';
      _ddl_down := _ddl_down || '

    ' || _patch.ddl_down || '

      ';

      _ddl_down := _ddl_down || '
---------------------------------------------------------------------------------
--      end patch: ' || _patch.number || '
---------------------------------------------------------------------------------

  ';
    end loop;

    _ddl_down := _ddl_down || '
---------------------------------------------------------------------------------
---------------------------------------------------------------------------------
--    end minor patch set: ' || _minor.name || ' - ' || _minor.number || '  
---------------------------------------------------------------------------------
---------------------------------------------------------------------------------
';
  end loop;

  return _ddl_down;
END;
$BODY$
  LANGUAGE plpgsql STABLE
  COST 100;


select *
from pde.minor
limit 1
;

select *
from pde.release release 
where status = 'DEVELOPMENT'
;

select pde.release_ddl_down(release)
from pde.release release where status = 'DEVELOPMENT'
;


------------------------------------------------
-- seed data
------------------------------------------------
-- INSERT INTO pde.artifact_type(name) SELECT 'extension'; 
-- INSERT INTO pde.patch_type(name, artifact_type_id, execution_order, key, properties, action, ddl_up_template, ddl_down_template, documentation_url) SELECT 'install extension', (SELECT id FROM pde.artifact_type WHERE NAME = 'extension'), 1, 'extension-install', '{}', 'Create';

INSERT INTO pde.artifact_type(name, requires_schema) SELECT 'schema', false; 
INSERT INTO pde.patch_type(name, artifact_type_id, execution_order, key, properties, action, ddl_up_template, ddl_down_template, documentation_url) SELECT 'create schema', (SELECT id FROM pde.artifact_type WHERE NAME = 'schema'), 20, 'schema-create', '{}', 'Create'
 ,'CREATE SCHEMA {{schemaName}};'
 ,'DROP SCHEMA {{schemaName}} CASCADE;'
 ,'https://www.graphile.org/postgraphile/namespaces/'
 ;

INSERT INTO pde.artifact_type(name) SELECT 'type'; 
INSERT INTO pde.patch_type(name, artifact_type_id, execution_order, key, properties, action, ddl_up_template, ddl_down_template, documentation_url) SELECT 'create type', (SELECT id FROM pde.artifact_type WHERE NAME = 'type'), 30, 'type-create', '{}', 'Create'
 ,'CREATE TYPE {{schemaName}}.{{typeName}} AS ENUM
(
  ''foo'',
  ''bar''
);
'
,'DROP TYPE {{{schemaName}}.{typeName}} CASCADE;'
,'https://www.postgresql.org/docs/9.6/static/sql-createtype.html'
;
INSERT INTO pde.patch_type(name, artifact_type_id, execution_order, key, properties, action, ddl_up_template, ddl_down_template, documentation_url) SELECT 'modify type', (SELECT id FROM pde.artifact_type WHERE NAME = 'type'), 33, 'type-modify', '{}', 'Append'
 ,'ALTER TYPE ucs.ucs_import_result ADD VALUE ''Linked'';'
 ,''
 ,''
;

INSERT INTO pde.artifact_type(name) SELECT 'table'; 
INSERT INTO pde.patch_type(name, artifact_type_id, execution_order, key, properties, action, ddl_up_template, ddl_down_template, documentation_url) SELECT 'create table', (SELECT id FROM pde.artifact_type WHERE NAME = 'table'), 40, 'table-create', '{}', 'Create'
  ,'
CREATE TABLE {{schemaName}}.{{tableName}} (
  id bigint UNIQUE NOT NULL DEFAULT shard_1.id_generator(),
  CONSTRAINT pk_{{schemaName}}_{{tableName}} PRIMARY KEY (id)
);
'
,'DROP TABLE {{schemaName}}.{{tableName}} CASCADE;'
,'https://www.graphile.org/postgraphile/tables/'
;

INSERT INTO pde.patch_type(name, artifact_type_id, execution_order, key, properties, action, ddl_up_template, ddl_down_template, documentation_url) SELECT 'add column(s)', (SELECT id FROM pde.artifact_type WHERE NAME = 'table'), 50, 'table-add-column', '{}', 'Append'
 ,'ALTER TABLE {{schemaName}}.{{tableName}} ADD COLUMN {{columnName}} {{typeName}};'
 ,'ALTER TABLE {{schemaName}}.{{tableName}} DROP COLUMN {{columnName}};'
 ,'https://www.graphile.org/postgraphile/relations/'
;
INSERT INTO pde.patch_type(name, artifact_type_id, execution_order, key, properties, action, ddl_up_template, ddl_down_template, documentation_url) SELECT 'add foreign key(s)', (SELECT id FROM pde.artifact_type WHERE NAME = 'table'), 60, 'table-add-foreign-key', '{}', 'Append'
 ,'ALTER TABLE {{localSchemaName}}.{{localTableName}} ADD CONSTRAINT fk_{{localTableName}}_{{targetTableName}} FOREIGN KEY ({{localColumnName}}) REFERENCES {{targetSchemaName}}.{{targetTableName}} (targetColumnName);'
 ,'ALTER TABLE {{localSchemaName}}.{{localTableName}} DROP CONSTRAINT fk_{{localTableName}}_{{targetTableName}};'
,'https://www.graphile.org/postgraphile/postgresql-indexes/'
;
INSERT INTO pde.patch_type(name, artifact_type_id, execution_order, key, properties, action, ddl_up_template, ddl_down_template, documentation_url) SELECT 'add index(es)', (SELECT id FROM pde.artifact_type WHERE NAME = 'table'), 70, 'table-add-index', '{}', 'Append'
 ,'CREATE INDEX IF NOT EXISTS idx_{{schemaName}}_{{tableName}}_{{columnName}} ON {{schemaName}}_{{tableName}}({{columnName}});'
 ,'DROP INDEX idx_{{schemaName}}_{{tableName}}_{{columnName}};'
,''
;
INSERT INTO pde.patch_type(name, artifact_type_id, execution_order, key, properties, action, ddl_up_template, ddl_down_template, documentation_url) SELECT 'add computed column', (SELECT id FROM pde.artifact_type WHERE NAME = 'table'), 90, 'table-add-computed-column', '{}', 'Append'
 ,'
create or replace function {{schemaName}}.{{tableName}}_{{columnName}}(u {{schemaName}}_{{tableName}})
returns {{returnType}} as $$
  -- this, you must do
$$ language sql stable;
'
,'drop function {{schemaName}}.{{tableName}}_{{columnName}}({{schemaName}}_{{tableName}});'
,'https://www.graphile.org/postgraphile/computed-columns/'
;
INSERT INTO pde.patch_type(name, artifact_type_id, execution_order, key, properties, action, ddl_up_template, ddl_down_template, documentation_url) SELECT 'modify computed column', (SELECT id FROM pde.artifact_type WHERE NAME = 'table'), 93, 'table-modify-computed-column', '{}', 'Append'
 ,'
create or replace function {{schemaName}}.{{tableName}}_{{columnName}}(u {{schemaName}}_{{tableName}})
returns {{returnType}} as $$
  -- this, you must do
$$ language sql stable;
'
,''
,'https://www.graphile.org/postgraphile/computed-columns/'
;
INSERT INTO pde.patch_type(name, artifact_type_id, execution_order, key, properties, action, ddl_up_template, ddl_down_template, documentation_url) SELECT 'manage smart comments', (SELECT id FROM pde.artifact_type WHERE NAME = 'table'), 103, 'table-smart-comments', '{}', 'Append'
 ,'-- https://www.graphile.org/postgraphile/smart-comments/'
 ,'-- https://www.graphile.org/postgraphile/smart-comments/'
 ,'https://www.graphile.org/postgraphile/smart-comments/'
;
INSERT INTO pde.patch_type(name, artifact_type_id, execution_order, key, properties, action, ddl_up_template, ddl_down_template, documentation_url) SELECT 'manage security', (SELECT id FROM pde.artifact_type WHERE NAME = 'table'), 110, 'table-security', '{}', 'Append'
 ,'
-- https://www.graphile.org/postgraphile/security/
 REVOKE ALL PRIVILEGES ON {{schemaName}}_{{tableName}} FROM PUBLIC;
 ALTER TABLE {{schemaName}}_{{tableName}} DISABLE ROW LEVEL SECURITY;
 DROP POLICY IF EXISTS all_{{schemaName}}_{{tableName}} ON {{schemaName}}_{{tableName}};

 GRANT select, update, delete ON TABLE {{schemaName}}_{{tableName}} TO {{roleName}};
 
 ALTER TABLE {{schemaName}}_{{tableName}} ENABLE ROW LEVEL SECURITY;
 CREATE POLICY all_{{schemaName}}_{{tableName}} ON {{schemaName}}_{{tableName}} FOR SELECT
 USING {{rlsClause}};
'
,''
,'https://www.graphile.org/postgraphile/security/'
;
INSERT INTO pde.patch_type(name, artifact_type_id, execution_order, key, properties, action, ddl_up_template, ddl_down_template, documentation_url) SELECT 'manage trigger', (SELECT id FROM pde.artifact_type WHERE NAME = 'table'), 120, 'table-triggers', '{}', 'Append'
 ,'
  CREATE FUNCTION {{triggerSchemaName}}.{{functionName}}() RETURNS trigger AS $$
  BEGIN
    NEW.updated_at = current_timestamp;
    RETURN NEW;
  END; $$ LANGUAGE plpgsql;

  CREATE TRIGGER tg_{{action}}_{{tableSchemaName}}_{{tableName}}
    BEFORE INSERT OR UPDATE ON {{tableSchemaName}}_{{tableName}}
    FOR EACH ROW
    EXECUTE PROCEDURE {{triggerSchemaName}}.{{functionName}}();
'
,'
DROP TRIGGER tg_{{action}}_{{tableSchemaName}}_{{tableName}};
DROP FUNCTION {{triggerSchemaName}}.{{functionName}}();
'
,'https://www.postgresql.org/docs/9.6/static/triggers.html'
;


INSERT INTO pde.artifact_type(name) SELECT 'function';
INSERT INTO pde.patch_type(name, artifact_type_id, execution_order, key, properties, action, ddl_up_template, ddl_down_template, documentation_url) SELECT 'create function', (SELECT id FROM pde.artifact_type WHERE NAME = 'function'), 130, 'function-create', '{}', 'Create'
 ,'
create or replace function {{schemaName}}.{{functionName}}(
  -- add parameters here
)
returns {{returnType}} as $$
  -- this, you must do
$$ language sql stable;
'
,'drop function {{schemaName}}.{{functionName}}(
  -- add parameter types here
);'
,'https://www.graphile.org/postgraphile/custom-mutations/'
;
INSERT INTO pde.patch_type(name, artifact_type_id, execution_order, key, properties, action, ddl_up_template, ddl_down_template, documentation_url) SELECT 'modify function', (SELECT id FROM pde.artifact_type WHERE NAME = 'function'), 140, 'function-modify', '{}', 'Append'
 ,'
create or replace function {{schemaName}}.{{functionName}}(
  -- add parameters here
)
returns {{returnType}} as $$
  -- this, you must do
$$ language sql stable;
'
,'drop function {{schemaName}}.{{functionName}}(
  -- add parameter types here
);'
,'https://www.graphile.org/postgraphile/custom-mutations/'
;
INSERT INTO pde.patch_type(name, artifact_type_id, execution_order, key, properties, action, ddl_up_template, ddl_down_template, documentation_url) SELECT 'manage smart comments', (SELECT id FROM pde.artifact_type WHERE NAME = 'function'), 150, 'function-comments', '{}', 'Append'
 ,'-- https://www.graphile.org/postgraphile/smart-comments/'
 ,''
 ,'https://www.graphile.org/postgraphile/smart-comments/'
;
INSERT INTO pde.patch_type(name, artifact_type_id, execution_order, key, properties, action, ddl_up_template, ddl_down_template, documentation_url) SELECT 'manage security', (SELECT id FROM pde.artifact_type WHERE NAME = 'function'), 160, 'function-security', '{}', 'Append'
 ,'
-- https://www.graphile.org/postgraphile/security/
GRANT EXECUTE ON FUNCTION {{schemaName}}.{{functionName}}() TO {{roleName}};
',
'
REVOKE EXECUTE ON FUNCTION {{schemaName}}.{{functionName}}() FROM {{roleName}};
'
,'https://www.graphile.org/postgraphile/security/'
;

INSERT INTO pde.artifact_type(name) SELECT 'custom script'; 
INSERT INTO pde.patch_type(name, artifact_type_id, execution_order, key, properties, action, ddl_up_template, ddl_down_template, documentation_url) SELECT 'create custom script', (SELECT id FROM pde.artifact_type WHERE NAME = 'custom script'), 170, 'custom-script', '{}', 'Create'
 ,'-- do anything you want here'
 ,'-- undo anything you want here'
 ,'https://www.graphile.org/postgraphile/introduction/'
;



DROP FUNCTION IF EXISTS pde.import_project(jsonb);
------------------------------------------------
-- pde.import_project
------------------------------------------------
CREATE OR REPLACE FUNCTION pde.import_project(
  _project_info jsonb
)
  RETURNS pde.pde_project AS
$BODY$
DECLARE
  _name text;
  _artifact_type_json jsonb;
  _artifact_type pde.artifact_type;
  _patch_type_json jsonb;
  _patch_type pde.patch_type;
  _project pde.pde_project;
  _schema_json jsonb;
  _schema pde.schema;
  _artifact_json jsonb;
  _artifact pde.artifact;
  _release_json jsonb;
  _release pde.release;
  _major_json jsonb;
  _major pde.major;
  _minor_json jsonb;
  _minor pde.minor;
  _patch_json jsonb;
  _patch pde.patch;
  _artifact_type_mappings jsonb;
  _patch_type_mappings jsonb;
  _artifact_type_id bigint;
  _patch_type_id bigint;
  _mapping jsonb;
  _result jsonb;
BEGIN
  _result := '{}';
  _artifact_type_mappings := '[]';
  _patch_type_mappings := '[]';

  --RAISE EXCEPTION '_result: %', _result;

  -- pre-process artifactTypes and patchTypes to properly hook up id values
  for _artifact_type_json in
    select jsonb_array_elements(_project_info->'artifactTypes')
  loop
    _name := _artifact_type_json->>'name'::text;
    SELECT * INTO _artifact_type FROM pde.artifact_type WHERE name = _name;

    IF _artifact_type.id IS NULL THEN
      INSERT INTO pde.artifact_type(id, name, properties) 
        SELECT _artifact_type_json->>'id', _artifact_type_json->>'name', _artifact_type_json->>'properties' 
        RETURNING * INTO _artifact_type;
    END IF;
    _mapping := ('[{"old": ' || (_artifact_type_json->>'id') || ', "new": ' || (_artifact_type.id) || '}]');
    _artifact_type_mappings := _artifact_type_mappings ||  (_mapping);

    for _patch_type_json in
      select jsonb_array_elements((_artifact_type_json->'patchTypes')->'nodes')
    loop
      RAISE NOTICE '  patch_type: %', _patch_type_json->'name';
      _name := _patch_type_json->>'name'::text;
      SELECT * INTO _patch_type FROM pde.patch_type WHERE name = _name;

      IF _patch_type.id IS NULL THEN
        -- _artifact_type_id := _patch_type_json->>'artifact_type_id';
        _artifact_type_id := (
          SELECT mapping->>'new'
          FROM jsonb_array_elements(_artifact_type_mappings) mapping
          WHERE mapping->>'old' = _patch_type_json->>'artifact_type_id'
        );
        INSERT INTO pde.patch(
          id
          ,name
          ,key
          ,ddl_up_template
          ,ddl_down_template
          ,properties
          ,execution_order
          ,artifact_type_id
          ,action
          ,documentation_url
        ) 
          SELECT 
            _patch_type_json->>'id'
            ,_patch_type_json->>'name'
            ,_patch_type_json->>'key' 
            ,_patch_type_json->>'ddl_up_template' 
            ,_patch_type_json->>'ddl_down_template' 
            ,_patch_type_json->>'properties' 
            ,_patch_type_json->>'execution_order' 
            ,_artifact_type_id 
            ,_patch_type_json->>'action'
            ,_patch_type_json->>'documentation_url'
          RETURNING * INTO _patch_type;
      END IF;
      _mapping := ('[{"old": ' || (_patch_type_json->>'id') || ', "new": ' || (_patch_type.id) || '}]');
      _patch_type_mappings := _patch_type_mappings ||  (_mapping);
    end loop;
  end loop;

  -- project
  RAISE NOTICE 'project name: %', (_project_info->'project')->>'name';
  SELECT * INTO _project FROM pde.pde_project WHERE name = ((_project_info->'project')->>'name')::text;

  IF _project.id IS NOT NULL THEN
    RAISE EXCEPTION 'Project already exists: %', (_project_info->'project')->'name';
  END IF;

  INSERT INTO pde.pde_project(
    id
    ,name
  )
  SELECT
    ((_project_info->'project')->>'id')::bigint
    ,(_project_info->'project')->>'name'
  RETURNING * INTO _project
  ;

  DELETE FROM pde.release WHERE project_id = _project.id;

  -- schemas
  for _schema_json in
    select jsonb_array_elements(((_project_info->'project')->'schemata')->'nodes')
  loop
    RAISE NOTICE 'schema: %', _schema_json->'name';
    INSERT INTO pde.schema(
      id
      ,name
      ,project_id
    )
    SELECT
      (_schema_json->>'id')::bigint
      ,_schema_json->>'name'
      ,_project.id
    RETURNING * INTO _schema
    ;

    -- artifacts
    for _artifact_json in
      select jsonb_array_elements((_schema_json->'artifacts')->'nodes')
    loop
      _artifact_type_id := (
        SELECT mapping->>'new'
        FROM jsonb_array_elements(_artifact_type_mappings) mapping
        WHERE mapping->>'old' = _artifact_json->>'artifactTypeId'
      );

      INSERT INTO pde.artifact(
        id
        ,name
        ,project_id
        ,schema_id
        ,artifact_type_id
        ,description
      )
      SELECT
        (_artifact_json->>'id')::bigint
        ,_artifact_json->>'name'
        ,_project.id
        ,_schema.id
        ,_artifact_type_id
        ,_artifact_json->>'description'
      RETURNING * INTO _artifact
      ;      
    end loop;
  end loop;


  -- releases
  for _release_json in
    select jsonb_array_elements(((_project_info->'project')->'releases')->'nodes')
  loop
    -- RAISE NOTICE 'release: %', jsonb_pretty(_release_json);
    -- RAISE NOTICE 'release: % - %', _release_json->>'id', _release_json->>'name';
    -- RAISE NOTICE '_project: %', _project.id;
    RAISE NOTICE 'parent: %', _release_json->>'parent_release_id';
    INSERT INTO pde.release(
      id
      ,project_id
      ,name
      ,status
      ,number
      ,parent_release_id
      ,locked
    )
    SELECT
      (_release_json->>'id')::bigint
      ,_project.id::bigint
      ,_release_json->>'name'
      ,(_release_json->>'status')::pde.release_status
      ,_release_json->>'number'
      ,(_release_json->>'parent_release_id')::bigint
      ,(_release_json->>'locked')::boolean
    RETURNING * INTO _release
    ;

    -- minors
    for _minor_json in
      select jsonb_array_elements((_release_json->'minors')->'nodes')
    loop
      _major_json := _minor_json->'major';
      SELECT * INTO _major FROM pde.major WHERE id = (_major_json->>'id')::bigint;
      IF _major.id IS NULL THEN
        INSERT INTO pde.major(
          id
          ,project_id
          ,name
          ,revision
        )
        SELECT
          (_major_json->>'id')::bigint
          ,_project.id::bigint
          ,_major_json->>'name'
          ,(_major_json->>'revision')::integer
        RETURNING * INTO _major
        ;
      END IF;

      SELECT * INTO _minor FROM pde.minor WHERE id = (_minor_json->>'id')::bigint;
      IF _minor.id IS NULL THEN
        INSERT INTO pde.minor(
          id
          ,major_id
          ,release_id
          ,project_id
          ,number
          ,name
          ,revision
          ,locked
        )
        SELECT
          (_minor_json->>'id')::bigint
          ,_major.id::bigint
          ,_release.id::bigint
          ,_project.id::bigint
          ,_minor_json->>'number'
          ,_minor_json->>'name'
          ,(_minor_json->>'revision')::integer
          ,(_minor_json->>'locked')::boolean
        RETURNING * INTO _minor
        ;
      END IF;

      -- patches
      for _patch_json in
        select jsonb_array_elements((_minor_json->'patches')->'nodes')
      loop
        RAISE NOTICE '  patch: %', _patch_json->'number';
        RAISE NOTICE '  patch: %', jsonb_pretty(_patch_json);
        _patch_type_id := (
          SELECT mapping->>'new'
          FROM jsonb_array_elements(_patch_type_mappings) mapping
          WHERE mapping->>'old' = _patch_json->>'patchTypeId'
        );
        INSERT INTO pde.patch(
          id
          ,minor_id
          ,artifact_id
          ,revision
          ,number
          ,ddl_up
          ,ddl_down
          ,locked
          ,project_id
          ,patch_type_id
        )
        SELECT
          (_patch_json->>'id')::bigint
          ,_minor.id
          ,(_patch_json->>'artifactId')::bigint
          ,(_patch_json->>'revision')::bigInt
          ,_patch_json->>'number'
          ,_patch_json->>'ddlUp'
          ,_patch_json->>'ddlDown'
          ,(_patch_json->>'locked')::boolean
          ,_project.id
          ,_patch_type_id
        RETURNING *
        INTO _patch
        ;

      end loop;
    end loop;
  end loop;

  -- major

  -- minor

  -- patches
 
  return _project;
END;
$BODY$
  LANGUAGE plpgsql volatile
  COST 100;
`
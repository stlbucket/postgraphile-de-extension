------------------------------------------------
-- shard_1 schema - from https://rob.conery.io/2014/05/28/a-better-id-generator-for-postgresql/
------------------------------------------------
drop schema if exists shard_1 cascade;

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
drop schema if exists pde cascade;

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
  project_id bigint NOT NULL,
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
--||--
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




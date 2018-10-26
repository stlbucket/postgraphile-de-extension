-- Deploy pde.artifact to pg
-- requires: structure/0020-schema

BEGIN;

  CREATE TABLE pde.artifact (
    id uuid UNIQUE NOT NULL DEFAULT uuid_generate_v1(),
    created_at timestamp NOT NULL DEFAULT current_timestamp,
    updated_at timestamp NOT NULL,
    name text NOT NULL,
    artifact_type_id UUID NOT NULL,
    ddl text,
    CONSTRAINT pk_artifact PRIMARY KEY (id)
  );

COMMIT;

-- Deploy auth:pde_tenant to pg
-- requires: structure/schema

BEGIN;

  CREATE TABLE pde.artifact_type (
    id uuid UNIQUE NOT NULL DEFAULT uuid_generate_v1(),
    name text NOT NULL,
    display_order integer NOT NULL,
    execution_order integer NOT NULL,
    properties jsonb NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT pk_pde_artifact_ype PRIMARY KEY (id)
  );
  --||--
  INSERT INTO pde.artifact_type(name, display_order, execution_order) SELECT 'extension', 0, 0; 
  INSERT INTO pde.artifact_type(name, display_order, execution_order) SELECT 'table', 0, 0; 
  INSERT INTO pde.artifact_type(name, display_order, execution_order) SELECT 'view', 0, 0; 
  INSERT INTO pde.artifact_type(name, display_order, execution_order) SELECT 'function', 0, 0; 
  INSERT INTO pde.artifact_type(name, display_order, execution_order) SELECT 'schema', 0, 0; 
  INSERT INTO pde.artifact_type(name, display_order, execution_order) SELECT 'trigger', 0, 0; 
  INSERT INTO pde.artifact_type(name, display_order, execution_order) SELECT 'index', 0, 0; 
  INSERT INTO pde.artifact_type(name, display_order, execution_order) SELECT 'comment', 0, 0; 

COMMIT;

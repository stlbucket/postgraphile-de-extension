-- Deploy auth:structure/schema to pg
-- requires: structure/roles

BEGIN;

  CREATE SCHEMA pde;
  
COMMIT;


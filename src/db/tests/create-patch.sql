begin;

select * from pde.pde_project;
select * from pde.release;
select * from pde.minor;
select * from pde.schema;
select * from pde.artifact;
select * from pde.patch;

-- insert into pde.patch(
--   artifact_id,
--   ddl_down,
--   ddl_up,
--   minor_id,
--   patch_type_id,
--   project_id

-- )
-- select
-- '1899760208113042461'
-- ,'DROP SCHEMA auth CASCADE;'
-- ,'CREATE SCHEMA auth;'
-- ,'1899760108313773083'
-- ,'1899759869246833666'
-- ,'1899760043931206679'
-- ;

-- select * from pde.patch;

rollback;
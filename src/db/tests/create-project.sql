-- fn_create_project_releases
--||--
CREATE OR REPLACE FUNCTION pde.fn_create_project_releases() RETURNS trigger AS $$
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



begin;

select * from pde.pde_project;
select * from pde.release;

insert into pde.pde_project(name) select 'TEST';

select * from pde.pde_project;
select * from pde.release;

rollback;
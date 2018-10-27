-- fn_create_project_releases
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


-- fn_timestamp_update_minor
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


-- fn_timestamp_update_artifact
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



-- fn_timestamp_update_patch
--||--
CREATE FUNCTION pde.fn_timestamp_update_patch() RETURNS trigger AS $$
BEGIN
  IF NEW.revision = NULL THEN
    NEW.revision := (select count(*) from pde.patch where minor_id = NEW.minor_id);
  END IF;
  NEW.number = (select mi.number || '.' || lpad(NEW.revision::text,4,'0') from pde.minor mi where mi.id = NEW.minor_id);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
--||--
CREATE TRIGGER tg_timestamp_before_update_patch
  BEFORE INSERT OR UPDATE ON pde.patch
  FOR EACH ROW
  EXECUTE PROCEDURE pde.fn_timestamp_update_patch();


------------------------------------------------
-- build_patch_new_schema
------------------------------------------------
CREATE OR REPLACE FUNCTION pde.fn_update_release_number(
    _release_id bigint
  )
  RETURNS boolean AS
$BODY$
BEGIN
  WITH max_patch_info AS (
    SELECT 
      p.id max_patch_id
      ,p.number
      ,r.id release_id
    FROM pde.patch p
    JOIN pde.minor m ON p.minor_id = m.id
    JOIN pde.release r ON r.id = m.release_id AND m.release_id = _release_id
    order by 
      m.revision desc
      ,p.revision desc
    LIMIT 1
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

  return true;
END;
$BODY$
  LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER
  COST 100;


-- fn_update_release_number
--||--
CREATE FUNCTION pde.trigger_fn_update_release_number() RETURNS trigger AS $$
DECLARE
  _release_id bigint;
BEGIN
  SELECT release_id INTO _release_id FROM pde.minor WHERE id = NEW.minor_id;

  PERFORM pde.fn_update_release_number(_release_id);

  RETURN NEW;
END; $$ LANGUAGE plpgsql;
--||--
CREATE TRIGGER tg_timestamp_after_update_patch
  AFTER INSERT OR UPDATE ON pde.patch
  FOR EACH ROW
  EXECUTE PROCEDURE pde.trigger_fn_update_release_number();


-- fn_calculate_minor_patch_numbers
--||--
CREATE FUNCTION pde.fn_adjust_minor_patch_numbers() RETURNS trigger AS $$
DECLARE
  _release_id bigint;
  _revision integer;
  _patch pde.patch;
BEGIN
  update pde.patch p
  set 
    revision = revision - 1
    ,number = (select mi.number || '.' || lpad((p.revision-1)::text,4,'0') from pde.minor mi where mi.id = OLD.minor_id)
  where minor_id = OLD.minor_id
  and revision > OLD.revision
  ;

  SELECT release_id INTO _release_id FROM pde.minor WHERE id = OLD.minor_id;

  PERFORM pde.fn_update_release_number(_release_id);

  RETURN OLD;
END; $$ LANGUAGE plpgsql;
--||--
CREATE TRIGGER tg_timestamp_after_delete_patch
  AFTER DELETE ON pde.patch
  FOR EACH ROW
  EXECUTE PROCEDURE pde.fn_adjust_minor_patch_numbers();

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
-- advance_minor
------------------------------------------------
CREATE OR REPLACE FUNCTION pde.advance_minor(minor_id bigint)
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
    RAISE EXCEPTION 'Cannot advance because minor does not exist: %', minor_id;
  END IF;

  SELECT *
  INTO _release
  FROM pde.release
  WHERE id = _minor.release_id
  ;

  IF _release.status != 'FUTURE' THEN
    RAISE EXCEPTION 'Cannot advance because patch is not in future release: %', _patch_id;
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

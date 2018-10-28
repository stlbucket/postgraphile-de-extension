drop function if exists pde.defer_minor(bigint);
drop function if exists pde.advance_minor(bigint);
drop function if exists pde.promote_minor(bigint);
drop function if exists pde.demote_minor(bigint);

------------------------------------------------
-- defer_minor
------------------------------------------------
CREATE OR REPLACE FUNCTION pde.defer_minor(_minor_id bigint)
  RETURNS pde.minor AS
$BODY$
DECLARE
  _minor pde.minor;
  _release pde.release;
BEGIN
  SELECT *
  INTO _minor
  FROM pde.minor
  WHERE id = _minor_id
  ;

  IF _minor.id IS NULL THEN
    RAISE EXCEPTION 'Cannot defer because minor does not exist: %', _minor_id;
  END IF;

  SELECT *
  INTO _release
  FROM pde.release
  WHERE id = _minor.release_id
  ;

  IF _release.status != 'DEVELOPMENT' THEN
    RAISE EXCEPTION 'Cannot defer because minor is not in development release: %', _minor_id;
  END IF;

  SELECT *
  INTO _release
  FROM pde.release
  WHERE project_id = _release.project_id
  AND status = 'FUTURE'
  ;

  IF _release.status != 'FUTURE' THEN
    RAISE EXCEPTION 'Cannot defer because future release does not exist: %', _minor_id;
  END IF;
  
  UPDATE pde.minor SET
    release_id = _release.id
  WHERE id = _minor_id
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
CREATE OR REPLACE FUNCTION pde.advance_minor(_minor_id bigint)
  RETURNS pde.minor AS
$BODY$
DECLARE
  _minor pde.minor;
  _release pde.release;
BEGIN
  SELECT *
  INTO _minor
  FROM pde.minor
  WHERE id = _minor_id
  ;

  IF _minor.id IS NULL THEN
    RAISE EXCEPTION 'Cannot advance because minor does not exist: %', _minor_id;
  END IF;

  SELECT *
  INTO _release
  FROM pde.release
  WHERE id = _minor.release_id
  ;

  IF _release.status != 'FUTURE' THEN
    RAISE EXCEPTION 'Cannot advance because minor is not in future release: %', _minor_id;
  END IF;

  UPDATE pde.minor SET
    release_id = (SELECT id FROM pde.release WHERE project_id = _release.project_id AND status = 'DEVELOPMENT')
  WHERE id = _minor_id
  RETURNING *
  INTO _minor
  ;

  return _minor;
END;
$BODY$
  LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER
  COST 100;


------------------------------------------------
-- demote_minor
------------------------------------------------
CREATE OR REPLACE FUNCTION pde.demote_minor(_minor_id bigint)
  RETURNS pde.minor AS
$BODY$
DECLARE
  _max_revision integer;
  _minor pde.minor;
BEGIN
  SELECT *
  INTO _minor
  FROM pde.minor
  WHERE id = _minor_id
  ;

  _max_revision := (SELECT max(revision) FROM pde.minor WHERE release_id = _minor.release_id);

  IF _minor.revision < _max_revision THEN
    UPDATE pde.minor
    SET revision = revision - 1
    WHERE release_id = _minor.release_id
    AND revision = _minor.revision + 1;

    UPDATE pde.minor
    SET revision = revision + 1
    WHERE id = _minor.id
    RETURNING * INTO _minor;
  END IF;

  return _minor;
END;
$BODY$
  LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER
  COST 100;

------------------------------------------------
-- promote_minor
------------------------------------------------
CREATE OR REPLACE FUNCTION pde.promote_minor(
    _minor_id bigint
  )
  RETURNS pde.minor AS
$BODY$
DECLARE
  _minor pde.minor;
BEGIN
  SELECT *
  INTO _minor
  FROM pde.minor
  WHERE id = _minor_id;

  IF _minor.revision > 0 THEN
    UPDATE pde.minor
    SET revision = revision + 1
    WHERE release_id = _minor.release_id
    AND revision = _minor.revision - 1;

    UPDATE pde.minor
    SET revision = revision - 1
    WHERE id = _minor.id
    RETURNING * INTO _minor;
  END IF;

  return _minor;
END;
$BODY$
  LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER
  COST 100;

------------------------------------------------
-- promote_patch
------------------------------------------------
CREATE OR REPLACE FUNCTION pde.promote_patch(
    _patch_id bigint
  )
  RETURNS pde.patch AS
$BODY$
DECLARE
  _patch pde.patch;
BEGIN
  SELECT *
  INTO _patch
  FROM pde.patch
  WHERE id = _patch_id;

  IF _patch.revision > 0 THEN
    UPDATE pde.patch
    SET revision = revision + 1
    WHERE minor_id = _patch.minor_id
    AND revision = _patch.revision - 1;

    UPDATE pde.patch
    SET revision = revision - 1
    WHERE id = _patch.id
    RETURNING * INTO _patch;
  END IF;

  return _patch;
END;
$BODY$
  LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER
  COST 100;


-- begin;
-- select pde.promote_patch(1886563572784301090);
-- rollback;


------------------------------------------------
-- demote_patch
------------------------------------------------
CREATE OR REPLACE FUNCTION pde.demote_patch(
    _patch_id bigint
  )
  RETURNS pde.patch AS
$BODY$
DECLARE
  _max_revision integer;
  _patch pde.patch;
BEGIN
  SELECT *
  INTO _patch
  FROM pde.patch
  WHERE id = _patch_id;

  _max_revision := (SELECT max(revision) FROM pde.patch WHERE minor_id = _patch.minor_id);

  IF _patch.revision < _max_revision THEN
    UPDATE pde.patch
    SET revision = revision - 1
    WHERE minor_id = _patch.minor_id
    AND revision = _patch.revision + 1;

    UPDATE pde.patch
    SET revision = revision + 1
    WHERE id = _patch.id
    RETURNING * INTO _patch;
  END IF;

  return _patch;
END;
$BODY$
  LANGUAGE plpgsql VOLATILE STRICT SECURITY DEFINER
  COST 100;

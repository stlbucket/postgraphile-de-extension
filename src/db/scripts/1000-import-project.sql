
DROP FUNCTION IF EXISTS pde.import_project(jsonb);
------------------------------------------------
-- pde.import_project
------------------------------------------------
CREATE OR REPLACE FUNCTION pde.import_project(
  _project_info jsonb
)
  RETURNS pde.pde_project AS
$BODY$
DECLARE
  _name text;
  _artifact_type_json jsonb;
  _artifact_type pde.artifact_type;
  _patch_type_json jsonb;
  _patch_type pde.patch_type;
  _project pde.pde_project;
  _schema_json jsonb;
  _schema pde.schema;
  _artifact_json jsonb;
  _artifact pde.artifact;
  _release_json jsonb;
  _release pde.release;
  _major_json jsonb;
  _major pde.major;
  _minor_json jsonb;
  _minor pde.minor;
  _patch_json jsonb;
  _patch pde.patch;
  _artifact_type_mappings jsonb;
  _patch_type_mappings jsonb;
  _artifact_type_id bigint;
  _patch_type_id bigint;
  _mapping jsonb;
  _result jsonb;
BEGIN
  _result := '{}';
  _artifact_type_mappings := '[]';
  _patch_type_mappings := '[]';

  --RAISE EXCEPTION '_result: %', _result;

  -- pre-process artifactTypes and patchTypes to properly hook up id values
  for _artifact_type_json in
    select jsonb_array_elements(_project_info->'artifactTypes')
  loop
    _name := _artifact_type_json->>'name'::text;
    SELECT * INTO _artifact_type FROM pde.artifact_type WHERE name = _name;

    IF _artifact_type.id IS NULL THEN
      INSERT INTO pde.artifact_type(id, name, properties) 
        SELECT _artifact_type_json->>'id', _artifact_type_json->>'name', _artifact_type_json->>'properties' 
        RETURNING * INTO _artifact_type;
    END IF;
    _mapping := ('[{"old": ' || (_artifact_type_json->>'id') || ', "new": ' || (_artifact_type.id) || '}]');
    _artifact_type_mappings := _artifact_type_mappings ||  (_mapping);

    for _patch_type_json in
      select jsonb_array_elements((_artifact_type_json->'patchTypes')->'nodes')
    loop
      RAISE NOTICE '  patch_type: %', _patch_type_json->'name';
      _name := _patch_type_json->>'name'::text;
      SELECT * INTO _patch_type FROM pde.patch_type WHERE name = _name;

      IF _patch_type.id IS NULL THEN
        -- _artifact_type_id := _patch_type_json->>'artifact_type_id';
        _artifact_type_id := (
          SELECT mapping->>'new'
          FROM jsonb_array_elements(_artifact_type_mappings) mapping
          WHERE mapping->>'old' = _patch_type_json->>'artifact_type_id'
        );
        INSERT INTO pde.patch(
          id
          ,name
          ,key
          ,ddl_up_template
          ,ddl_down_template
          ,properties
          ,execution_order
          ,artifact_type_id
          ,action
          ,documentation_url
        ) 
          SELECT 
            _patch_type_json->>'id'
            ,_patch_type_json->>'name'
            ,_patch_type_json->>'key' 
            ,_patch_type_json->>'ddl_up_template' 
            ,_patch_type_json->>'ddl_down_template' 
            ,_patch_type_json->>'properties' 
            ,_patch_type_json->>'execution_order' 
            ,_artifact_type_id 
            ,_patch_type_json->>'action'
            ,_patch_type_json->>'documentation_url'
          RETURNING * INTO _patch_type;
      END IF;
      _mapping := ('[{"old": ' || (_patch_type_json->>'id') || ', "new": ' || (_patch_type.id) || '}]');
      _patch_type_mappings := _patch_type_mappings ||  (_mapping);
    end loop;
  end loop;

  -- project
  RAISE NOTICE 'project name: %', (_project_info->'project')->>'name';
  SELECT * INTO _project FROM pde.pde_project WHERE name = ((_project_info->'project')->>'name')::text;

  IF _project.id IS NOT NULL THEN
    RAISE EXCEPTION 'Project already exists: %', (_project_info->'project')->'name';
  END IF;

  INSERT INTO pde.pde_project(
    id
    ,name
  )
  SELECT
    ((_project_info->'project')->>'id')::bigint
    ,(_project_info->'project')->>'name'
  RETURNING * INTO _project
  ;

  DELETE FROM pde.release WHERE project_id = _project.id;

  -- schemas
  for _schema_json in
    select jsonb_array_elements(((_project_info->'project')->'schemata')->'nodes')
  loop
    RAISE NOTICE 'schema: %', _schema_json->'name';
    INSERT INTO pde.schema(
      id
      ,name
      ,project_id
    )
    SELECT
      (_schema_json->>'id')::bigint
      ,_schema_json->>'name'
      ,_project.id
    RETURNING * INTO _schema
    ;

    -- artifacts
    for _artifact_json in
      select jsonb_array_elements((_schema_json->'artifacts')->'nodes')
    loop
      _artifact_type_id := (
        SELECT mapping->>'new'
        FROM jsonb_array_elements(_artifact_type_mappings) mapping
        WHERE mapping->>'old' = _artifact_json->>'artifactTypeId'
      );

      INSERT INTO pde.artifact(
        id
        ,name
        ,project_id
        ,schema_id
        ,artifact_type_id
        ,description
      )
      SELECT
        (_artifact_json->>'id')::bigint
        ,_artifact_json->>'name'
        ,_project.id
        ,_schema.id
        ,_artifact_type_id
        ,_artifact_json->>'description'
      RETURNING * INTO _artifact
      ;      
    end loop;
  end loop;


  -- releases
  for _release_json in
    select jsonb_array_elements(((_project_info->'project')->'releases')->'nodes')
  loop
    -- RAISE NOTICE 'release: %', jsonb_pretty(_release_json);
    -- RAISE NOTICE 'release: % - %', _release_json->>'id', _release_json->>'name';
    -- RAISE NOTICE '_project: %', _project.id;
    RAISE NOTICE 'parent: %', _release_json->>'parent_release_id';
    INSERT INTO pde.release(
      id
      ,project_id
      ,name
      ,status
      ,number
      ,parent_release_id
      ,locked
    )
    SELECT
      (_release_json->>'id')::bigint
      ,_project.id::bigint
      ,_release_json->>'name'
      ,(_release_json->>'status')::pde.release_status
      ,_release_json->>'number'
      ,(_release_json->>'parent_release_id')::bigint
      ,(_release_json->>'locked')::boolean
    RETURNING * INTO _release
    ;

    -- minors
    for _minor_json in
      select jsonb_array_elements((_release_json->'minors')->'nodes')
    loop
      _major_json := _minor_json->'major';
      SELECT * INTO _major FROM pde.major WHERE id = (_major_json->>'id')::bigint;
      IF _major.id IS NULL THEN
        INSERT INTO pde.major(
          id
          ,project_id
          ,name
          ,revision
        )
        SELECT
          (_major_json->>'id')::bigint
          ,_project.id::bigint
          ,_major_json->>'name'
          ,(_major_json->>'revision')::integer
        RETURNING * INTO _major
        ;
      END IF;

      SELECT * INTO _minor FROM pde.minor WHERE id = (_minor_json->>'id')::bigint;
      IF _minor.id IS NULL THEN
        INSERT INTO pde.minor(
          id
          ,major_id
          ,release_id
          ,project_id
          ,number
          ,name
          ,revision
          ,locked
        )
        SELECT
          (_minor_json->>'id')::bigint
          ,_major.id::bigint
          ,_release.id::bigint
          ,_project.id::bigint
          ,_minor_json->>'number'
          ,_minor_json->>'name'
          ,(_minor_json->>'revision')::integer
          ,(_minor_json->>'locked')::boolean
        RETURNING * INTO _minor
        ;
      END IF;

      -- patches
      for _patch_json in
        select jsonb_array_elements((_minor_json->'patches')->'nodes')
      loop
        RAISE NOTICE '  patch: %', _patch_json->'number';
        RAISE NOTICE '  patch: %', jsonb_pretty(_patch_json);
        _patch_type_id := (
          SELECT mapping->>'new'
          FROM jsonb_array_elements(_patch_type_mappings) mapping
          WHERE mapping->>'old' = _patch_json->>'patchTypeId'
        );
        INSERT INTO pde.patch(
          id
          ,minor_id
          ,artifact_id
          ,revision
          ,number
          ,ddl_up
          ,ddl_down
          ,locked
          ,project_id
          ,patch_type_id
        )
        SELECT
          (_patch_json->>'id')::bigint
          ,_minor.id
          ,(_patch_json->>'artifactId')::bigint
          ,(_patch_json->>'revision')::bigInt
          ,_patch_json->>'number'
          ,_patch_json->>'ddlUp'
          ,_patch_json->>'ddlDown'
          ,(_patch_json->>'locked')::boolean
          ,_project.id
          ,_patch_type_id
        RETURNING *
        INTO _patch
        ;

      end loop;
    end loop;
  end loop;

  -- major

  -- minor

  -- patches
 
  return _project;
END;
$BODY$
  LANGUAGE plpgsql volatile
  COST 100;
  
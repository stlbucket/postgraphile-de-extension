-- release
ALTER TABLE pde.release ADD CONSTRAINT fk_release_project FOREIGN KEY (project_id) REFERENCES pde.pde_project (id) ON DELETE CASCADE;
ALTER TABLE pde.release ADD CONSTRAINT fk_release_parent FOREIGN KEY (parent_release_id) REFERENCES pde.release (id) ON DELETE CASCADE;

-- major
ALTER TABLE pde.major ADD CONSTRAINT fk_major_project FOREIGN KEY (project_id) REFERENCES pde.pde_project (id) ON DELETE CASCADE;

-- minor
ALTER TABLE pde.minor ADD CONSTRAINT fk_minor_major FOREIGN KEY (major_id) REFERENCES pde.major (id) ON DELETE CASCADE;
ALTER TABLE pde.minor ADD CONSTRAINT fk_minor_release FOREIGN KEY (release_id) REFERENCES pde.release (id) ON DELETE CASCADE;
ALTER TABLE pde.minor ADD CONSTRAINT fk_minor_project FOREIGN KEY (project_id) REFERENCES pde.pde_project (id) ON DELETE CASCADE;

-- schema
ALTER TABLE pde.schema ADD CONSTRAINT fk_schema_project FOREIGN KEY (project_id) REFERENCES pde.pde_project (id) ON DELETE CASCADE;

-- artifact
ALTER TABLE pde.artifact ADD CONSTRAINT fk_artifact_project FOREIGN KEY (project_id) REFERENCES pde.pde_project (id) ON DELETE CASCADE;

-- artifact
ALTER TABLE pde.artifact ADD CONSTRAINT fk_artifact_type FOREIGN KEY (artifact_type_id) REFERENCES pde.artifact_type (id) ON DELETE CASCADE;
ALTER TABLE pde.artifact ADD CONSTRAINT fk_artifact_schema FOREIGN KEY (schema_id) REFERENCES pde.schema (id) ON DELETE CASCADE;

-- patch_type
ALTER TABLE pde.patch_type ADD CONSTRAINT fk_patch_type_artifact_type FOREIGN KEY (artifact_type_id) REFERENCES pde.artifact_type (id) ON DELETE CASCADE;

-- patch
ALTER TABLE pde.patch ADD CONSTRAINT fk_patch_minor FOREIGN KEY (minor_id) REFERENCES pde.minor (id) ON DELETE CASCADE;
ALTER TABLE pde.patch ADD CONSTRAINT fk_patch_artifact FOREIGN KEY (artifact_id) REFERENCES pde.artifact (id) ON DELETE CASCADE;
ALTER TABLE pde.patch ADD CONSTRAINT fk_patch_project FOREIGN KEY (project_id) REFERENCES pde.pde_project (id) ON DELETE CASCADE;
ALTER TABLE pde.patch ADD CONSTRAINT fk_patch_patch_type FOREIGN KEY (patch_type_id) REFERENCES pde.patch_type (id) ON DELETE CASCADE;
ALTER TABLE pde.patch ADD CONSTRAINT fk_patch_dev_deployment FOREIGN KEY (dev_deployment_id) REFERENCES pde.dev_deployment (id) ON DELETE SET NULL;

-- todo: add dev_depl
ALTER TABLE pde.dev_deployment ADD CONSTRAINT fk_dev_deployment_project FOREIGN KEY (project_id) REFERENCES pde.pde_project (id) ON DELETE CASCADE;

-- psql_query
ALTER TABLE pde.psql_query ADD CONSTRAINT fk_psql_query_project FOREIGN KEY (project_id) REFERENCES pde.pde_project (id) ON DELETE CASCADE;
ALTER TABLE pde.psql_query ADD CONSTRAINT fk_psql_query_minor FOREIGN KEY (minor_id) REFERENCES pde.minor (id) ON DELETE CASCADE;

-- test
ALTER TABLE pde.test ADD CONSTRAINT fk_test_minor FOREIGN KEY (minor_id) REFERENCES pde.minor (id) ON DELETE CASCADE;





begin;


WITH new_patch AS(
  insert into pde.dev_deployment(project_id, ddl_down, status, error_message)
  select 1886559526354682903, '', 'ERROR', 'Error: {"message":"schema \"cards\" already exists"}'
  RETURNING *
)
UPDATE pde.patch p
SET dev_deployment_id = np.id
FROM new_patch np
WHERE p.id = 1886559760866608158
;


rollback;
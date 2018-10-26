-- Verify auth-fn:function/app_user_has_access on pg

BEGIN;

  SELECT has_function_privilege('auth_fn.app_user_has_access(uuid, text)', 'execute');

ROLLBACK;

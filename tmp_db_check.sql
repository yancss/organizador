select
  exists(select 1 from information_schema.tables where table_schema='public' and table_name='Permission') as has_permission_table,
  exists(select 1 from information_schema.tables where table_schema='public' and table_name='WorkspaceRole') as has_workspacerole_table,
  exists(select 1 from information_schema.tables where table_schema='public' and table_name='WorkspaceRoleModel') as has_workspacerolemodel_table,
  exists(select 1 from information_schema.tables where table_schema='public' and table_name='WorkspaceRolePermission') as has_roleperm_table,
  exists(select 1 from information_schema.tables where table_schema='public' and table_name='WorkspaceUserRole') as has_userrole_table;

select migration_name, started_at, finished_at, rolled_back_at, applied_steps_count
from "_prisma_migrations"
order by started_at desc
limit 8;

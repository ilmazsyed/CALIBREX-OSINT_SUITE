export const WORKSPACE_ROLES = ['owner','admin','analyst','viewer'];
export function workspaceRole(workspace, userId) { return workspace?.members?.find(member => member.userId === userId)?.role || null; }
export function canWorkspace(role, action='view') {
  if (action === 'view') return ['owner','admin','analyst','viewer'].includes(role);
  if (action === 'edit') return ['owner','admin','analyst'].includes(role);
  if (action === 'manage') return ['owner','admin'].includes(role);
  return false;
}
export function normaliseWorkspaceMemberRole(role) { return ['admin','analyst','viewer'].includes(role) ? role : 'analyst'; }

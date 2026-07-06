export const isSuperAdmin = (userInfo) =>
  userInfo?.role === 'SUPER_ADMIN' || userInfo?.role?.name === 'SUPER_ADMIN';

export const hasPermission = (userInfo, permission) => {
  if (isSuperAdmin(userInfo)) return true;
  return (userInfo?.permissions || []).includes(permission);
};

const adminPanelPermissionPrefixes = [
  'product:',
  'category:',
  'order:',
  'support:',
  'mail:',
  'whatsapp:',
  'integration:',
];

export const canAccessAdminPanel = (userInfo) => {
  if (isSuperAdmin(userInfo) || hasPermission(userInfo, 'access:admin_panel')) return true;

  return (userInfo?.permissions || []).some((permission) =>
    adminPanelPermissionPrefixes.some((prefix) => permission.startsWith(prefix))
  );
};

export const canViewCosts = (userInfo) => hasPermission(userInfo, 'finance:read_costs');

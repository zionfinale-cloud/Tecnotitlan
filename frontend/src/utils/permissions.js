export const isSuperAdmin = (userInfo) =>
  userInfo?.role === 'SUPER_ADMIN' || userInfo?.role?.name === 'SUPER_ADMIN';

export const hasPermission = (userInfo, permission) => {
  if (isSuperAdmin(userInfo)) return true;
  return (userInfo?.permissions || []).includes(permission);
};

export const canViewCosts = (userInfo) => hasPermission(userInfo, 'finance:read_costs');

const TEAM_MANAGER_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR']);

export const isStaffUser = (user = {}) => {
  const role = user.role?.name || user.role;
  return Boolean(role && role !== 'USER');
};

export const canUseRouteBeforeTwoFactorEnrollment = (url = '') => (
  /^\/api\/security\/(status|2fa\/(setup|enable))(?:\/|$)/.test(url)
  || /^\/api\/users\/(session|profile|logout)(?:\/|$)/.test(url)
);

export const requiresTwoFactorEnrollment = (user, url) => (
  isStaffUser(user)
  && !user?.twoFactorEnabled
  && !canUseRouteBeforeTwoFactorEnrollment(url)
);

export const getMyWorkAccess = (user = {}) => {
  const permissions = new Set(user.permissions || []);
  return {
    canOrders: permissions.has('order:read') || permissions.has('order:update'),
    canSupport: ['support:read', 'support:update', 'whatsapp:chat'].some((permission) => permissions.has(permission)),
    canManageTeam: TEAM_MANAGER_ROLES.has(user.role?.name || user.role),
  };
};

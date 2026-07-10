const permissionName = (entry) => entry?.permission?.name || entry?.name;

const buildEffectivePermissionNames = (user = {}) => {
  const rolePermissionNames = (user.role?.permissions || [])
    .map(permissionName)
    .filter(Boolean);
  const grantedPermissionNames = (user.permissionGrants || [])
    .map(permissionName)
    .filter(Boolean);
  const deniedPermissionNames = (user.permissionDenies || [])
    .map(permissionName)
    .filter(Boolean);

  const denied = new Set(deniedPermissionNames);
  const effective = new Set([...rolePermissionNames, ...grantedPermissionNames]);
  denied.forEach((permission) => effective.delete(permission));

  return Array.from(effective).sort();
};

const getPermissionOverrideNames = (user = {}) => ({
  granted: (user.permissionGrants || []).map(permissionName).filter(Boolean).sort(),
  denied: (user.permissionDenies || []).map(permissionName).filter(Boolean).sort(),
});

const userPermissionInclude = {
  role: {
    include: {
      permissions: { select: { id: true, name: true, description: true } },
    },
  },
  permissionGrants: {
    include: { permission: { select: { id: true, name: true, description: true } } },
  },
  permissionDenies: {
    include: { permission: { select: { id: true, name: true, description: true } } },
  },
};

const toAuthUserPayload = (user) => {
  const permissions = buildEffectivePermissionNames(user);

  return {
    id: user.id,
    customerNumber: user.customerNumber,
    name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    email: user.email,
    phone: user.phone,
    role: user.role?.name,
    roleId: user.roleId,
    permissions,
    permissionOverrides: getPermissionOverrideNames(user),
  };
};

const applyEffectivePermissionsToUser = (user) => {
  const permissions = buildEffectivePermissionNames(user);
  const rolePermissionObjects = permissions.map((name) => ({ name }));

  return {
    ...user,
    permissions,
    permissionOverrides: getPermissionOverrideNames(user),
    role: {
      ...user.role,
      permissions: rolePermissionObjects,
    },
  };
};

export {
  applyEffectivePermissionsToUser,
  buildEffectivePermissionNames,
  getPermissionOverrideNames,
  toAuthUserPayload,
  userPermissionInclude,
};

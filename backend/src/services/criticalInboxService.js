import prisma from '../config/prisma.js';

const SALES_ROLES = ['VENDEDOR', 'SELLER', 'SALES'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'];

const userLabel = (user) => [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;

export const ensureCriticalAlertAssignment = async (externalClaimId, alertKind) => {
  const claim = await prisma.meliClaim.findUnique({
    where: { externalClaimId: String(externalClaimId) },
    include: { activities: true },
  });
  if (!claim) return null;
  const kind = String(alertKind || '').toUpperCase();
  const existing = claim.activities.find((activity) => (
    activity.action === 'DASHBOARD_ALERT_ASSIGNED'
    && String(activity.details?.alertKind || '').toUpperCase() === kind
  ));
  if (existing) return existing.details;

  const users = await prisma.user.findMany({
    where: { role: { name: { in: [...SALES_ROLES, ...ADMIN_ROLES] } } },
    include: { role: { select: { name: true } } },
  });
  if (!users.length) return null;
  const recentAssignments = await prisma.meliClaimActivity.findMany({
    where: { action: 'DASHBOARD_ALERT_ASSIGNED', createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    select: { details: true },
  });
  const workload = recentAssignments.reduce((counts, activity) => {
    const id = activity.details?.primaryUserId;
    if (id) counts[id] = (counts[id] || 0) + 1;
    return counts;
  }, {});
  const sales = users.filter((user) => SALES_ROLES.includes(user.role?.name));
  const primaryPool = sales.length ? sales : users.filter((user) => ADMIN_ROLES.includes(user.role?.name));
  const primary = [...primaryPool].sort((left, right) => (workload[left.id] || 0) - (workload[right.id] || 0) || left.email.localeCompare(right.email))[0];
  const backup = users.find((user) => ADMIN_ROLES.includes(user.role?.name) && user.id !== primary.id) || null;
  const details = {
    alertKind: kind, primaryUserId: primary.id, primaryName: userLabel(primary),
    backupUserId: backup?.id || null, backupName: backup ? userLabel(backup) : null,
    assignedAt: new Date().toISOString(), automatic: true,
  };
  await prisma.$transaction([
    prisma.meliClaim.update({ where: { id: claim.id }, data: { assignedTo: primary.email } }),
    prisma.meliClaimActivity.create({ data: { claimId: claim.id, action: 'DASHBOARD_ALERT_ASSIGNED', actorName: 'Asignación automática', details } }),
  ]);
  return details;
};


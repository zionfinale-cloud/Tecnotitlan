import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/apiService';
import styles from './ProductListScreen.module.css';

const lockedRoleNames = ['SUPER_ADMIN', 'USER'];

const emptyForm = {
  id: null,
  name: '',
  description: '',
  permissionIds: [],
};

const rolePresets = {
  VENDEDOR: [
    'access:admin_panel',
    'product:read',
    'category:read',
    'order:read',
    'order:update',
    'support:read',
    'support:update',
    'mail:read',
    'mail:send',
    'whatsapp:chat',
    'tecatl:read',
    'tecatl:reply',
    'tecatl:handoff',
  ],
  SUPERVISOR: [
    'access:admin_panel',
    'product:read',
    'product:update',
    'category:read',
    'order:read',
    'order:update',
    'support:read',
    'support:update',
    'mail:read',
    'mail:send',
    'whatsapp:chat',
    'tecatl:read',
    'tecatl:reply',
    'tecatl:handoff',
  ],
  ADMIN: [
    'access:admin_panel',
    'user:read',
    'user:update',
    'role:create',
    'role:read',
    'role:update',
    'product:create',
    'product:read',
    'product:update',
    'product:delete',
    'category:create',
    'category:read',
    'category:update',
    'category:delete',
    'order:read',
    'order:update',
    'report:read',
    'finance:read_costs',
    'setting:read',
    'setting:update',
    'integration:read',
    'integration:update',
    'support:read',
    'support:update',
    'mail:read',
    'mail:send',
    'whatsapp:chat',
    'tecatl:read',
    'tecatl:reply',
    'tecatl:knowledge',
    'tecatl:handoff',
  ],
};

const permissionMatrix = [
  {
    module: 'Acceso al panel',
    description: 'Permite entrar al dashboard de trabajo.',
    actions: [{ label: 'Entrar', permission: 'access:admin_panel' }],
  },
  {
    module: 'Productos',
    description: 'Catalogo visible, fichas, imagenes y precios publicos.',
    actions: [
      { label: 'Ver', permission: 'product:read' },
      { label: 'Crear', permission: 'product:create' },
      { label: 'Editar', permission: 'product:update' },
      { label: 'Eliminar', permission: 'product:delete' },
      { label: 'Ver costos', permission: 'finance:read_costs', danger: true },
    ],
  },
  {
    module: 'Inventario',
    description: 'Existencias por producto/canal. Costos e inversiones quedan separados.',
    actions: [
      { label: 'Ver stock', permission: 'product:read' },
      { label: 'Mover stock', permission: 'product:update' },
      { label: 'Entradas/costos', permission: 'finance:read_costs', danger: true },
      { label: 'Cortes/utilidad', permission: 'finance:read_costs', danger: true },
    ],
  },
  {
    module: 'Inversiones y utilidad',
    description: 'Dinero invertido, costos, margen, utilidad y reportes sensibles.',
    actions: [
      { label: 'Ver costos', permission: 'finance:read_costs', danger: true },
      { label: 'Ver reportes', permission: 'report:read', danger: true },
    ],
  },
  {
    module: 'Pedidos',
    description: 'Seguimiento, estados, atencion y fulfillment manual.',
    actions: [
      { label: 'Ver', permission: 'order:read' },
      { label: 'Actualizar', permission: 'order:update' },
    ],
  },
  {
    module: 'Canales',
    description: 'Preparacion operativa para Web, Mercado Libre, TikTok Shop y Amazon.',
    actions: [
      { label: 'Ver', permission: 'product:read' },
      { label: 'Editar', permission: 'product:update' },
      { label: 'Integrar', permission: 'integration:update' },
    ],
  },
  {
    module: 'Clientes y usuarios',
    description: 'Alta operativa de equipo y usuarios registrados.',
    actions: [
      { label: 'Ver', permission: 'user:read' },
      { label: 'Editar', permission: 'user:update' },
      { label: 'Eliminar', permission: 'user:delete', danger: true },
    ],
  },
  {
    module: 'Roles y permisos',
    description: 'Quien puede cambiar accesos. Normalmente solo Super Admin.',
    actions: [
      { label: 'Ver', permission: 'role:read', danger: true },
      { label: 'Crear', permission: 'role:create', danger: true },
      { label: 'Editar', permission: 'role:update', danger: true },
      { label: 'Eliminar', permission: 'role:delete', danger: true },
    ],
  },
  {
    module: 'Categorias',
    description: 'Organizacion del catalogo y navegacion.',
    actions: [
      { label: 'Ver', permission: 'category:read' },
      { label: 'Crear', permission: 'category:create' },
      { label: 'Editar', permission: 'category:update' },
      { label: 'Eliminar', permission: 'category:delete' },
    ],
  },
  {
    module: 'Soporte',
    description: 'Tickets y seguimiento a clientes.',
    actions: [
      { label: 'Ver', permission: 'support:read' },
      { label: 'Atender', permission: 'support:update' },
    ],
  },
  {
    module: 'Correo',
    description: 'Bandeja corporativa para el equipo.',
    actions: [
      { label: 'Leer', permission: 'mail:read' },
      { label: 'Responder', permission: 'mail:send' },
    ],
  },
  {
    module: 'WhatsApp',
    description: 'Chat de ventas/soporte desde el dashboard.',
    actions: [{ label: 'Atender chat', permission: 'whatsapp:chat' }],
  },
  {
    module: 'Tecatl',
    description: 'Asistente conversacional, conversaciones, conocimiento y escalamiento humano.',
    actions: [
      { label: 'Ver conversaciones', permission: 'tecatl:read' },
      { label: 'Responder', permission: 'tecatl:reply' },
      { label: 'Base conocimiento', permission: 'tecatl:knowledge' },
      { label: 'Escalamientos', permission: 'tecatl:handoff' },
      { label: 'Configurar perfil', permission: 'tecatl:manage', danger: true },
    ],
  },
  {
    module: 'Storefront y configuracion',
    description: 'Home, textos, colores y ajustes visibles de la tienda.',
    actions: [
      { label: 'Ver', permission: 'setting:read' },
      { label: 'Editar', permission: 'setting:update' },
    ],
  },
  {
    module: 'Integraciones',
    description: 'Stripe, Mercado Libre, TikTok Shop, n8n y conexiones externas.',
    actions: [
      { label: 'Ver', permission: 'integration:read' },
      { label: 'Conectar', permission: 'integration:update' },
      { label: 'Desconectar', permission: 'integration:delete', danger: true },
    ],
  },
  {
    module: 'Sistema sensible',
    description: 'Variables, SMTP, secretos, WhatsApp QR y configuracion critica.',
    actions: [{ label: 'Configurar', permission: 'system:configure', danger: true }],
  },
];

const normalizeRoleName = (value) => value.trim().toUpperCase().replace(/\s+/g, '_');

const RoleListScreen = () => {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const permissionByName = useMemo(
    () => new Map(permissions.map((permission) => [permission.name, permission])),
    [permissions]
  );

  const permissionNamesInMatrix = useMemo(
    () => new Set(permissionMatrix.flatMap((row) => row.actions.map((action) => action.permission))),
    []
  );

  const advancedPermissions = useMemo(
    () => permissions.filter((permission) => !permissionNamesInMatrix.has(permission.name)),
    [permissionNamesInMatrix, permissions]
  );

  const isLockedRole = lockedRoleNames.includes(form.name);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [rolesResponse, permissionsResponse] = await Promise.all([
        api.get('/roles'),
        api.get('/roles/permissions'),
      ]);
      setRoles(rolesResponse.data.data.roles || []);
      setPermissions(permissionsResponse.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar roles y permisos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const startCreate = () => {
    setForm(emptyForm);
    setError('');
    setSuccess('');
  };

  const startEdit = (role) => {
    setForm({
      id: role.id,
      name: role.name,
      description: role.description || '',
      permissionIds: (role.permissions || []).map((permission) => permission.id),
    });
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasPermissionId = (permissionId) => form.permissionIds.includes(permissionId);

  const setPermission = (permissionName, enabled) => {
    const permission = permissionByName.get(permissionName);
    if (!permission || isLockedRole) return;

    setForm((current) => {
      const exists = current.permissionIds.includes(permission.id);
      if (enabled && !exists) {
        return { ...current, permissionIds: [...current.permissionIds, permission.id] };
      }
      if (!enabled && exists) {
        return {
          ...current,
          permissionIds: current.permissionIds.filter((id) => id !== permission.id),
        };
      }
      return current;
    });
  };

  const togglePermission = (permissionId) => {
    if (isLockedRole) return;
    setForm((current) => ({
      ...current,
      permissionIds: current.permissionIds.includes(permissionId)
        ? current.permissionIds.filter((id) => id !== permissionId)
        : [...current.permissionIds, permissionId],
    }));
  };

  const applyPreset = (presetName) => {
    const permissionIds = (rolePresets[presetName] || [])
      .map((permissionName) => permissionByName.get(permissionName)?.id)
      .filter(Boolean);

    setForm((current) => ({
      ...current,
      name: current.name || presetName,
      description: current.description || {
        ADMIN: 'Administra operacion, catalogo, pedidos, inventario y costos sin acceso a configuracion sensible.',
        SUPERVISOR: 'Supervisa ventas, pedidos, inventario operativo y atencion sin ver costos por defecto.',
        VENDEDOR: 'Atiende clientes, pedidos, correo, WhatsApp y consulta inventario sin ver costos.',
      }[presetName],
      permissionIds,
    }));
  };

  const saveRole = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        name: normalizeRoleName(form.name),
        description: form.description.trim(),
        permissionIds: form.permissionIds,
      };

      if (form.id) {
        await api.put(`/roles/${form.id}`, payload);
        setSuccess('Rol actualizado.');
      } else {
        await api.post('/roles', payload);
        setSuccess('Rol creado.');
      }

      setForm(emptyForm);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo guardar el rol.');
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (role) => {
    if (!window.confirm(`Eliminar el rol ${role.name}?`)) return;

    setError('');
    setSuccess('');
    try {
      await api.delete(`/roles/${role.id}`);
      setSuccess('Rol eliminado.');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo eliminar el rol.');
    }
  };

  const renderSwitch = (action) => {
    const permission = permissionByName.get(action.permission);
    if (!permission) return <span className={styles.muted}>-</span>;

    const checked = hasPermissionId(permission.id);
    return (
      <label
        key={`${action.label}-${action.permission}`}
        className={`${styles.permissionSwitch} ${checked ? styles.permissionSwitchOn : ''} ${action.danger ? styles.permissionSwitchDanger : ''}`}
        title={permission.description || permission.name}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={isLockedRole}
          onChange={(event) => setPermission(action.permission, event.target.checked)}
        />
        <span>{action.label}</span>
      </label>
    );
  };

  return (
    <>
      <div className={styles.toolbar}>
        <div>
          <h1 className={styles.title}>Roles y permisos</h1>
          <p className={styles.subtitle}>
            Matriz tipo VEVA: marca que puede hacer cada rol. El switch "Ver costos" controla costos,
            inversiones, utilidad y cortes sensibles.
          </p>
        </div>
        <button className={styles.secondaryButton} type="button" onClick={startCreate}>
          + Nuevo rol
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <section className={styles.card} style={{ marginBottom: '1.25rem' }}>
        <div className={styles.toolbar}>
          <div>
            <h2 className={styles.title} style={{ fontSize: '1.25rem', marginBottom: 0 }}>
              {form.id ? `Editar ${form.name}` : 'Crear rol'}
            </h2>
            <p className={styles.subtitle} style={{ marginBottom: 0 }}>
              Usa un perfil rapido o ajusta cada permiso manualmente.
            </p>
          </div>
          <div className={styles.actions} style={{ marginTop: 0 }}>
            <button className={styles.secondaryButton} type="button" onClick={() => applyPreset('VENDEDOR')} disabled={isLockedRole}>
              Perfil vendedor
            </button>
            <button className={styles.secondaryButton} type="button" onClick={() => applyPreset('SUPERVISOR')} disabled={isLockedRole}>
              Perfil supervisor
            </button>
            <button className={styles.secondaryButton} type="button" onClick={() => applyPreset('ADMIN')} disabled={isLockedRole}>
              Perfil admin
            </button>
          </div>
        </div>

        {isLockedRole && (
          <div className={styles.error}>
            Este rol base esta protegido. SUPER_ADMIN tiene acceso total y USER es el rol de cliente.
          </div>
        )}

        <form onSubmit={saveRole}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>Nombre del rol</label>
              <input
                className={styles.input}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="VENDEDOR"
                disabled={isLockedRole}
                required
              />
              <small className={styles.muted}>Se guarda en mayusculas, ejemplo: SUPERVISOR.</small>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Descripcion</label>
              <input
                className={styles.input}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Puede atender ventas sin ver costos"
                disabled={isLockedRole}
              />
            </div>
          </div>

          <div className={styles.permissionMatrix}>
            {permissionMatrix.map((row) => (
              <div key={row.module} className={styles.permissionRow}>
                <div className={styles.permissionModule}>
                  <strong>{row.module}</strong>
                  <small>{row.description}</small>
                </div>
                <div className={styles.permissionActions}>
                  {row.actions.map(renderSwitch)}
                </div>
              </div>
            ))}
          </div>

          {advancedPermissions.length > 0 && (
            <div className={styles.placeholderBox} style={{ textAlign: 'left', color: '#0f172a' }}>
              <strong>Permisos avanzados</strong>
              <p className={styles.muted}>
                Estos permisos existen en el sistema pero no pertenecen a una fila comun. Tocarlos solo si sabes para que son.
              </p>
              <div className={styles.formGrid}>
                {advancedPermissions.map((permission) => (
                  <label key={permission.id} className={styles.muted} style={{ color: '#0f172a' }}>
                    <input
                      type="checkbox"
                      checked={form.permissionIds.includes(permission.id)}
                      onChange={() => togglePermission(permission.id)}
                      disabled={isLockedRole}
                    />{' '}
                    <strong>{permission.name}</strong>
                    <br />
                    <span>{permission.description}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={saving || isLockedRole}>
              {saving ? 'Guardando...' : 'Guardar rol'}
            </button>
            <button className={styles.secondaryButton} type="button" onClick={() => setForm(emptyForm)}>
              Limpiar
            </button>
          </div>
        </form>
      </section>

      <section className={styles.card}>
        {loading ? (
          <div className={styles.empty}>Cargando roles...</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Rol</th>
                  <th>Descripcion</th>
                  <th>Usuarios</th>
                  <th>Permisos activos</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => {
                  const isLocked = lockedRoleNames.includes(role.name);
                  return (
                    <tr key={role.id}>
                      <td><strong>{role.name}</strong></td>
                      <td>{role.description || '-'}</td>
                      <td>{role._count?.users || 0}</td>
                      <td>{(role.permissions || []).length}</td>
                      <td>
                        <button
                          className={styles.secondaryButton}
                          type="button"
                          onClick={() => startEdit(role)}
                          disabled={isLocked}
                        >
                          Editar
                        </button>{' '}
                        <button
                          className={styles.dangerButton}
                          type="button"
                          onClick={() => deleteRole(role)}
                          disabled={isLocked || (role._count?.users || 0) > 0}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
};

export default RoleListScreen;

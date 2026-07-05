import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/apiService';
import styles from './ProductListScreen.module.css';

const baseRoleNames = ['SUPER_ADMIN', 'USER'];

const emptyForm = {
  id: null,
  name: '',
  description: '',
  permissionIds: [],
};

const formatGroupName = (name) => {
  const [group] = name.split(':');
  const labels = {
    access: 'Acceso',
    user: 'Usuarios',
    role: 'Roles',
    product: 'Productos',
    category: 'Categorias',
    order: 'Pedidos',
    report: 'Reportes',
    finance: 'Finanzas y costos',
    setting: 'Configuracion',
    integration: 'Integraciones',
    support: 'Soporte',
    mail: 'Correo',
    whatsapp: 'WhatsApp',
    system: 'Sistema',
  };
  return labels[group] || group;
};

const RoleListScreen = () => {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const groupedPermissions = useMemo(() => {
    return permissions.reduce((groups, permission) => {
      const group = formatGroupName(permission.name);
      return {
        ...groups,
        [group]: [...(groups[group] || []), permission],
      };
    }, {});
  }, [permissions]);

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

  const togglePermission = (permissionId) => {
    setForm((current) => ({
      ...current,
      permissionIds: current.permissionIds.includes(permissionId)
        ? current.permissionIds.filter((id) => id !== permissionId)
        : [...current.permissionIds, permissionId],
    }));
  };

  const saveRole = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        name: form.name.trim().toUpperCase().replace(/\s+/g, '_'),
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

  return (
    <>
      <div className={styles.toolbar}>
        <div>
          <h1 className={styles.title}>Roles y permisos</h1>
          <p className={styles.subtitle}>
            Define que puede ver cada equipo. Para vendedores no marques "Finanzas y costos".
          </p>
        </div>
        <button className={styles.secondaryButton} type="button" onClick={startCreate}>
          + Nuevo rol
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <section className={styles.card} style={{ marginBottom: '1.25rem' }}>
        <h2 className={styles.title} style={{ fontSize: '1.25rem' }}>
          {form.id ? 'Editar rol' : 'Crear rol'}
        </h2>
        <form onSubmit={saveRole}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>Nombre del rol</label>
              <input
                className={styles.input}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="VENDEDOR"
                disabled={baseRoleNames.includes(form.name)}
                required
              />
              <small className={styles.muted}>Se guardara en mayusculas, ejemplo: VENDEDOR.</small>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Descripcion</label>
              <input
                className={styles.input}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Puede atender ventas y pedidos sin ver costos"
              />
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            {Object.entries(groupedPermissions).map(([group, groupPermissions]) => (
              <div key={group} className={styles.placeholderBox} style={{ textAlign: 'left', color: '#0f172a' }}>
                <strong>{group}</strong>
                <div className={styles.formGrid} style={{ marginTop: '0.75rem' }}>
                  {groupPermissions.map((permission) => (
                    <label key={permission.id} className={styles.muted} style={{ color: '#0f172a' }}>
                      <input
                        type="checkbox"
                        checked={form.permissionIds.includes(permission.id)}
                        onChange={() => togglePermission(permission.id)}
                        disabled={baseRoleNames.includes(form.name)}
                      />{' '}
                      <strong>{permission.name}</strong>
                      <br />
                      <span>{permission.description}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={saving || baseRoleNames.includes(form.name)}>
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
                  <th>Permisos</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => {
                  const isBaseRole = baseRoleNames.includes(role.name);
                  return (
                    <tr key={role.id}>
                      <td><strong>{role.name}</strong></td>
                      <td>{role.description || '-'}</td>
                      <td>{role._count?.users || 0}</td>
                      <td>{(role.permissions || []).map((permission) => permission.name).join(', ') || 'Sin permisos'}</td>
                      <td>
                        <button
                          className={styles.secondaryButton}
                          type="button"
                          onClick={() => startEdit(role)}
                          disabled={isBaseRole}
                        >
                          Editar
                        </button>{' '}
                        <button
                          className={styles.dangerButton}
                          type="button"
                          onClick={() => deleteRole(role)}
                          disabled={isBaseRole || (role._count?.users || 0) > 0}
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

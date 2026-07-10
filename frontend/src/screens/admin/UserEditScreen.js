import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../services/apiService';
import styles from './ProductListScreen.module.css';
import { permissionMatrix } from './RoleListScreen';

const UserEditScreen = () => {
  const { id } = useParams();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    secondLastName: '',
    email: '',
    roleId: '',
    permissionGrantIds: [],
    permissionDenyIds: [],
  });
  const [userMeta, setUserMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [userResponse, rolesResponse, permissionsResponse] = await Promise.all([
          api.get(`/users/${id}`),
          api.get('/roles'),
          api.get('/roles/permissions'),
        ]);
        const user = userResponse.data.data.user;
        setForm({
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          secondLastName: user.secondLastName || '',
          email: user.email || '',
          roleId: user.roleId || user.role?.id || '',
          permissionGrantIds: user.permissionGrantIds || [],
          permissionDenyIds: user.permissionDenyIds || [],
        });
        setUserMeta(user);
        setRoles(rolesResponse.data.data.roles || []);
        setPermissions(permissionsResponse.data.data || []);
      } catch (err) {
        setError(err.response?.data?.message || 'No se pudo cargar el usuario.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  const saveUser = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await api.put(`/users/${id}`, form);
      if (data.data?.user) {
        setUserMeta(data.data.user);
        setForm((current) => ({
          ...current,
          permissionGrantIds: data.data.user.permissionGrantIds || current.permissionGrantIds,
          permissionDenyIds: data.data.user.permissionDenyIds || current.permissionDenyIds,
        }));
      }
      setSuccess('Usuario actualizado.');
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo actualizar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === form.roleId),
    [form.roleId, roles]
  );

  const permissionByName = useMemo(
    () => new Map(permissions.map((permission) => [permission.name, permission])),
    [permissions]
  );

  const matrixPermissionNames = useMemo(
    () => new Set(permissionMatrix.flatMap((row) => row.actions.map((action) => action.permission))),
    []
  );

  const advancedPermissions = useMemo(
    () => permissions.filter((permission) => !matrixPermissionNames.has(permission.name)),
    [matrixPermissionNames, permissions]
  );

  const rolePermissionIds = useMemo(
    () => new Set((selectedRole?.permissions || []).map((permission) => permission.id)),
    [selectedRole]
  );

  const grantIds = useMemo(() => new Set(form.permissionGrantIds), [form.permissionGrantIds]);
  const denyIds = useMemo(() => new Set(form.permissionDenyIds), [form.permissionDenyIds]);
  const isSuperAdminTarget = selectedRole?.name === 'SUPER_ADMIN' || userMeta?.role?.name === 'SUPER_ADMIN';

  const setPermissionMode = (permissionId, mode) => {
    if (!permissionId || isSuperAdminTarget) return;

    setForm((current) => {
      const nextGrants = new Set(current.permissionGrantIds);
      const nextDenies = new Set(current.permissionDenyIds);
      nextGrants.delete(permissionId);
      nextDenies.delete(permissionId);

      if (mode === 'grant') nextGrants.add(permissionId);
      if (mode === 'deny') nextDenies.add(permissionId);

      return {
        ...current,
        permissionGrantIds: Array.from(nextGrants),
        permissionDenyIds: Array.from(nextDenies),
      };
    });
  };

  const getPermissionMode = (permissionId) => {
    if (denyIds.has(permissionId)) return 'deny';
    if (grantIds.has(permissionId)) return 'grant';
    return 'inherit';
  };

  const isEffectiveAllowed = (permissionId) => {
    const mode = getPermissionMode(permissionId);
    if (mode === 'deny') return false;
    if (mode === 'grant') return true;
    return rolePermissionIds.has(permissionId);
  };

  const renderPermissionControls = (permission, danger = false) => {
    if (!permission) return <span className={styles.muted}>No existe</span>;
    const mode = getPermissionMode(permission.id);
    const effective = isEffectiveAllowed(permission.id);

    return (
      <div className={styles.overrideGroup} title={permission.description || permission.name}>
        <button
          type="button"
          className={`${styles.overrideButton} ${mode === 'inherit' ? styles.overrideActive : ''}`}
          onClick={() => setPermissionMode(permission.id, 'inherit')}
          disabled={isSuperAdminTarget}
        >
          Rol: {rolePermissionIds.has(permission.id) ? 'Si' : 'No'}
        </button>
        <button
          type="button"
          className={`${styles.overrideButton} ${styles.overrideAllow} ${mode === 'grant' ? styles.overrideActive : ''}`}
          onClick={() => setPermissionMode(permission.id, 'grant')}
          disabled={isSuperAdminTarget}
        >
          Permitir
        </button>
        <button
          type="button"
          className={`${styles.overrideButton} ${styles.overrideDeny} ${mode === 'deny' ? styles.overrideActive : ''} ${danger ? styles.overrideDanger : ''}`}
          onClick={() => setPermissionMode(permission.id, 'deny')}
          disabled={isSuperAdminTarget}
        >
          Bloquear
        </button>
        <span className={`${styles.permissionResult} ${effective ? styles.permissionAllowed : styles.permissionBlocked}`}>
          {effective ? 'Activo' : 'Sin acceso'}
        </span>
      </div>
    );
  };

  if (loading) {
    return <div className={styles.empty}>Cargando usuario...</div>;
  }

  return (
    <>
      <div className={styles.toolbar}>
        <div>
          <h1 className={styles.title}>Editar usuario</h1>
          <p className={styles.subtitle}>
            Asigna el rol base y ajusta permisos individuales cuando una persona necesite mas o menos acceso.
          </p>
        </div>
        <Link className={styles.secondaryButton} to="/admin/userlist">Volver</Link>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      {userMeta && (
        <div className={styles.placeholderBox} style={{ textAlign: 'left', color: '#0f172a' }}>
          <strong>Cliente:</strong> {userMeta.customerNumber || userMeta.id}
          {' | '}
          <strong>Registrado:</strong> {userMeta.createdAt ? new Date(userMeta.createdAt).toLocaleString('es-MX') : '-'}
          {' | '}
          <strong>Rol actual:</strong> {userMeta.role?.name || 'USER'}
        </div>
      )}

      <section className={styles.card}>
        <form onSubmit={saveUser}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>Nombre</label>
              <input
                className={styles.input}
                value={form.firstName}
                onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Apellido paterno</label>
              <input
                className={styles.input}
                value={form.lastName}
                onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Apellido materno</label>
              <input
                className={styles.input}
                value={form.secondLastName}
                onChange={(event) => setForm({ ...form, secondLastName: event.target.value })}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Correo</label>
              <input
                className={styles.input}
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
              />
            </div>
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label className={styles.label}>Rol</label>
              <select
                className={styles.select}
                value={form.roleId}
                onChange={(event) => setForm({ ...form, roleId: event.target.value })}
                required
              >
                <option value="">Selecciona rol</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name} - {role.description || 'Sin descripcion'}
                  </option>
                ))}
              </select>
              <small className={styles.muted}>
                El rol es la base. Abajo puedes permitir o bloquear permisos solo para este usuario.
              </small>
            </div>
          </div>

          <div className={styles.permissionMatrix}>
            <div className={styles.placeholderBox} style={{ textAlign: 'left', color: '#0f172a', marginTop: 0 }}>
              <strong>Permisos individuales</strong>
              <p className={styles.placeholderText}>
                "Rol" respeta lo que tiene el rol base. "Permitir" agrega acceso a esta persona. "Bloquear" le quita acceso aunque el rol lo tenga.
              </p>
              {isSuperAdminTarget && (
                <p className={styles.placeholderText}>
                  Los usuarios SUPER_ADMIN siempre tienen acceso completo y no aceptan bloqueos individuales para evitar perder el control del sistema.
                </p>
              )}
            </div>

            {permissionMatrix.map((row) => (
              <div key={row.module} className={styles.permissionRow}>
                <div className={styles.permissionModule}>
                  <strong>{row.module}</strong>
                  <small>{row.description}</small>
                </div>
                <div className={styles.permissionActions}>
                  {row.actions.map((action) => {
                    const permission = permissionByName.get(action.permission);
                    return (
                      <div key={action.permission} className={styles.permissionOverrideItem}>
                        <span className={action.danger ? styles.dangerText : ''}>{action.label}</span>
                        {renderPermissionControls(permission, action.danger)}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {advancedPermissions.length > 0 && (
              <div className={styles.permissionRow}>
                <div className={styles.permissionModule}>
                  <strong>Permisos avanzados</strong>
                  <small>Permisos nuevos o tecnicos que no estan en la matriz principal.</small>
                </div>
                <div className={styles.permissionActions}>
                  {advancedPermissions.map((permission) => (
                    <div key={permission.id} className={styles.permissionOverrideItem}>
                      <span>{permission.name}</span>
                      {renderPermissionControls(permission)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar usuario'}
            </button>
            <Link className={styles.secondaryButton} to="/admin/userlist">Cancelar</Link>
          </div>
        </form>
      </section>
    </>
  );
};

export default UserEditScreen;

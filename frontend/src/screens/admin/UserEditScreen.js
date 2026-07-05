import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../services/apiService';
import styles from './ProductListScreen.module.css';

const UserEditScreen = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    secondLastName: '',
    email: '',
    roleId: '',
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
        const [userResponse, rolesResponse] = await Promise.all([
          api.get(`/users/${id}`),
          api.get('/roles'),
        ]);
        const user = userResponse.data.data.user;
        setForm({
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          secondLastName: user.secondLastName || '',
          email: user.email || '',
          roleId: user.roleId || user.role?.id || '',
        });
        setUserMeta(user);
        setRoles(rolesResponse.data.data.roles || []);
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
      await api.put(`/users/${id}`, form);
      setSuccess('Usuario actualizado.');
      window.setTimeout(() => navigate('/admin/userlist'), 700);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo actualizar el usuario.');
    } finally {
      setSaving(false);
    }
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
            Asigna el rol correcto. Un vendedor no debe tener "finance:read_costs".
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
                Para crear un vendedor: ve a Roles, crea VENDEDOR y marca solo productos/pedidos/canales/WhatsApp segun necesites.
              </small>
            </div>
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

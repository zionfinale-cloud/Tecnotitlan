import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/apiService';
import styles from './ProductListScreen.module.css';

const flattenCategories = (categories = [], depth = 0) =>
  categories.flatMap((category) => [
    { ...category, depth },
    ...flattenCategories(category.children || [], depth + 1),
  ]);

const CategoryListScreen = () => {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ name: '', parent: '' });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);

  const loadCategories = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/categories');
      setCategories(data.data.categories || []);
    } catch (err) {
      if (!silent) setError(err.response?.data?.message || 'No se pudieron cargar las categorías.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
    const interval = setInterval(() => {
      loadCategories({ silent: true });
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: '', parent: '' });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = { name: form.name.trim(), parent: form.parent || null };
      if (editingId) {
        await api.put(`/categories/${editingId}`, payload);
        setSuccess('Categoría actualizada.');
      } else {
        await api.post('/categories', payload);
        setSuccess('Categoría creada.');
      }
      resetForm();
      await loadCategories();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo guardar la categoría.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (category) => {
    setEditingId(category.id);
    setForm({ name: category.name, parent: category.parentId || '' });
    setSuccess('');
    setError('');
  };

  const deleteCategory = async (category) => {
    if (!window.confirm(`¿Eliminar la categoría "${category.name}"?`)) return;

    setError('');
    setSuccess('');
    try {
      await api.delete(`/categories/${category.id}`);
      setSuccess('Categoría eliminada.');
      await loadCategories();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo eliminar. Revisa si tiene productos o subcategorías.');
    }
  };

  return (
    <>
      <div className={styles.toolbar}>
        <div>
          <h1 className={styles.title}>Gestión de Categorías</h1>
          <p className={styles.subtitle}>Organiza el catálogo antes de cargar productos.</p>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <div className={styles.card}>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="category-name">Nombre</label>
              <input
                id="category-name"
                className={styles.input}
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
                placeholder="Ej. Audio"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="category-parent">Categoría padre</label>
              <select
                id="category-parent"
                className={styles.select}
                value={form.parent}
                onChange={(event) => setForm((current) => ({ ...current, parent: event.target.value }))}
              >
                <option value="">Sin padre</option>
                {flatCategories
                  .filter((category) => category.id !== editingId)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {'— '.repeat(category.depth)}{category.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={saving}>
              {saving ? 'Guardando...' : editingId ? 'Actualizar categoría' : 'Crear categoría'}
            </button>
            {editingId && (
              <button className={styles.secondaryButton} type="button" onClick={resetForm}>
                Cancelar edición
              </button>
            )}
          </div>
        </form>
      </div>

      <div className={styles.card} style={{ marginTop: '1rem' }}>
        {loading ? (
          <div className={styles.empty}>Cargando categorías...</div>
        ) : flatCategories.length === 0 ? (
          <div className={styles.empty}>Aún no hay categorías. Crea la primera para empezar el catálogo.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Slug</th>
                  <th>Tipo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {flatCategories.map((category) => (
                  <tr key={category.id}>
                    <td>{'— '.repeat(category.depth)}{category.name}</td>
                    <td>{category.slug}</td>
                    <td>{category.parentId ? 'Subcategoría' : 'Raíz'}</td>
                    <td>
                      <button className={styles.secondaryButton} type="button" onClick={() => startEdit(category)}>
                        Editar
                      </button>{' '}
                      <button className={styles.dangerButton} type="button" onClick={() => deleteCategory(category)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default CategoryListScreen;

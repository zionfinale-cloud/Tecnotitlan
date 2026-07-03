import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../services/apiService';
import styles from './ProductListScreen.module.css';

const emptyProduct = {
  name: '',
  description: '',
  price: '',
  costPrice: '',
  brand: '',
  categoryId: '',
  countInStock: 0,
  productType: 'IN_HOUSE',
  supplierInfo: '',
  youtubeUrl: '',
};

const flattenCategories = (categories = [], depth = 0) =>
  categories.flatMap((category) => [
    { ...category, depth },
    ...flattenCategories(category.children || [], depth + 1),
  ]);

const ProductEditScreen = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const [form, setForm] = useState(emptyProduct);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [categoriesResponse, productResponse] = await Promise.all([
          api.get('/categories'),
          isEditing ? api.get(`/products/${id}`) : Promise.resolve(null),
        ]);

        setCategories(categoriesResponse.data.data.categories || []);

        if (productResponse) {
          const product = productResponse.data.data.product;
          setForm({
            name: product.name || '',
            description: product.description || '',
            price: product.price ?? '',
            costPrice: product.costPrice ?? '',
            brand: product.brand || '',
            categoryId: product.categoryId || '',
            countInStock: product.countInStock ?? 0,
            productType: product.productType || 'IN_HOUSE',
            supplierInfo: product.supplierInfo || '',
            youtubeUrl: product.youtubeUrl || '',
          });
        }
      } catch (err) {
        setError(err.response?.data?.message || 'No se pudo cargar el formulario de producto.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, isEditing]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      ...form,
      price: Number(form.price),
      costPrice: form.costPrice === '' ? undefined : Number(form.costPrice),
      countInStock: Number(form.countInStock),
      supplierInfo: form.productType === 'DROPSHIPPING' ? form.supplierInfo : '',
    };

    try {
      if (isEditing) {
        await api.put(`/products/${id}`, payload);
      } else {
        await api.post('/products', payload);
      }
      navigate('/admin/productlist');
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo guardar el producto.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.empty}>Cargando producto...</div>;
  }

  return (
    <>
      <div className={styles.toolbar}>
        <div>
          <h1 className={styles.title}>{isEditing ? 'Editar Producto' : 'Nuevo Producto'}</h1>
          <p className={styles.subtitle}>Datos base para vender en web y preparar el catálogo omnicanal.</p>
        </div>
        <Link className={styles.secondaryButton} to="/admin/productlist">Volver</Link>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {flatCategories.length === 0 && (
        <div className={styles.error}>
          Primero crea al menos una categoría. Los productos necesitan categoría para generar SKU y mostrarse bien.
        </div>
      )}

      <div className={styles.card}>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="product-name">Nombre</label>
              <input id="product-name" className={styles.input} value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="product-brand">Marca</label>
              <input id="product-brand" className={styles.input} value={form.brand} onChange={(event) => updateField('brand', event.target.value)} placeholder="Tecnotitlán, Genérica, etc." />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="product-category">Categoría</label>
              <select id="product-category" className={styles.select} value={form.categoryId} onChange={(event) => updateField('categoryId', event.target.value)} required>
                <option value="">Selecciona una categoría</option>
                {flatCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {'— '.repeat(category.depth)}{category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="product-type">Tipo</label>
              <select id="product-type" className={styles.select} value={form.productType} onChange={(event) => updateField('productType', event.target.value)}>
                <option value="IN_HOUSE">Inventario propio</option>
                <option value="DROPSHIPPING">Dropshipping</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="product-price">Precio venta</label>
              <input id="product-price" className={styles.input} type="number" step="0.01" min="0" value={form.price} onChange={(event) => updateField('price', event.target.value)} required />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="product-cost">Costo</label>
              <input id="product-cost" className={styles.input} type="number" step="0.01" min="0" value={form.costPrice} onChange={(event) => updateField('costPrice', event.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="product-stock">Stock disponible</label>
              <input id="product-stock" className={styles.input} type="number" min="0" value={form.countInStock} onChange={(event) => updateField('countInStock', event.target.value)} required />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="product-youtube">Video YouTube</label>
              <input id="product-youtube" className={styles.input} value={form.youtubeUrl} onChange={(event) => updateField('youtubeUrl', event.target.value)} placeholder="Opcional" />
            </div>
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label className={styles.label} htmlFor="product-description">Descripción</label>
              <textarea id="product-description" className={styles.textarea} value={form.description} onChange={(event) => updateField('description', event.target.value)} required />
            </div>
            {form.productType === 'DROPSHIPPING' && (
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label className={styles.label} htmlFor="product-supplier">Información del proveedor</label>
                <textarea id="product-supplier" className={styles.textarea} value={form.supplierInfo} onChange={(event) => updateField('supplierInfo', event.target.value)} required />
              </div>
            )}
          </div>
          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={saving || flatCategories.length === 0}>
              {saving ? 'Guardando...' : 'Guardar producto'}
            </button>
            <Link className={styles.secondaryButton} to="/admin/productlist">Cancelar</Link>
          </div>
        </form>
      </div>
    </>
  );
};

export default ProductEditScreen;

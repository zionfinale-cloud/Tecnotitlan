import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/apiService';
import { FALLBACK_PRODUCT_IMAGE, resolveAssetUrl } from '../../utils/assetUrl';
import { canViewCosts } from '../../utils/permissions';
import styles from './ProductListScreen.module.css';

const SKU_PREFIXES = [
  { value: 'AUR', label: 'AUR - Auriculares / audio' },
  { value: 'BOS', label: 'BOS - Bocinas' },
  { value: 'DRN', label: 'DRN - Drones' },
  { value: 'WTC', label: 'WTC - Relojes / smartwatches' },
  { value: 'ENE', label: 'ENE - Energia / power banks' },
  { value: 'CBL', label: 'CBL - Cables' },
  { value: 'CRG', label: 'CRG - Cargadores' },
  { value: 'GMG', label: 'GMG - Gaming' },
  { value: 'GEN', label: 'GEN - General' },
];

const emptyProduct = {
  name: '',
  description: '',
  price: '',
  costPrice: '',
  brand: '',
  categoryId: '',
  skuPrefix: 'GEN',
  countInStock: 0,
  productType: 'IN_HOUSE',
  supplierInfo: '',
  youtubeUrl: '',
  shippingPayer: 'CUSTOMER',
  shippingCostEstimate: '',
  weightKg: '',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  media: [],
  characteristics: [{ key: '', value: '' }],
};

const flattenCategories = (categories = [], depth = 0) =>
  categories.flatMap((category) => [
    { ...category, depth },
    ...flattenCategories(category.children || [], depth + 1),
  ]);

const ProductEditScreen = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useContext(AuthContext);
  const showCosts = canViewCosts(userInfo);
  const isEditing = Boolean(id);
  const [form, setForm] = useState(emptyProduct);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [imageWarnings, setImageWarnings] = useState({});

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
            ...emptyProduct,
            name: product.name || '',
            description: product.description || '',
            price: product.price ?? '',
            costPrice: product.costPrice ?? '',
            brand: product.brand || '',
            categoryId: product.categoryId || '',
            skuPrefix: product.sku?.split('-')?.[0] || 'GEN',
            countInStock: product.countInStock ?? 0,
            productType: product.productType || 'IN_HOUSE',
            supplierInfo: product.supplierInfo || '',
            youtubeUrl: product.youtubeUrl || '',
            shippingPayer: product.shippingPayer || 'CUSTOMER',
            shippingCostEstimate: product.shippingCostEstimate ?? '',
            weightKg: product.weightKg ?? '',
            lengthCm: product.lengthCm ?? '',
            widthCm: product.widthCm ?? '',
            heightCm: product.heightCm ?? '',
            media: product.media || [],
            characteristics: product.characteristics?.length
              ? product.characteristics.map((item) => ({ key: item.key, value: item.value }))
              : [{ key: '', value: '' }],
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

  const updateCharacteristic = (index, field, value) => {
    setForm((current) => ({
      ...current,
      characteristics: current.characteristics.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const addCharacteristic = () => {
    setForm((current) => ({
      ...current,
      characteristics: [...current.characteristics, { key: '', value: '' }],
    }));
  };

  const removeCharacteristic = (index) => {
    setForm((current) => ({
      ...current,
      characteristics: current.characteristics.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const uploadImages = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    setError('');

    try {
      const uploaded = [];
      for (const file of files) {
        const previewUrl = URL.createObjectURL(file);
        const formData = new FormData();
        formData.append('image', file);
        const { data } = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploaded.push({ type: 'IMAGE', url: data.filePath, previewUrl, altText: form.name || file.name });
      }

      setForm((current) => ({ ...current, media: [...current.media, ...uploaded] }));
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron subir las imagenes.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const removeImage = (index) => {
    setForm((current) => ({
      ...current,
      media: current.media.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      ...form,
      price: Number(form.price),
      countInStock: Number(form.countInStock || 0),
      shippingCostEstimate: form.shippingCostEstimate === '' ? undefined : Number(form.shippingCostEstimate),
      weightKg: form.weightKg === '' ? undefined : Number(form.weightKg),
      lengthCm: form.lengthCm === '' ? undefined : Number(form.lengthCm),
      widthCm: form.widthCm === '' ? undefined : Number(form.widthCm),
      heightCm: form.heightCm === '' ? undefined : Number(form.heightCm),
      supplierInfo: form.productType === 'DROPSHIPPING' ? form.supplierInfo : '',
      media: form.media.map(({ type, url, altText }) => ({ type, url, altText })),
      characteristics: form.characteristics.filter((item) => item.key && item.value),
    };

    if (showCosts) {
      payload.costPrice = form.costPrice === '' ? undefined : Number(form.costPrice);
    }

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
          <p className={styles.subtitle}>
            Primero crea la ficha comercial. Despues registra entradas reales en Inventario.
          </p>
        </div>
        <Link className={styles.secondaryButton} to="/admin/productlist">Volver</Link>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {flatCategories.length === 0 && (
        <div className={styles.error}>
          Primero crea al menos una categoria. Los productos necesitan categoria para generar SKU y mostrarse bien.
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
              <input id="product-brand" className={styles.input} value={form.brand} onChange={(event) => updateField('brand', event.target.value)} placeholder="Tecnotitlan, Generica, etc." />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="product-category">Categoria</label>
              <select id="product-category" className={styles.select} value={form.categoryId} onChange={(event) => updateField('categoryId', event.target.value)} required>
                <option value="">Selecciona una categoria</option>
                {flatCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {'- '.repeat(category.depth)}{category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="product-prefix">Prefijo SKU</label>
              <select id="product-prefix" className={styles.select} value={form.skuPrefix} onChange={(event) => updateField('skuPrefix', event.target.value)} disabled={isEditing}>
                {SKU_PREFIXES.map((prefix) => (
                  <option key={prefix.value} value={prefix.value}>{prefix.label}</option>
                ))}
              </select>
              {isEditing && <small className={styles.muted}>El SKU no se cambia despues de creado para no romper ventas.</small>}
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="product-type">Tipo</label>
              <select id="product-type" className={styles.select} value={form.productType} onChange={(event) => updateField('productType', event.target.value)}>
                <option value="IN_HOUSE">Inventario propio</option>
                <option value="DROPSHIPPING">Dropshipping</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="product-price">Precio venta web</label>
              <input id="product-price" className={styles.input} type="number" step="0.01" min="0" value={form.price} onChange={(event) => updateField('price', event.target.value)} required />
            </div>
            {showCosts && (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="product-cost">Costo referencia</label>
                <input id="product-cost" className={styles.input} type="number" step="0.01" min="0" value={form.costPrice} onChange={(event) => updateField('costPrice', event.target.value)} placeholder="El costo real se confirma en Inventario" />
              </div>
            )}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="product-stock">Stock inicial</label>
              <input id="product-stock" className={styles.input} type="number" min="0" value={form.countInStock} onChange={(event) => updateField('countInStock', event.target.value)} />
              <small className={styles.muted}>Recomendado: 0. Usa Inventario para registrar entradas reales.</small>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="product-youtube">Video YouTube / TikTok / Reel</label>
              <input id="product-youtube" className={styles.input} value={form.youtubeUrl} onChange={(event) => updateField('youtubeUrl', event.target.value)} placeholder="Pega el link del video promocional" />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="shipping-payer">Regla de envio</label>
              <select id="shipping-payer" className={styles.select} value={form.shippingPayer} onChange={(event) => updateField('shippingPayer', event.target.value)}>
                <option value="CUSTOMER">Lo paga el cliente</option>
                <option value="SELLER">Lo absorbemos nosotros</option>
                <option value="MARKETPLACE">Lo maneja marketplace</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="shipping-cost">Envio estimado</label>
              <input id="shipping-cost" className={styles.input} type="number" step="0.01" min="0" value={form.shippingCostEstimate} onChange={(event) => updateField('shippingCostEstimate', event.target.value)} placeholder="Ej. 99" />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="weight">Peso kg</label>
              <input id="weight" className={styles.input} type="number" step="0.01" min="0" value={form.weightKg} onChange={(event) => updateField('weightKg', event.target.value)} placeholder="0.25" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Medidas cm</label>
              <div className={styles.formGrid}>
                <input className={styles.input} type="number" step="0.1" min="0" value={form.lengthCm} onChange={(event) => updateField('lengthCm', event.target.value)} placeholder="Largo" />
                <input className={styles.input} type="number" step="0.1" min="0" value={form.widthCm} onChange={(event) => updateField('widthCm', event.target.value)} placeholder="Ancho" />
                <input className={styles.input} type="number" step="0.1" min="0" value={form.heightCm} onChange={(event) => updateField('heightCm', event.target.value)} placeholder="Alto" />
              </div>
            </div>
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label className={styles.label} htmlFor="product-description">Descripcion comercial</label>
              <textarea id="product-description" className={styles.textarea} value={form.description} onChange={(event) => updateField('description', event.target.value)} required />
            </div>

            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label className={styles.label}>Imagenes del producto</label>
              <input className={styles.input} type="file" accept="image/*" multiple onChange={uploadImages} disabled={uploading} />
              {uploading && <small className={styles.muted}>Subiendo imagenes...</small>}
              <div className={styles.actions}>
                {form.media.map((item, index) => (
                  <div key={`${item.url}-${index}`} className={styles.placeholderBox} style={{ width: 180 }}>
                    <img
                      src={item.previewUrl || resolveAssetUrl(item.url)}
                      alt={item.altText || form.name}
                      style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 8 }}
                      onError={(event) => {
                        setImageWarnings((current) => ({
                          ...current,
                          [index]: 'La imagen se ve localmente, pero la URL publica no esta disponible. Revisa volumen /app/uploads o usa almacenamiento externo.',
                        }));
                        event.currentTarget.src = FALLBACK_PRODUCT_IMAGE;
                      }}
                    />
                    {imageWarnings[index] && (
                      <small className={styles.muted} style={{ display: 'block', marginTop: 6 }}>
                        {imageWarnings[index]}
                      </small>
                    )}
                    <button className={styles.dangerButton} type="button" onClick={() => removeImage(index)} style={{ marginTop: 8 }}>
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label className={styles.label}>Especificaciones / caracteristicas</label>
              {form.characteristics.map((item, index) => (
                <div className={styles.formGrid} key={index} style={{ marginBottom: '0.75rem' }}>
                  <input className={styles.input} value={item.key} onChange={(event) => updateCharacteristic(index, 'key', event.target.value)} placeholder="Ej. Capacidad" />
                  <input className={styles.input} value={item.value} onChange={(event) => updateCharacteristic(index, 'value', event.target.value)} placeholder="Ej. 20,000 mAh" />
                  <button className={styles.dangerButton} type="button" onClick={() => removeCharacteristic(index)}>Quitar</button>
                </div>
              ))}
              <button className={styles.secondaryButton} type="button" onClick={addCharacteristic}>+ Agregar especificacion</button>
            </div>

            {form.productType === 'DROPSHIPPING' && (
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label className={styles.label} htmlFor="product-supplier">Informacion del proveedor</label>
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

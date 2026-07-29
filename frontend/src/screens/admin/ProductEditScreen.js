import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/apiService';
import { FALLBACK_PRODUCT_IMAGE, resolveAssetUrl } from '../../utils/assetUrl';
import { canViewCosts } from '../../utils/permissions';
import styles from './ProductListScreen.module.css';

const SKU_PREFIXES = [
  { value: 'AUR', label: 'AUR - Auriculares / audio' },
  { value: 'BOC', label: 'BOC - Bocinas' },
  { value: 'BOS', label: 'BOS - Bocinas (legacy)' },
  { value: 'DRN', label: 'DRN - Drones' },
  { value: 'WTC', label: 'WTC - Relojes / smartwatches' },
  { value: 'ENE', label: 'ENE - Energia / power banks' },
  { value: 'CBL', label: 'CBL - Cables' },
  { value: 'CRG', label: 'CRG - Cargadores' },
  { value: 'GMG', label: 'GMG - Gaming' },
  { value: 'GEN', label: 'GEN - General' },
];
const CUSTOM_SKU_PREFIX_VALUE = '__CUSTOM__';
const TECATL_TAG_CHARACTERISTIC_KEY = 'Etiquetas Tecatl';

const TECATL_TAG_OPTIONS = [
  'viaje',
  'bateria',
  'audio',
  'auriculares',
  'carga rapida',
  'usb-c',
  'bluetooth',
  'regalo',
  'oficina',
  'escuela',
  'auto',
  'gaming',
  'emergencia',
  'compacto',
  'premium',
];

const TECATL_CHARACTERISTIC_PRESETS = [
  { key: 'Uso recomendado', value: 'Viaje, oficina, escuela, auto, gaming' },
  { key: TECATL_TAG_CHARACTERISTIC_KEY, value: 'viaje, bateria, audio, regalo, emergencia' },
  { key: 'Compatibilidad', value: 'Android, iPhone, USB-C, Bluetooth' },
  { key: 'Ideal para', value: 'personas que viajan, estudiantes, repartidores, oficina' },
];

const normalizeLabel = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const normalizeTag = (value) => normalizeLabel(value)
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const splitTags = (value) => String(value || '')
  .split(',')
  .map(normalizeTag)
  .filter(Boolean);

const getTecatlTagsFromCharacteristics = (characteristics = []) => {
  const tagRow = characteristics.find(
    (item) => normalizeLabel(item.key) === normalizeLabel(TECATL_TAG_CHARACTERISTIC_KEY)
  );
  return tagRow ? splitTags(tagRow.value) : [];
};

const normalizeSkuPrefix = (value) => String(value || '')
  .replace(/[^a-zA-Z0-9]/g, '')
  .slice(0, 3)
  .toUpperCase();

const emptyProduct = {
  sku: '',
  name: '',
  description: '',
  price: '',
  costPrice: '',
  brand: '',
  categoryId: '',
  skuPrefix: '',
  countInStock: 0,
  productType: 'IN_HOUSE',
  supplierStock: 0,
  supplierStockUnlimited: false,
  supplierLeadTimeMinutes: 60,
  supplierInfo: '',
  youtubeUrl: '',
  shippingPayer: 'CUSTOMER',
  shippingCostEstimate: '',
  weightKg: '',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  meliItemId: '',
  meliPublicationUrl: '',
  lastMeliSync: '',
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
  const [customSkuMode, setCustomSkuMode] = useState(false);
  const [customTecatlTag, setCustomTecatlTag] = useState('');
  const [meliLoading, setMeliLoading] = useState(false);
  const [meliPreview, setMeliPreview] = useState(null);
  const [meliMessage, setMeliMessage] = useState('');
  const [meliError, setMeliError] = useState('');
  const [meliRequirements, setMeliRequirements] = useState(null);
  const [meliPublishForm, setMeliPublishForm] = useState({
    categoryId: '',
    listingTypeId: 'gold_special',
    condition: 'new',
    attributes: {},
  });

  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);
  const predefinedSkuValues = useMemo(() => SKU_PREFIXES.map((prefix) => prefix.value), []);
  const selectedSkuPrefixMode = useMemo(() => {
    if (customSkuMode) return CUSTOM_SKU_PREFIX_VALUE;
    if (!form.skuPrefix) return '';
    if (predefinedSkuValues.includes(form.skuPrefix)) return form.skuPrefix;
    return CUSTOM_SKU_PREFIX_VALUE;
  }, [customSkuMode, form.skuPrefix, predefinedSkuValues]);
  const isCustomSkuPrefix = selectedSkuPrefixMode === CUSTOM_SKU_PREFIX_VALUE;
  const tecatlTags = useMemo(
    () => getTecatlTagsFromCharacteristics(form.characteristics),
    [form.characteristics]
  );

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
          const loadedSkuPrefix = product.sku?.split('-')?.[0] || 'GEN';
          setCustomSkuMode(Boolean(loadedSkuPrefix && !SKU_PREFIXES.some((prefix) => prefix.value === loadedSkuPrefix)));
          setForm({
            ...emptyProduct,
            sku: product.sku || '',
            name: product.name || '',
            description: product.description || '',
            price: product.price ?? '',
            costPrice: product.costPrice ?? '',
            brand: product.brand || '',
            categoryId: product.categoryId || '',
            skuPrefix: loadedSkuPrefix,
            countInStock: product.countInStock ?? 0,
            productType: product.productType || 'IN_HOUSE',
            supplierStock: product.supplierStock ?? 0,
            supplierStockUnlimited: Boolean(product.supplierStockUnlimited),
            supplierLeadTimeMinutes: product.supplierLeadTimeMinutes ?? 60,
            supplierInfo: product.supplierInfo || '',
            youtubeUrl: product.youtubeUrl || '',
            shippingPayer: product.shippingPayer || 'CUSTOMER',
            shippingCostEstimate: product.shippingCostEstimate ?? '',
            weightKg: product.weightKg ?? '',
            lengthCm: product.lengthCm ?? '',
            widthCm: product.widthCm ?? '',
            heightCm: product.heightCm ?? '',
            meliItemId: product.meliItemId || '',
            meliPublicationUrl: product.meliPublicationUrl || '',
            lastMeliSync: product.lastMeliSync || '',
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

  const updateSkuPrefix = (value) => {
    updateField('skuPrefix', normalizeSkuPrefix(value));
  };

  const updateSkuPrefixMode = (value) => {
    if (value === CUSTOM_SKU_PREFIX_VALUE) {
      setCustomSkuMode(true);
      updateField('skuPrefix', '');
      return;
    }

    setCustomSkuMode(false);
    updateSkuPrefix(value);
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

  const addCharacteristicPreset = (preset) => {
    setForm((current) => {
      const emptyIndex = current.characteristics.findIndex((item) => !item.key && !item.value);
      if (emptyIndex >= 0) {
        return {
          ...current,
          characteristics: current.characteristics.map((item, index) =>
            index === emptyIndex ? preset : item
          ),
        };
      }

      return {
        ...current,
        characteristics: [...current.characteristics, preset],
      };
    });
  };

  const setTecatlTags = (tags) => {
    const cleanTags = [...new Set(tags.map(normalizeTag).filter(Boolean))];
    const tagValue = cleanTags.join(', ');

    setForm((current) => {
      const tagIndex = current.characteristics.findIndex(
        (item) => normalizeLabel(item.key) === normalizeLabel(TECATL_TAG_CHARACTERISTIC_KEY)
      );

      if (tagIndex >= 0) {
        const nextCharacteristics = current.characteristics.map((item, index) =>
          index === tagIndex
            ? { ...item, key: TECATL_TAG_CHARACTERISTIC_KEY, value: tagValue }
            : item
        );

        return { ...current, characteristics: nextCharacteristics };
      }

      if (!tagValue) return current;

      const emptyIndex = current.characteristics.findIndex((item) => !item.key && !item.value);
      if (emptyIndex >= 0) {
        return {
          ...current,
          characteristics: current.characteristics.map((item, index) =>
            index === emptyIndex ? { key: TECATL_TAG_CHARACTERISTIC_KEY, value: tagValue } : item
          ),
        };
      }

      return {
        ...current,
        characteristics: [
          ...current.characteristics,
          { key: TECATL_TAG_CHARACTERISTIC_KEY, value: tagValue },
        ],
      };
    });
  };

  const toggleTecatlTag = (tag) => {
    const cleanTag = normalizeTag(tag);
    if (!cleanTag) return;

    setTecatlTags(
      tecatlTags.includes(cleanTag)
        ? tecatlTags.filter((item) => item !== cleanTag)
        : [...tecatlTags, cleanTag]
    );
  };

  const addCustomTecatlTag = (event) => {
    event.preventDefault();
    const cleanTag = normalizeTag(customTecatlTag);
    if (!cleanTag) return;
    setTecatlTags([...tecatlTags, cleanTag]);
    setCustomTecatlTag('');
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

  const validateMeliPublication = async () => {
    const itemId = String(form.meliItemId || '').trim();
    if (!itemId) {
      setMeliError('Escribe el ID de la publicacion de Mercado Libre, por ejemplo MLM123456789.');
      setMeliMessage('');
      return;
    }

    setMeliLoading(true);
    setMeliError('');
    setMeliMessage('');

    try {
      const { data } = await api.get(`/mercadolibre/items/${encodeURIComponent(itemId)}`);
      const item = data.data || {};
      setMeliPreview(item);
      setMeliMessage(`Publicacion encontrada: ${item.title || item.id}. Stock Meli: ${item.available_quantity ?? 'sin dato'}.`);
    } catch (err) {
      setMeliPreview(null);
      setMeliError(err.response?.data?.message || 'No se pudo validar la publicacion de Mercado Libre.');
    } finally {
      setMeliLoading(false);
    }
  };

  const prepareMeliPublication = async () => {
    if (!isEditing) {
      setMeliError('Guarda primero el producto antes de preparar la publicacion.');
      return;
    }

    setMeliLoading(true);
    setMeliError('');
    setMeliMessage('');

    try {
      const { data } = await api.get('/mercadolibre/publication-requirements', {
        params: {
          title: form.name,
          productId: id,
          categoryId: meliPublishForm.categoryId || undefined,
        },
      });
      const requirements = data.data || {};
      setMeliRequirements(requirements);
      setMeliPublishForm((current) => ({
        ...current,
        categoryId: requirements.categoryId || current.categoryId,
        attributes: (requirements.attributes || []).reduce((result, attribute) => ({
          ...result,
          [attribute.id]: current.attributes[attribute.id] || (
            attribute.id === 'BRAND' ? form.brand : ''
          ),
        }), {}),
      }));
      setMeliMessage(
        requirements.inventory?.assignedStock > 0
          ? 'Ficha preparada. Revisa categoria, atributos y stock antes de publicar.'
          : 'Ficha preparada, pero primero debes traspasar piezas de Bodega/Web a Mercado Libre.'
      );
    } catch (err) {
      setMeliRequirements(null);
      setMeliError(err.response?.data?.message || 'No se pudo preparar la publicacion de Mercado Libre.');
    } finally {
      setMeliLoading(false);
    }
  };

  const updateMeliAttribute = (attributeId, value) => {
    setMeliPublishForm((current) => ({
      ...current,
      attributes: {
        ...current.attributes,
        [attributeId]: value,
      },
    }));
  };

  const publishMeliProduct = async () => {
    if (!meliRequirements) {
      setMeliError('Primero prepara y revisa la publicacion.');
      return;
    }

    const missingAttribute = (meliRequirements.attributes || []).find(
      (attribute) => attribute.required && !String(
        meliPublishForm.attributes[attribute.id] || ''
      ).trim()
    );
    if (missingAttribute) {
      setMeliError(`Completa el atributo obligatorio: ${missingAttribute.name}.`);
      return;
    }

    setMeliLoading(true);
    setMeliError('');
    setMeliMessage('');

    try {
      const attributes = Object.entries(meliPublishForm.attributes)
        .map(([attributeId, value]) => ({
          id: attributeId,
          value_name: String(value || '').trim(),
        }))
        .filter((attribute) => attribute.value_name);
      const { data } = await api.post(`/products/${encodeURIComponent(id)}/publish-meli`, {
        categoryId: meliPublishForm.categoryId,
        listingTypeId: meliPublishForm.listingTypeId,
        condition: meliPublishForm.condition,
        attributes,
      });
      const product = data.data?.product || {};
      const item = data.data?.item || {};
      setForm((current) => ({
        ...current,
        meliItemId: product.meliItemId || item.id || '',
        meliPublicationUrl: product.meliPublicationUrl || item.permalink || '',
        lastMeliSync: product.lastMeliSync || new Date().toISOString(),
      }));
      setMeliPreview(item);
      setMeliMessage(data.message || 'Producto publicado correctamente en Mercado Libre.');
    } catch (err) {
      setMeliError(err.response?.data?.message || 'No se pudo publicar el producto en Mercado Libre.');
    } finally {
      setMeliLoading(false);
    }
  };

  const linkMeliPublication = async () => {
    const itemId = String(form.meliItemId || '').trim();
    if (!isEditing || !itemId) {
      setMeliError('Guarda primero el producto y escribe el ID de publicacion de Mercado Libre.');
      setMeliMessage('');
      return;
    }

    setMeliLoading(true);
    setMeliError('');
    setMeliMessage('');

    try {
      const { data } = await api.put(`/products/${encodeURIComponent(id)}/link-meli`, { meliItemId: itemId });
      const product = data.data?.product || {};
      setForm((current) => ({
        ...current,
        meliItemId: product.meliItemId || itemId,
        meliPublicationUrl: product.meliPublicationUrl || current.meliPublicationUrl,
        lastMeliSync: product.lastMeliSync || '',
      }));
      const assignedStock = Number(data.data?.assignedStock || 0);
      const remoteStock = Number(data.data?.remoteStockBeforeLink || 0);
      setMeliMessage(
        `Publicacion vinculada. Mercado Libre tenia ${remoteStock} pieza(s) y Tecnotitlan la concilio a ${assignedStock} pieza(s) asignadas.`
      );
    } catch (err) {
      setMeliError(err.response?.data?.message || 'No se pudo vincular el producto con Mercado Libre.');
    } finally {
      setMeliLoading(false);
    }
  };

  const syncMeliStock = async () => {
    if (!form.sku) {
      setMeliError('No se encontro el SKU local para sincronizar.');
      setMeliMessage('');
      return;
    }

    setMeliLoading(true);
    setMeliError('');
    setMeliMessage('');

    try {
      const { data } = await api.put(`/mercadolibre/products/${encodeURIComponent(form.sku)}/sync`);
      setForm((current) => ({ ...current, lastMeliSync: new Date().toISOString() }));
      setMeliMessage(data.message || 'Stock sincronizado con Mercado Libre.');
    } catch (err) {
      setMeliError(err.response?.data?.message || 'No se pudo sincronizar el stock con Mercado Libre.');
    } finally {
      setMeliLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      ...form,
      price: Number(form.price),
      countInStock: Number(form.countInStock || 0),
      supplierStock: form.productType === 'SUPPLIER_ON_DEMAND' ? Number(form.supplierStock || 0) : 0,
      supplierStockUnlimited: form.productType === 'SUPPLIER_ON_DEMAND' && Boolean(form.supplierStockUnlimited),
      supplierLeadTimeMinutes: form.productType === 'SUPPLIER_ON_DEMAND'
        ? Number(form.supplierLeadTimeMinutes || 60)
        : 60,
      shippingCostEstimate: form.shippingCostEstimate === '' ? undefined : Number(form.shippingCostEstimate),
      weightKg: form.weightKg === '' ? undefined : Number(form.weightKg),
      lengthCm: form.lengthCm === '' ? undefined : Number(form.lengthCm),
      widthCm: form.widthCm === '' ? undefined : Number(form.widthCm),
      heightCm: form.heightCm === '' ? undefined : Number(form.heightCm),
      supplierInfo: ['DROPSHIPPING', 'SUPPLIER_ON_DEMAND'].includes(form.productType) ? form.supplierInfo : '',
      media: form.media.map(({ type, url, altText }) => ({ type, url, altText })),
      characteristics: form.characteristics.filter((item) => item.key && item.value),
    };

    if (!payload.skuPrefix) {
      delete payload.skuPrefix;
    }

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
              <select
                id="product-prefix"
                className={styles.select}
                value={selectedSkuPrefixMode}
                onChange={(event) => updateSkuPrefixMode(event.target.value)}
                disabled={isEditing}
              >
                <option value="">Auto por categoria</option>
                {SKU_PREFIXES.map((prefix) => (
                  <option key={prefix.value} value={prefix.value}>{prefix.label}</option>
                ))}
                <option value={CUSTOM_SKU_PREFIX_VALUE}>Crear prefijo nuevo...</option>
              </select>
              {isCustomSkuPrefix && (
                <input
                  className={styles.input}
                  value={form.skuPrefix}
                  onChange={(event) => updateSkuPrefix(event.target.value)}
                  minLength="2"
                  maxLength="3"
                  placeholder="Ej. PWB"
                  disabled={isEditing}
                />
              )}
              <small className={styles.muted}>
                Usa Auto para que Tecnotitlan lo infiera, selecciona una clave existente o crea una nueva de 2 a 3 caracteres.
              </small>
              {isEditing && <small className={styles.muted}>El SKU no se cambia despues de creado para no romper ventas.</small>}
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="product-type">Tipo</label>
              <select id="product-type" className={styles.select} value={form.productType} onChange={(event) => updateField('productType', event.target.value)}>
                <option value="IN_HOUSE">Inventario propio</option>
                <option value="SUPPLIER_ON_DEMAND">Proveedor local / bajo pedido</option>
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
              <label className={styles.label} htmlFor="product-stock">Stock inicial propio</label>
              <input id="product-stock" className={styles.input} type="number" min="0" value={form.countInStock} onChange={(event) => updateField('countInStock', event.target.value)} />
              <small className={styles.muted}>Solo piezas que ya compraste. Usa Inventario para registrar entradas reales.</small>
            </div>
            {form.productType === 'SUPPLIER_ON_DEMAND' && (
              <>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="supplier-unlimited">Disponibilidad del proveedor</label>
                  <label className={styles.checkboxLabel} htmlFor="supplier-unlimited">
                    <input
                      id="supplier-unlimited"
                      type="checkbox"
                      checked={form.supplierStockUnlimited}
                      onChange={(event) => updateField('supplierStockUnlimited', event.target.checked)}
                    />
                    El proveedor lo surte de forma constante
                  </label>
                  <small className={styles.muted}>No afecta tu inversión hasta que exista una venta.</small>
                </div>
                {!form.supplierStockUnlimited && (
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="supplier-stock">Stock confirmado con proveedor</label>
                    <input id="supplier-stock" className={styles.input} type="number" min="0" value={form.supplierStock} onChange={(event) => updateField('supplierStock', event.target.value)} />
                    <small className={styles.muted}>Se suma a lo disponible, pero no se cuenta como bodega propia.</small>
                  </div>
                )}
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="supplier-lead-time">Tiempo de abastecimiento (minutos)</label>
                  <input id="supplier-lead-time" className={styles.input} type="number" min="0" value={form.supplierLeadTimeMinutes} onChange={(event) => updateField('supplierLeadTimeMinutes', event.target.value)} />
                  <small className={styles.muted}>Ejemplo: 60 si tu proveedor lo entrega en una hora.</small>
                </div>
              </>
            )}
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

            {isEditing && (
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label className={styles.label}>Mercado Libre</label>
                <div className={styles.assistBox}>
                  {!form.meliItemId && (
                    <>
                      <strong>Publicar desde Tecnotitlan</strong>
                      <small>
                        Tecnotitlan creara la publicacion, guardara el item ID y enviara solamente el stock
                        que hayas traspasado a Mercado Libre.
                      </small>
                      <div className={styles.inlineForm}>
                        <button
                          className={styles.secondaryButton}
                          type="button"
                          onClick={prepareMeliPublication}
                          disabled={meliLoading}
                        >
                          {meliRequirements ? 'Actualizar preparacion' : 'Preparar publicacion'}
                        </button>
                      </div>
                      {meliRequirements && (
                        <>
                          <div className={styles.inventorySummary}>
                            <span>Bodega/Web <strong>{meliRequirements.inventory?.warehouseStock ?? 0}</strong></span>
                            <span>Asignado a Meli <strong>{meliRequirements.inventory?.assignedStock ?? 0}</strong></span>
                            <span>Publicable <strong>{meliRequirements.inventory?.publishableStock ?? 0}</strong></span>
                          </div>
                          <small>
                            Categoria sugerida: <strong>
                              {meliRequirements.categoryName || meliRequirements.categoryId}
                            </strong>
                            {meliRequirements.domainName ? ` / ${meliRequirements.domainName}` : ''}
                          </small>
                          <div className={styles.formGrid}>
                            <div className={styles.field}>
                              <label className={styles.label} htmlFor="meli-category">Categoria Meli</label>
                              <input
                                id="meli-category"
                                className={styles.input}
                                value={meliPublishForm.categoryId}
                                onChange={(event) => setMeliPublishForm((current) => ({
                                  ...current,
                                  categoryId: event.target.value.trim().toUpperCase(),
                                }))}
                              />
                            </div>
                            <div className={styles.field}>
                              <label className={styles.label} htmlFor="meli-listing-type">Tipo de publicacion</label>
                              <select
                                id="meli-listing-type"
                                className={styles.select}
                                value={meliPublishForm.listingTypeId}
                                onChange={(event) => setMeliPublishForm((current) => ({
                                  ...current,
                                  listingTypeId: event.target.value,
                                }))}
                              >
                                <option value="gold_special">Clasica</option>
                                <option value="gold_pro">Premium</option>
                              </select>
                            </div>
                            <div className={styles.field}>
                              <label className={styles.label} htmlFor="meli-condition">Condicion</label>
                              <select
                                id="meli-condition"
                                className={styles.select}
                                value={meliPublishForm.condition}
                                onChange={(event) => setMeliPublishForm((current) => ({
                                  ...current,
                                  condition: event.target.value,
                                }))}
                              >
                                <option value="new">Nuevo</option>
                                <option value="used">Usado</option>
                              </select>
                            </div>
                          </div>
                          {(meliRequirements.attributes || []).length > 0 && (
                            <div className={styles.meliAttributeGrid}>
                              {(meliRequirements.attributes || []).map((attribute) => (
                                <div className={styles.field} key={attribute.id}>
                                  <label className={styles.label} htmlFor={`meli-${attribute.id}`}>
                                    {attribute.name}{attribute.required ? ' *' : ''}
                                  </label>
                                  {attribute.allowCustomValue ? (
                                    <>
                                      <input
                                        id={`meli-${attribute.id}`}
                                        list={`meli-${attribute.id}-suggestions`}
                                        className={styles.input}
                                        value={meliPublishForm.attributes[attribute.id] || ''}
                                        onChange={(event) => updateMeliAttribute(attribute.id, event.target.value)}
                                        placeholder={attribute.hint || `Escribe la ${attribute.name.toLowerCase()} real`}
                                        maxLength={attribute.valueMaxLength || undefined}
                                      />
                                      <datalist id={`meli-${attribute.id}-suggestions`}>
                                        {(attribute.values || []).map((value) => (
                                          <option key={value.id || value.name} value={value.name} />
                                        ))}
                                      </datalist>
                                      <small className={styles.fieldHint}>
                                        Escribe la marca real si no aparece en las sugerencias.
                                      </small>
                                    </>
                                  ) : attribute.values?.length ? (
                                    <select
                                      id={`meli-${attribute.id}`}
                                      className={styles.select}
                                      value={meliPublishForm.attributes[attribute.id] || ''}
                                      onChange={(event) => updateMeliAttribute(attribute.id, event.target.value)}
                                    >
                                      <option value="">Selecciona</option>
                                      {attribute.values.map((value) => (
                                        <option key={value.id || value.name} value={value.name}>
                                          {value.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      id={`meli-${attribute.id}`}
                                      className={styles.input}
                                      value={meliPublishForm.attributes[attribute.id] || ''}
                                      onChange={(event) => updateMeliAttribute(attribute.id, event.target.value)}
                                      maxLength={attribute.valueMaxLength || undefined}
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          <button
                            className={styles.button}
                            type="button"
                            onClick={publishMeliProduct}
                            disabled={meliLoading || Number(meliRequirements.inventory?.publishableStock || 0) <= 0}
                          >
                            Publicar en Mercado Libre
                          </button>
                        </>
                      )}
                    </>
                  )}
                  <strong>{form.meliItemId ? 'Publicacion vinculada' : 'Vincular una publicacion existente'}</strong>
                  <small>
                    Si la publicacion ya existe, pega su ID. Al vincularla, el stock remoto se reemplazara
                    por las piezas realmente asignadas desde Inventario.
                  </small>
                  {!form.meliItemId && (
                    <small>
                      Primero realiza el traspaso Bodega/Web → Mercado Libre. Sin stock asignado,
                      Tecnotitlan no permitira guardar el vinculo ni modificar la publicacion remota.
                    </small>
                  )}
                  <div className={styles.inlineForm}>
                    <input
                      className={styles.input}
                      value={form.meliItemId}
                      onChange={(event) => {
                        updateField('meliItemId', event.target.value.trim());
                        setMeliPreview(null);
                        setMeliError('');
                        setMeliMessage('');
                      }}
                      placeholder="Ej. MLM123456789"
                    />
                    <button className={styles.secondaryButton} type="button" onClick={validateMeliPublication} disabled={meliLoading}>
                      Validar
                    </button>
                    <button className={styles.secondaryButton} type="button" onClick={linkMeliPublication} disabled={meliLoading}>
                      Guardar vinculo
                    </button>
                    <button className={styles.button} type="button" onClick={syncMeliStock} disabled={meliLoading || !form.meliItemId}>
                      Sincronizar stock
                    </button>
                  </div>
                  {form.meliPublicationUrl && (
                    <a href={form.meliPublicationUrl} target="_blank" rel="noreferrer">
                      Abrir publicacion en Mercado Libre
                    </a>
                  )}
                  {form.lastMeliSync && (
                    <small>Ultima sincronizacion: {new Date(form.lastMeliSync).toLocaleString()}</small>
                  )}
                  {meliPreview && (
                    <small>
                      Meli: <strong>{meliPreview.title || meliPreview.id}</strong>
                      {meliPreview.status ? ` / Estado: ${meliPreview.status}` : ''}
                    </small>
                  )}
                  {meliMessage && <div className={styles.success}>{meliMessage}</div>}
                  {meliError && <div className={styles.error}>{meliError}</div>}
                </div>
              </div>
            )}

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
                          [index]: item.previewUrl
                            ? 'No se pudo mostrar la vista previa local. Vuelve a seleccionar el archivo antes de guardar.'
                            : 'La imagen no esta disponible publicamente. Guarda el producto para organizarla por SKU; si persiste, revisa el volumen /app/uploads.',
                        }));
                        event.currentTarget.src = FALLBACK_PRODUCT_IMAGE;
                      }}
                      onLoad={() => {
                        setImageWarnings((current) => {
                          const next = { ...current };
                          delete next[index];
                          return next;
                        });
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
              <div className={styles.assistBox}>
                <strong>Para que Tecatl recomiende mejor</strong>
                <small>
                  Agrega usos, etiquetas y compatibilidad. Asi cuando alguien diga "voy a viajar" o "necesito bateria",
                  Tecatl puede encontrar productos aunque no diga el nombre exacto.
                </small>
                <div className={styles.tagCloud} aria-label="Etiquetas para Tecatl">
                  {TECATL_TAG_OPTIONS.map((tag) => {
                    const isSelected = tecatlTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        className={`${styles.tagChip} ${isSelected ? styles.tagChipActive : ''}`}
                        type="button"
                        onClick={() => toggleTecatlTag(tag)}
                        aria-pressed={isSelected}
                      >
                        {isSelected ? '✓ ' : '+ '}{tag}
                      </button>
                    );
                  })}
                </div>
                <div className={styles.inlineForm}>
                  <input
                    className={styles.input}
                    value={customTecatlTag}
                    onChange={(event) => setCustomTecatlTag(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') addCustomTecatlTag(event);
                    }}
                    placeholder="Agregar etiqueta personalizada, ej. campismo"
                  />
                  <button className={styles.secondaryButton} type="button" onClick={addCustomTecatlTag}>
                    Agregar etiqueta
                  </button>
                </div>
                {tecatlTags.length > 0 && (
                  <small>
                    Activas: <strong>{tecatlTags.join(', ')}</strong>
                  </small>
                )}
                <div className={styles.inlineActions}>
                  {TECATL_CHARACTERISTIC_PRESETS.map((preset) => (
                    <button
                      key={preset.key}
                      className={styles.secondaryButton}
                      type="button"
                      onClick={() => addCharacteristicPreset(preset)}
                    >
                      + {preset.key}
                    </button>
                  ))}
                </div>
              </div>
              {form.characteristics.map((item, index) => (
                <div className={styles.formGrid} key={index} style={{ marginBottom: '0.75rem' }}>
                  <input className={styles.input} value={item.key} onChange={(event) => updateCharacteristic(index, 'key', event.target.value)} placeholder="Ej. Capacidad" />
                  <input className={styles.input} value={item.value} onChange={(event) => updateCharacteristic(index, 'value', event.target.value)} placeholder="Ej. 20,000 mAh" />
                  <button className={styles.dangerButton} type="button" onClick={() => removeCharacteristic(index)}>Quitar</button>
                </div>
              ))}
              <button className={styles.secondaryButton} type="button" onClick={addCharacteristic}>+ Agregar especificacion</button>
            </div>

            {['DROPSHIPPING', 'SUPPLIER_ON_DEMAND'].includes(form.productType) && (
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

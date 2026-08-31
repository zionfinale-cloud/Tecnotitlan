import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/apiService';
import { useRealtimeRefresh } from './useRealtimeRefresh';

const COLLECTIONS = {
  offers: { title: 'Ofertas', endpoint: '/products', params: { sortBy: 'price_asc' } },
  new: { title: 'Novedades', endpoint: '/products', params: { sortBy: 'createdAt_desc' } },
  top: { title: 'Más vendidos', endpoint: '/products/top', params: {} },
  all: { title: 'Todos los productos', endpoint: '/products', params: {} },
};

const useProductFilters = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pages, setPages] = useState(1);
  const requestSequence = useRef(0);
  const page = Number(searchParams.get('page')) || 1;
  const selectedCategory = searchParams.get('category') || '';
  const collectionKey = searchParams.get('collection') || 'all';
  const collection = COLLECTIONS[collectionKey] || COLLECTIONS.all;

  const updateParams = useCallback((updates) => {
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
      return next;
    });
  }, [setSearchParams]);

  const loadCategories = useCallback(() => api.get('/categories')
      .then(({ data }) => setCategories(data.data.categories || []))
      .catch(() => setCategories([])), []);

  const loadProducts = useCallback(async ({ silent = false } = {}) => {
    const sequence = ++requestSequence.current;
    if (!silent) setLoading(true);
    setError('');
    const params = { ...collection.params, pageNumber: page, pageSize: 12, ...(selectedCategory ? { category: selectedCategory } : {}) };

    try {
      const { data } = await api.get(collection.endpoint, { params });
      if (sequence !== requestSequence.current) return;
      setProducts(data.data.products || []);
      setPages(data.data.pages || 1);
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      if (!silent) {
        setProducts([]);
        setPages(1);
        setError('No pudimos cargar el catálogo. Estamos revisando la conexión.');
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [collection, page, selectedCategory]);

  useRealtimeRefresh(['products', 'catalog', 'inventory'], () => {
    loadProducts({ silent: true });
    loadCategories();
  });

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  return {
    products, loading, error, page, pages, categories, selectedCategory,
    setPage: value => updateParams({ page: value > 1 ? String(value) : '' }),
    setSelectedCategory: slug => updateParams({ category: slug, page: '', collection: slug ? 'all' : collectionKey }),
    collectionTitle: selectedCategory ? categories.find(category => category.slug === selectedCategory)?.name || 'Categoría' : collection.title,
    clearFilters: () => updateParams({ category: '', collection: 'all', page: '' }),
  };
};

export default useProductFilters;

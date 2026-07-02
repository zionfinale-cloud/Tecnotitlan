import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/apiService';

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

  useEffect(() => {
    api.get('/categories')
      .then(({ data }) => setCategories(data.data.categories || []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const params = { ...collection.params, pageNumber: page, pageSize: 12, ...(selectedCategory ? { category: selectedCategory } : {}) };

    api.get(collection.endpoint, { params })
      .then(({ data }) => {
        if (!active) return;
        setProducts(data.data.products || []);
        setPages(data.data.pages || 1);
      })
      .catch(() => {
        if (!active) return;
        setProducts([]);
        setPages(1);
        setError('No pudimos cargar el catálogo. Estamos revisando la conexión.');
      })
      .finally(() => active && setLoading(false));

    return () => { active = false; };
  }, [collection, page, selectedCategory]);

  return {
    products, loading, error, page, pages, categories, selectedCategory,
    setPage: value => updateParams({ page: value > 1 ? String(value) : '' }),
    setSelectedCategory: slug => updateParams({ category: slug, page: '', collection: slug ? 'all' : collectionKey }),
    collectionTitle: selectedCategory ? categories.find(category => category.slug === selectedCategory)?.name || 'Categoría' : collection.title,
    clearFilters: () => updateParams({ category: '', collection: 'all', page: '' }),
  };
};

export default useProductFilters;

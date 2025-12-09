import { useState, useEffect } from 'react';
import { useApi } from './useApi';
import { useDebounce } from './useDebounce';

const useProductFilters = () => {
    // Estados para los filtros
    const [page, setPage] = useState(1);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [keyword, setKeyword] = useState('');
    const debouncedKeyword = useDebounce(keyword, 500); // Aplica debounce a la búsqueda

    // Hooks para las llamadas a la API
    const { data: productData, loading: productsLoading, error: productsError, request: fetchProducts } = useApi();
    const { data: categoriesData, loading: categoriesLoading, error: categoriesError, request: fetchCategories } = useApi();

    // Efecto para cargar las categorías una sola vez al montar el hook
    useEffect(() => {
        fetchCategories('get', '/categories');
    }, [fetchCategories]);

    // Efecto para cargar los productos cada vez que cambian los filtros (página, categoría, búsqueda)
    useEffect(() => {
        const getProducts = () => {
            // Construimos los query params dinámicamente
            const params = new URLSearchParams();
            if (debouncedKeyword) params.append('keyword', debouncedKeyword);
            if (selectedCategory) params.append('category', selectedCategory);
            if (page) params.append('page', page);

            const queryString = params.toString();
            fetchProducts('get', `/products?${queryString}`);
        };

        getProducts();
    }, [page, selectedCategory, debouncedKeyword, fetchProducts]);

    const handleClearFilters = () => {
        setSelectedCategory('');
        setKeyword('');
        setPage(1);
    };

    return {
        // Datos y estados de productos
        products: productData?.data?.products || [],
        loading: productsLoading,
        error: productsError,
        page,
        setPage,
        pages: productData?.data?.pages || 1,
        // Datos y estados de categorías
        categories: categoriesData?.data || [],
        categoriesLoading,
        categoriesError,
        // Filtros y acciones
        selectedCategory,
        setSelectedCategory,
        keyword,
        setKeyword,
        handleClearFilters,
    };
};

export default useProductFilters;
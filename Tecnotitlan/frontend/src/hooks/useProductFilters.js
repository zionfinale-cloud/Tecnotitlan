import { useState, useEffect } from 'react';
// import api from '../services/apiService';

// --- MOCK DATA para que el frontend cargue ---
const MOCK_CATEGORIES = [
    { id: 1, name: 'Drones' },
    { id: 2, name: 'Realidad Virtual' },
    { id: 3, name: 'Smartwatches' },
    { id: 4, name: 'Accesorios' },
];

const MOCK_PRODUCTS = [
  { _id: '1', name: 'Deona Pexnnices (Smartwatch)', price: 199.99, sku: 'DRN001', rating: 4.5, numReviews: 12, countInStock: 5, image: 'https://placehold.co/400x300/F1F5F9/0F172A?text=WATCH' },
  { _id: '2', name: 'Trps del Tib (VR Headset)', price: 299.99, sku: 'VR001', rating: 5, numReviews: 25, countInStock: 10, isOffer: true, image: 'https://placehold.co/400x300/F1F5F9/0F172A?text=VR+HEADSET' },
  { _id: '3', name: 'Pnda de Tvler (Batería)', price: 49.99, sku: 'DRN002', rating: 3.5, numReviews: 8, countInStock: 0, image: 'https://placehold.co/400x300/F1F5F9/0F172A?text=BATTERY' },
  { _id: '4', name: 'Datns eq Pcnitations (VR Glasses)', price: 129.99, sku: 'DRN003', rating: 4, numReviews: 15, countInStock: 3, image: 'https://placehold.co/400x300/F1F5F9/0F172A?text=VR+GLASSES' },
  { _id: '5', name: 'Auriculares Inalámbricos', price: 79.50, sku: 'AUR005', rating: 4.2, numReviews: 20, countInStock: 8, image: 'https://placehold.co/400x300/F1F5F9/0F172A?text=AURICULARES' },
];
// --- FIN MOCK DATA ---


const useProductFilters = () => {
    // Estado de la URL (simulación de router/query params)
    const [page, setPage] = useState(1);
    const [selectedCategory, setSelectedCategory] = useState('');

    // Estado de la data
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [pages, setPages] = useState(1); // Total de páginas

    // Simulación de la llamada a la API
    useEffect(() => {
        setLoading(true);
        setError(null);
        
        // Simular un retraso en la red (ej: 500ms)
        const timer = setTimeout(() => {
            let filtered = MOCK_PRODUCTS;
            
            // Simulación de filtrado por categoría
            if (selectedCategory) {
                filtered = MOCK_PRODUCTS.filter(p => 
                    p.name.toLowerCase().includes(selectedCategory.toLowerCase()) 
                );
            }

            // Simulación de paginación (simplemente devolvemos los productos filtrados)
            setProducts(filtered);
            setPages(Math.ceil(filtered.length / 4)); // Simula 4 productos por página
            setLoading(false);
        }, 500); 

        return () => clearTimeout(timer); 
    }, [page, selectedCategory]);

    const handleClearFilters = () => {
        setSelectedCategory('');
        setPage(1);
    };

    return {
        products,
        loading,
        error,
        page,
        setPage,
        pages,
        categories: MOCK_CATEGORIES,
        selectedCategory,
        setSelectedCategory,
        handleClearFilters,
    };
};

export default useProductFilters;
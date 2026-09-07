import React, { createContext, useState, useEffect } from 'react';

// Valores por defecto
export const CartContext = createContext({
    cartItems: [],
    isItemJustAdded: false, // Usado para disparar animaciones en el Header
    addToCart: () => {},
    removeFromCart: () => {},
    updateCartItemQty: () => {},
    clearCart: () => {}
});

export const CartProvider = ({ children }) => {
    // Estado del carrito: array de ítems
    const [cartItems, setCartItems] = useState(() => {
        try {
            const storedCart = localStorage.getItem('cartItems');
            return storedCart ? JSON.parse(storedCart) : [];
        } catch (error) {
            localStorage.removeItem('cartItems');
            return [];
        }
    });
    // Estado booleano para la animación del carrito
    const [isItemJustAdded, setIsItemJustAdded] = useState(false); 

    // Guardar en localStorage cada vez que cartItems cambia.
    useEffect(() => {
        localStorage.setItem('cartItems', JSON.stringify(cartItems));
    }, [cartItems]);

    /**
     * Agrega o actualiza un artículo en el carrito.
     * @param {object} item - { product: ID, name: string, price: number, image: string, qty: number }
     */
    const addToCart = (item) => {
        setCartItems(prev => {
            const existItem = prev.find(x => x.product === item.product);
            
            if (existItem) {
                // Si el item existe, actualizamos completamente el item (incluyendo qty)
                return prev.map(x => x.product === existItem.product ? item : x);
            } else {
                // Si no existe, lo añade
                return [...prev, item];
            }
        });
        
        // Disparar la animación en el header por 1 segundo
        setIsItemJustAdded(true);
        setTimeout(() => setIsItemJustAdded(false), 1000);
    };

    /**
     * Elimina completamente un artículo del carrito.
     * @param {string} id - ID del producto
     */
    const removeFromCart = (id) => {
        setCartItems(prev => prev.filter(x => x.product !== id));
    };
    
    /**
     * Actualiza la cantidad de un artículo.
     */
    const updateCartItemQty = (id, newQty) => {
        setCartItems(prev => {
            if (newQty <= 0) {
                // Eliminar el producto si la cantidad es 0
                return prev.filter(x => x.product !== id);
            }
            // Actualizar la cantidad del producto
            return prev.map(x => x.product === id ? { ...x, qty: newQty } : x);
        });
    }
    
    const clearCart = () => {
        setCartItems([]);
    }

    return (
        <CartContext.Provider value={{ cartItems, isItemJustAdded, addToCart, removeFromCart, updateCartItemQty, clearCart }}>
            {children}
        </CartContext.Provider>
    );
};

import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from 'react-bootstrap';
// Asumo que tienes un componente Rating en el mismo directorio
import Rating from './Rating'; 
import { useContext } from 'react';
import { CartContext } from '../context/CartContext'; // Para la funcionalidad del carrito

const Product = ({ product }) => {
  const { addToCart } = useContext(CartContext);

  const isOffer = product.isOffer || product.discountPercentage > 0;

  // Manejador para añadir al carrito
  const addToCartHandler = () => {
    // Aquí asumo que la estructura de tu producto tiene un ID y una cantidad mínima de 1
    addToCart({
      product: product.id || product._id, // Usar el ID del producto
      name: product.name,
      price: product.price,
      image: product.image || product.media?.[0]?.url, // Usar la imagen correcta
      qty: 1,
    });
  };

  return (
    // La Card ahora tiene estilos Tailwind para el efecto flotante
    <Card 
      className="my-3 p-3 rounded-xl border-0 h-full flex flex-col transition-all duration-300 hover:shadow-2xl hover:-translate-y-1"
      style={{ 
        backgroundColor: 'var(--card-bg-color)',
        boxShadow: '0 8px 25px rgba(0,0,0,0.05)', // Sombra base sutil
        overflow: 'hidden'
      }}
    >
      {isOffer && (
        <div className="absolute top-0 right-0 bg-red-600 text-white text-xs font-bold py-1 px-3 rounded-bl-xl z-10">
          OFERTA!
        </div>
      )}

      {/* Imagen del Producto */}
      <Link to={`/product/${product.sku}`} className="text-decoration-none">
        <div className="overflow-hidden bg-gray-50 p-4 flex items-center justify-center h-[200px] mb-3 relative">
            <Card.Img 
              src={product.image || product.media?.[0]?.url || '/images/sample.jpg'} 
              variant="top" 
              className="object-contain max-h-[160px] transition-transform duration-500 hover:scale-110" 
              alt={product.name}
            />
        </div>
      </Link>

      <Card.Body className="px-1 pb-2 flex flex-col flex-grow">
        {/* Título */}
        <Link to={`/product/${product.sku}`} className="text-decoration-none flex-grow">
          <Card.Title as="div" className="product-title mb-2 h-12">
            <strong className="text-base font-medium text-slate-800 line-clamp-2 hover:text-cyan-600 transition-colors">
                {product.name}
            </strong>
          </Card.Title>
        </Link>

        {/* Rating */}
        <Card.Text as="div" className="mb-2">
          {/* Asegúrate de que Rating reciba los props correctos */}
          <Rating value={product.rating || 0} text={`${product.numReviews || 0} reviews`} />
        </Card.Text>

        {/* Precio y Botón CTA */}
        <div className="d-flex items-center justify-content-between mt-3 gap-2">
            <Card.Text as="h3" className="mb-0 text-xl font-extrabold text-[#0F172A] flex-grow">
              ${product.price.toFixed(2)}
            </Card.Text>
            
            <Button 
                onClick={addToCartHandler} 
                className="btn-primary rounded-full px-4 py-2 text-sm shadow-md hover:shadow-lg flex items-center justify-center"
                disabled={product.countInStock === 0}
            >
                {product.countInStock === 0 ? 'Sin Stock' : <i className="fas fa-cart-plus"></i>}
            </Button>
        </div>
      </Card.Body>
    </Card>
  );
};

// ** Importante: Asumo que tienes un Rating.js. Si no lo tienes, usa este dummy temporal: **
const Rating = ({ value, text }) => (
    <div className="d-flex align-items-center text-sm text-gray-500">
        {[1, 2, 3, 4, 5].map(index => (
            <i 
                key={index} 
                className={
                    value >= index 
                        ? 'fas fa-star text-yellow-400' 
                        : value >= index - 0.5 
                        ? 'fas fa-star-half-alt text-yellow-400' 
                        : 'far fa-star text-gray-300'
                }
            ></i>
        ))}
        <span className="ms-2 text-xs text-gray-500">{text}</span>
    </div>
);


export default Product;
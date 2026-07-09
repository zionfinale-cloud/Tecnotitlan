import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/apiService';
import { canViewCosts } from '../../utils/permissions';
import styles from './ProductListScreen.module.css';

const ProductListScreen = () => {
  const { userInfo } = useContext(AuthContext);
  const showCosts = canViewCosts(userInfo);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadProducts = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/products', {
        params: {
          pageSize: 100,
          keyword: keyword || undefined,
          showArchived,
        },
      });
      setProducts(data.data.products || []);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar los productos.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
    const interval = setInterval(() => {
      loadProducts({ silent: true });
    }, 20000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  const archiveProduct = async (product) => {
    if (!window.confirm(`¿Archivar "${product.name}"?`)) return;

    setError('');
    setSuccess('');
    try {
      await api.delete(`/products/${product.sku}`);
      setSuccess('Producto archivado.');
      await loadProducts();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo archivar el producto.');
    }
  };

  const restoreProduct = async (product) => {
    setError('');
    setSuccess('');
    try {
      await api.put(`/products/${product.sku}/unarchive`);
      setSuccess('Producto restaurado.');
      await loadProducts();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo restaurar el producto.');
    }
  };

  return (
    <>
      <div className={styles.toolbar}>
        <div>
          <h1 className={styles.title}>Gestión de Productos</h1>
          <p className={styles.subtitle}>Carga catálogo real, costos, precios y stock desde el admin.</p>
        </div>
        <Link className={styles.button} to="/admin/product/create">
          + Nuevo producto
        </Link>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <form
            className={styles.toolbar}
            onSubmit={(event) => {
              event.preventDefault();
              loadProducts();
            }}
          >
            <input
              className={styles.input}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Buscar por nombre o SKU"
              style={{ minWidth: 260 }}
            />
            <button className={styles.secondaryButton} type="submit">Buscar</button>
          </form>
          <label className={styles.muted}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />{' '}
            Ver archivados
          </label>
        </div>

        {loading ? (
          <div className={styles.empty}>Cargando productos...</div>
        ) : products.length === 0 ? (
          <div className={styles.empty}>No hay productos en esta vista. Crea el primero cuando tengas una categoría lista.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Precio</th>
                  {showCosts && <th>Costo</th>}
                  <th>Stock</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>{product.sku}</td>
                    <td>{product.name}</td>
                    <td>{product.category?.name || 'Sin categoría'}</td>
                    <td>${Number(product.price || 0).toFixed(2)}</td>
                    {showCosts && <td>${Number(product.costPrice || 0).toFixed(2)}</td>}
                    <td>{product.countInStock}</td>
                    <td>{product.isArchived ? 'Archivado' : 'Activo'}</td>
                    <td>
                      <Link className={styles.secondaryButton} to={`/admin/product/${product.sku}/edit`}>
                        Editar
                      </Link>{' '}
                      {product.isArchived ? (
                        <button className={styles.secondaryButton} type="button" onClick={() => restoreProduct(product)}>
                          Restaurar
                        </button>
                      ) : (
                        <button className={styles.dangerButton} type="button" onClick={() => archiveProduct(product)}>
                          Archivar
                        </button>
                      )}
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

export default ProductListScreen;

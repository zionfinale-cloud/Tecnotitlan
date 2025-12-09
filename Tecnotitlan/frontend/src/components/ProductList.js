import React from 'react';
import { Row, Col } from 'react-bootstrap';
import Product from './Product';
import Paginate from './Paginate';
import styles from './ProductList.module.css';

const ProductList = ({ products, loading, error, pages, page, setPage }) => {
    return (
        <>
            {(!products || products.length === 0) ? (
                <div className={styles.emptyContainer}>
                    <i className={`fas fa-box-open ${styles.emptyIcon}`}></i>
                    <h4 className={styles.emptyTitle}>¡Lo sentimos! No hay productos en esta sección.</h4>
                </div>
            ) : (
                <>
                    <Row>
                        {products.map((product) => (
                            <Col
                                key={product._id}
                                xs={12} sm={6} md={4} lg={3}
                                className={styles.gridCol}>
                                <Product product={product} />
                            </Col>
                        ))}
                    </Row>
                    
                    {(pages > 1) && (
                        <div className="d-flex justify-content-center mt-5">
                            <Paginate pages={pages} page={page} setPage={setPage} />
                        </div>
                    )}
                </>
            )}
        </>
    );
};

export default ProductList;
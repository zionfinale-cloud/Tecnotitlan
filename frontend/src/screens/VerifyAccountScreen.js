import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const VerifyAccountScreen = () => {
    const { token } = useParams();
    const { verifyAccount } = useContext(AuthContext);
    const [status, setStatus] = useState('loading'); // loading, success, error
    const [message, setMessage] = useState('');

    useEffect(() => {
        const verify = async () => {
            try {
                const response = await verifyAccount(token);
                if (response.status === 'success') {
                    setStatus('success');
                    setMessage('¡Tu cuenta ha sido activada exitosamente! Ya puedes comprar.');
                } else {
                    setStatus('error');
                    setMessage(response.message || 'No se pudo activar la cuenta.');
                }
            } catch (error) {
                setStatus('error');
                setMessage(error.response?.data?.message || 'El enlace es inválido o ha expirado.');
            }
        };

        if (token) {
            verify();
        } else {
            setStatus('error');
            setMessage('Token de verificación no proporcionado.');
        }
    }, [token, verifyAccount]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
                {status === 'loading' && (
                    <>
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--cta-color)] mx-auto mb-4"></div>
                        <h2 className="text-2xl font-bold text-gray-800">Verificando cuenta...</h2>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                            <i className="fas fa-check text-green-600 text-xl"></i>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Cuenta Activada!</h2>
                        <p className="text-gray-600 mb-6">{message}</p>
                        <Link to="/login" className="inline-block bg-[var(--cta-color)] text-white font-bold py-2 px-6 rounded hover:opacity-90 transition duration-200">
                            Iniciar Sesión
                        </Link>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                            <i className="fas fa-times text-red-600 text-xl"></i>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Error de Activación</h2>
                        <p className="text-gray-600 mb-6">{message}</p>
                        <Link to="/" className="text-[var(--cta-color)] hover:underline">
                            Volver al inicio
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
};

export default VerifyAccountScreen;
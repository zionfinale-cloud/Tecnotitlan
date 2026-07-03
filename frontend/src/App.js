import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';

// --- CONTEXTOS (Proveedores de Estado Global) ---
// Importaciones centralizadas desde los archivos "barril" en /context y /components
import {
    AuthProvider,
    SettingsProvider,
    CartProvider, // Importado desde el barril
    NotificationProvider,
    ToastProvider,
    LoadingProvider,
} from 'context';

// --- LAYOUTS ---
import { Layout, AdminLayout, ProtectedRoute } from 'components';

// --- SCREENS (Páginas) ---
// Las pantallas se mantienen con rutas relativas, ya que no se agrupan en un barril.
import HomeScreen from './screens/HomeScreen';
import ProductScreen from './screens/ProductScreen';
import CartScreen from './screens/CartScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import ProfileScreen from './screens/ProfileScreen';
import ShippingScreen from './screens/ShippingScreen';
import PaymentScreen from './screens/PaymentScreen';
import PlaceOrderScreen from './screens/PlaceOrderScreen';
import OrderScreen from './screens/OrderScreen';
// Admin Screens
import AdminDashboard from './screens/admin/AdminDashboard';
import ProductListScreen from './screens/admin/ProductListScreen';
import OrderListScreen from './screens/admin/OrderListScreen';
import UserListScreen from './screens/admin/UserListScreen';
import ProductEditScreen from './screens/admin/ProductEditScreen';
import UserEditScreen from './screens/admin/UserEditScreen';
import CategoryListScreen from './screens/admin/CategoryListScreen';
import RoleListScreen from './screens/admin/RoleListScreen';
import WhatsappSettingsScreen from './screens/admin/WhatsappSettingsScreen';
import SettingsPage from './screens/admin/SettingsPage'; // Contenedor de sub-rutas
import LegalPagesScreen from './screens/admin/LegalPagesScreen';
import PrivacyPolicy from './screens/PrivacyPolicy';
import TermsOfService from './screens/TermsOfService';
import ContactScreen from './screens/ContactScreen';
import SupportTicketsScreen from './screens/admin/SupportTicketsScreen';

// --- Configuración de PayPal ---
const initialOptions = {
    clientId: process.env.REACT_APP_PAYPAL_CLIENT_ID || "sb", // Usamos "sb" para Sandbox si no está definido
    currency: "MXN",
    intent: "capture",
};

function App() {
    return (
        <PayPalScriptProvider options={initialOptions}>
            <LoadingProvider>
                <AuthProvider>
                    <SettingsProvider>
                        <CartProvider>
                            <NotificationProvider>
                                <ToastProvider>
                                    <BrowserRouter>
                                        <Routes>
                                            {/* --- Rutas Públicas y de Cliente (Usan el Layout Principal) --- */}
                                            <Route path="/" element={<Layout />}>
                                                <Route index element={<HomeScreen />} />
                                                <Route path="product/:sku" element={<ProductScreen />} />
                                                <Route path="cart" element={<CartScreen />} />
                                                <Route path="login" element={<LoginScreen />} />
                                                <Route path="register" element={<RegisterScreen />} />
                                                <Route path="privacy-policy" element={<PrivacyPolicy />} />
                                                <Route path="terms-of-service" element={<TermsOfService />} />
                                                <Route path="contact" element={<ContactScreen />} />

                                                {/* --- Rutas Protegidas de Cliente --- */}
                                                <Route element={<ProtectedRoute />}>
                                                    <Route path="profile" element={<ProfileScreen />} />
                                                    <Route path="shipping" element={<ShippingScreen />} />
                                                    <Route path="payment" element={<PaymentScreen />} />
                                                    <Route path="placeorder" element={<PlaceOrderScreen />} />
                                                    <Route path="order/:id" element={<OrderScreen />} />
                                                </Route>
                                            </Route>

                                            {/* --- Rutas de Administrador (Usan el AdminLayout) --- */}
                                            <Route 
                                                path="/admin" 
                                                element={<ProtectedRoute adminOnly={true}><AdminLayout /></ProtectedRoute>}
                                            >
                                                <Route path="dashboard" element={<AdminDashboard />} />
                                                <Route path="productlist" element={<ProductListScreen />} />
                                                <Route path="orderlist" element={<OrderListScreen />} />
                                                <Route path="userlist" element={<UserListScreen />} />
                                                <Route path="product/create" element={<ProductEditScreen />} />
                                                <Route path="product/:id/edit" element={<ProductEditScreen />} />
                                                <Route path="user/:id/edit" element={<UserEditScreen />} />
                                                <Route path="categorylist" element={<CategoryListScreen />} />
                                                <Route path="rolelist" element={<RoleListScreen />} />
                                                <Route path="support" element={<SupportTicketsScreen />} />
                                                
                                                {/* Sub-rutas de Configuración */}
                                                <Route path="settings" element={<SettingsPage />}>
                                                    <Route path="legal" element={<LegalPagesScreen />} />
                                                    <Route path="whatsapp" element={<WhatsappSettingsScreen />} />
                                                </Route>

                                            </Route>

                                            {/* Ruta 404/Not Found (opcional) */}
                                            <Route path="*" element={<>404 Not Found</>} />
                                        </Routes>
                                    </BrowserRouter>
                                </ToastProvider>
                            </NotificationProvider>
                        </CartProvider>
                    </SettingsProvider>
                </AuthProvider>
            </LoadingProvider>
        </PayPalScriptProvider>
    );
}

export default App;

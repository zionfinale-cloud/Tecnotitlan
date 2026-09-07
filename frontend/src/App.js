import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// --- CONTEXTOS (Proveedores de Estado Global) ---
// Importaciones centralizadas desde los archivos "barril" en /context y /components
import {
    AuthProvider,
    SettingsProvider,
    CartProvider, // Importado desde el barril
    NotificationProvider,
    ToastProvider,
    LoadingProvider,
    RealtimeProvider,
} from 'context';

// --- LAYOUTS ---
import { Layout, AdminLayout, ProtectedRoute, LoadingSpinner } from 'components';

// --- SCREENS (Páginas) ---
// Las pantallas se mantienen con rutas relativas, ya que no se agrupan en un barril.
import HomeScreen from './screens/HomeScreen';
const ProductScreen = lazy(() => import('./screens/ProductScreen'));
const CartScreen = lazy(() => import('./screens/CartScreen'));
const LoginScreen = lazy(() => import('./screens/LoginScreen'));
const RegisterScreen = lazy(() => import('./screens/RegisterScreen'));
const ProfileScreen = lazy(() => import('./screens/ProfileScreen'));
const ShippingScreen = lazy(() => import('./screens/ShippingScreen'));
const PaymentScreen = lazy(() => import('./screens/PaymentScreen'));
const PlaceOrderScreen = lazy(() => import('./screens/PlaceOrderScreen'));
const OrderScreen = lazy(() => import('./screens/OrderScreen'));
const StripePaymentScreen = lazy(() => import('./screens/StripePaymentScreen'));
// Admin Screens
const AdminDashboard = lazy(() => import('./screens/admin/AdminDashboard'));
const ProductListScreen = lazy(() => import('./screens/admin/ProductListScreen'));
const InvestmentsScreen = lazy(() => import('./screens/admin/InvestmentsScreen'));
const InventoryScreen = lazy(() => import('./screens/admin/InventoryScreen'));
const ChannelsScreen = lazy(() => import('./screens/admin/ChannelsScreen'));
const OrderListScreen = lazy(() => import('./screens/admin/OrderListScreen'));
const StaffMailScreen = lazy(() => import('./screens/admin/StaffMailScreen'));
const UserListScreen = lazy(() => import('./screens/admin/UserListScreen'));
const ProductEditScreen = lazy(() => import('./screens/admin/ProductEditScreen'));
const UserEditScreen = lazy(() => import('./screens/admin/UserEditScreen'));
const CategoryListScreen = lazy(() => import('./screens/admin/CategoryListScreen'));
const RoleListScreen = lazy(() => import('./screens/admin/RoleListScreen'));
const WhatsappSettingsScreen = lazy(() => import('./screens/admin/WhatsappSettingsScreen'));
const WhatsAppChatScreen = lazy(() => import('./screens/admin/WhatsAppChatScreen'));
const TecatlAdminScreen = lazy(() => import('./screens/admin/TecatlAdminScreen'));
const TikTokShopSettingsScreen = lazy(() => import('./screens/admin/TikTokShopSettingsScreen'));
const MercadoLibreSettingsScreen = lazy(() => import('./screens/admin/MercadoLibreSettingsScreen'));
const SettingsPage = lazy(() => import('./screens/admin/SettingsPage'));
const SystemSettingsScreen = lazy(() => import('./screens/admin/SystemSettingsScreen'));
const StorefrontSettingsScreen = lazy(() => import('./screens/admin/StorefrontSettingsScreen'));
const LegalPagesScreen = lazy(() => import('./screens/admin/LegalPagesScreen'));
const NotificationLogsScreen = lazy(() => import('./screens/admin/NotificationLogsScreen'));
const PrivacyPolicy = lazy(() => import('./screens/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./screens/TermsOfService'));
const ContactScreen = lazy(() => import('./screens/ContactScreen'));
const SupportTicketsScreen = lazy(() => import('./screens/admin/SupportTicketsScreen'));
const MercadoLibreClaimsScreen = lazy(() => import('./screens/admin/MercadoLibreClaimsScreen'));
const MercadoLibreCommunicationsScreen = lazy(() => import('./screens/admin/MercadoLibreCommunicationsScreen'));
const UnifiedInboxScreen = lazy(() => import('./screens/admin/UnifiedInboxScreen'));
const ReturnInspectionScreen = lazy(() => import('./screens/admin/ReturnInspectionScreen'));
const ServiceQualityScreen = lazy(() => import('./screens/admin/ServiceQualityScreen'));
import PageViewTracker from './components/PageViewTracker';
const VerifyAccountScreen = lazy(() => import('./screens/VerifyAccountScreen'));
const SecurityScreen = lazy(() => import('./screens/SecurityScreen'));
const MyWorkScreen = lazy(() => import('./screens/admin/MyWorkScreen'));

function App() {
    return (
            <LoadingProvider>
                <AuthProvider>
                    <RealtimeProvider>
                    <SettingsProvider>
                        <CartProvider>
                            <NotificationProvider>
                                <ToastProvider>
                                    <BrowserRouter>
                                        <PageViewTracker />
                                        <Suspense fallback={<LoadingSpinner />}><Routes>
                                            {/* --- Rutas Públicas y de Cliente (Usan el Layout Principal) --- */}
                                            <Route path="/" element={<Layout />}>
                                                <Route index element={<HomeScreen />} />
                                                <Route path="product/:sku" element={<ProductScreen />} />
                                                <Route path="cart" element={<CartScreen />} />
                                                <Route path="login" element={<LoginScreen />} />
                                                <Route path="register" element={<RegisterScreen />} />
                                                <Route path="verify-email" element={<VerifyAccountScreen />} />
                                                <Route path="verify-email/:token" element={<VerifyAccountScreen />} />
                                                <Route path="privacy-policy" element={<PrivacyPolicy />} />
                                                <Route path="aviso-de-privacidad" element={<PrivacyPolicy />} />
                                                <Route path="politica-de-privacidad" element={<PrivacyPolicy />} />
                                                <Route path="terms-of-service" element={<TermsOfService />} />
                                                <Route path="contact" element={<ContactScreen />} />

                                                {/* --- Rutas Protegidas de Cliente --- */}
                                                <Route element={<ProtectedRoute />}>
                                                    <Route path="profile" element={<ProfileScreen />} />
                                                    <Route path="security" element={<SecurityScreen />} />
                                                    <Route path="shipping" element={<ShippingScreen />} />
                                                    <Route path="payment" element={<PaymentScreen />} />
                                                    <Route path="placeorder" element={<PlaceOrderScreen />} />
                                                    <Route path="order/:id" element={<OrderScreen />} />
                                                    <Route path="order/:id/pay" element={<StripePaymentScreen />} />
                                                </Route>
                                            </Route>

                                            <Route path="/mail" element={<StaffMailScreen standalone />} />

                                            {/* --- Rutas de Administrador (Usan el AdminLayout) --- */}
                                            <Route 
                                                path="/admin" 
                                                element={<ProtectedRoute adminOnly={true}><AdminLayout /></ProtectedRoute>}
                                            >
                                                <Route index element={<Navigate to="my-work" replace />} />
                                                <Route path="my-work" element={<MyWorkScreen />} />
                                                <Route path="dashboard" element={<AdminDashboard />} />
                                                <Route path="productlist" element={<ProductListScreen />} />
                                                <Route path="investments" element={<InvestmentsScreen />} />
                                                <Route path="inventory" element={<InventoryScreen />} />
                                                <Route path="channels" element={<ChannelsScreen />} />
                                                <Route path="orderlist" element={<OrderListScreen />} />
                                                <Route path="mail" element={<Navigate to="/mail" replace />} />
                                                <Route path="whatsapp-chat" element={<WhatsAppChatScreen />} />
                                                <Route path="tecatl" element={<TecatlAdminScreen />} />
                                                <Route path="userlist" element={<UserListScreen />} />
                                                <Route path="product/create" element={<ProductEditScreen />} />
                                                <Route path="product/:id/edit" element={<ProductEditScreen />} />
                                                <Route path="user/:id/edit" element={<UserEditScreen />} />
                                                <Route path="categorylist" element={<CategoryListScreen />} />
                                                <Route path="rolelist" element={<RoleListScreen />} />
                                                <Route path="support" element={<SupportTicketsScreen />} />
                                                <Route path="meli-claims" element={<MercadoLibreClaimsScreen />} />
                                                <Route path="meli-communications" element={<MercadoLibreCommunicationsScreen />} />
                                                <Route path="inbox" element={<UnifiedInboxScreen />} />
                                                <Route path="returns" element={<ReturnInspectionScreen />} />
                                                <Route path="service-quality" element={<ServiceQualityScreen />} />
                                                <Route path="security" element={<SecurityScreen admin />} />
                                                
                                                {/* Sub-rutas de Configuración */}
                                                <Route path="settings" element={<SettingsPage />}>
                                                    <Route index element={<Navigate to="system" replace />} />
                                                    <Route path="system" element={<SystemSettingsScreen />} />
                                                    <Route path="storefront" element={<StorefrontSettingsScreen />} />
                                                    <Route path="legal" element={<LegalPagesScreen />} />
                                                    <Route path="whatsapp" element={<WhatsappSettingsScreen />} />
                                                    <Route path="tiktok" element={<TikTokShopSettingsScreen />} />
                                                    <Route path="mercadolibre" element={<MercadoLibreSettingsScreen />} />
                                                    <Route path="notification-logs" element={<NotificationLogsScreen />} />
                                                </Route>

                                            </Route>

                                            {/* Ruta 404/Not Found (opcional) */}
                                            <Route path="*" element={<>404 Not Found</>} />
                                        </Routes></Suspense>
                                    </BrowserRouter>
                                </ToastProvider>
                            </NotificationProvider>
                        </CartProvider>
                    </SettingsProvider>
                    </RealtimeProvider>
                </AuthProvider>
            </LoadingProvider>
    );
}

export default App;

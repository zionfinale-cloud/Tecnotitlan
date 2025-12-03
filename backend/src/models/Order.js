// backend/src/models/Order.js @Order.js
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User', // Referencia al modelo User
    },
    isDropshippingOrder: { // <-- NUEVO: Para identificar fácilmente pedidos de dropshipping
      type: Boolean,
      default: false,
    },
    orderNumber: { // Nuevo campo para un número de pedido legible
      type: String,
      required: true,
      unique: true, // Asegurar que sea único
    },
    orderItems: [
      {
        name: { type: String, required: true },
        qty: { type: Number, required: true },
        image: { type: String, required: false }, // Podría ser la primera imagen del producto
        price: { type: Number, required: true },
        product: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          ref: 'Product', // Referencia al modelo Product
        },
        supplierInfo: { type: String }, // <-- NUEVO: Para guardar la info del proveedor
      },
    ],
    shippingAddress: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    paymentMethod: {
      type: String,
      required: [true, 'El método de pago es obligatorio.'],
    },
    paymentResult: {
      id: { type: String },
      status: { type: String },
      update_time: { type: String },
      email_address: { type: String },
    },
    paymentFee: { // <-- NUEVO: Para guardar la comisión del método de pago
      type: Number,
      required: true,
      default: 0.0,
    },
    itemsPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },
    shippingPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },
    taxPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },
    totalPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },
    isPaid: {
      type: Boolean,
      required: true,
      default: false,
    },
    paidAt: {
      type: Date,
    },
    isDelivered: {
      type: Boolean,
      required: true,
      default: false,
    },
    deliveredAt: {
      type: Date,
    },
    status: {
      type: String,
      required: true,
      enum: [
        'Pending Payment',
        'Processing',
        'Pending Fulfillment', // <-- NUEVO: Para pedidos de dropshipping pagados
        'Shipped',
        'Delivered',
        'Cancelled',
      ],
      default: 'Pending Payment',
    },
    statusHistory: [ // <-- NUEVO: Para rastrear cambios de estado
      {
        status: { type: String, required: true },
        date: { type: Date, default: Date.now },
        notes: { type: String, default: '' },
      }
    ],
    // Reemplazamos shippingGuide por un objeto más estructurado
    shippingInfo: {
      trackingNumber: {
        type: String,
      },
      carrier: { // Opcional, para el futuro
        type: String,
      },
    },
    shippedAt: {
      type: Date,
    },
  },
  {
    timestamps: true, // Agrega createdAt y updatedAt automáticamente
  }
);

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;

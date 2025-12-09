const mongoose = require('mongoose');

const meliIntegrationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    unique: true, // Solo una integración por usuario administrador
  },
  accessToken: {
    type: String,
    required: true,
  },
  refreshToken: {
    type: String,
    required: true,
  },
  expiresIn: {
    type: Number, // La duración en segundos que nos da Meli
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  meliUserId: {
    type: Number, // El user_id de Meli es un número
    required: true,
    index: true,
  },
}, {
  timestamps: true, // Añade createdAt y updatedAt automáticamente
});

const MeliIntegration = mongoose.model('MeliIntegration', meliIntegrationSchema);

module.exports = MeliIntegration;
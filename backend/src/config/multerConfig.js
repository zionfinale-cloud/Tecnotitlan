import multer from 'multer';
import path from 'path';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { cloudinary, configureCloudinary } from './cloudinary.js';

// --- Almacenamiento en Cloudinary ---
const cloudinary_storage = new CloudinaryStorage({
  cloudinary: cloudinary, // Pasamos la instancia
  params: {
    folder: 'tecnotitlan',
    format: async (req, file) => 'jpg',
    public_id: (req, file) => `product-${Date.now()}`,
  },
});

// --- Almacenamiento Local ---
const local_storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename(req, file, cb) {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

// Antes de usar multer, nos aseguramos de que cloudinary esté configurado.
// Esto se llamará en el middleware dinámico, por lo que la configuración ya estará cargada.
const ensureCloudinaryConfig = () => configureCloudinary();
const local = multer({ storage: local_storage });
const cloudinaryUploader = multer({ storage: cloudinary_storage });
export {
  local,
  cloudinaryUploader as cloudinary,
  ensureCloudinaryConfig,
};
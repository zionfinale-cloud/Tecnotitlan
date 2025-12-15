import path from 'path';
import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { protect, admin } from '../middleware/authMiddleware.js';
import { getConfig } from '../services/configService.js';

const router = express.Router();

/**
 * Configura dinámicamente el motor de almacenamiento para Multer (local o Cloudinary)
 * basándose en la configuración de la aplicación.
 */
const getStorageEngine = () => {
  const config = getConfig();

  if (config.UPLOAD_STRATEGY === 'cloudinary') {
    // --- ESTRATEGIA CLOUDINARY ---
    // Valida que las credenciales de Cloudinary estén presentes.
    if (!config.CLOUDINARY_CLOUD_NAME || !config.CLOUDINARY_API_KEY || !config.CLOUDINARY_API_SECRET) {
      throw new Error('Faltan las credenciales de Cloudinary en la configuración.');
    }

    cloudinary.config({
      cloud_name: config.CLOUDINARY_CLOUD_NAME,
      api_key: config.CLOUDINARY_API_KEY,
      api_secret: config.CLOUDINARY_API_SECRET,
    });

    return new CloudinaryStorage({
      cloudinary,
      params: {
        folder: 'tecnotitlan_products',
        format: async (req, file) => 'webp', // Usar un formato moderno como webp
        public_id: (req, file) => `${Date.now()}-${file.originalname.split('.')[0]}`,
      },
    });
  } else {
    // --- ESTRATEGIA LOCAL (por defecto) ---
    return multer.diskStorage({
      destination(req, file, cb) {
        cb(null, 'uploads/');
      },
      filename(req, file, cb) {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
      },
    });
  }
};

// Middleware de Multer que usa el motor de almacenamiento dinámico.
const upload = multer({
  storage: getStorageEngine(),
  fileFilter: function (req, file, cb) {
    // Valida que solo se suban imágenes.
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Error: ¡Solo se permiten archivos de imagen!'));
  },
});

// Ruta para subir una imagen. Protegida y solo para administradores.
router.post('/', protect, admin, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).send({ message: 'Por favor, suba un archivo de imagen.' });
  }
  // Devuelve la ruta del archivo subido. Cloudinary devuelve una URL completa,
  // mientras que el almacenamiento local devuelve una ruta relativa.
  res.status(200).send({
    message: 'Imagen subida con éxito',
    image: req.file.path,
  });
});

export default router;
import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js'; // Importar la instancia única de Prisma
import { NotFoundError, BadRequestError } from '../utils/errorUtils.js';
import slugify from 'slugify';
import { getConfig } from '../services/configService.js';

// @desc    Crear una nueva categoría
// @route   POST /api/categories
// @access  Private/Admin
const createCategory = asyncHandler(async (req, res) => {
  const { name, parent } = req.body;
  // Aunque slugify no necesita config, es un ejemplo de cómo se usaría.
  const config = getConfig();
  const slugifyOptions = config.SLUGIFY_OPTIONS || { lower: true, strict: true };
  const slug = slugify(name, slugifyOptions);

  // Verificar si ya existe una categoría con el mismo slug
  const existingCategory = await prisma.category.findUnique({ where: { slug } });
  if (existingCategory) {
    throw new BadRequestError(`Ya existe una categoría con el slug '${slug}'. Elige un nombre diferente.`);
  }

  // Verificar si la categoría padre existe, si se proporciona
  if (parent) {
    const parentCategory = await prisma.category.findUnique({ where: { id: parent } });
    if (!parentCategory) {
      throw new BadRequestError(`La categoría padre con ID '${parent}' no existe.`);
    }
  }

  const createdCategory = await prisma.category.create({
    data: { name, slug, parentId: parent || null },
  });

  res.status(201).json({ status: 'success', data: { category: createdCategory } });
});

// @desc    Obtener todas las categorías (en formato de árbol)
// @route   GET /api/categories
// @access  Public
const getCategories = asyncHandler(async (req, res) => {
  console.log('\n--- [DEBUG] Iniciando getCategories ---');
  const categories = await prisma.category.findMany({});
  console.log('[DEBUG 1/3] Categorías planas desde la BD:', JSON.stringify(categories, null, 2));

  const buildCategoryTree = (flatCategories) => {
    const categoryMap = new Map();
    const rootCategories = [];

    // 1. Inicializar el mapa con cada categoría y un array de hijos vacío.
    flatCategories.forEach(category => {
      categoryMap.set(category.id, { ...category, children: [] });
    });
    console.log('[DEBUG 2/3] Mapa de categorías creado. Total de nodos:', categoryMap.size);

    // 2. Iterar sobre el mapa para construir las relaciones.
    categoryMap.forEach(categoryNode => {
      if (categoryNode.parentId && categoryMap.has(categoryNode.parentId)) {
        categoryMap.get(categoryNode.parentId).children.push(categoryNode);
      } else {
        rootCategories.push(categoryNode); // Es una categoría raíz
      }
    });
    return rootCategories;
  };

  const categoryTree = buildCategoryTree(categories);
  console.log('[DEBUG 3/3] Árbol final a enviar al frontend:', JSON.stringify(categoryTree, null, 2));
  console.log('--- [DEBUG] Fin de getCategories ---\n');

  res.status(200).json({ status: 'success', data: { categories: categoryTree } });
});

// @desc    Actualizar una categoría
// @route   PUT /api/categories/:id
// @access  Private/Admin
const updateCategory = asyncHandler(async (req, res, next) => {
  const { name, parent } = req.body;
  const category = await prisma.category.findUnique({ where: { id: req.params.id } });

  if (!category) {
    return next(new NotFoundError('Categoría no encontrada'));
  }

  const dataToUpdate = {
    parentId: parent !== undefined ? parent : category.parentId,
  };

  if (name && name !== category.name) {
    dataToUpdate.name = name;
    const config = getConfig();
    const slugifyOptions = config.SLUGIFY_OPTIONS || { lower: true, strict: true };
    dataToUpdate.slug = slugify(name, slugifyOptions);
    // Verificar que el nuevo slug no esté ya en uso por otra categoría
    const existingCategory = await prisma.category.findFirst({ where: { slug: dataToUpdate.slug, id: { not: category.id } } });
    if (existingCategory) {
      throw new BadRequestError(`Ya existe otra categoría con el slug '${dataToUpdate.slug}'. Elige un nombre diferente.`);
    }
  }

  const updatedCategory = await prisma.category.update({ where: { id: req.params.id }, data: dataToUpdate });
  res.status(200).json({ status: 'success', data: { category: updatedCategory } });
});

// @desc    Eliminar una categoría
// @route   DELETE /api/categories/:id
// @access  Private/Admin
const deleteCategory = asyncHandler(async (req, res, next) => {
  try {
    // Opcional: Añadir lógica para manejar productos y subcategorías huérfanas.
    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(200).json({ status: 'success', message: 'Categoría eliminada' });
  } catch (error) {
    if (error.code === 'P2025') {
      return next(new NotFoundError('Categoría no encontrada'));
    }
    next(error);
  }
});

export { createCategory, getCategories, updateCategory, deleteCategory };
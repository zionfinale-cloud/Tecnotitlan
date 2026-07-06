import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';
import {
  closeConversation,
  createKnowledgeArticle,
  deleteKnowledgeArticle,
  getConversation,
  getConversations,
  getKnowledgeArticles,
  getProfile,
  replyConversation,
  updateKnowledgeArticle,
  updateProfile,
} from '../controllers/tecatlController.js';

const router = express.Router();

router.use(protect);

router.get('/profile', checkPermission('tecatl:read', 'tecatl:manage'), getProfile);
router.put('/profile', checkPermission('tecatl:manage'), updateProfile);

router.get('/conversations', checkPermission('tecatl:read'), getConversations);
router.get('/conversations/:id', checkPermission('tecatl:read'), getConversation);
router.post('/conversations/:id/reply', checkPermission('tecatl:reply'), replyConversation);
router.post('/conversations/:id/close', checkPermission('tecatl:handoff'), closeConversation);

router.get('/knowledge', checkPermission('tecatl:read', 'tecatl:knowledge'), getKnowledgeArticles);
router.post('/knowledge', checkPermission('tecatl:knowledge'), createKnowledgeArticle);
router.put('/knowledge/:id', checkPermission('tecatl:knowledge'), updateKnowledgeArticle);
router.delete('/knowledge/:id', checkPermission('tecatl:knowledge'), deleteKnowledgeArticle);

export default router;

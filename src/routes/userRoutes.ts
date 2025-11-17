import { Router } from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updatePassword,
  deleteUser,
  loginUser
} from '../controllers/userController';
import authMiddleware from '../middlewares/auth'; 

const router = Router();

// Rotas NÃO PROTEGIDAS (Auth)
router.post('/', createUser);
router.post('/login', loginUser);

// Rotas PROTEGIDAS (Acesso via Token)

// 1. Rota de ALTERAÇÃO DE SENHA (MAIS ESPECÍFICA, deve vir primeiro)
router.put('/:id/password', authMiddleware, updatePassword);

// 2. Rotas CRUD (Mais genéricas com :id)
router.get('/', getUsers); 
router.get('/:id', authMiddleware, getUserById); //  GET para buscar dados
router.put('/:id', authMiddleware, updateUser);
router.delete('/:id', authMiddleware, deleteUser);


export default router;
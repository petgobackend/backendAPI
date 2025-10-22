import { Router } from 'express';
// Adiciona a importação do loginUser
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  loginUser 
} from '../controllers/userController';

const router = Router();

// --- Rotas CRUD de Usuário ---
router.get('/', getUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

// --- Rota de Autenticação ---
router.post('/login', loginUser); // Rota de login adicionada

export default router;
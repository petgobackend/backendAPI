"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const auth_1 = __importDefault(require("../middlewares/auth"));
const router = (0, express_1.Router)();
// Rotas NÃO PROTEGIDAS (Auth)
router.post('/', userController_1.createUser);
router.post('/login', userController_1.loginUser);
// Rotas PROTEGIDAS (Acesso via Token)
// 1. Rota de ALTERAÇÃO DE SENHA (MAIS ESPECÍFICA, deve vir primeiro)
router.put('/:id/password', auth_1.default, userController_1.updatePassword);
// 2. Rotas CRUD (Mais genéricas com :id)
router.get('/', userController_1.getUsers);
router.get('/:id', auth_1.default, userController_1.getUserById); //  GET para buscar dados
router.put('/:id', auth_1.default, userController_1.updateUser);
router.delete('/:id', auth_1.default, userController_1.deleteUser);
exports.default = router;

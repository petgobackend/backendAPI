"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginUser = exports.createUser = exports.getUsers = exports.deleteUser = exports.updatePassword = exports.updateUser = exports.getUserById = void 0;
const db_1 = __importDefault(require("../utils/db"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// NOTA: As funções 'getUsers', 'createUser' e 'loginUser' permanecem sem alteração, 
// pois não precisam da verificação de ID na requisição.
// ───────────────────────────────────────────────────────────────────────────────
// BUSCAR POR ID (AGORA PROTEGIDO)
const getUserById = async (req, res) => {
    const { id } = req.params;
    const conn = await db_1.default.getConnection();
    // 🚨 VERIFICAÇÃO DE SEGURANÇA: Checa se o ID da rota é o mesmo ID do token
    if (req.userId !== id) {
        conn.release();
        return res.status(403).json({ status: 'error', message: 'Acesso negado. Você só pode ver sua própria conta.' });
    }
    try {
        const [rows] = await conn.query('SELECT id, name, email, cpf FROM users WHERE id = ?', [id]);
        const user = rows[0];
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Usuário não encontrado.' });
        }
        res.status(200).json({ status: 'success', data: user });
    }
    catch (err) {
        console.error('Erro ao buscar usuário por id:', err);
        res.status(500).json({ status: 'error', message: 'Erro interno ao buscar usuário.' });
    }
    finally {
        conn.release();
    }
};
exports.getUserById = getUserById;
// ───────────────────────────────────────────────────────────────────────────────
// ATUALIZAR DADOS CADASTRAIS (AGORA PROTEGIDO)
const updateUser = async (req, res) => {
    const { id } = req.params;
    const { name, cpf } = req.body;
    const conn = await db_1.default.getConnection();
    // 🚨 VERIFICAÇÃO DE SEGURANÇA
    if (req.userId !== id) {
        conn.release();
        return res.status(403).json({ status: 'error', message: 'Acesso negado. Você só pode atualizar sua própria conta.' });
    }
    if (!name || !cpf) {
        conn.release();
        return res.status(400).json({
            status: 'error',
            message: 'Nome e cpf são obrigatórios.',
        });
    }
    try {
        const [result] = await conn.query('UPDATE users SET name = ?, cpf = ? WHERE id = ?', [name, cpf, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'error', message: 'Usuário não encontrado.' });
        }
        res.status(200).json({
            status: 'success',
            message: 'Usuário atualizado com sucesso.',
            data: { id: Number(id), name, cpf },
        });
    }
    catch (err) {
        console.error('Erro ao atualizar usuário:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                status: 'error',
                message: 'CPF já cadastrado por outro usuário.',
            });
        }
        res.status(500).json({
            status: 'error',
            message: 'Ocorreu um erro interno ao atualizar o usuário.',
        });
    }
    finally {
        conn.release();
    }
};
exports.updateUser = updateUser;
// ───────────────────────────────────────────────────────────────────────────────
// ATUALIZAR SENHA (AGORA PROTEGIDO)
const updatePassword = async (req, res) => {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    const conn = await db_1.default.getConnection();
    // 🚨 VERIFICAÇÃO DE SEGURANÇA
    if (req.userId !== id) {
        conn.release();
        return res.status(403).json({ status: 'error', message: 'Acesso negado. Você só pode alterar a senha da sua conta.' });
    }
    if (!currentPassword || !newPassword) {
        conn.release();
        return res.status(400).json({
            status: 'error',
            message: 'Senha atual e nova senha são obrigatórias.',
        });
    }
    try {
        const [rows] = await conn.query('SELECT id, password FROM users WHERE id = ?', [id]);
        const user = rows[0];
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Usuário não encontrado.' });
        }
        const ok = await bcrypt_1.default.compare(currentPassword, user.password);
        if (!ok) {
            return res.status(401).json({ status: 'error', message: 'Senha atual incorreta.' });
        }
        const salt = await bcrypt_1.default.genSalt(10);
        const hashed = await bcrypt_1.default.hash(newPassword, salt);
        await conn.query('UPDATE users SET password = ? WHERE id = ?', [hashed, id]);
        res.status(200).json({ status: 'success', message: 'Senha atualizada com sucesso.' });
    }
    catch (err) {
        console.error('Erro ao atualizar senha:', err);
        res.status(500).json({ status: 'error', message: 'Erro interno ao atualizar senha.' });
    }
    finally {
        conn.release();
    }
};
exports.updatePassword = updatePassword;
// ───────────────────────────────────────────────────────────────────────────────
// DELETAR (AGORA PROTEGIDO)
const deleteUser = async (req, res) => {
    const { id } = req.params;
    const conn = await db_1.default.getConnection();
    // 🚨 VERIFICAÇÃO DE SEGURANÇA
    if (req.userId !== id) {
        conn.release();
        return res.status(403).json({ status: 'error', message: 'Acesso negado. Você só pode deletar sua própria conta.' });
    }
    try {
        const [result] = await conn.query('DELETE FROM users WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ status: 'error', message: 'Usuário não encontrado.' });
        }
        res.status(200).json({ status: 'success', message: 'Usuário deletado com sucesso.' });
    }
    catch (err) {
        console.error('Erro ao deletar usuário:', err);
        res.status(500).json({ status: 'error', message: 'Ocorreu um erro interno ao deletar o usuário.' });
    }
    finally {
        conn.release();
    }
};
exports.deleteUser = deleteUser;
// Update 11/11/2025 - colocamos os export pro user routes reconhecer
const getUsers = async (req, res) => {
    const conn = await db_1.default.getConnection();
    try {
        const [rows] = await conn.query('SELECT id, name, email, cpf FROM users');
        res.status(200).json({
            status: 'success',
            message: 'Usuários buscados com sucesso.',
            data: rows,
        });
    }
    catch (err) {
        console.error('Erro ao buscar usuários:', err);
        res.status(500).json({
            status: 'error',
            message: 'Ocorreu um erro interno ao buscar usuários.',
        });
    }
    finally {
        conn.release();
    }
};
exports.getUsers = getUsers;
const createUser = async (req, res) => {
    const { name, email, cpf, password } = req.body;
    const conn = await db_1.default.getConnection();
    if (!name || !email || !cpf || !password) {
        conn.release();
        return res.status(400).json({
            status: 'error',
            message: 'Nome, email, cpf e senha são obrigatórios.',
        });
    }
    try {
        const salt = await bcrypt_1.default.genSalt(10);
        const hashedPassword = await bcrypt_1.default.hash(password, salt);
        const [result] = await conn.query('INSERT INTO users (name, email, cpf, password) VALUES (?, ?, ?, ?)', [name, email, cpf, hashedPassword]);
        const insertId = result.insertId;
        res.status(201).json({
            status: 'success',
            message: 'Usuário criado com sucesso.',
            data: { id: insertId, name, email, cpf },
        });
    }
    catch (err) {
        console.error('Erro ao criar usuário:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ status: 'error', message: 'Email ou CPF já cadastrado.' });
        }
        res.status(500).json({ status: 'error', message: 'Ocorreu um erro interno ao criar o usuário.' });
    }
    finally {
        conn.release();
    }
};
exports.createUser = createUser;
const loginUser = async (req, res) => {
    const { email, password } = req.body;
    const conn = await db_1.default.getConnection();
    if (!email || !password) {
        conn.release();
        return res.status(400).json({ status: 'error', message: 'Email e senha são obrigatórios.' });
    }
    try {
        const [rows] = await conn.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            return res.status(401).json({ status: 'error', message: 'Credenciais inválidas.' });
        }
        const user = rows[0];
        const isMatch = await bcrypt_1.default.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ status: 'error', message: 'Credenciais inválidas.' });
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({
            status: 'success',
            message: 'Login realizado com sucesso.',
            data: {
                token,
                user: { id: user.id, name: user.name, email: user.email, cpf: user.cpf },
            },
        });
    }
    catch (err) {
        console.error('Erro ao fazer login:', err);
        res.status(500).json({ status: 'error', message: 'Ocorreu um erro interno ao tentar fazer login.' });
    }
    finally {
        conn.release();
    }
};
exports.loginUser = loginUser;

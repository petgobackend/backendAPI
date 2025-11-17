// src/controllers/userController.ts (Corrigido)
import { Request, Response } from 'express';
import db from '../utils/db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// NOTA: As funções 'getUsers', 'createUser' e 'loginUser' permanecem sem alteração, 
// pois não precisam da verificação de ID na requisição.

// ───────────────────────────────────────────────────────────────────────────────
// BUSCAR POR ID (AGORA PROTEGIDO)
export const getUserById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const conn = await db.getConnection();

  // 🚨 VERIFICAÇÃO DE SEGURANÇA: Checa se o ID da rota é o mesmo ID do token
  if (req.userId !== id) {
    conn.release();
    return res.status(403).json({ status: 'error', message: 'Acesso negado. Você só pode ver sua própria conta.' });
  }

  try {
    const [rows] = await conn.query('SELECT id, name, email, cpf FROM users WHERE id = ?', [id]);
    const user = (rows as any[])[0];
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'Usuário não encontrado.' });
    }
    res.status(200).json({ status: 'success', data: user });
  } catch (err) {
    console.error('Erro ao buscar usuário por id:', err);
    res.status(500).json({ status: 'error', message: 'Erro interno ao buscar usuário.' });
  } finally {
    conn.release();
  }
};

// ───────────────────────────────────────────────────────────────────────────────
// ATUALIZAR DADOS CADASTRAIS (AGORA PROTEGIDO)
export const updateUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, cpf } = req.body;
  const conn = await db.getConnection();

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
    const [result] = await conn.query(
      'UPDATE users SET name = ?, cpf = ? WHERE id = ?',
      [name, cpf, id]
    );

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Usuário não encontrado.' });
    }

    res.status(200).json({
      status: 'success',
      message: 'Usuário atualizado com sucesso.',
      data: { id: Number(id), name, cpf },
    });
  } catch (err) {
    console.error('Erro ao atualizar usuário:', err);
    if ((err as any).code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        status: 'error',
        message: 'CPF já cadastrado por outro usuário.',
      });
    }
    res.status(500).json({
      status: 'error',
      message: 'Ocorreu um erro interno ao atualizar o usuário.',
    });
  } finally {
    conn.release();
  }
};

// ───────────────────────────────────────────────────────────────────────────────
// ATUALIZAR SENHA (AGORA PROTEGIDO)
export const updatePassword = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;
  const conn = await db.getConnection();

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
    const [rows] = await conn.query<any[]>('SELECT id, password FROM users WHERE id = ?', [id]);
    const user = rows[0];
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'Usuário não encontrado.' });
    }

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) {
      return res.status(401).json({ status: 'error', message: 'Senha atual incorreta.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);
    await conn.query('UPDATE users SET password = ? WHERE id = ?', [hashed, id]);

    res.status(200).json({ status: 'success', message: 'Senha atualizada com sucesso.' });
  } catch (err) {
    console.error('Erro ao atualizar senha:', err);
    res.status(500).json({ status: 'error', message: 'Erro interno ao atualizar senha.' });
  } finally {
    conn.release();
  }
};

// ───────────────────────────────────────────────────────────────────────────────
// DELETAR (AGORA PROTEGIDO)
export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const conn = await db.getConnection();

  // 🚨 VERIFICAÇÃO DE SEGURANÇA
  if (req.userId !== id) {
    conn.release();
    return res.status(403).json({ status: 'error', message: 'Acesso negado. Você só pode deletar sua própria conta.' });
  }

  try {
    const [result] = await conn.query('DELETE FROM users WHERE id = ?', [id]);
    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Usuário não encontrado.' });
    }
    res.status(200).json({ status: 'success', message: 'Usuário deletado com sucesso.' });
  } catch (err) {
    console.error('Erro ao deletar usuário:', err);
    res.status(500).json({ status: 'error', message: 'Ocorreu um erro interno ao deletar o usuário.' });
  } finally {
    conn.release();
  }
};
// Update 11/11/2025 - colocamos os export pro user routes reconhecer
export const getUsers = async (req: Request, res: Response) => {
  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query('SELECT id, name, email, cpf FROM users');
    res.status(200).json({
      status: 'success',
      message: 'Usuários buscados com sucesso.',
      data: rows,
    });
  } catch (err) {
    console.error('Erro ao buscar usuários:', err);
    res.status(500).json({
      status: 'error',
      message: 'Ocorreu um erro interno ao buscar usuários.',
    });
  } finally {
    conn.release();
  }
};

export const createUser = async (req: Request, res: Response) => {
  const { name, email, cpf, password } = req.body;
  const conn = await db.getConnection();

  if (!name || !email || !cpf || !password) {
    conn.release();
    return res.status(400).json({
      status: 'error',
      message: 'Nome, email, cpf e senha são obrigatórios.',
    });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const [result] = await conn.query(
      'INSERT INTO users (name, email, cpf, password) VALUES (?, ?, ?, ?)',
      [name, email, cpf, hashedPassword]
    );

    const insertId = (result as any).insertId;

    res.status(201).json({
      status: 'success',
      message: 'Usuário criado com sucesso.',
      data: { id: insertId, name, email, cpf },
    });
  } catch (err) {
    console.error('Erro ao criar usuário:', err);
    if ((err as any).code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ status: 'error', message: 'Email ou CPF já cadastrado.' });
    }
    res.status(500).json({ status: 'error', message: 'Ocorreu um erro interno ao criar o usuário.' });
  } finally {
    conn.release();
  }
};

export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const conn = await db.getConnection();

  if (!email || !password) {
    conn.release();
    return res.status(400).json({ status: 'error', message: 'Email e senha são obrigatórios.' });
  }

  try {
    const [rows] = await conn.query<any[]>('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ status: 'error', message: 'Credenciais inválidas.' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Credenciais inválidas.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET as string,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      status: 'success',
      message: 'Login realizado com sucesso.',
      data: {
        token,
        user: { id: user.id, name: user.name, email: user.email, cpf: user.cpf },
      },
    });
  } catch (err) {
    console.error('Erro ao fazer login:', err);
    res.status(500).json({ status: 'error', message: 'Ocorreu um erro interno ao tentar fazer login.' });
  } finally {
    conn.release();
  }
};


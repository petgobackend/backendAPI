import { Request, Response } from 'express';
import db from '../utils/db';

export const getUsers = async (req: Request, res: Response) => {
  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM users');
    res.status(200).json(rows);
  } catch (err) {
    console.error('Erro ao buscar usuários:', err);
    res.status(500).json({ error: 'Erro ao buscar usuários.' });
  } finally {
    conn.release();
  }
};

export const createUser = async (req: Request, res: Response) => {
  const { name, email } = req.body;
  const conn = await db.getConnection();

  if (!name || !email) {
    return res.status(400).json({ error: 'Nome e email são obrigatórios.' });
  }

  try {
    const [result] = await conn.query(
      'INSERT INTO users (name, email) VALUES (?, ?)',
      [name, email]
    );
    res.status(201).json({ id: (result as any).insertId, name, email });
  } catch (err) {
    console.error('Erro ao criar usuário:', err);
    res.status(500).json({ error: 'Erro ao criar usuário.' });
  } finally {
    conn.release();
  }
};

export const updateUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email } = req.body;
  const conn = await db.getConnection();

  if (!name || !email) {
    return res.status(400).json({ error: 'Nome e email são obrigatórios.' });
  }

  try {
    await conn.query('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, id]);
    res.status(200).json({ id, name, email });
  } catch (err) {
    console.error('Erro ao atualizar usuário:', err);
    res.status(500).json({ error: 'Erro ao atualizar usuário.' });
  } finally {
    conn.release();
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const conn = await db.getConnection();
  try {
    await conn.query('DELETE FROM users WHERE id = ?', [id]);
    res.status(200).json({ message: 'Usuário deletado com sucesso.' });
  } catch (err) {
    console.error('Erro ao deletar usuário:', err);
    res.status(500).json({ error: 'Erro ao deletar usuário.' });
  } finally {
    conn.release();
  }
};

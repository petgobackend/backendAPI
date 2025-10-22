import { Request, Response } from 'express';
import db from '../utils/db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Função para buscar todos os usuários
export const getUsers = async (req: Request, res: Response) => {
  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query('SELECT id, name, email, cpf FROM users');
    
    // Resposta de Sucesso
    res.status(200).json({
      status: 'success',
      message: 'Usuários buscados com sucesso.',
      data: rows,
    });
  } catch (err) {
    console.error('Erro ao buscar usuários:', err);
    // Resposta de Erro
    res.status(500).json({
      status: 'error',
      message: 'Ocorreu um erro interno ao buscar usuários.',
    });
  } finally {
    conn.release();
  }
};

// Função para criar um novo usuário
export const createUser = async (req: Request, res: Response) => {
  const { name, email, cpf, password } = req.body;
  const conn = await db.getConnection();

  if (!name || !email || !cpf || !password) {
    conn.release();
    // Resposta de Erro (Validação)
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

    // Resposta de Sucesso
    res.status(201).json({
      status: 'success',
      message: 'Usuário criado com sucesso.',
      data: {
        id: insertId,
        name,
        email,
        cpf,
      },
    });
  } catch (err) {
    console.error('Erro ao criar usuário:', err);
    // Resposta de Erro (Duplicidade)
    if ((err as any).code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        status: 'error',
        message: 'Email ou CPF já cadastrado.',
      });
    }
    // Resposta de Erro (Servidor)
    res.status(500).json({
      status: 'error',
      message: 'Ocorreu um erro interno ao criar o usuário.',
    });
  } finally {
    conn.release();
  }
};

// Função para atualizar um usuário
export const updateUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, cpf } = req.body;
  const conn = await db.getConnection();

  if (!name || !email || !cpf) {
    conn.release();
    // Resposta de Erro (Validação)
    return res.status(400).json({
      status: 'error',
      message: 'Nome, email e cpf são obrigatórios.',
    });
  }

  try {
    const [result] = await conn.query(
      'UPDATE users SET name = ?, email = ?, cpf = ? WHERE id = ?',
      [name, email, cpf, id]
    );

    // Resposta de Erro (Não encontrado)
    if ((result as any).affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuário não encontrado.',
      });
    }

    // Resposta de Sucesso
    res.status(200).json({
      status: 'success',
      message: 'Usuário atualizado com sucesso.',
      data: { id: Number(id), name, email, cpf },
    });
  } catch (err) {
    console.error('Erro ao atualizar usuário:', err);
    // Resposta de Erro (Duplicidade)
    if ((err as any).code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        status: 'error',
        message: 'Email ou CPF já cadastrado por outro usuário.',
      });
    }
    // Resposta de Erro (Servidor)
    res.status(500).json({
      status: 'error',
      message: 'Ocorreu um erro interno ao atualizar o usuário.',
    });
  } finally {
    conn.release();
  }
};

// Função para deletar um usuário
export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const conn = await db.getConnection();

  try {
    const [result] = await conn.query('DELETE FROM users WHERE id = ?', [id]);

    // Resposta de Erro (Não encontrado)
    if ((result as any).affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuário não encontrado.',
      });
    }

    // Resposta de Sucesso
    res.status(200).json({
      status: 'success',
      message: 'Usuário deletado com sucesso.',
    });
  } catch (err) {
    console.error('Erro ao deletar usuário:', err);
    // Resposta de Erro (Servidor)
    res.status(500).json({
      status: 'error',
      message: 'Ocorreu um erro interno ao deletar o usuário.',
    });
  } finally {
    conn.release();
  }
};

// --- FUNÇÃO DE LOGIN ---

export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const conn = await db.getConnection();

  if (!email || !password) {
    conn.release();
    // Resposta de Erro (Validação)
    return res.status(400).json({
      status: 'error',
      message: 'Email e senha são obrigatórios.',
    });
  }

  try {
    const [rows] = await conn.query<any[]>('SELECT * FROM users WHERE email = ?', [email]);

    // Resposta de Erro (Não encontrado - MELHORIA DE SEGURANÇA)
    if (rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Credenciais inválidas.', // Mensagem genérica
      });
    }

    const user = rows[0];

    const isMatch = await bcrypt.compare(password, user.password);

    // Resposta de Erro (Senha incorreta)
    if (!isMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Credenciais inválidas.', // Mensagem genérica
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET as string,
      { expiresIn: '1h' }
    );

    // Resposta de Sucesso (Login)
    res.status(200).json({
      status: 'success',
      message: 'Login realizado com sucesso.',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          cpf: user.cpf,
        },
      },
    });
  } catch (err) {
    console.error('Erro ao fazer login:', err);
    // Resposta de Erro (Servidor)
    res.status(500).json({
      status: 'error',
      message: 'Ocorreu um erro interno ao tentar fazer login.',
    });
  } finally {
    conn.release();
  }
};
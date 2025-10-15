import { Request, Response } from 'express';
import db from '../utils/db';

export const getAnimals = async (req: Request, res: Response) => {
  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM animals');
    res.status(200).json(rows);
  } catch (err) {
    console.error('Erro ao buscar animais:', err);
    res.status(500).json({ error: 'Erro ao buscar animais.' });
  } finally {
    conn.release();
  }
};

export const createAnimal = async (req: Request, res: Response) => {
  const { name, species, breed, latitude, longitude, created_by } = req.body;
  const conn = await db.getConnection();

  if (!name || !species) {
    return res.status(400).json({ error: 'Nome e espécie são obrigatórios.' });
  }

  try {
    const [result] = await conn.query(
      `INSERT INTO animals (name, species, breed, latitude, longitude, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, species, breed || null, latitude || null, longitude || null, created_by || null]
    );

    res.status(201).json({
      id: (result as any).insertId,
      name,
      species,
      breed,
      latitude,
      longitude,
      created_by,
    });
  } catch (err) {
    console.error('Erro ao criar animal:', err);
    res.status(500).json({ error: 'Erro ao criar animal.' });
  } finally {
    conn.release();
  }
};

export const updateAnimal = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, species, breed, latitude, longitude } = req.body;
  const conn = await db.getConnection();

  if (!name || !species) {
    return res.status(400).json({ error: 'Nome e espécie são obrigatórios.' });
  }

  try {
    await conn.query(
      `UPDATE animals 
       SET name = ?, species = ?, breed = ?, latitude = ?, longitude = ?
       WHERE id = ?`,
      [name, species, breed, latitude, longitude, id]
    );

    res.status(200).json({ id, name, species, breed, latitude, longitude });
  } catch (err) {
    console.error('Erro ao atualizar animal:', err);
    res.status(500).json({ error: 'Erro ao atualizar animal.' });
  } finally {
    conn.release();
  }
};

export const deleteAnimal = async (req: Request, res: Response) => {
  const { id } = req.params;
  const conn = await db.getConnection();

  try {
    await conn.query('DELETE FROM animals WHERE id = ?', [id]);
    res.status(200).json({ message: 'Animal deletado com sucesso.' });
  } catch (err) {
    console.error('Erro ao deletar animal:', err);
    res.status(500).json({ error: 'Erro ao deletar animal.' });
  } finally {
    conn.release();
  }
};

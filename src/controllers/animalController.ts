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

export const getAnimalById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM animals WHERE id = ?', [id]);
    const animal = (rows as any)[0];

    if (!animal) {
      return res.status(404).json({ error: 'Animal não encontrado.' });
    }

    res.status(200).json(animal);
  } catch (err) {
    console.error(`Erro ao buscar animal com id ${id}:`, err);
    res.status(500).json({ error: 'Erro ao buscar animal.' });
  } finally {
    conn.release();
  }
};

export const createAnimal = async (req: Request, res: Response) => {
  const { name, species, breed, latitude, longitude, created_by, health_status } = req.body;
  const image_url = req.file ? req.file.path : null;
  const conn = await db.getConnection();

  if (!name || !species || !health_status) {
    return res.status(400).json({ error: 'Nome, espécie e estado de saúde são obrigatórios.' });
  }

  try {
    const [result] = await conn.query(
      `INSERT INTO animals (name, species, breed, latitude, longitude, created_by, health_status, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, species, breed || null, latitude || null, longitude || null, created_by || null, health_status, image_url]
    );

    res.status(201).json({
      id: (result as any).insertId,
      name,
      species,
      breed,
      latitude,
      longitude,
      created_by,
      health_status,
      image_url,
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
  const { name, species, breed, latitude, longitude, health_status } = req.body;
  const conn = await db.getConnection();

  if (!name || !species || !health_status) {
    return res.status(400).json({ error: 'Nome, espécie e estado de saúde são obrigatórios.' });
  }

  try {
    let query = 'UPDATE animals SET name = ?, species = ?, breed = ?, latitude = ?, longitude = ?, health_status = ?';
    const params: any[] = [name, species, breed, latitude, longitude, health_status];

    if (req.file) {
      query += ', image_url = ?';
      params.push(req.file.path);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await conn.query(query, params);

    res.status(200).json({ id, message: 'Animal atualizado com sucesso.' });
  } catch (err) {
    console.error(`Erro ao atualizar animal com id ${id}:`, err);
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
    console.error(`Erro ao deletar animal com id ${id}:`, err);
    res.status(500).json({ error: 'Erro ao deletar animal.' });
  } finally {
    conn.release();
  }
};
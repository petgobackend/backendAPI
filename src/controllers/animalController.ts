import { Request, Response } from 'express';
import db from '../utils/db';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import fs from 'fs';

const visionClient = new ImageAnnotatorClient({
  keyFilename: 'gcp-credentials.json'
});

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
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhuma imagem foi enviada.' });
  }
  const imagePath = req.file.path;
  const conn = await db.getConnection();
  
  try {
    const [result] = await visionClient.safeSearchDetection(imagePath);
    const detections = result.safeSearchAnnotation;

    if (
      detections?.adult === 'VERY_LIKELY' || detections?.adult === 'LIKELY' ||
      detections?.violence === 'VERY_LIKELY' || detections?.violence === 'LIKELY' ||
      detections?.racy === 'VERY_LIKELY' || detections?.racy === 'LIKELY'
    ) {
      fs.unlinkSync(imagePath);
      return res.status(400).json({ error: 'A imagem enviada é inadequada.' });
    }

    const { name, species, breed, latitude, longitude, created_by, health_status } = req.body;

    if (!name || !species || !health_status) {
      fs.unlinkSync(imagePath);
      return res.status(400).json({ error: 'Nome, espécie e estado de saúde são obrigatórios.' });
    }

    await conn.beginTransaction();
    const [dbResult] = await conn.query(
      `INSERT INTO animals (name, species, breed, latitude, longitude, created_by, health_status, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, species, breed || null, latitude || null, longitude || null, created_by || null, health_status, imagePath]
    );
    await conn.commit();

    res.status(201).json({
      id: (dbResult as any).insertId, name, species, breed, latitude, longitude, created_by, health_status, image_url: imagePath
    });

  } catch (err) {
    await conn.rollback();
    fs.unlinkSync(imagePath);
    console.error('Erro ao criar animal:', err);
    res.status(500).json({ error: 'Erro interno ao criar animal.' });
  } finally {
    conn.release();
  }
};

export const updateAnimal = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, species, breed, latitude, longitude, health_status } = req.body;
  const conn = await db.getConnection();
  let newImagePath: string | undefined;

  if (!name || !species || !health_status) {
    return res.status(400).json({ error: 'Nome, espécie e estado de saúde são obrigatórios.' });
  }

  try {
    if (req.file) {
      newImagePath = req.file.path;
      const [result] = await visionClient.safeSearchDetection(newImagePath);
      const detections = result.safeSearchAnnotation;

      if (
        detections?.adult === 'VERY_LIKELY' || detections?.adult === 'LIKELY' ||
        detections?.violence === 'VERY_LIKELY' || detections?.violence === 'LIKELY' ||
        detections?.racy === 'VERY_LIKELY' || detections?.racy === 'LIKELY'
      ) {
        fs.unlinkSync(newImagePath);
        return res.status(400).json({ error: 'A nova imagem enviada é inadequada.' });
      }
    }

    let query = 'UPDATE animals SET name = ?, species = ?, breed = ?, latitude = ?, longitude = ?, health_status = ?';
    const params: any[] = [name, species, breed, latitude, longitude, health_status];

    if (newImagePath) {
      query += ', image_url = ?';
      params.push(newImagePath);
    }

    query += ' WHERE id = ?';
    params.push(id);
    
    await conn.beginTransaction();
    await conn.query(query, params);
    await conn.commit();

    res.status(200).json({ id, message: 'Animal atualizado com sucesso.' });
  } catch (err) {
    await conn.rollback();
    if (newImagePath) {
      fs.unlinkSync(newImagePath);
    }
    console.error(`Erro ao atualizar animal com id ${id}:`, err);
    res.status(500).json({ error: 'Erro interno ao atualizar animal.' });
  } finally {
    conn.release();
  }
};

export const deleteAnimal = async (req: Request, res: Response) => {
  const { id } = req.params;
  const conn = await db.getConnection();
  try {
    // Adicionar lógica para remover a imagem do sistema de arquivos se necessário
    await conn.query('DELETE FROM animals WHERE id = ?', [id]);
    res.status(200).json({ message: 'Animal deletado com sucesso.' });
  } catch (err) {
    console.error(`Erro ao deletar animal com id ${id}:`, err);
    res.status(500).json({ error: 'Erro ao deletar animal.' });
  } finally {
    conn.release();
  }
};
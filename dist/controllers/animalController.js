"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAnimal = exports.updateAnimal = exports.createAnimal = exports.getAnimalById = exports.getAnimals = void 0;
const db_1 = __importDefault(require("../utils/db"));
const vision_1 = require("@google-cloud/vision");
const fs_1 = __importDefault(require("fs"));
const visionClient = new vision_1.ImageAnnotatorClient({
    keyFilename: 'gcp-credentials.json'
});
const getAnimals = async (req, res) => {
    const conn = await db_1.default.getConnection();
    try {
        const [rows] = await conn.query('SELECT * FROM animals');
        res.status(200).json(rows);
    }
    catch (err) {
        console.error('Erro ao buscar animais:', err);
        res.status(500).json({ error: 'Erro ao buscar animais.' });
    }
    finally {
        conn.release();
    }
};
exports.getAnimals = getAnimals;
const getAnimalById = async (req, res) => {
    const { id } = req.params;
    const conn = await db_1.default.getConnection();
    try {
        const [rows] = await conn.query('SELECT * FROM animals WHERE id = ?', [id]);
        const animal = rows[0];
        if (!animal) {
            return res.status(404).json({ error: 'Animal não encontrado.' });
        }
        res.status(200).json(animal);
    }
    catch (err) {
        console.error(`Erro ao buscar animal com id ${id}:`, err);
        res.status(500).json({ error: 'Erro ao buscar animal.' });
    }
    finally {
        conn.release();
    }
};
exports.getAnimalById = getAnimalById;
const createAnimal = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhuma imagem foi enviada.' });
    }
    const imagePath = req.file.path;
    const conn = await db_1.default.getConnection();
    try {
        const [result] = await visionClient.safeSearchDetection(imagePath);
        const detections = result.safeSearchAnnotation;
        if (detections?.adult === 'VERY_LIKELY' || detections?.adult === 'LIKELY' ||
            detections?.violence === 'VERY_LIKELY' || detections?.violence === 'LIKELY' ||
            detections?.racy === 'VERY_LIKELY' || detections?.racy === 'LIKELY') {
            fs_1.default.unlinkSync(imagePath);
            return res.status(400).json({ error: 'A imagem enviada é inadequada.' });
        }
        const { name, species, breed, latitude, longitude, created_by, health_status } = req.body;
        if (!name || !species || !health_status) {
            fs_1.default.unlinkSync(imagePath);
            return res.status(400).json({ error: 'Nome, espécie e estado de saúde são obrigatórios.' });
        }
        await conn.beginTransaction();
        const [dbResult] = await conn.query(`INSERT INTO animals (name, species, breed, latitude, longitude, created_by, health_status, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [name, species, breed || null, latitude || null, longitude || null, created_by || null, health_status, imagePath]);
        await conn.commit();
        res.status(201).json({
            id: dbResult.insertId, name, species, breed, latitude, longitude, created_by, health_status, image_url: imagePath
        });
    }
    catch (err) {
        await conn.rollback();
        fs_1.default.unlinkSync(imagePath);
        console.error('Erro ao criar animal:', err);
        res.status(500).json({ error: 'Erro interno ao criar animal.' });
    }
    finally {
        conn.release();
    }
};
exports.createAnimal = createAnimal;
const updateAnimal = async (req, res) => {
    const { id } = req.params;
    const { name, species, breed, latitude, longitude, health_status } = req.body;
    const conn = await db_1.default.getConnection();
    let newImagePath;
    if (!name || !species || !health_status) {
        return res.status(400).json({ error: 'Nome, espécie e estado de saúde são obrigatórios.' });
    }
    try {
        if (req.file) {
            newImagePath = req.file.path;
            const [result] = await visionClient.safeSearchDetection(newImagePath);
            const detections = result.safeSearchAnnotation;
            if (detections?.adult === 'VERY_LIKELY' || detections?.adult === 'LIKELY' ||
                detections?.violence === 'VERY_LIKELY' || detections?.violence === 'LIKELY' ||
                detections?.racy === 'VERY_LIKELY' || detections?.racy === 'LIKELY') {
                fs_1.default.unlinkSync(newImagePath);
                return res.status(400).json({ error: 'A nova imagem enviada é inadequada.' });
            }
        }
        let query = 'UPDATE animals SET name = ?, species = ?, breed = ?, latitude = ?, longitude = ?, health_status = ?';
        const params = [name, species, breed, latitude, longitude, health_status];
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
    }
    catch (err) {
        await conn.rollback();
        if (newImagePath) {
            fs_1.default.unlinkSync(newImagePath);
        }
        console.error(`Erro ao atualizar animal com id ${id}:`, err);
        res.status(500).json({ error: 'Erro interno ao atualizar animal.' });
    }
    finally {
        conn.release();
    }
};
exports.updateAnimal = updateAnimal;
const deleteAnimal = async (req, res) => {
    const { id } = req.params;
    const conn = await db_1.default.getConnection();
    try {
        // Adicionar lógica para remover a imagem do sistema de arquivos se necessário
        await conn.query('DELETE FROM animals WHERE id = ?', [id]);
        res.status(200).json({ message: 'Animal deletado com sucesso.' });
    }
    catch (err) {
        console.error(`Erro ao deletar animal com id ${id}:`, err);
        res.status(500).json({ error: 'Erro ao deletar animal.' });
    }
    finally {
        conn.release();
    }
};
exports.deleteAnimal = deleteAnimal;

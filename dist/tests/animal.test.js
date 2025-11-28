"use strict";
// src/tests/animal.test.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 1) MOCK DO GOOGLE VISION (deve vir ANTES de qualquer import)
 * Mantém um único objeto de cliente e muda apenas o comportamento da função.
 * Assim, o controller continua usando a mesma instância mesmo após mudar o modo.
 */
jest.mock('@google-cloud/vision', () => {
    const client = {
        safeSearchDetection: jest.fn().mockResolvedValue([{
                safeSearchAnnotation: {
                    adult: 'UNLIKELY',
                    violence: 'UNLIKELY',
                    racy: 'UNLIKELY',
                }
            }])
    };
    return {
        ImageAnnotatorClient: jest.fn(() => client),
        __setVisionSafe: () => {
            client.safeSearchDetection.mockResolvedValue([{
                    safeSearchAnnotation: {
                        adult: 'UNLIKELY',
                        violence: 'UNLIKELY',
                        racy: 'UNLIKELY',
                    }
                }]);
        },
        __setVisionUnsafe: () => {
            client.safeSearchDetection.mockResolvedValue([{
                    safeSearchAnnotation: {
                        adult: 'VERY_LIKELY',
                        violence: 'LIKELY',
                        racy: 'LIKELY',
                    }
                }]);
        },
    };
});
// 2) Agora os imports normais
const supertest_1 = __importDefault(require("supertest"));
const index_1 = __importDefault(require("../index"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Importa os helpers do mock da Vision
const { __setVisionSafe, __setVisionUnsafe } = require('@google-cloud/vision');
const mem = {
    animals: [],
    shouldFailDelete: false,
};
jest.mock('../utils/db', () => {
    return {
        __esModule: true,
        default: {
            getConnection: async () => ({
                beginTransaction: async () => { },
                commit: async () => { },
                rollback: async () => { },
                release: () => { },
                query: async (sql, params) => {
                    // SELECT * FROM animals
                    if (/SELECT \* FROM animals\b/.test(sql) && !/WHERE id/.test(sql)) {
                        return [mem.animals.slice()];
                    }
                    // SELECT * FROM animals WHERE id = ?
                    if (/SELECT \* FROM animals WHERE id = \?/.test(sql)) {
                        const id = Number(params?.[0]);
                        const row = mem.animals.find(a => a.id === id);
                        return [[row].filter(Boolean)];
                    }
                    // INSERT INTO animals (...)
                    if (/INSERT INTO animals\b/.test(sql)) {
                        const id = (mem.animals[mem.animals.length - 1]?.id ?? 0) + 1;
                        const [name, species, breed, latitude, longitude, created_by, health_status, image_url] = params ?? [];
                        const row = {
                            id,
                            name,
                            species,
                            breed,
                            latitude: latitude != null ? Number(latitude) : null,
                            longitude: longitude != null ? Number(longitude) : null,
                            created_by: created_by != null ? Number(created_by) : null,
                            health_status,
                            image_url,
                        };
                        mem.animals.push(row);
                        return [{ insertId: id }];
                    }
                    // UPDATE animals SET ...
                    if (/UPDATE animals SET\b/.test(sql)) {
                        const id = Number(params?.[params.length - 1]);
                        const idx = mem.animals.findIndex(a => a.id === id);
                        if (idx >= 0) {
                            const [name, species, breed, latitude, longitude, health_status] = params;
                            mem.animals[idx] = {
                                ...mem.animals[idx],
                                name,
                                species,
                                breed,
                                latitude: latitude != null ? Number(latitude) : null,
                                longitude: longitude != null ? Number(longitude) : null,
                                health_status,
                                ...(params && params.length === 8 ? { image_url: params[6] } : {}),
                            };
                        }
                        return [{}];
                    }
                    // DELETE FROM animals WHERE id = ?
                    if (/DELETE FROM animals WHERE id = \?/.test(sql)) {
                        if (mem.shouldFailDelete)
                            throw new Error('forced-delete-error');
                        const id = Number(params?.[0]);
                        const antes = mem.animals.length;
                        mem.animals = mem.animals.filter(a => a.id !== id);
                        return [{ affectedRows: antes !== mem.animals.length ? 1 : 0 }];
                    }
                    return [[]];
                },
            }),
        },
    };
});
/**
 * 4) Preparação do arquivo temporário para upload
 */
const uploadsDir = path_1.default.join(__dirname, '../../uploads');
const tempImage = path_1.default.join(uploadsDir, 'tmp-test-image.jpg');
beforeAll(() => {
    if (!fs_1.default.existsSync(uploadsDir))
        fs_1.default.mkdirSync(uploadsDir, { recursive: true });
    // Cria um JPEG mínimo
    fs_1.default.writeFileSync(tempImage, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
});
afterAll(() => {
    try {
        fs_1.default.unlinkSync(tempImage);
    }
    catch { }
});
beforeEach(() => {
    mem.animals = [];
    mem.shouldFailDelete = false;
    // Sempre começa com o Vision no modo seguro
    __setVisionSafe();
    jest.clearAllMocks();
});
/**
 * 5) TESTES
 */
describe('Animal Controller', () => {
    it('deve criar um novo animal (201) quando multipart válido', async () => {
        const res = await (0, supertest_1.default)(index_1.default)
            .post('/animals')
            .field('name', 'Rex')
            .field('species', 'cachorro')
            .field('breed', 'Vira-lata')
            .field('health_status', 'Saudável')
            .field('latitude', '-23.5')
            .field('longitude', '-46.6')
            .field('created_by', '1')
            .attach('image', tempImage);
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toBe('Rex');
    });
    it('deve retornar 400 quando nenhuma imagem for enviada', async () => {
        const res = await (0, supertest_1.default)(index_1.default)
            .post('/animals')
            .field('name', 'Rex')
            .field('species', 'cachorro')
            .field('health_status', 'Saudável');
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Nenhuma imagem foi enviada.');
    });
    it('deve retornar 400 quando faltar campos obrigatórios (name/species/health_status)', async () => {
        const res = await (0, supertest_1.default)(index_1.default)
            .post('/animals')
            .field('species', 'cachorro') // faltando name e health_status
            .attach('image', tempImage);
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Nome, espécie e estado de saúde são obrigatórios.');
    });
    it('deve retornar 400 quando a Vision classificar a imagem como inadequada', async () => {
        __setVisionUnsafe();
        const res = await (0, supertest_1.default)(index_1.default)
            .post('/animals')
            .field('name', 'Milo')
            .field('species', 'gato')
            .field('health_status', 'Ok')
            .attach('image', tempImage);
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'A imagem enviada é inadequada.');
    });
    it('deve listar os animais (200)', async () => {
        await (0, supertest_1.default)(index_1.default)
            .post('/animals')
            .field('name', 'Rex')
            .field('species', 'cachorro')
            .field('health_status', 'Saudável')
            .attach('image', tempImage);
        const res = await (0, supertest_1.default)(index_1.default).get('/animals');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(1);
    });
    it('deve buscar um animal por id (200) e retornar 404 quando não existir', async () => {
        const create = await (0, supertest_1.default)(index_1.default)
            .post('/animals')
            .field('name', 'Rex')
            .field('species', 'cachorro')
            .field('health_status', 'Saudável')
            .attach('image', tempImage);
        const id = create.body.id;
        const ok = await (0, supertest_1.default)(index_1.default).get(`/animals/${id}`);
        expect(ok.status).toBe(200);
        expect(ok.body).toHaveProperty('id', id);
        const notFound = await (0, supertest_1.default)(index_1.default).get('/animals/9999');
        expect(notFound.status).toBe(404);
        expect(notFound.body).toHaveProperty('error', 'Animal não encontrado.');
    });
    it('deve atualizar um animal (200) e falhar com 400 se faltar campos obrigatórios', async () => {
        const create = await (0, supertest_1.default)(index_1.default)
            .post('/animals')
            .field('name', 'Rex')
            .field('species', 'cachorro')
            .field('health_status', 'Saudável')
            .attach('image', tempImage);
        const id = create.body.id;
        const ok = await (0, supertest_1.default)(index_1.default)
            .put(`/animals/${id}`)
            .field('name', 'Rex Atualizado')
            .field('species', 'cachorro')
            .field('breed', 'Vira-lata')
            .field('latitude', '-23.5')
            .field('longitude', '-46.6')
            .field('health_status', 'Ok');
        expect(ok.status).toBe(200);
        expect(ok.body).toHaveProperty('id', String(id));
        const bad = await (0, supertest_1.default)(index_1.default)
            .put(`/animals/${id}`)
            // faltando name/species/health_status
            .field('breed', 'Outra');
        expect(bad.status).toBe(400);
        expect(bad.body).toHaveProperty('error', 'Nome, espécie e estado de saúde são obrigatórios.');
    });
    it('deve retornar 400 no update quando a nova imagem for inadequada', async () => {
        const create = await (0, supertest_1.default)(index_1.default)
            .post('/animals')
            .field('name', 'Rex')
            .field('species', 'cachorro')
            .field('health_status', 'Saudável')
            .attach('image', tempImage);
        const id = create.body.id;
        __setVisionUnsafe();
        const bad = await (0, supertest_1.default)(index_1.default)
            .put(`/animals/${id}`)
            .field('name', 'Rex')
            .field('species', 'cachorro')
            .field('breed', 'Vira-lata')
            .field('latitude', '-23.5')
            .field('longitude', '-46.6')
            .field('health_status', 'Ok')
            .attach('image', tempImage);
        expect(bad.status).toBe(400);
        expect(bad.body).toHaveProperty('error', 'A nova imagem enviada é inadequada.');
    });
    it('deve deletar um animal (200) e simular erro 500 no delete', async () => {
        const create = await (0, supertest_1.default)(index_1.default)
            .post('/animals')
            .field('name', 'Rex')
            .field('species', 'cachorro')
            .field('health_status', 'Saudável')
            .attach('image', tempImage);
        const id = create.body.id;
        const ok = await (0, supertest_1.default)(index_1.default).delete(`/animals/${id}`);
        expect(ok.status).toBe(200);
        expect(ok.body).toHaveProperty('message', 'Animal deletado com sucesso.');
        mem.shouldFailDelete = true;
        const fail = await (0, supertest_1.default)(index_1.default).delete(`/animals/${id}`);
        expect(fail.status).toBe(500);
        expect(fail.body).toHaveProperty('error', 'Erro ao deletar animal.');
    });
});

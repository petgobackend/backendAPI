"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const index_1 = __importDefault(require("../index"));
// ───────────────────────────────────────────────────────────────
// MOCK DO GOOGLE VISION – CONTROLAR SE A IMAGEM É SEGURA OU NÃO
// ───────────────────────────────────────────────────────────────
let safeSearchMock = jest.fn();
jest.mock('@google-cloud/vision', () => ({
    ImageAnnotatorClient: jest.fn().mockImplementation(() => ({
        safeSearchDetection: (...args) => safeSearchMock(...args)
    }))
}));
const usersTable = [];
const animalsTable = [];
let userIdSeq = 1;
let animalIdSeq = 1;
const baseQueryImpl = async (sql, params = []) => {
    const normalized = sql.trim().toLowerCase();
    // USERS
    if (normalized.startsWith('select id, name, email, cpf from users')) {
        const rows = usersTable.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            cpf: u.cpf
        }));
        return [rows];
    }
    if (normalized.startsWith('insert into users')) {
        const [name, email, cpf, password] = params;
        const already = usersTable.find(u => u.email === email || u.cpf === cpf);
        if (already) {
            const dupErr = new Error('dup entry');
            dupErr.code = 'ER_DUP_ENTRY';
            throw dupErr;
        }
        const newUser = {
            id: userIdSeq++,
            name,
            email,
            cpf,
            password
        };
        usersTable.push(newUser);
        return [{ insertId: newUser.id }];
    }
    if (normalized.startsWith('update users set name = ?, email = ?, cpf = ? where id = ?')) {
        const [name, email, cpf, id] = params;
        const sameEmailCpf = usersTable.find(u => (u.email === email || u.cpf === cpf) && u.id !== Number(id));
        if (sameEmailCpf) {
            const dupErr = new Error('dup entry');
            dupErr.code = 'ER_DUP_ENTRY';
            throw dupErr;
        }
        const user = usersTable.find(u => u.id === Number(id));
        if (!user) {
            return [{ affectedRows: 0 }];
        }
        user.name = name;
        user.email = email;
        user.cpf = cpf;
        return [{ affectedRows: 1 }];
    }
    if (normalized.startsWith('delete from users where id = ?')) {
        const [id] = params;
        const idx = usersTable.findIndex(u => u.id === Number(id));
        if (idx === -1) {
            return [{ affectedRows: 0 }];
        }
        usersTable.splice(idx, 1);
        return [{ affectedRows: 1 }];
    }
    if (normalized.startsWith('select * from users where email = ?')) {
        const [email] = params;
        const rows = usersTable.filter(u => u.email === email);
        return [rows];
    }
    // ANIMALS
    if (normalized.startsWith('select * from animals where id = ?')) {
        const [id] = params;
        const rows = animalsTable.filter(a => a.id === Number(id));
        return [rows];
    }
    if (normalized.startsWith('select * from animals')) {
        return [animalsTable.slice()];
    }
    if (normalized.startsWith('insert into animals')) {
        const [name, species, breed, latitude, longitude, created_by, health_status, image_url] = params;
        const newAnimal = {
            id: animalIdSeq++,
            name,
            species,
            breed: breed ?? null,
            latitude: latitude !== null ? Number(latitude) : null,
            longitude: longitude !== null ? Number(longitude) : null,
            created_by: created_by !== null ? Number(created_by) : null,
            health_status,
            image_url
        };
        animalsTable.push(newAnimal);
        return [{ insertId: newAnimal.id }];
    }
    if (normalized.startsWith('update animals set')) {
        const hasImageUrl = normalized.includes('image_url = ?');
        const paramsCopy = [...params];
        const id = paramsCopy[paramsCopy.length - 1];
        const animal = animalsTable.find(a => a.id === Number(id));
        if (!animal) {
            return [{ affectedRows: 0 }];
        }
        if (hasImageUrl) {
            const [name, species, breed, latitude, longitude, health_status, image_url] = paramsCopy.slice(0, 7);
            animal.name = name;
            animal.species = species;
            animal.breed = breed;
            animal.latitude = latitude !== null ? Number(latitude) : null;
            animal.longitude = longitude !== null ? Number(longitude) : null;
            animal.health_status = health_status;
            animal.image_url = image_url;
        }
        else {
            const [name, species, breed, latitude, longitude, health_status] = paramsCopy.slice(0, 6);
            animal.name = name;
            animal.species = species;
            animal.breed = breed;
            animal.latitude = latitude !== null ? Number(latitude) : null;
            animal.longitude = longitude !== null ? Number(longitude) : null;
            animal.health_status = health_status;
        }
        return [{ affectedRows: 1 }];
    }
    if (normalized.startsWith('delete from animals where id = ?')) {
        const [id] = params;
        const idx = animalsTable.findIndex(a => a.id === Number(id));
        if (idx === -1) {
            return [{ affectedRows: 0 }];
        }
        animalsTable.splice(idx, 1);
        return [{ affectedRows: 1 }];
    }
    return [[]];
};
const mockConnection = {
    query: jest.fn(baseQueryImpl),
    beginTransaction: jest.fn(async () => { }),
    commit: jest.fn(async () => { }),
    rollback: jest.fn(async () => { }),
    release: jest.fn(() => { })
};
jest.mock('../utils/db', () => ({
    __esModule: true,
    default: {
        getConnection: jest.fn().mockResolvedValue(mockConnection)
    }
}));
// ───────────────────────────────────────────────────────────────
// SETUP GERAL
// ───────────────────────────────────────────────────────────────
const createTempImage = () => {
    const tempDir = path_1.default.join(__dirname, 'tmp');
    if (!fs_1.default.existsSync(tempDir)) {
        fs_1.default.mkdirSync(tempDir);
    }
    const imgPath = path_1.default.join(tempDir, 'test-image.jpg');
    fs_1.default.writeFileSync(imgPath, 'dummy image content');
    return imgPath;
};
beforeEach(() => {
    usersTable.length = 0;
    animalsTable.length = 0;
    userIdSeq = 1;
    animalIdSeq = 1;
    mockConnection.query.mockImplementation(baseQueryImpl);
    safeSearchMock.mockReset();
    safeSearchMock.mockResolvedValue([
        {
            safeSearchAnnotation: {
                adult: 'UNLIKELY',
                violence: 'UNLIKELY',
                racy: 'UNLIKELY'
            }
        }
    ]);
});
// ───────────────────────────────────────────────────────────────
// TESTES DE INTEGRAÇÃO – USERS
// ───────────────────────────────────────────────────────────────
describe('Integração /users', () => {
    it('deve criar usuário e fazer login com sucesso', async () => {
        const createRes = await (0, supertest_1.default)(index_1.default)
            .post('/users')
            .send({
            name: 'Marcela',
            email: 'marcela@example.com',
            cpf: '12345678900',
            password: 'senha123'
        });
        expect(createRes.status).toBe(201);
        expect(createRes.body.status).toBe('success');
        expect(createRes.body.data).toMatchObject({
            name: 'Marcela',
            email: 'marcela@example.com',
            cpf: '12345678900'
        });
        const loginRes = await (0, supertest_1.default)(index_1.default)
            .post('/users/login')
            .send({
            email: 'marcela@example.com',
            password: 'senha123'
        });
        expect(loginRes.status).toBe(200);
        expect(loginRes.body.status).toBe('success');
        expect(loginRes.body.data).toHaveProperty('token');
        expect(loginRes.body.data.user.email).toBe('marcela@example.com');
    });
    it('deve retornar 409 ao tentar criar usuário duplicado', async () => {
        await (0, supertest_1.default)(index_1.default)
            .post('/users')
            .send({
            name: 'Marcela',
            email: 'marcela@example.com',
            cpf: '12345678900',
            password: 'senha123'
        });
        const dupRes = await (0, supertest_1.default)(index_1.default)
            .post('/users')
            .send({
            name: 'Outra Marcela',
            email: 'marcela@example.com',
            cpf: '12345678900',
            password: 'senha456'
        });
        expect(dupRes.status).toBe(409);
        expect(dupRes.body.status).toBe('error');
        expect(dupRes.body.message).toBe('Email ou CPF já cadastrado.');
    });
    it('deve retornar 401 ao fazer login com senha incorreta', async () => {
        await (0, supertest_1.default)(index_1.default)
            .post('/users')
            .send({
            name: 'Marcela',
            email: 'marcela@example.com',
            cpf: '12345678900',
            password: 'senha123'
        });
        const badLogin = await (0, supertest_1.default)(index_1.default)
            .post('/users/login')
            .send({
            email: 'marcela@example.com',
            password: 'senhaErrada'
        });
        expect(badLogin.status).toBe(401);
        expect(badLogin.body.status).toBe('error');
        expect(badLogin.body.message).toBe('Credenciais inválidas.');
    });
    it('deve listar usuários com sucesso', async () => {
        await (0, supertest_1.default)(index_1.default)
            .post('/users')
            .send({
            name: 'Marcela',
            email: 'marcela@example.com',
            cpf: '12345678900',
            password: 'senha123'
        });
        const res = await (0, supertest_1.default)(index_1.default).get('/users');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBe(1);
    });
});
// ───────────────────────────────────────────────────────────────
// TESTES DE INTEGRAÇÃO – ANIMALS
// ───────────────────────────────────────────────────────────────
describe('Integração /animals', () => {
    it('deve listar animais (inicialmente vazio)', async () => {
        const res = await (0, supertest_1.default)(index_1.default).get('/animals');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(0);
    });
    it('deve criar animal com imagem válida', async () => {
        const imgPath = createTempImage();
        const res = await (0, supertest_1.default)(index_1.default)
            .post('/animals')
            .field('name', 'Rex')
            .field('species', 'Cachorro')
            .field('breed', 'Vira-lata')
            .field('latitude', '-23.5')
            .field('longitude', '-46.6')
            .field('created_by', '1')
            .field('health_status', 'Saudável')
            .attach('image', imgPath);
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toBe('Rex');
        const list = await (0, supertest_1.default)(index_1.default).get('/animals');
        expect(list.body.length).toBe(1);
    });
    it('deve retornar 400 ao criar animal sem imagem', async () => {
        const res = await (0, supertest_1.default)(index_1.default)
            .post('/animals')
            .field('name', 'Rex')
            .field('species', 'Cachorro')
            .field('health_status', 'Saudável');
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Nenhuma imagem foi enviada.');
    });
    it('deve retornar 400 quando a Vision classificar a imagem como inadequada', async () => {
        const imgPath = createTempImage();
        safeSearchMock.mockResolvedValueOnce([
            {
                safeSearchAnnotation: {
                    adult: 'VERY_LIKELY',
                    violence: 'UNLIKELY',
                    racy: 'UNLIKELY'
                }
            }
        ]);
        const res = await (0, supertest_1.default)(index_1.default)
            .post('/animals')
            .field('name', 'Rex')
            .field('species', 'Cachorro')
            .field('health_status', 'Saudável')
            .attach('image', imgPath);
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'A imagem enviada é inadequada.');
    });
    it('deve buscar animal por id existente e retornar 404 para inexistente', async () => {
        const imgPath = createTempImage();
        const create = await (0, supertest_1.default)(index_1.default)
            .post('/animals')
            .field('name', 'Rex')
            .field('species', 'Cachorro')
            .field('health_status', 'Saudável')
            .attach('image', imgPath);
        const id = create.body.id;
        const ok = await (0, supertest_1.default)(index_1.default).get(`/animals/${id}`);
        expect(ok.status).toBe(200);
        expect(ok.body.id).toBe(id);
        const notFound = await (0, supertest_1.default)(index_1.default).get('/animals/9999');
        expect(notFound.status).toBe(404);
        expect(notFound.body).toHaveProperty('error', 'Animal não encontrado.');
    });
    it('deve atualizar animal com sucesso', async () => {
        const imgPath = createTempImage();
        const create = await (0, supertest_1.default)(index_1.default)
            .post('/animals')
            .field('name', 'Rex')
            .field('species', 'Cachorro')
            .field('health_status', 'Saudável')
            .attach('image', imgPath);
        const id = create.body.id;
        const update = await (0, supertest_1.default)(index_1.default)
            .put(`/animals/${id}`)
            .field('name', 'Rex Atualizado')
            .field('species', 'Cachorro')
            .field('breed', 'SRD')
            .field('latitude', '-23.4')
            .field('longitude', '-46.5')
            .field('health_status', 'Em tratamento');
        expect(update.status).toBe(200);
        expect(update.body).toHaveProperty('id', String(id));
    });
    it('deve deletar animal com sucesso', async () => {
        const imgPath = createTempImage();
        const create = await (0, supertest_1.default)(index_1.default)
            .post('/animals')
            .field('name', 'Rex')
            .field('species', 'Cachorro')
            .field('health_status', 'Saudável')
            .attach('image', imgPath);
        const id = create.body.id;
        const del = await (0, supertest_1.default)(index_1.default).delete(`/animals/${id}`);
        expect(del.status).toBe(200);
        expect(del.body).toHaveProperty('message', 'Animal deletado com sucesso.');
        const list = await (0, supertest_1.default)(index_1.default).get('/animals');
        expect(list.body.length).toBe(0);
    });
});
// ───────────────────────────────────────────────────────────────
// TESTE DE PONTA A PONTA – FLUXO COMPLETO (E2E-001)
// ───────────────────────────────────────────────────────────────
describe('Fluxo ponta a ponta PetGo (E2E-001)', () => {
    it('deve criar usuário, logar, criar animal, listar e deletar', async () => {
        // 1) Criar usuário
        const createUserRes = await (0, supertest_1.default)(index_1.default)
            .post('/users')
            .send({
            name: 'Fluxo E2E',
            email: 'e2e@example.com',
            cpf: '99999999900',
            password: 'senhaE2E'
        });
        expect(createUserRes.status).toBe(201);
        const userId = createUserRes.body.data.id;
        // 2) Login
        const loginRes = await (0, supertest_1.default)(index_1.default)
            .post('/users/login')
            .send({
            email: 'e2e@example.com',
            password: 'senhaE2E'
        });
        expect(loginRes.status).toBe(200);
        expect(loginRes.body.data).toHaveProperty('token');
        // 3) Criar animal
        const imgPath = createTempImage();
        const createAnimalRes = await (0, supertest_1.default)(index_1.default)
            .post('/animals')
            .field('name', 'Dog E2E')
            .field('species', 'Cachorro')
            .field('health_status', 'Saudável')
            .field('created_by', String(userId))
            .attach('image', imgPath);
        expect(createAnimalRes.status).toBe(201);
        const animalId = createAnimalRes.body.id;
        // 4) Listar animais e verificar se o criado está na lista
        const listRes = await (0, supertest_1.default)(index_1.default).get('/animals');
        expect(listRes.status).toBe(200);
        expect(Array.isArray(listRes.body)).toBe(true);
        const found = listRes.body.find((a) => a.id === animalId);
        expect(found).toBeTruthy();
        // 5) Deletar o animal
        const delRes = await (0, supertest_1.default)(index_1.default).delete(`/animals/${animalId}`);
        expect(delRes.status).toBe(200);
        // 6) Confirmar lista vazia de novo
        const listAfter = await (0, supertest_1.default)(index_1.default).get('/animals');
        expect(listAfter.status).toBe(200);
        expect(listAfter.body.length).toBe(0);
    });
});

"use strict";
// src/tests/integration.crud.test.ts
// TESTES DE INTEGRAÇÃO: Testa a pilha HTTP de CRUD e Validação.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const index_1 = __importDefault(require("../index"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// --- MOCKS (Reaproveitados de animal.test.ts e user.test.ts) ---
// NOTA: Os mocks de DB, bcrypt e JWT devem ser carregados pelo Jest.
const tempImage = path_1.default.join(path_1.default.dirname(__dirname), '../uploads', 'tmp-int-crud.jpg');
beforeAll(() => {
    // Garante que o diretório e o arquivo temporário existam
    const uploadsDir = path_1.default.join(path_1.default.dirname(__dirname), '../uploads');
    if (!fs_1.default.existsSync(uploadsDir))
        fs_1.default.mkdirSync(uploadsDir, { recursive: true });
    fs_1.default.writeFileSync(tempImage, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
});
afterAll(() => { try {
    fs_1.default.unlinkSync(tempImage);
}
catch { } });
describe('TESTES DE INTEGRAÇÃO: CRUD de Usuário e Animal', () => {
    let userId;
    let animalId;
    // --- TESTES DE INTEGRAÇÃO DE USUÁRIO (CRUD BÁSICO) ---
    describe('User CRUD & Validation', () => {
        it('1. POST /users: Deve registrar um novo usuário (201)', async () => {
            const res = await (0, supertest_1.default)(index_1.default).post('/users').send({
                name: 'Int User', email: 'int@crud.com', cpf: '000.000.000-00', password: 'pw',
            });
            expect(res.status).toBe(201);
            userId = String(res.body.data.id);
        });
        it('2. POST /users/login: Deve logar o usuário (200)', async () => {
            const res = await (0, supertest_1.default)(index_1.default).post('/users/login').send({
                email: 'int@crud.com', password: 'pw',
            });
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveProperty('token');
        });
        it('3. PUT /users/:id: Deve retornar 400 se faltar campo obrigatório no update', async () => {
            // LINHA 49 CORRIGIDA: Uso correto da sintaxe de Template Literal
            const res = await (0, supertest_1.default)(index_1.default)
                .put(/users/$, { userId })
                .send({ name: 'Update Test', email: 'int@crud.com' });
            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('message', 'Nome e cpf são obrigatórios.');
        });
        it('4. DELETE /users/:id: Deve deletar o usuário (200)', async () => {
            // LINHA 58 CORRIGIDA: Uso correto da sintaxe de Template Literal
            const res = await (0, supertest_1.default)(index_1.default).delete(/users/$, { userId });
            expect(res.status).toBe(200);
        });
    });
    // --- TESTES DE INTEGRAÇÃO DE ANIMAL (CRUD BÁSICO) ---
    describe('Animal CRUD & Validation', () => {
        it('5. POST /animals: Deve criar um animal com sucesso (201)', async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .post('/animals')
                .field('name', 'Animal Crud')
                .field('species', 'cachorro')
                .field('health_status', 'Saudável')
                .attach('image', tempImage);
            expect(res.status).toBe(201);
            animalId = res.body.id;
        });
        it('6. GET /animals: Deve listar animais (200)', async () => {
            const res = await (0, supertest_1.default)(index_1.default).get('/animals');
            expect(res.status).toBe(200);
            expect(res.body.length).toBeGreaterThan(0);
        });
        it('7. PUT /animals/:id: Deve atualizar animal com sucesso (200)', async () => {
            // LINHA 86 CORRIGIDA: Uso correto da sintaxe de Template Literal
            const res = await (0, supertest_1.default)(index_1.default)
                .put(/animals/$, { animalId })
                .field('name', 'Atualizado')
                .field('species', 'cachorro')
                .field('health_status', 'Ok');
            expect(res.status).toBe(200);
        });
        it('8. DELETE /animals/:id: Deve deletar o animal (200)', async () => {
            // LINHA 96 CORRIGIDA: Uso correto da sintaxe de Template Literal
            const res = await (0, supertest_1.default)(index_1.default).delete(/animals/$, { animalId });
            expect(res.status).toBe(200);
        });
    });
});

// src/tests/integration.crud.test.ts
// TESTES DE INTEGRAÇÃO: Testa a pilha HTTP de CRUD e Validação.

import request from 'supertest';
import app from '../index';
import path from 'path';
import fs from 'fs';

// --- MOCKS (Reaproveitados de animal.test.ts e user.test.ts) ---
// NOTA: Os mocks de DB, bcrypt e JWT devem ser carregados pelo Jest.

const tempImage = path.join(path.dirname(__dirname), '../uploads', 'tmp-int-crud.jpg');

beforeAll(() => {
    // Garante que o diretório e o arquivo temporário existam
    const uploadsDir = path.join(path.dirname(__dirname), '../uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(tempImage, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
});
afterAll(() => { try { fs.unlinkSync(tempImage); } catch {} });


describe('TESTES DE INTEGRAÇÃO: CRUD de Usuário e Animal', () => {
    let userId: string;
    let animalId: number;

    // --- TESTES DE INTEGRAÇÃO DE USUÁRIO (CRUD BÁSICO) ---
    describe('User CRUD & Validation', () => {
        it('1. POST /users: Deve registrar um novo usuário (201)', async () => {
            const res = await request(app).post('/users').send({
                name: 'Int User', email: 'int@crud.com', cpf: '000.000.000-00', password: 'pw',
            });
            expect(res.status).toBe(201);
            userId = String(res.body.data.id);
        });

        it('2. POST /users/login: Deve logar o usuário (200)', async () => {
            const res = await request(app).post('/users/login').send({
                email: 'int@crud.com', password: 'pw',
            });
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveProperty('token');
        });

        it('3. PUT /users/:id: Deve retornar 400 se faltar campo obrigatório no update', async () => {
            // LINHA 49 CORRIGIDA: Uso correto da sintaxe de Template Literal
            const res = await request(app)
                .put(/users/${userId}) 
                .send({ name: 'Update Test', email: 'int@crud.com' }); 
                
            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('message', 'Nome e cpf são obrigatórios.'); 
        });
        
        it('4. DELETE /users/:id: Deve deletar o usuário (200)', async () => {
            // LINHA 58 CORRIGIDA: Uso correto da sintaxe de Template Literal
            const res = await request(app).delete(/users/${userId});
            expect(res.status).toBe(200);
        });
    });

    // --- TESTES DE INTEGRAÇÃO DE ANIMAL (CRUD BÁSICO) ---
    describe('Animal CRUD & Validation', () => {
        it('5. POST /animals: Deve criar um animal com sucesso (201)', async () => {
            const res = await request(app)
                .post('/animals')
                .field('name', 'Animal Crud')
                .field('species', 'cachorro')
                .field('health_status', 'Saudável')
                .attach('image', tempImage);
            
            expect(res.status).toBe(201);
            animalId = res.body.id;
        });

        it('6. GET /animals: Deve listar animais (200)', async () => {
            const res = await request(app).get('/animals');
            expect(res.status).toBe(200);
            expect(res.body.length).toBeGreaterThan(0);
        });

        it('7. PUT /animals/:id: Deve atualizar animal com sucesso (200)', async () => {
            // LINHA 86 CORRIGIDA: Uso correto da sintaxe de Template Literal
            const res = await request(app)
                .put(/animals/${animalId})
                .field('name', 'Atualizado')
                .field('species', 'cachorro')
                .field('health_status', 'Ok');
                
            expect(res.status).toBe(200);
        });
        
        it('8. DELETE /animals/:id: Deve deletar o animal (200)', async () => {
             // LINHA 96 CORRIGIDA: Uso correto da sintaxe de Template Literal
             const res = await request(app).delete(/animals/${animalId});
             expect(res.status).toBe(200);
        });
    });
});
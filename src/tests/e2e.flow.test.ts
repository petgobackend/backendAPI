// src/tests/e2e.flow.test.ts

import request from 'supertest';
import app from '../index'; // O seu app Express
import fs from 'fs';
import path from 'path';

// NOTA: Para rodar este teste, você deve ter a funcionalidade de mock do
// Google Vision (em animal.test.ts) ativa para evitar chamadas externas.

// 1. Variáveis de Estado para o Fluxo
let authToken: string;
let createdUserId: string;
let createdAnimalId: number;
const tempImagePath = path.join(__dirname, '../../uploads', 'tmp-e2e-image.jpg');

// Cria uma imagem temporária para o upload (Necessário pelo Multer)
beforeAll(() => {
    // Garante que o diretório 'uploads' existe
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    // Cria um JPEG mínimo para o teste
    fs.writeFileSync(tempImagePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
});

// Limpa a imagem temporária no final
afterAll(() => {
    try { fs.unlinkSync(tempImagePath); } catch {}
});


describe('FLUXO E2E (API Flow Simulation)', () => {
    // -----------------------------------------------------------
    // ETAPA 1: REGISTRO E LOGIN DO USUÁRIO
    // -----------------------------------------------------------

    it('1. Deve registrar um novo usuário', async () => {
        const res = await request(app)
            .post('/users')
            .send({
                name: 'E2E Test User',
                email: 'e2e_user_' + Date.now() + '@petgo.com',
                cpf: '111.111.111-11',
                password: 'password123',
            });

        expect(res.status).toBe(201);
        expect(res.body.status).toBe('success');
        
        // Salva o ID para uso futuro (login e deleção)
        createdUserId = String(res.body.data.id);
    });

    it('2. Deve logar o usuário e receber um token JWT', async () => {
        const res = await request(app)
            .post('/users/login')
            .send({
                email: 'e2e_user_' + createdUserId + '@petgo.com', // O email real será o do teste anterior
                password: 'password123',
            });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data).toHaveProperty('token');
        
        // Salva o token para requisições protegidas
        authToken = res.body.data.token;
    });

    // -----------------------------------------------------------
    // ETAPA 2: AÇÕES PROTEGIDAS (Criação de Animal)
    // -----------------------------------------------------------
    
    it('3. Deve criar um novo animal autenticado', async () => {
        const res = await request(app)
            .post('/animals')
            // Adiciona o token na requisição
            .set('Authorization', `Bearer ${authToken}`)
            // Dados e imagem (multipart/form-data)
            .field('name', 'Pingo E2E')
            .field('species', 'cachorro')
            .field('health_status', 'Resgatado')
            .field('created_by', createdUserId)
            .attach('image', tempImagePath); 

        expect(res.status).toBe(201);
        expect(res.body.name).toBe('Pingo E2E');
        expect(res.body).toHaveProperty('id');

        // Salva o ID do animal para a próxima verificação
        createdAnimalId = res.body.id;
    });

    it('4. Deve buscar o animal criado para verificar a persistência', async () => {
        const res = await request(app)
            .get(`/animals/${createdAnimalId}`)
            .set('Authorization', `Bearer ${authToken}`); // Rota GET /animals/:id não é protegida, mas por boas práticas passamos o token se for a intenção

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(createdAnimalId);
        expect(res.body.name).toBe('Pingo E2E');
    });

    // -----------------------------------------------------------
    // ETAPA 3: LIMPEZA (DELETAR O USUÁRIO E ANIMAL CRIADO)
    // -----------------------------------------------------------
    
    it('5. Deve deletar o animal criado', async () => {
        const res = await request(app)
            .delete(`/animals/${createdAnimalId}`)
            .set('Authorization', `Bearer ${authToken}`); // Rota /animals/:id é protegida por auth? Se não for, remova o .set

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Animal deletado com sucesso.');
    });

    it('6. Deve deletar o usuário criado', async () => {
        const res = await request(app)
            .delete(`/users/${createdUserId}`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.message).toBe('Usuário deletado com sucesso.');
    });
});
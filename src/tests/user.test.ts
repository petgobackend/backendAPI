import request from 'supertest';
import app from '../index'; // 
import db from '../utils/db';

describe('User Controller', () => {
  afterAll(async () => {
    await db.end();
  });

  it('deve criar um novo usuário', async () => {
    const response = await request(app)
      .post('/users')
      .send({ name: 'Teste User', email: 'teste@example.com' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe('Teste User');
  });

  it('deve listar todos os usuários', async () => {
    const response = await request(app).get('/users');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});

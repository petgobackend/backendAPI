import request from 'supertest';
import app from '../index';

describe('User Controller', () => {
  it('deve criar um novo usuário', async () => {
    const response = await request(app)
      .post('/users')
      .send({ name: 'Teste User', email: 'teste2@example.com' });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe('Teste User');
  });

  it('deve listar todos os usuários', async () => {
    const response = await request(app).get('/users');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});

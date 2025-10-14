import request from 'supertest';
import app from '../index';
import db from '../utils/db';

describe('Animal Controller', () => {
  afterAll(async () => {
    await db.end();
  });

  it('deve criar um novo animal', async () => {
    const response = await request(app)
      .post('/animals')
      .send({ name: 'Rex', species: 'Cachorro', created_by: 1 });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe('Rex');
  });

  it('deve listar os animais', async () => {
    const response = await request(app).get('/animals');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});

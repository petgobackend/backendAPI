import request from 'supertest';
import app from '../index';

describe('Animal Controller', () => {
  it('deve criar um novo animal', async () => {
    const response = await request(app)
      .post('/animals')
      .send({
        name: 'Rex',
        species: 'Cachorro',
        breed: 'Vira-lata',
        latitude: -23.5,
        longitude: -46.6,
        created_by: 1,
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe('Rex');
  });

  it('deve listar os animais', async () => {
    const response = await request(app).get('/animals');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});

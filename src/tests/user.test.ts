// src/tests/user.test.ts

import request from 'supertest';
import app from '../index';

jest.mock('bcrypt', () => ({
  genSalt: jest.fn().mockResolvedValue('salt'),
  hash: jest.fn().mockImplementation(async (pwd: string) => `hashed:${pwd}`),
  compare: jest.fn().mockImplementation(async (pwd: string, hashed: string) => hashed === `hashed:${pwd}`),
}));

// jwt mock
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockImplementation(() => 'mock.jwt.token'),
}));

type UserRow = {
  id: number;
  name: string;
  email: string;
  cpf: string;
  password: string;
};

const mem = {
  users: [] as UserRow[],
  // flags para simular erros
  forceGetUsersError: false,
  forceCreateUserServerError: false,
  forceUpdateServerError: false,
  forceDeleteServerError: false,
  forceLoginServerError: false,
  // para simular duplicidade
  forceDuplicateOnCreate: false,
  forceDuplicateOnUpdate: false,
};

jest.mock('../utils/db', () => ({
  __esModule: true,
  default: {
    getConnection: async () => ({
      release: () => {},
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      query: async (sql: string, params: any[] = []) => {
        // GET USERS
        if (/^SELECT id, name, email, cpf FROM users/.test(sql)) {
          if (mem.forceGetUsersError) throw new Error('forced-get-users-error');
          // retorna apenas os campos selecionados
          return [mem.users.map(u => ({ id: u.id, name: u.name, email: u.email, cpf: u.cpf }))];
        }

        // CREATE USER
        if (/^INSERT INTO users/.test(sql)) {
          if (mem.forceCreateUserServerError) throw new Error('forced-create-error');
          if (mem.forceDuplicateOnCreate) {
            const err: any = new Error('dup');
            err.code = 'ER_DUP_ENTRY';
            throw err;
          }
          const [name, email, cpf, password] = params;
          const id = (mem.users[mem.users.length - 1]?.id ?? 0) + 1;
          mem.users.push({ id, name, email, cpf, password });
          return [{ insertId: id }];
        }

        // UPDATE USER
        if (/^UPDATE users SET/.test(sql)) {
          if (mem.forceUpdateServerError) throw new Error('forced-update-error');
          if (mem.forceDuplicateOnUpdate) {
            const err: any = new Error('dup');
            err.code = 'ER_DUP_ENTRY';
            throw err;
          }
          const [name, email, cpf, idParam] = params;
          const id = Number(idParam);
          const idx = mem.users.findIndex(u => u.id === id);
          if (idx === -1) {
            return [{ affectedRows: 0 }];
          }
          mem.users[idx] = { ...mem.users[idx], name, email, cpf };
          return [{ affectedRows: 1 }];
        }

        // DELETE USER
        if (/^DELETE FROM users WHERE id = \?/.test(sql)) {
          if (mem.forceDeleteServerError) throw new Error('forced-delete-error');
          const id = Number(params[0]);
          const before = mem.users.length;
          mem.users = mem.users.filter(u => u.id !== id);
          return [{ affectedRows: before !== mem.users.length ? 1 : 0 }];
        }

        // LOGIN (SELECT * WHERE email = ?)
        if (/^SELECT \* FROM users WHERE email = \?/.test(sql)) {
          if (mem.forceLoginServerError) throw new Error('forced-login-error');
          const email = params[0];
          const found = mem.users.filter(u => u.email === email);
          return [found];
        }

        return [[]];
      },
    }),
  },
}));

/* ===========================
   SETUP
   =========================== */

beforeEach(() => {
  mem.users = [];
  mem.forceGetUsersError = false;
  mem.forceCreateUserServerError = false;
  mem.forceUpdateServerError = false;
  mem.forceDeleteServerError = false;
  mem.forceLoginServerError = false;
  mem.forceDuplicateOnCreate = false;
  mem.forceDuplicateOnUpdate = false;
});

/* ===========================
   TESTES
   =========================== */

describe('User Controller', () => {
  /* ------- CREATE ------- */
  it('deve criar um novo usuário (201)', async () => {
    const res = await request(app).post('/users').send({
      name: 'Marcela',
      email: 'marcela@example.com',
      cpf: '111.222.333-44',
      password: '123456',
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toMatchObject({
      id: expect.any(Number),
      name: 'Marcela',
      email: 'marcela@example.com',
      cpf: '111.222.333-44',
    });
  });

  it('deve retornar 400 se faltar campos obrigatórios ao criar', async () => {
    const res = await request(app).post('/users').send({
      name: 'Sem Email',
      // email faltando
      cpf: '111.222.333-44',
      password: '123456',
    });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toMatch(/obrigatórios/i);
  });

  it('deve retornar 409 se email/CPF já cadastrado (ER_DUP_ENTRY)', async () => {
    mem.forceDuplicateOnCreate = true;

    const res = await request(app).post('/users').send({
      name: 'Dup',
      email: 'dup@example.com',
      cpf: '000.000.000-00',
      password: 'pw',
    });

    expect(res.status).toBe(409);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toMatch(/já cadastrado/i);
  });

  it('deve retornar 500 em erro interno no create', async () => {
    mem.forceCreateUserServerError = true;

    const res = await request(app).post('/users').send({
      name: 'Err',
      email: 'err@example.com',
      cpf: '999.999.999-99',
      password: 'pw',
    });

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
  });

  /* ------- GET LIST ------- */
  it('deve listar todos os usuários (200)', async () => {
    // cria 1
    await request(app).post('/users').send({
      name: 'A',
      email: 'a@example.com',
      cpf: '111.111.111-11',
      password: 'pw',
    });

    const res = await request(app).get('/users');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    // confere que senha não veio
    expect(res.body.data[0]).toEqual(
      expect.objectContaining({ id: expect.any(Number), name: 'A', email: 'a@example.com', cpf: '111.111.111-11' })
    );
    expect(res.body.data[0]).not.toHaveProperty('password');
  });

  it('deve retornar 500 se falhar ao listar usuários', async () => {
    mem.forceGetUsersError = true;
    const res = await request(app).get('/users');
    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
  });

  /* ------- UPDATE ------- */
  it('deve atualizar um usuário (200)', async () => {
    const created = await request(app).post('/users').send({
      name: 'Old',
      email: 'old@example.com',
      cpf: '123.456.789-00',
      password: 'pw',
    });
    const id = created.body.data.id;

    const res = await request(app).put(`/users/${id}`).send({
      name: 'New',
      email: 'new@example.com',
      cpf: '123.456.789-00',
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toEqual({ id, name: 'New', email: 'new@example.com', cpf: '123.456.789-00' });
  });

  it('deve retornar 400 se faltar campos no update', async () => {
    const created = await request(app).post('/users').send({
      name: 'Old',
      email: 'old@example.com',
      cpf: '123.456.789-00',
      password: 'pw',
    });
    const id = created.body.data.id;

    const res = await request(app).put(`/users/${id}`).send({
      name: 'Only Name', // faltando email e cpf
    });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });

  it('deve retornar 404 se usuário não existir no update', async () => {
    const res = await request(app).put('/users/9999').send({
      name: 'X',
      email: 'x@example.com',
      cpf: '000.000.000-00',
    });
    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toMatch(/não encontrado/i);
  });

  it('deve retornar 409 se email/CPF já cadastrado por outro no update', async () => {
    // cria 2 usuários
    const a = await request(app).post('/users').send({
      name: 'A',
      email: 'a@example.com',
      cpf: '111.111.111-11',
      password: 'pw',
    });
    const b = await request(app).post('/users').send({
      name: 'B',
      email: 'b@example.com',
      cpf: '222.222.222-22',
      password: 'pw',
    });

    mem.forceDuplicateOnUpdate = true;

    const res = await request(app).put(`/users/${a.body.data.id}`).send({
      name: 'A2',
      email: 'b@example.com',
      cpf: '111.111.111-11',
    });

    expect(res.status).toBe(409);
    expect(res.body.status).toBe('error');
  });

  it('deve retornar 500 em erro interno no update', async () => {
    const created = await request(app).post('/users').send({
      name: 'Old',
      email: 'old@example.com',
      cpf: '123.456.789-00',
      password: 'pw',
    });
    const id = created.body.data.id;

    mem.forceUpdateServerError = true;
    const res = await request(app).put(`/users/${id}`).send({
      name: 'New',
      email: 'new@example.com',
      cpf: '123.456.789-00',
    });

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
  });

  /* ------- DELETE ------- */
  it('deve deletar usuário (200)', async () => {
    const created = await request(app).post('/users').send({
      name: 'Del',
      email: 'del@example.com',
      cpf: '333.333.333-33',
      password: 'pw',
    });
    const id = created.body.data.id;

    const res = await request(app).delete(`/users/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  it('deve retornar 404 ao deletar usuário inexistente', async () => {
    const res = await request(app).delete('/users/9999');
    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
  });

  it('deve retornar 500 em erro interno no delete', async () => {
    const created = await request(app).post('/users').send({
      name: 'Del',
      email: 'del@example.com',
      cpf: '333.333.333-33',
      password: 'pw',
    });
    const id = created.body.data.id;

    mem.forceDeleteServerError = true;
    const res = await request(app).delete(`/users/${id}`);
    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
  });

  /* ------- LOGIN ------- */
  it('deve logar com sucesso (200)', async () => {
    // cria usuário (senha "pw" vira "hashed:pw" pelo mock do bcrypt.hash)
    await request(app).post('/users').send({
      name: 'Login',
      email: 'login@example.com',
      cpf: '444.444.444-44',
      password: 'pw',
    });

    const res = await request(app).post('/users/login').send({
      email: 'login@example.com',
      password: 'pw',
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('token', 'mock.jwt.token');
    expect(res.body.data.user.email).toBe('login@example.com');
  });

  it('deve retornar 400 no login se faltar email/senha', async () => {
    const res = await request(app).post('/users/login').send({
      email: 'x@example.com',
      // senha faltando
    });
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });

  it('deve retornar 401 no login se email não existir', async () => {
    const res = await request(app).post('/users/login').send({
      email: 'naoexiste@example.com',
      password: 'pw',
    });
    expect(res.status).toBe(401);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toMatch(/credenciais inválidas/i);
  });

  it('deve retornar 401 no login se senha estiver incorreta', async () => {
    // cria usuário com senha "pw"
    await request(app).post('/users').send({
      name: 'Login2',
      email: 'login2@example.com',
      cpf: '555.555.555-55',
      password: 'pw',
    });

    const res = await request(app).post('/users/login').send({
      email: 'login2@example.com',
      password: 'errada',
    });
    expect(res.status).toBe(401);
    expect(res.body.status).toBe('error');
  });

  it('deve retornar 500 em erro interno no login', async () => {
    mem.forceLoginServerError = true;
    const res = await request(app).post('/users/login').send({
      email: 'qualquer@example.com',
      password: 'pw',
    });
    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
  });
});

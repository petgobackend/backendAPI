// src/tests/app.e2e.test.ts
// E2E de usuário usando Jest + Supertest, com DB em memória

import request from 'supertest'
import app from '../index'

type UserRow = {
  id: number
  name: string
  email: string
  cpf: string
  password: string
}

// mock do DB em memória
jest.mock('../utils/db', () => {
  const mem = {
    users: [] as UserRow[]
  }

  const mockConnection = {
    release: () => {},
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    query: async (sql: string, params: any[] = []) => {
      // SELECT id, name, email, cpf FROM users
      if (
        /^SELECT id, name, email, cpf FROM users\b/.test(sql) &&
        !/WHERE id = \?/.test(sql)
      ) {
        return [
          mem.users.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            cpf: u.cpf
          }))
        ]
      }

      // SELECT id, name, email, cpf FROM users WHERE id = ?
      if (
        /^SELECT id, name, email, cpf FROM users WHERE id = \?/.test(sql)
      ) {
        const id = Number(params[0])
        const found = mem.users.find(u => u.id === id)
        return [[found].filter(Boolean)]
      }

      // SELECT * FROM users WHERE email = ?
      if (/^SELECT \* FROM users WHERE email = \?/.test(sql)) {
        const email = String(params[0])
        const found = mem.users.filter(u => u.email === email)
        return [found]
      }

      // INSERT INTO users (name, email, cpf, password)
      if (/^INSERT INTO users\b/.test(sql)) {
        const [name, email, cpf, password] = params

        const exists = mem.users.some(
          u => u.email === email || u.cpf === cpf
        )

        if (exists) {
          const err: any = new Error('duplicate')
          err.code = 'ER_DUP_ENTRY'
          throw err
        }

        const id = (mem.users[mem.users.length - 1]?.id ?? 0) + 1
        mem.users.push({
          id,
          name,
          email,
          cpf,
          password
        })

        return [{ insertId: id }]
      }

      // UPDATE users SET name = ?, cpf = ? WHERE id = ?
      if (/^UPDATE users SET name = \?, cpf = \? WHERE id = \?/.test(sql)) {
        const [name, cpf, idParam] = params
        const id = Number(idParam)
        const idx = mem.users.findIndex(u => u.id === id)

        if (idx === -1) {
          return [{ affectedRows: 0 }]
        }

        mem.users[idx] = {
          ...mem.users[idx],
          name,
          cpf
        }

        return [{ affectedRows: 1 }]
      }

      // DELETE FROM users WHERE id = ?
      if (/^DELETE FROM users WHERE id = \?/.test(sql)) {
        const id = Number(params[0])
        const before = mem.users.length
        mem.users = mem.users.filter(u => u.id !== id)
        const affectedRows = before !== mem.users.length ? 1 : 0
        return [{ affectedRows }]
      }

      return [[]]
    }
  }

  return {
    __esModule: true,
    default: {
      getConnection: async () => mockConnection,
      __mem: mem
    }
  }
})

// mock de bcrypt (igual user.test.ts)
jest.mock('bcrypt', () => ({
  genSalt: jest.fn().mockResolvedValue('salt'),
  hash: jest
    .fn()
    .mockImplementation(async (pwd: string) => `hashed:${pwd}`),
  compare: jest
    .fn()
    .mockImplementation(async (pwd: string, hashed: string) => {
      return hashed === `hashed:${pwd}`
    })
}))

// mock de JWT compatível com o authMiddleware
jest.mock('jsonwebtoken', () => ({
  sign: jest
    .fn()
    .mockImplementation((payload: any) => `token-${payload.id}`),
  verify: jest.fn().mockImplementation((token: string) => {
    const match = token.match(/^token-(\d+)/)
    if (!match) {
      throw new Error('invalid token')
    }
    const id = Number(match[1])
    return {
      id,
      email: `user${id}@example.com`
    }
  })
}))

// helper de header de auth
const authHeader = (token: string) => ({
  Authorization: `Bearer ${token}`
})

// limpa o "banco" em memória antes de cada teste
beforeEach(() => {
  const db = require('../utils/db').default as any
  db.__mem.users = []
})

describe('E2E PetGo - fluxos de usuário', () => {
  // 1) Fluxo completo: cadastro → login → update → listagem → "logout"
  it('Fluxo completo de usuário (cadastro, login, atualização, listagem e logout)', async () => {
    const email = 'e2e.user@example.com'
    const cpf = '000.111.222-33'
    const senha = 'pw123'

    const createRes = await request(app)
      .post('/users')
      .send({
        name: 'E2E User',
        email,
        cpf,
        password: senha
      })

    expect(createRes.status).toBe(201)
    expect(createRes.body.status).toBe('success')
    const userId = createRes.body.data.id

    const loginRes = await request(app)
      .post('/users/login')
      .send({
        email,
        password: senha
      })

    expect(loginRes.status).toBe(200)
    expect(loginRes.body.status).toBe('success')
    const token = loginRes.body.data.token

    const updateRes = await request(app)
      .put(`/users/${userId}`)
      .set(authHeader(token))
      .send({
        name: 'E2E User Atualizado',
        cpf
      })

    expect(updateRes.status).toBe(200)
    expect(updateRes.body.status).toBe('success')
    expect(updateRes.body.data).toMatchObject({
      id: userId,
      name: 'E2E User Atualizado',
      cpf
    })

    const listRes = await request(app).get('/users')

    expect(listRes.status).toBe(200)
    expect(listRes.body.status).toBe('success')
    const found = listRes.body.data.find(
      (u: any) => u.id === userId
    )

    expect(found).toBeDefined()
    expect(found.name).toBe('E2E User Atualizado')
    expect(found.cpf).toBe(cpf)

    const logoutRes = await request(app)
      .put(`/users/${userId}`)
      .send({
        name: 'Tentativa após logout',
        cpf
      })

    expect(logoutRes.status).toBe(401)
    expect(logoutRes.body.status).toBe('error')
  })

  // 2) Fluxo de segurança: sem token, token inválido, token válido
  it('Fluxo de segurança (proteção das rotas com JWT)', async () => {
    const email = 'secure.user@example.com'
    const cpf = '111.222.333-44'
    const senha = 'pwsecure'

    const createRes = await request(app)
      .post('/users')
      .send({
        name: 'Secure User',
        email,
        cpf,
        password: senha
      })

    expect(createRes.status).toBe(201)
    const userId = createRes.body.data.id

    const loginRes = await request(app)
      .post('/users/login')
      .send({
        email,
        password: senha
      })

    expect(loginRes.status).toBe(200)
    const token = loginRes.body.data.token

    const noTokenRes = await request(app).get(`/users/${userId}`)

    expect(noTokenRes.status).toBe(401)
    expect(noTokenRes.body.status).toBe('error')

    const invalidTokenRes = await request(app)
      .get(`/users/${userId}`)
      .set({
        Authorization: 'Bearer token-invalido'
      })

    expect(invalidTokenRes.status).toBe(401)
    expect(invalidTokenRes.body.status).toBe('error')

    const okRes = await request(app)
      .get(`/users/${userId}`)
      .set(authHeader(token))

    expect(okRes.status).toBe(200)
    expect(okRes.body.status).toBe('success')
    expect(okRes.body.data).toMatchObject({
      id: userId,
      name: 'Secure User',
      email,
      cpf
    })
  })

  // 3) Fluxo de validação: campos obrigatórios, duplicidade, login inválido
  it('Fluxo de validação (erros de campos e credenciais)', async () => {
    const invalidCreateRes = await request(app)
      .post('/users')
      .send({
        name: 'Sem Email',
        cpf: '222.333.444-55',
        password: 'pw'
      })

    expect(invalidCreateRes.status).toBe(400)
    expect(invalidCreateRes.body.status).toBe('error')
    expect(invalidCreateRes.body.message).toMatch(/obrigatórios/i)

    const email = 'valid.user@example.com'
    const cpf = '333.444.555-66'
    const senha = 'pwvalid'

    const firstCreateRes = await request(app)
      .post('/users')
      .send({
        name: 'Valid User',
        email,
        cpf,
        password: senha
      })

    expect(firstCreateRes.status).toBe(201)
    expect(firstCreateRes.body.status).toBe('success')

    const dupCreateRes = await request(app)
      .post('/users')
      .send({
        name: 'Dup User',
        email,
        cpf,
        password: 'other'
      })

    expect(dupCreateRes.status).toBe(409)
    expect(dupCreateRes.body.status).toBe('error')
    expect(dupCreateRes.body.message).toMatch(/já cadastrado/i)

    const missingLoginRes = await request(app)
      .post('/users/login')
      .send({
        email
      })

    expect(missingLoginRes.status).toBe(400)
    expect(missingLoginRes.body.status).toBe('error')
    expect(missingLoginRes.body.message).toMatch(/obrigatórios/i)

    const wrongPassRes = await request(app)
      .post('/users/login')
      .send({
        email,
        password: 'senha-errada'
      })

    expect(wrongPassRes.status).toBe(401)
    expect(wrongPassRes.status).toBe(401)
    expect(wrongPassRes.body.status).toBe('error')
    expect(wrongPassRes.body.message).toMatch(/credenciais inválidas/i)
  })
})

// src/tests/app.integration.test.ts
// Testes de INTEGRAÇÃO: CRUD de Usuário e Animal

import request from 'supertest'
import path from 'path'
import fs from 'fs'
import app from '../index'

// ─────────────────────────────────────────────
// MOCKS GERAIS
// ─────────────────────────────────────────────

// 1) Mock do Google Vision – sempre considera a imagem "segura"
jest.mock('@google-cloud/vision', () => {
  return {
    ImageAnnotatorClient: jest.fn(() => ({
      safeSearchDetection: jest.fn().mockResolvedValue([
        {
          safeSearchAnnotation: {
            adult: 'UNLIKELY',
            violence: 'UNLIKELY',
            racy: 'UNLIKELY'
          }
        }
      ])
    }))
  }
})

// 2) Mock do bcrypt – igual ao user.test.ts
jest.mock('bcrypt', () => ({
  genSalt: jest.fn().mockResolvedValue('salt'),
  hash: jest.fn().mockImplementation(async (pwd: string) => `hashed:${pwd}`),
  compare: jest
    .fn()
    .mockImplementation(
      async (pwd: string, hashed: string) => hashed === `hashed:${pwd}`
    )
}))

// 3) Mock do jsonwebtoken – evita depender de JWT_SECRET real
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock.jwt.token')
}))

// 4) Mock do authMiddleware – default export como função
jest.mock('../middlewares/auth', () => ({
  __esModule: true,
  default: (req: any, res: any, next: any) => {
    if (req.params && req.params.id) {
      req.userId = String(req.params.id)
    } else {
      req.userId = '1'
    }
    next()
  }
}))

// ─────────────────────────────────────────────
// MOCK DO BANCO EM MEMÓRIA (users + animals)
// ─────────────────────────────────────────────

type UserRow = {
  id: number
  name: string
  email: string
  cpf: string
  password: string
}

type AnimalRow = {
  id: number
  name: string
  species: string
  breed: string | null
  latitude: number | null
  longitude: number | null
  created_by: number | null
  health_status: string
  image_url: string
}

const memDb = {
  users: [] as UserRow[],
  animals: [] as AnimalRow[]
}

jest.mock('../utils/db', () => {
  const mockConnection = {
    beginTransaction: jest.fn(async () => {}),
    commit: jest.fn(async () => {}),
    rollback: jest.fn(async () => {}),
    release: jest.fn(),
    query: jest.fn(async (sql: string, params: any[] = []) => {
      // USERS
      if (/^SELECT id, name, email, cpf FROM users/.test(sql)) {
        return [
          memDb.users.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            cpf: u.cpf
          }))
        ]
      }

      if (/^SELECT \* FROM users WHERE email = \?/.test(sql)) {
        const email = params[0]
        const found = memDb.users.filter(u => u.email === email)
        return [found]
      }

      if (/^INSERT INTO users/.test(sql)) {
        const [name, email, cpf, password] = params
        const id = (memDb.users[memDb.users.length - 1]?.id ?? 0) + 1
        memDb.users.push({ id, name, email, cpf, password })
        return [{ insertId: id }]
      }

      if (/^UPDATE users SET name = \?, cpf = \? WHERE id = \?/.test(sql)) {
        const [name, cpf, idParam] = params
        const id = Number(idParam)
        const idx = memDb.users.findIndex(u => u.id === id)
        if (idx === -1) {
          return [{ affectedRows: 0 }]
        }
        memDb.users[idx] = { ...memDb.users[idx], name, cpf }
        return [{ affectedRows: 1 }]
      }

      if (/^DELETE FROM users WHERE id = \?/.test(sql)) {
        const id = Number(params[0])
        const before = memDb.users.length
        memDb.users = memDb.users.filter(u => u.id !== id)
        return [{ affectedRows: before !== memDb.users.length ? 1 : 0 }]
      }

      // ANIMALS
      if (/^SELECT \* FROM animals\b/.test(sql) && !/WHERE id/.test(sql)) {
        return [memDb.animals.slice()]
      }

      if (/^SELECT \* FROM animals WHERE id = \?/.test(sql)) {
        const id = Number(params[0])
        const row = memDb.animals.find(a => a.id === id)
        return [[row].filter(Boolean)]
      }

      if (/^INSERT INTO animals/.test(sql)) {
        const [
          name,
          species,
          breed,
          latitude,
          longitude,
          created_by,
          health_status,
          image_url
        ] = params
        const id = (memDb.animals[memDb.animals.length - 1]?.id ?? 0) + 1
        const row: AnimalRow = {
          id,
          name,
          species,
          breed: breed ?? null,
          latitude: latitude != null ? Number(latitude) : null,
          longitude: longitude != null ? Number(longitude) : null,
          created_by: created_by != null ? Number(created_by) : null,
          health_status,
          image_url
        }
        memDb.animals.push(row)
        return [{ insertId: id }]
      }

      if (/^UPDATE animals SET/.test(sql)) {
        const id = Number(params[params.length - 1])
        const idx = memDb.animals.findIndex(a => a.id === id)
        if (idx === -1) {
          return [{ affectedRows: 0 }]
        }

        const [
          name,
          species,
          breed,
          latitude,
          longitude,
          health_status
        ] = params

        memDb.animals[idx] = {
          ...memDb.animals[idx],
          name,
          species,
          breed,
          latitude: latitude != null ? Number(latitude) : null,
          longitude: longitude != null ? Number(longitude) : null,
          health_status
        }

        return [{ affectedRows: 1 }]
      }

      if (/^DELETE FROM animals WHERE id = \?/.test(sql)) {
        const id = Number(params[0])
        const before = memDb.animals.length
        memDb.animals = memDb.animals.filter(a => a.id !== id)
        return [{ affectedRows: before !== memDb.animals.length ? 1 : 0 }]
      }

      return [[]]
    })
  }

  return {
    __esModule: true,
    default: {
      getConnection: jest.fn(async () => mockConnection)
    }
  }
})

// ─────────────────────────────────────────────
// ARQUIVO DE IMAGEM TEMPORÁRIO PARA /animals
// ─────────────────────────────────────────────

const uploadsDir = path.join(__dirname, '../../uploads')
const tempImage = path.join(uploadsDir, 'tmp-int-crud.jpg')

beforeAll(() => {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }
  fs.writeFileSync(tempImage, Buffer.from([0xff, 0xd8, 0xff, 0xd9]))
})

afterAll(() => {
  try {
    fs.unlinkSync(tempImage)
  } catch {}
})

beforeEach(() => {
  memDb.users = []
  memDb.animals = []
})

// ─────────────────────────────────────────────
// TESTES DE INTEGRAÇÃO: CRUD USUÁRIO + ANIMAL
// ─────────────────────────────────────────────

describe('TESTES DE INTEGRAÇÃO: CRUD de Usuário e Animal', () => {
  describe('User CRUD & Validation', () => {
    it('1. POST /users: deve registrar um novo usuário (201)', async () => {
      const res = await request(app).post('/users').send({
        name: 'Int User',
        email: 'int@crud.com',
        cpf: '000.000.000-00',
        password: 'pw'
      })

      expect(res.status).toBe(201)
      expect(res.body.status).toBe('success')
      expect(res.body.data).toHaveProperty('id')
    })

    it('2. POST /users/login: deve logar o usuário (200)', async () => {
      await request(app).post('/users').send({
        name: 'Login User',
        email: 'login@crud.com',
        cpf: '111.111.111-11',
        password: 'pw'
      })

      const res = await request(app).post('/users/login').send({
        email: 'login@crud.com',
        password: 'pw'
      })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('success')
      expect(res.body.data).toHaveProperty('token', 'mock.jwt.token')
    })

    it('3. PUT /users/:id: deve retornar 400 se faltar campo obrigatório (cpf)', async () => {
      const created = await request(app).post('/users').send({
        name: 'Update User',
        email: 'update@crud.com',
        cpf: '222.222.222-22',
        password: 'pw'
      })

      const userId = String(created.body.data.id)

      const res = await request(app)
        .put(`/users/${userId}`)
        .send({
          name: 'Update User 2'
        })

      expect(res.status).toBe(400)
      expect(res.body.status).toBe('error')
      expect(res.body.message).toMatch(/Nome e cpf são obrigatórios/i)
    })

    it('4. DELETE /users/:id: deve deletar o usuário (200)', async () => {
      const created = await request(app).post('/users').send({
        name: 'Delete User',
        email: 'delete@crud.com',
        cpf: '333.333.333-33',
        password: 'pw'
      })

      const userId = String(created.body.data.id)

      const res = await request(app).delete(`/users/${userId}`)

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('success')
    })
  })

  describe('Animal CRUD & Validation', () => {
    it('5. POST /animals: deve criar um animal com sucesso (201)', async () => {
      const res = await request(app)
        .post('/animals')
        .field('name', 'Animal Crud')
        .field('species', 'cachorro')
        .field('health_status', 'Saudável')
        .attach('image', tempImage)

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('id')
    })

    it('6. GET /animals: deve listar animais (200)', async () => {
      await request(app)
        .post('/animals')
        .field('name', 'Animal List')
        .field('species', 'gato')
        .field('health_status', 'Saudável')
        .attach('image', tempImage)

      const res = await request(app).get('/animals')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeGreaterThan(0)
    })

    it('7. PUT /animals/:id: deve atualizar animal com sucesso (200)', async () => {
      const created = await request(app)
        .post('/animals')
        .field('name', 'Animal Update')
        .field('species', 'cachorro')
        .field('health_status', 'Saudável')
        .attach('image', tempImage)

      const animalId = created.body.id

      const res = await request(app)
        .put(`/animals/${animalId}`)
        .field('name', 'Animal Atualizado')
        .field('species', 'cachorro')
        .field('health_status', 'Ok')

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('message', 'Animal atualizado com sucesso.')
    })

    it('8. DELETE /animals/:id: deve deletar o animal (200)', async () => {
      const created = await request(app)
        .post('/animals')
        .field('name', 'Animal Delete')
        .field('species', 'cachorro')
        .field('health_status', 'Saudável')
        .attach('image', tempImage)

      const animalId = created.body.id

      const res = await request(app).delete(`/animals/${animalId}`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('message', 'Animal deletado com sucesso.')
    })
  })
})

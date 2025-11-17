import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path'; 
import userRoutes from './routes/userRoutes';
import animalRoutes from './routes/animalRoutes';
import db from './utils/db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Middlewares globais (CORS e JSON) - Devem vir primeiro
app.use(cors());
app.use(express.json());

// 2. Servir arquivos estáticos (uploads) - OK
// A rota estática DEVE vir ANTES das rotas da API se a sua rota da API fosse, por exemplo, `/uploads`.
// Como é `/users`, não há conflito, mas a ordem é segura.
app.use('/uploads', express.static(path.resolve(__dirname, '..', 'uploads')));

// 3. Rotas da API (CRUCIAL: devem vir antes do tratamento de 404)
app.use('/users', userRoutes); 
app.use('/animals', animalRoutes); 

// 4. Rota raiz (pode ser deixada por último, é uma rota simples GET)
app.get('/', (req, res) => {
  res.send('Backend PetGo rodando!');
});

// 5. Tratamento de erro 404
// Se a requisição chegou até aqui, nenhuma rota anterior a processou.
app.use((req, res) => {
    // Isso garante que o Express retorne JSON para 404s, e não o HTML padrão
    // que você está vendo.
    res.status(404).json({ status: 'error', message: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
});


async function startServer() {
  try {
    const conn = await db.getConnection();
    await conn.query('SELECT 1');
    conn.release();
    console.log('Conectado ao MySQL!');
    app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
  } catch (err) {
    console.error('Erro ao conectar no banco:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

export default app;
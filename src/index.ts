import express from 'express';
import dotenv from 'dotenv';
import userRoutes from './routes/userRoutes';
import animalRoutes from './routes/animalRoutes';
import db from './utils/db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api/users', userRoutes);
app.use('/api/animals', animalRoutes);

app.get('/', (req, res) => {
  res.send('Backend PetGo rodando!');
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

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const animalRoutes_1 = __importDefault(require("./routes/animalRoutes"));
const db_1 = __importDefault(require("./utils/db"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// 1. Middlewares globais (CORS e JSON) - Devem vir primeiro
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// 2. Servir arquivos estáticos (uploads) - OK
// A rota estática DEVE vir ANTES das rotas da API se a sua rota da API fosse, por exemplo, `/uploads`.
// Como é `/users`, não há conflito, mas a ordem é segura.
app.use('/uploads', express_1.default.static(path_1.default.resolve(__dirname, '..', 'uploads')));
// 3. Rotas da API (CRUCIAL: devem vir antes do tratamento de 404)
app.use('/users', userRoutes_1.default);
app.use('/animals', animalRoutes_1.default);
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
        const conn = await db_1.default.getConnection();
        await conn.query('SELECT 1');
        conn.release();
        console.log('Conectado ao MySQL!');
        app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
    }
    catch (err) {
        console.error('Erro ao conectar no banco:', err);
        process.exit(1);
    }
}
if (require.main === module) {
    startServer();
}
exports.default = app;

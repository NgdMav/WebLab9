import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initSocket } from './socket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


app.use(express.static(path.join(__dirname, 'public')));


app.get('/', (req, res) => {
    res.render('index', { title: 'Словарная игра - Главная' });
});

app.get('/game', (req, res) => {
    res.render('game', { title: 'Словарная игра - Игровой чат' });
});


const server = app.listen(process.env.PORT || 3000, () => {
    console.log(`Сервер запущен на порту ${process.env.PORT || 3000}`);
    console.log(`http://localhost:${process.env.PORT || 3000}`);
});


initSocket(server);
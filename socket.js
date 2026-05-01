import { Server } from "socket.io";
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const wordsData = JSON.parse(readFileSync(join(__dirname, 'words.json'), 'utf-8'));
const words = wordsData.words;

export function initSocket(httpServer) {
    const io = new Server(httpServer);
    

    const players = {};
    const gameState = {
        isPlaying: false,
        currentTurn: null,
        currentLetter: null,
        timeLeft: 30,
        timerInterval: null,
        messages: [],
        currentRound: 0,
        totalRounds: 5 
    };

    const GAME_CONFIG = {
        ROUNDS_TO_WIN: 5,
        TURN_TIME: 30,
        MIN_PLAYERS: 2
    };
    

    function getRandomLetter() {
        const letters = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЭЮЯ';
        return letters[Math.floor(Math.random() * letters.length)];
    }
    
    function isValidWord(word, startLetter) {
        if (!word || word.length < 2) return false;
        const firstLetter = word[0].toUpperCase();
        if (firstLetter !== startLetter) return false;
        return words.includes(word.toLowerCase());
    }
    
    function broadcastGameState() {
        io.emit('gameState', {
            players: players,
            isPlaying: gameState.isPlaying,
            currentTurn: gameState.currentTurn,
            currentLetter: gameState.currentLetter,
            timeLeft: gameState.timeLeft,
            messages: gameState.messages.slice(-20),
            currentRound: gameState.currentRound,
            totalRounds: GAME_CONFIG.ROUNDS_TO_WIN
        });
    }
    
    function startTurnTimer() {
        if (gameState.timerInterval) clearInterval(gameState.timerInterval);
        
        gameState.timeLeft = 30;
        broadcastGameState();
        
        gameState.timerInterval = setInterval(() => {
            if (!gameState.isPlaying) return;
            
            gameState.timeLeft--;
            broadcastGameState();
            
            if (gameState.timeLeft <= 0) {
                clearInterval(gameState.timerInterval);
                io.emit('systemMessage', `Время вышло! Ход переходит следующему игроку.`);
                nextTurn();
            }
        }, 1000);
    }
    
    function nextTurn() {
        const playerIds = Object.keys(players);
        if (playerIds.length === 0) return;
        
        const currentIndex = playerIds.indexOf(gameState.currentTurn);
        const nextIndex = (currentIndex + 1) % playerIds.length;

        if (nextIndex === 0) {
            gameState.currentRound++;
            io.emit('systemMessage', `РАУНД ${gameState.currentRound} ЗАВЕРШЁН!`);
            
            if (checkGameEnd()) {
                return;
            }
            
            io.emit('systemMessage', `НАЧИНАЕТСЯ РАУНД ${gameState.currentRound + 1}!`);
        }


        gameState.currentTurn = playerIds[nextIndex];
        
        gameState.currentLetter = getRandomLetter();
        
        io.emit('systemMessage', `Новый ход! Игрок ${players[gameState.currentTurn]?.name} должен назвать слово на букву "${gameState.currentLetter}"`);
        
        startTurnTimer();
        broadcastGameState();
    }
    
    function checkGameStart() {
        const readyPlayers = Object.values(players).filter(p => p.isReady);
        if (readyPlayers.length >= 2 && !gameState.isPlaying) {
            startGame();
        }
    }
    
    function startGame() {
        gameState.isPlaying = true;
        gameState.currentRound = 0;
        const playerIds = Object.keys(players);
        gameState.currentTurn = playerIds[0];
        gameState.currentLetter = getRandomLetter();
        gameState.messages = [];
        
        io.emit('systemMessage', 'ИГРА НАЧАЛАСЬ!');
        io.emit('systemMessage', `Правила: называйте слова на заданную букву. Слова должны быть существительными в именительном падеже.`);
        io.emit('systemMessage', `Первый ход: ${players[gameState.currentTurn]?.name}`);
        io.emit('systemMessage', `Начальная буква: "${gameState.currentLetter}"`);
        io.emit('systemMessage', `Победит тот, кто наберёт больше очков за ${GAME_CONFIG.ROUNDS_TO_WIN} раундов!`);
        
        startTurnTimer();
        broadcastGameState();
    }

    function checkGameEnd() {
        if (gameState.currentRound >= GAME_CONFIG.ROUNDS_TO_WIN) {
            endGame();
            return true;
        }
        return false;
    }
    
    function endGame() {
        gameState.isPlaying = false;
        if (gameState.timerInterval) clearInterval(gameState.timerInterval);
        
        
        let winner = null;
        let maxScore = -1;
        for (const [id, player] of Object.entries(players)) {
            if (player.score > maxScore) {
                maxScore = player.score;
                winner = player;
            }
            player.score = 0;
        }
        
        if (winner) {
            io.emit('systemMessage', `ИГРА ОКОНЧЕНА! Победитель: ${winner.name} с ${maxScore} очками!`);
        }
        
        for (const id in players) {
            players[id].isReady = false;
        }
        
        broadcastGameState();
    }
    
    // Socket.IO события
    io.on("connection", (socket) => {
        console.log("Новое подключение:", socket.id);
        
        socket.on("register", (name) => {
            if (gameState.isPlaying) {
                socket.emit("systemMessage", "Игра уже идёт, присоединиться нельзя!");
                return;
            }
            
            players[socket.id] = {
                name: name.substring(0, 20),
                score: 0,
                isReady: false,
                currentWord: null
            };
            
            console.log(`Зарегистрирован игрок: ${name} (${socket.id})`);
            socket.emit("systemMessage", `Добро пожаловать, ${name}! Нажмите "Готов" чтобы начать игру.`);
            io.emit("systemMessage", `Игрок ${name} присоединился к игре!`);
            broadcastGameState();
        });
        
        
        socket.on("ready", () => {
            if (gameState.isPlaying) {
                socket.emit("systemMessage", "Игра уже идёт!");
                return;
            }
            
            if (players[socket.id]) {
                players[socket.id].isReady = true;
                io.emit("systemMessage", `${players[socket.id].name} готов к игре!`);
                broadcastGameState();
                checkGameStart();
            }
        });
        
        
        socket.on("submitWord", (word) => {
            if (!gameState.isPlaying) {
                socket.emit("systemMessage", "Игра ещё не началась!");
                return;
            }
            
            if (gameState.currentTurn !== socket.id) {
                socket.emit("systemMessage", "Сейчас не ваш ход!");
                return;
            }
            
            if (!isValidWord(word, gameState.currentLetter)) {
                socket.emit("systemMessage", `Слово "${word}" не подходит! Нужно существительное на букву "${gameState.currentLetter}"`);
                return;
            }
            
            // Проверка на повтор слова
            const isWordUsed = gameState.messages.some(msg => 
                msg.type === 'word' && msg.word?.toLowerCase() === word.toLowerCase()
            );
            
            if (isWordUsed) {
                socket.emit("systemMessage", `Слово "${word}" уже было использовано!`);
                return;
            }
            
            
            const player = players[socket.id];
            const points = word.length;
            player.score += points;
            
            
            gameState.messages.push({
                type: 'word',
                player: player.name,
                word: word,
                points: points,
                timestamp: new Date().toLocaleTimeString()
            });
            
            io.emit("wordMessage", {
                player: player.name,
                word: word,
                points: points,
                timestamp: new Date().toLocaleTimeString()
            });
            
            
            clearInterval(gameState.timerInterval);
            nextTurn();
        });
        
        
        socket.on("chatMessage", (message) => {
            const player = players[socket.id];
            if (!player) return;
            
            
            if (message.length > 200) message = message.substring(0, 200);
            
            io.emit("chatMessage", {
                player: player.name,
                message: message,
                timestamp: new Date().toLocaleTimeString()
            });
        });
        
        // Отключение
        socket.on("disconnect", () => {
            console.log("Отключение:", socket.id);
            const player = players[socket.id];
            
            if (player) {
                io.emit("systemMessage", `Игрок ${player.name} покинул игру`);
                delete players[socket.id];
                
                if (gameState.isPlaying && Object.keys(players).length < 2) {
                    endGame();
                    io.emit("systemMessage", "Игра прервана (недостаточно игроков)");
                }
                
                broadcastGameState();
            }
        });
    });
}
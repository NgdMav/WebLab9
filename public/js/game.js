const socket = io();

let playersList;
let chatMessages;
let gameStatus;
let currentTurn;
let currentLetter;
let timeLeft;
let wordInput;
let submitBtn;
let chatInput;
let sendChatBtn;
let readyBtn;


document.addEventListener('DOMContentLoaded', () => {
    playersList = document.getElementById('playersList');
    chatMessages = document.getElementById('chatMessages');
    gameStatus = document.getElementById('gameStatus');
    currentTurn = document.getElementById('currentTurn');
    currentLetter = document.getElementById('currentLetter');
    timeLeft = document.getElementById('timeLeft');
    wordInput = document.getElementById('wordInput');
    submitBtn = document.getElementById('submitWordBtn');
    chatInput = document.getElementById('chatInput');
    sendChatBtn = document.getElementById('sendChatBtn');
    readyBtn = document.getElementById('readyBtn');

    
    const playerName = localStorage.getItem('playerName');
    if (!playerName) {
        window.location.href = '/';
        return;
    }

    
    socket.emit('register', playerName);

    
    submitBtn.addEventListener('click', () => {
        const word = wordInput.value.trim();
        if (word) {
            socket.emit('submitWord', word);
            wordInput.value = '';
        }
    });

    sendChatBtn.addEventListener('click', () => {
        const message = chatInput.value.trim();
        if (message) {
            socket.emit('chatMessage', message);
            chatInput.value = '';
        }
    });

    readyBtn.addEventListener('click', () => {
        socket.emit('ready');
        readyBtn.textContent = 'Ожидание...';
        readyBtn.disabled = true;
    });

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatBtn.click();
    });

    wordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitBtn.click();
    });
});

// Socket.IO события
socket.on('gameState', (state) => {
    updatePlayersList(state.players);
    updateGameStatus(state);
});

socket.on('systemMessage', (message) => {
    addSystemMessage(message);
});

socket.on('chatMessage', (data) => {
    addChatMessage(data.player, data.message, data.timestamp);
});

socket.on('wordMessage', (data) => {
    addWordMessage(data.player, data.word, data.points, data.timestamp);
});

socket.on('connect', () => {
    addSystemMessage('Подключено к серверу');
});

socket.on('disconnect', () => {
    addSystemMessage('Потеряно соединение с сервером');
});


function updatePlayersList(players) {
    if (!playersList) return;
    
    const playerIds = Object.keys(players);
    if (playerIds.length === 0) {
        playersList.innerHTML = '<div class="loading">Нет игроков</div>';
        return;
    }
    
    playersList.innerHTML = '';
    for (const [id, player] of Object.entries(players)) {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-item';
        if (socket.id === id) playerDiv.classList.add('current-user');
        
        playerDiv.innerHTML = `
            <div>
                <span class="player-name">${escapeHtml(player.name)}</span>
                ${player.isReady ? '<span class="ready-badge">Готов</span>' : ''}
            </div>
            <div class="player-score">${player.score} очков</div>
        `;
        playersList.appendChild(playerDiv);
    }
}

function updateGameStatus(state) {
    gameStatus.textContent = state.isPlaying ? 'Игра идёт' : 'Ожидание игроков';
    
    if (state.currentTurn && state.players[state.currentTurn]) {
        currentTurn.textContent = state.players[state.currentTurn].name;
    } else {
        currentTurn.textContent = '—';
    }
    
    currentLetter.textContent = state.currentLetter || '—';
    
    if (state.timeLeft > 0) {
        timeLeft.textContent = `${state.timeLeft} сек`;
        if (state.timeLeft <= 10) {
            timeLeft.classList.add('warning');
        } else {
            timeLeft.classList.remove('warning');
        }
    } else {
        timeLeft.textContent = '—';
    }
    
    if (readyBtn) {
        if (state.isPlaying) {
            readyBtn.disabled = true;
            readyBtn.textContent = 'Игра идёт';
        } else {
            readyBtn.disabled = false;
            readyBtn.textContent = 'Готов к игре';
        }
    }
    

    if (wordInput && submitBtn) {
        const isMyTurn = state.currentTurn === socket.id && state.isPlaying;
        wordInput.disabled = !isMyTurn;
        submitBtn.disabled = !isMyTurn;
        if (isMyTurn) {
            wordInput.placeholder = 'Ваш ход! Введите слово...';
        } else {
            wordInput.placeholder = state.isPlaying ? 'Ожидание вашего хода...' : 'Игра не началась';
        }
    }
}

function addSystemMessage(message) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'system-message';
    msgDiv.textContent = message;
    chatMessages.appendChild(msgDiv);
    scrollToBottom();
}

function addChatMessage(player, message, timestamp) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message chat-message';
    msgDiv.innerHTML = `
        <div class="message-header">
            <strong>${escapeHtml(player)}</strong> <span style="font-size:0.7em;">${timestamp}</span>
        </div>
        <div class="message-text">${escapeHtml(message)}</div>
    `;
    chatMessages.appendChild(msgDiv);
    scrollToBottom();
}

function addWordMessage(player, word, points, timestamp) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message word-message';
    msgDiv.innerHTML = `
        <div class="message-header">
            <strong>${escapeHtml(player)}</strong> <span style="font-size:0.7em;">${timestamp}</span>
        </div>
        <div class="message-text">
            Сказал слово "<strong>${escapeHtml(word)}</strong>" 
            <span class="message-points">(+${points} очков)</span>
        </div>
    `;
    chatMessages.appendChild(msgDiv);
    scrollToBottom();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Shared Multiplayer Game State
let deck = [];
let gameState = {
  playerHand: [],
  dealerHand: [],
  gameOver: true,
  statusMessage: "Waiting to start...",
  pScore: 0,
  dScore: 0
};

const suits = ['♥', '♦', '♣', '♠'];
const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck() {
  deck = [];
  for (let suit of suits) {
    for (let value of values) {
      let weight = parseInt(value);
      if (['J', 'Q', 'K'].includes(value)) weight = 10;
      if (value === 'A') weight = 11;
      deck.push({ value, suit, weight });
    }
  }
  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function getScore(hand) {
  let score = 0;
  let aces = 0;
  for (let card of hand) {
    score += card.weight;
    if (card.value === 'A') aces += 1;
  }
  while (score > 21 && aces > 0) {
    score -= 10;
    aces -= 1;
  }
  return score;
}

function updateScores() {
  gameState.pScore = getScore(gameState.playerHand);
  gameState.dScore = gameState.gameOver ? getScore(gameState.dealerHand) : "?";
}

function handleDealerTurn() {
  gameState.gameOver = true;
  while (getScore(gameState.dealerHand) < 17) {
    gameState.dealerHand.push(deck.pop());
  }
  updateScores();

  let pScore = gameState.pScore;
  let dScore = gameState.dScore;

  if (dScore > 21) gameState.statusMessage = "Dealer Busts! Players Win!";
  else if (pScore > dScore) gameState.statusMessage = "Players Win!";
  else if (dScore > pScore) gameState.statusMessage = "Dealer Wins.";
  else gameState.statusMessage = "Push (Tie).";
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  
  // Send current state to new player immediately
  socket.emit('updateState', gameState);

  socket.on('action', (actionType) => {
    if (actionType === 'start') {
      createDeck();
      gameState.playerHand = [deck.pop(), deck.pop()];
      gameState.dealerHand = [deck.pop(), deck.pop()];
      gameState.gameOver = false;
      gameState.statusMessage = "Players turn! Hit or Stand?";
      updateScores();
      
      if (gameState.pScore === 21) handleDealerTurn();
    } 
    else if (actionType === 'hit' && !gameState.gameOver) {
      gameState.playerHand.push(deck.pop());
      updateScores();
      if (gameState.pScore > 21) {
        gameState.statusMessage = "Bust! Players Lose.";
        gameState.gameOver = true;
      }
    } 
    else if (actionType === 'stand' && !gameState.gameOver) {
      handleDealerTurn();
    }

    // Broadcast updated state to all connected players
    io.emit('updateState', gameState);
  });

  socket.on('disconnect', () => console.log('Player disconnected:', socket.id));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running! Play at http://localhost:${PORT}`);
});

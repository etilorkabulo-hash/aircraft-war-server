const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();

app.use(cors());
app.use(express.json());

// 🧍 joueurs en mémoire
let players = [];

app.get('/', (req, res) => {
    res.json({ status: "Aircraft War API ONLINE 🚀" });
});


// 🔐 REGISTER
app.post('/register', (req, res) => {

    const { name } = req.body;

    // éviter doublons
    const exists = players.find(p => p.name === name);

    if (exists) {
        return res.status(400).json({ error: "Name already exists" });
    }

    const player = {
        id: crypto.randomUUID(),
        name,
        score: 0
    };

    players.push(player);

    res.json(player);
});


// 🔐 LOGIN
app.post('/login', (req, res) => {

    const { name } = req.body;

    const player = players.find(p => p.name === name);

    if (!player) {
        return res.status(404).json({ error: "Player not found" });
    }

    res.json(player);
});


// 🏆 SCORE UPDATE
app.post('/score', (req, res) => {

    const { id, score } = req.body;

    const player = players.find(p => p.id === id);

    if (!player) {
        return res.status(404).json({ error: "Player not found" });
    }

    if (score > player.score) {
        player.score = score;
    }

    res.json({ success: true, player });
});


// 📊 LEADERBOARD
app.get('/leaderboard', (req, res) => {

    const sorted = [...players].sort((a, b) => b.score - a.score);

    res.json(sorted);
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Aircraft War Server running on port " + PORT);
});

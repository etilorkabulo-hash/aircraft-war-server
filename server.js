const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

let players = [];

app.get('/', (req, res) => {
    res.json({ status: "Aircraft War API ONLINE" });
});

app.post('/player', (req, res) => {
    const { name } = req.body;

    const player = {
        id: Date.now(),
        name,
        score: 0
    };

    players.push(player);

    res.json(player);
});

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

app.get('/leaderboard', (req, res) => {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    res.json(sorted);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("Server running");
});

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Données en mémoire
let players = [];
let scores = [];
let queue = [];
let matches = [];

// Middleware de logs
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ===== ROUTES JOUEURS =====

app.post('/api/player', (req, res) => {
    const { username } = req.body;

    if (!username || typeof username !== 'string') {
        return res.status(400).json({ error: 'Username invalide' });
    }

    if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: 'Username doit faire entre 3 et 20 caractères' });
    }

    let player = players.find(p => p.username.toLowerCase() === username.toLowerCase());

    if (!player) {
        player = {
            playerId: uuidv4(),
            username: username,
            createdAt: new Date(),
            totalScore: 0,
            gamesPlayed: 0,
            maxScore: 0
        };
        players.push(player);
        console.log(`✅ Nouveau joueur créé: ${username}`);
    } else {
        console.log(`🔄 Joueur reconnecté: ${username}`);
    }

    res.json({
        playerId: player.playerId,
        username: player.username
    });
});

// ===== ROUTES SCORES =====

app.post('/api/score', (req, res) => {
    const { playerId, score } = req.body;

    if (!playerId || score === undefined) {
        return res.status(400).json({ error: 'PlayerId et score requis' });
    }

    if (score < 0 || score > 10000000) {
        return res.status(400).json({ error: 'Score invalide' });
    }

    const player = players.find(p => p.playerId === playerId);
    if (!player) {
        return res.status(404).json({ error: 'Joueur non trouvé' });
    }

    scores.push({
        scoreId: uuidv4(),
        playerId: playerId,
        username: player.username,
        score: score,
        timestamp: new Date()
    });

    player.totalScore += score;
    player.gamesPlayed += 1;
    if (score > player.maxScore) {
        player.maxScore = score;
    }

    console.log(`📊 Score enregistré: ${player.username} -> ${score} pts`);

    res.json({
        success: true,
        message: 'Score enregistré',
        playerStats: {
            totalScore: player.totalScore,
            gamesPlayed: player.gamesPlayed,
            maxScore: player.maxScore
        }
    });
});

// ===== ROUTES CLASSEMENT =====

app.get('/api/leaderboard', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    
    const leaderboard = players
        .map(p => ({
            playerId: p.playerId,
            username: p.username,
            score: p.totalScore,
            gamesPlayed: p.gamesPlayed,
            maxScore: p.maxScore,
            avgScore: p.gamesPlayed > 0 ? Math.round(p.totalScore / p.gamesPlayed) : 0
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    console.log(`📈 Classement demandé - Top ${leaderboard.length} joueurs`);

    res.json({
        leaderboard: leaderboard,
        totalPlayers: players.length,
        timestamp: new Date()
    });
});

// ===== ROUTES MATCHMAKING =====

app.post('/api/match/join', (req, res) => {
    const { playerId } = req.body;

    if (!playerId) {
        return res.status(400).json({ error: 'PlayerId requis' });
    }

    const player = players.find(p => p.playerId === playerId);
    if (!player) {
        return res.status(404).json({ error: 'Joueur non trouvé' });
    }

    const queueEntry = {
        playerId: playerId,
        username: player.username,
        joinedAt: new Date()
    };

    queue.push(queueEntry);
    console.log(`⏳ ${player.username} rejoint la file (${queue.length} en attente)`);

    if (queue.length >= 2) {
        const player1 = queue.shift();
        const player2 = queue.shift();

        const matchId = uuidv4();
        const match = {
            matchId: matchId,
            player1Id: player1.playerId,
            player1Username: player1.username,
            player2Id: player2.playerId,
            player2Username: player2.username,
            player1Score: 0,
            player2Score: 0,
            status: 'ongoing',
            createdAt: new Date()
        };

        matches.push(match);
        console.log(`⚔️ Match créé: ${player1.username} vs ${player2.username}`);

        if (playerId === player1.playerId) {
            return res.json({
                matchId: matchId,
                opponent: player2.username,
                role: 'player1'
            });
        } else {
            return res.json({
                matchId: matchId,
                opponent: player1.username,
                role: 'player2'
            });
        }
    }

    res.json({
        matchId: null,
        message: 'En attente d\'un adversaire...',
        queuePosition: queue.length
    });
});

app.post('/api/match/score', (req, res) => {
    const { matchId, playerId, score } = req.body;

    if (!matchId || !playerId || score === undefined) {
        return res.status(400).json({ error: 'Paramètres manquants' });
    }

    const match = matches.find(m => m.matchId === matchId);
    if (!match) {
        return res.status(404).json({ error: 'Match non trouvé' });
    }

    if (match.player1Id === playerId) {
        match.player1Score = score;
    } else if (match.player2Id === playerId) {
        match.player2Score = score;
    } else {
        return res.status(403).json({ error: 'Vous n\'êtes pas dans ce match' });
    }

    if (match.player1Score > 0 && match.player2Score > 0) {
        match.status = 'completed';
        
        const player1 = players.find(p => p.playerId === match.player1Id);
        const player2 = players.find(p => p.playerId === match.player2Id);
        
        if (player1) {
            player1.totalScore += match.player1Score;
            player1.gamesPlayed += 1;
            if (match.player1Score > player1.maxScore) {
                player1.maxScore = match.player1Score;
            }
        }
        if (player2) {
            player2.totalScore += match.player2Score;
            player2.gamesPlayed += 1;
            if (match.player2Score > player2.maxScore) {
                player2.maxScore = match.player2Score;
            }
        }
        
        console.log(`✅ Match terminé: ${match.player1Username}(${match.player1Score}) vs ${match.player2Username}(${match.player2Score})`);
    }

    res.json({
        success: true,
        message: 'Score du match enregistré'
    });
});

app.get('/api/match/result/:matchId', (req, res) => {
    const { matchId } = req.params;

    const match = matches.find(m => m.matchId === matchId);
    if (!match) {
        return res.status(404).json({ error: 'Match non trouvé' });
    }

    let winner, loser, winnerScore, loserScore;

    if (match.player1Score > match.player2Score) {
        winner = match.player1Id;
        loser = match.player2Id;
        winnerScore = match.player1Score;
        loserScore = match.player2Score;
    } else if (match.player2Score > match.player1Score) {
        winner = match.player2Id;
        loser = match.player1Id;
        winnerScore = match.player2Score;
        loserScore = match.player1Score;
    } else {
        winner = null;
        loser = null;
        winnerScore = match.player1Score;
        loserScore = match.player2Score;
    }

    res.json({
        matchId: match.matchId,
        winner: winner,
        loser: loser,
        winnerScore: winnerScore,
        loserScore: loserScore,
        player1Username: match.player1Username,
        player2Username: match.player2Username,
        status: match.status
    });
});

// ===== ROUTES UTILITAIRES =====

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date(),
        stats: {
            totalPlayers: players.length,
            totalMatches: matches.length,
            queueLength: queue.length,
            totalScores: scores.length
        }
    });
});

app.get('/api/stats', (req, res) => {
    const topPlayer = players.reduce((prev, current) => 
        (prev.totalScore > current.totalScore) ? prev : current
    , { totalScore: 0 });

    res.json({
        totalPlayers: players.length,
        totalGames: scores.length,
        topPlayer: {
            username: topPlayer.username,
            score: topPlayer.totalScore
        }
    });
});

// Gestion des erreurs
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({
        error: 'Erreur serveur interne',
        message: err.message
    });
});

// 404
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint non trouvé' });
});

// Démarrage
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║  ✈️  AIRCRAFT WAR PRO - SERVER V1.0   ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`✅ Serveur lancé sur le port ${PORT}`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log('🔌 API endpoints disponibles');
    console.log('');
});

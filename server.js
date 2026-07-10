const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 数据文件路径
const DATA_FILE = path.join(__dirname, 'data', 'users.json');
const HISTORY_FILE = path.join(__dirname, 'data', 'history.json');

// 确保数据目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// 加载用户数据
function loadUsers() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('加载用户数据失败:', err);
    }
    return [];
}

// 保存用户数据
function saveUsers(users) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2), 'utf-8');
    } catch (err) {
        console.error('保存用户数据失败:', err);
    }
}

// 加载历史记录
function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('加载历史记录失败:', err);
    }
    return [];
}

// 保存历史记录
function saveHistory(history) {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
    } catch (err) {
        console.error('保存历史记录失败:', err);
    }
}

// 盲盒奖品配置 (1-20绩点)
const PRIZES = [
    { gpa: 1, weight: 15 },
    { gpa: 2, weight: 15 },
    { gpa: 3, weight: 12 },
    { gpa: 4, weight: 10 },
    { gpa: 5, weight: 10 },
    { gpa: 6, weight: 8 },
    { gpa: 7, weight: 7 },
    { gpa: 8, weight: 6 },
    { gpa: 9, weight: 5 },
    { gpa: 10, weight: 4 },
    { gpa: 12, weight: 3 },
    { gpa: 15, weight: 2 },
    { gpa: 20, weight: 1 }
];

// 加权随机抽取
function drawPrize() {
    const totalWeight = PRIZES.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const prize of PRIZES) {
        random -= prize.weight;
        if (random <= 0) {
            return prize.gpa;
        }
    }
    return 1;
}

app.use(express.json());
app.use(express.static('public'));

// 获取所有用户
app.get('/api/users', (req, res) => {
    const users = loadUsers();
    res.json(users);
});

// 获取单个用户
app.get('/api/users/:id', (req, res) => {
    const users = loadUsers();
    const user = users.find(u => u.id === req.params.id);
    if (!user) {
        return res.status(404).json({ error: '用户不存在' });
    }
    res.json(user);
});

// 添加/更新用户
app.post('/api/users', (req, res) => {
    const { id, name, gpa } = req.body;
    if (!id || !name) {
        return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const users = loadUsers();
    const existingIndex = users.findIndex(u => u.id === id);
    
    const userData = {
        id,
        name,
        gpa: gpa || 0,
        drawnGpa: 0,
        drawCount: 0
    };
    
    if (existingIndex >= 0) {
        users[existingIndex] = { ...users[existingIndex], ...userData };
    } else {
        users.push(userData);
    }
    
    saveUsers(users);
    res.json({ success: true, user: userData });
});

// 盲盒抽奖
app.post('/api/draw', (req, res) => {
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).json({ error: '缺少用户ID' });
    }
    
    const users = loadUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
        return res.status(404).json({ error: '用户不存在' });
    }
    
    // 抽取奖品
    const prizeGpa = drawPrize();
    
    // 更新用户数据
    users[userIndex].drawnGpa = (users[userIndex].drawnGpa || 0) + prizeGpa;
    users[userIndex].drawCount = (users[userIndex].drawCount || 0) + 1;
    saveUsers(users);
    
    // 记录历史
    const history = loadHistory();
    history.push({
        userId,
        userName: users[userIndex].name,
        prizeGpa,
        timestamp: new Date().toISOString()
    });
    saveHistory(history);
    
    res.json({
        success: true,
        prize: prizeGpa,
        user: users[userIndex]
    });
});

// 获取用户抽奖历史
app.get('/api/history/:userId', (req, res) => {
    const history = loadHistory();
    const userHistory = history
        .filter(h => h.userId === req.params.userId)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(userHistory);
});

// 获取所有历史（管理员）
app.get('/api/history', (req, res) => {
    const history = loadHistory();
    res.json(history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
});

// 页面路由
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 盲盒抽奖系统运行在 http://localhost:${PORT}`);
});

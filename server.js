const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件 - 配置CORS以支持Safari
app.use(cors({
    origin: true, // 允许所有来源，或者可以指定具体域名
    credentials: false, // Safari兼容性：不使用凭据
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'X-Requested-With'],
    exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
    maxAge: 86400 // 预检请求缓存时间
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件服务
app.use(express.static('.'));

// MongoDB 连接
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/notes-app';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB 连接成功'))
.catch(err => console.error('MongoDB 连接失败:', err));

// 笔记数据模型
const noteSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    content: { type: String, default: '' },
    workspace: { type: String, default: 'public' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    userId: { type: String, default: 'default' } // 用于多用户支持
});

const Note = mongoose.model('Note', noteSchema);

// 用户设置模型
const settingsSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    settings: { type: Object, default: {} },
    workspaces: { type: Array, default: ['public', 'private'] },
    updatedAt: { type: Date, default: Date.now }
});

const UserSettings = mongoose.model('UserSettings', settingsSchema);

// API 路由

// 获取所有笔记
app.get('/api/notes', async (req, res) => {
    try {
        const { userId = 'default', workspace } = req.query;
        const filter = { userId };
        if (workspace) {
            filter.workspace = workspace;
        }
        const notes = await Note.find(filter).sort({ updatedAt: -1 });
        res.json(notes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 创建或更新笔记
app.post('/api/notes', async (req, res) => {
    try {
        const { id, title, content, workspace, userId = 'default' } = req.body;
        
        const noteData = {
            id,
            title,
            content,
            workspace,
            userId,
            updatedAt: new Date()
        };
        
        const note = await Note.findOneAndUpdate(
            { id, userId },
            noteData,
            { upsert: true, new: true }
        );
        
        res.json(note);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除笔记
app.delete('/api/notes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId = 'default' } = req.query;
        
        await Note.findOneAndDelete({ id, userId });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取用户设置
app.get('/api/settings', async (req, res) => {
    try {
        const { userId = 'default' } = req.query;
        const userSettings = await UserSettings.findOne({ userId });
        
        if (!userSettings) {
            // 创建默认设置
            const defaultSettings = {
                userId,
                settings: {
                    theme: 'light',
                    fontSize: 14,
                    autoSave: true,
                    aiEnabled: false,
                    aiApiKey: '',
                    aiBaseUrl: 'https://api.deepseek.com',
                    aiModel: 'deepseek-chat',
                    markdownTheme: 'github',
                    customThemeUrl: '',
                    cloudSync: true
                },
                workspaces: ['public', 'private']
            };
            
            const newSettings = await UserSettings.create(defaultSettings);
            return res.json(newSettings);
        }
        
        res.json(userSettings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 更新用户设置
app.post('/api/settings', async (req, res) => {
    try {
        const { userId = 'default', settings, workspaces } = req.body;
        
        const userSettings = await UserSettings.findOneAndUpdate(
            { userId },
            { 
                settings,
                workspaces,
                updatedAt: new Date()
            },
            { upsert: true, new: true }
        );
        
        res.json(userSettings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 同步状态检查
app.get('/api/sync/status', async (req, res) => {
    try {
        const { userId = 'default' } = req.query;
        const notesCount = await Note.countDocuments({ userId });
        const lastSync = await Note.findOne({ userId }).sort({ updatedAt: -1 });
        
        res.json({
            connected: true,
            notesCount,
            lastSync: lastSync ? lastSync.updatedAt : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 批量同步笔记
app.post('/api/sync/notes', async (req, res) => {
    try {
        const { notes, userId = 'default' } = req.body;
        
        const operations = notes.map(note => ({
            updateOne: {
                filter: { id: note.id, userId },
                update: { ...note, userId, updatedAt: new Date() },
                upsert: true
            }
        }));
        
        await Note.bulkWrite(operations);
        
        // 返回所有笔记
        const allNotes = await Note.find({ userId }).sort({ updatedAt: -1 });
        res.json(allNotes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
    console.log(`访问地址: http://localhost:${PORT}`);
});

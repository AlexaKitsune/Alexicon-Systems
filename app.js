const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const createDatabase = require('./utils/db_setup');
createDatabase();

const app = express();
const server = http.createServer(app);

const { initSocket } = require('./utils/socket');
initSocket(server); // Socket.IO inicializado UNA VEZ aquí

const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());
app.use(
    '/badges',
    express.static(path.join(__dirname, 'storage', 'badges'))
);

const routes = [
    ['alexicon/auth', require('./services/alexicon/auth')],
    ['alexicon/users', require('./services/alexicon/users')],
    ['alexicon/social', require('./services/alexicon/social')],
    ['alexicon/media', require('./services/alexicon/media')],
    ['alexicon/notifications', require('./services/alexicon/notifications')],
    ['alexicon/content', require('./services/alexicon/content')],
    ['alexicon/settings', require('./services/alexicon/settings')],
    ['alexicon/badges', require('./services/alexicon/badges')],
    ['alexicon/on', require('./services/alexicon/status')],
    ['alexicon/api-keys', require('./services/alexicon/api_keys')],
    ['alexicon/services', require('./services/alexicon/services')],
    ['alexicon/subscriptions', require('./services/alexicon/subscriptions')],
    ['alexicon/credits', require('./services/alexicon/credits')],

    ['yipnet/posts', require('./services/yipnet/posts')],
    ['yipnet/comments', require('./services/yipnet/comments')],
    ['yipnet/messages', require('./services/yipnet/messages')],
    ['yipnet/votes', require('./services/yipnet/votes')],
    ['yipnet/stats', require('./services/yipnet/stats')],
    ['yipnet/search', require('./services/yipnet/search')],

    ['alyx/chats', require('./services/alyx/chats')],
    ['alyx/projects', require('./services/alyx/projects')],
    ['alyx/messages', require('./services/alyx/messages')],
    ['alyx/usage', require('./services/alyx/usage')],
    //['alyx/api-keys', require('./services/alyx/api_keys')],
];

routes.forEach(([route, router]) => {
    app.use(`/${route}`, router);
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Server:
server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
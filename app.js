const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const createDatabase = require('./utils/dbSetup');
createDatabase();

const app = express();
const server = http.createServer(app);

const { initSocket } = require('./utils/socket');
initSocket(server); // Socket.IO inicializado UNA VEZ aquí

const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

const routeNames = [
    'alexicon/api',
    'alexicon/block',
    'alexicon/check_session',
    'alexicon/follow',
    'alexicon/login',
    'alexicon/logout',
    'alexicon/media_by_id',
    'alexicon/notification_seen',
    'alexicon/notifications',
    'alexicon/on',
    'alexicon/refresh_verify_key',
    'alexicon/register',
    'alexicon/report',
    'alexicon/retrieve_users',
    'alexicon/retrieve',
    'alexicon/update_pass',
    'alexicon/update_pics',
    'alexicon/update_profile',
    'alexicon/upload',
    'alexicon/verify',

    'yipnet/comment',
    'yipnet/delete',
    'yipnet/get_messages',
    'yipnet/get_single_comment',
    'yipnet/get_single_post',
    'yipnet/list_comments',
    'yipnet/list_messages',
    'yipnet/list_posts',
    'yipnet/message',
    'yipnet/newsfeed',
    'yipnet/post',
    'yipnet/retrieve_posts',
    'yipnet/vote',
];

routeNames.forEach(r => app.use(
    '/' + r.split('/')[0],
    require(`./services/${r}`)
));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Server:
server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

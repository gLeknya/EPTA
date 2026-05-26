const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4'
};

const server = http.createServer((req, res) => {
    console.log(`${new Date().toLocaleTimeString()} - ${req.method} ${req.url}`);
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    
    // Proxy API requests
    if (req.url.startsWith('/api/')) {
        const apiUrl = `${API_BASE_URL}${req.url}`;
        const options = {
            method: req.method,
            headers: { ...req.headers, host: new URL(API_BASE_URL).host }
        };
        
        const proxyReq = http.request(apiUrl, options, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        });
        
        proxyReq.on('error', (error) => {
            console.error('Proxy error:', error);
            res.writeHead(502);
            res.end('Bad Gateway');
        });
        
        req.pipe(proxyReq);
        return;
    }
    
    // Serve static files
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }
    
    const extname = path.extname(filePath);
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';
    
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h1 style="color: red; text-align: center; margin-top: 50px;">404 - Файл не найден!</h1>');
            } else {
                res.writeHead(500);
                res.end(`Ошибка сервера: ${error.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log('🌿 Сервер ЕПТА запущен! 🌿');
    console.log(`📍 Локальный адрес: http://localhost:${PORT}`);
    console.log(`📁 Файлы должны быть в той же папке:`);
    console.log(`   - index.html`);
    console.log(`   - style.css`);
    console.log(`   - script.js`);
    console.log(`   - server.js (этот файл)`);
    console.log('🛑 Для остановки нажмите Ctrl + C\n');
    
    // Открываем браузер автоматически (опционально)
    const { exec } = require('child_process');
    const platform = process.platform;
    
    if (platform === 'win32') {
        exec(`start http://localhost:${PORT}`);
    } else if (platform === 'darwin') {
        exec(`open http://localhost:${PORT}`);
    } else {
        exec(`xdg-open http://localhost:${PORT}`);
    }
});

// Обработка ошибок сервера
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Порт ${PORT} уже занят!`);
        console.error('Попробуйте изменить PORT в файле server.js');
    } else {
        console.error('❌ Ошибка сервера:', error);
    }
});
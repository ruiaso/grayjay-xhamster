const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5000;
const HOST = '0.0.0.0';

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './index.html';
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*'
        });
        res.end('File not found', 'utf-8');
      } else {
        res.writeHead(500, { 
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*'
        });
        res.end('Server error: ' + error.code, 'utf-8');
      }
    } else {
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Grayjay Plugin Server running at http://${HOST}:${PORT}/`);
  console.log(`\nSpankBang Plugin:`);
  console.log(`  Config: http://${HOST}:${PORT}/SpankbangConfig.json`);
  console.log(`  Script: http://${HOST}:${PORT}/SpankbangScript.js`);
  console.log(`\nxHamster Plugin:`);
  console.log(`  Config: http://${HOST}:${PORT}/XhamsterConfig.json`);
  console.log(`  Script: http://${HOST}:${PORT}/XhamsterScript.js`);
});

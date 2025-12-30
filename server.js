// server.js - FULL UNABRIDGED - LAST WORKING IMAGE GENERATION PROXY
const http = require('http');
const url = require('url');
const finalhandler = require('finalhandler');
const serveStatic = require('serve-static');
require('dotenv').config();

const serve = serveStatic('.', { 'index': ['index.html'] });

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);

    // Text Chat Proxy
    if (parsedUrl.pathname === '/api/chat' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            let requestData = {};
            try {
                requestData = JSON.parse(body || '{}');
            } catch (e) {
                console.error('JSON parse error:', e);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON body' }));
                return;
            }
            try {
                const veniceResponse = await fetch('https://api.venice.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.VENICE_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
          body: JSON.stringify({
          model: requestData.model || 'mistral-31-24b',
          messages: requestData.messages || [],
          temperature: 0.8,
          max_tokens: 8096
        })
                });
                const responseText = await veniceResponse.text();
                console.log('Venice chat status:', veniceResponse.status);
                res.writeHead(veniceResponse.status, { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*' 
                });
                res.end(responseText);
            } catch (err) {
                console.error('Chat fetch failed:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Proxy error', details: err.message }));
            }
        });
        return;
    }

    // Image Generation Proxy - LAST WORKING CONFIGURATION
    if (parsedUrl.pathname === '/api/image' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            let requestData = {};
            try {
                requestData = JSON.parse(body || '{}');
            } catch (e) {
                console.error('JSON parse error:', e);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON body' }));
                return;
            }
            try {

                console.log('Sending to Venice chat with model:', 'mistral-31-24b');
                console.log('Full request payload:', JSON.stringify({
                    model: 'mistral-31-24b',
                    messages: requestData.messages || [],
                    temperature: 0.8,
                    max_tokens: 8096
                }));

                const veniceResponse = await fetch('https://api.venice.ai/api/v1/image/generate', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.VENICE_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'venice-sd35',
                        prompt: requestData.prompt,
                        return_binary: false
                    })
                });
                const responseData = await veniceResponse.json();
                res.writeHead(200, { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*' 
                });
                res.end(JSON.stringify(responseData));
            } catch (err) {
                console.error('Image generation failed:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Image generation failed', details: err.message }));
            }
        });
        return;
    }

    // CORS OPTIONS
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    // Static files
    serve(req, res, finalhandler(req, res));
});

const PORT = 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://10.5.0.2:${PORT}/`);
});
const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// --- Serve Frontend ---
app.use(express.static(__dirname)); // Serve all files from the root

// --- Backend API Proxy ---
// Use memory storage for simplicity and to avoid disk I/O issues
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Endpoint to proxy transcription requests to Nexara
app.post('/api/transcribe', upload.single('file'), async (req, res) => {
    console.log('\n--- Transcription Request Received ---');

    if (!req.file) {
        console.error('❌ No file received by server.');
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    // Server-side logging
    console.log(`[SERVER] Received file: ${req.file.originalname}`);
    console.log(`[SERVER] MimeType: ${req.file.mimetype}`);
    console.log(`[SERVER] Size: ${req.file.size} bytes`);

    if (req.file.size === 0) {
        console.error('❌ Received an empty file.');
        return res.status(400).json({ error: 'Received an empty file.' });
    }

    const apiKey = req.header('x-nexara-api-key');
    if (!apiKey) {
        console.error('❌ Nexara API key is missing from headers.');
        return res.status(401).json({ error: 'Nexara API key is missing.' });
    }

    const nexaraApiUrl = 'https://api.nexara.ru/api/v1/audio/transcriptions';

    try {
        const formData = new FormData();
        // Append the buffer from memory directly. This is the crucial part.
        formData.append('file', req.file.buffer, req.file.originalname);

        // Forward other form fields from the client
        if (req.body.response_format) formData.append('response_format', req.body.response_format);
        if (req.body.task) formData.append('task', req.body.task);
        if (req.body.language) formData.append('language', req.body.language);

        console.log('[SERVER] Forwarding to Nexara API...');

        const nexaraResponse = await axios.post(nexaraApiUrl, formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${apiKey}`,
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        });

        console.log('[SERVER] Success from Nexara API.');
        res.json(nexaraResponse.data);

    } catch (error) {
        const status = error.response?.status || 500;
        const message = error.response?.data || { error: 'Internal Server Error' };
        console.error(`[SERVER] Error proxying to Nexara (Status: ${status}):`, message);
        res.status(status).json(message);
    }
});

// Endpoint to forward data to the user's n8n webhook
app.post('/api/webhook', async (req, res) => {
    console.log('\n--- Webhook Request Received ---');
    const { webhookUrl, payload } = req.body;

    if (!webhookUrl || !payload) {
        return res.status(400).json({ error: 'webhookUrl and payload are required.' });
    }

    try {
        console.log(`[SERVER] Forwarding to n8n webhook: ${webhookUrl}`);
        const n8nResponse = await axios.post(webhookUrl, payload);
        res.status(200).json({ success: true, response: n8nResponse.data });
    } catch (error) {
        const status = error.response?.status || 500;
        const message = error.response?.data || { error: 'Internal Server Error' };
        console.error(`[SERVER] Error forwarding to n8n (Status: ${status}):`, message);
        res.status(status).json(message);
    }
});

app.listen(port, () => {
    console.log(`\n🚀 NexaraBot App is running!`);
    console.log(`✅ Server is live on http://localhost:${port}`);
});
/* ==========================================================================
   ASM MOLFETTA APP - MAIN EXPRESS SERVER
   ========================================================================== */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { initDb, dbRun, dbGet, dbAll } = require('./database');
const { sendReportEmail } = require('./mailer');

const app = express();
const PORT = process.env.PORT || 8080;

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded photos (restrict to image files only)
app.use('/uploads', (req, res, next) => {
    const ext = path.extname(req.path).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'];
    if (!allowed.includes(ext)) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
}, express.static(path.join(__dirname, 'uploads')));

// ============================================================================
// MULTER - FILE UPLOAD CONFIGURATION
// ============================================================================

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `photo-${unique}${ext}`);
    }
});

const fileFilter = (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Solo immagini sono accettate (JPEG, PNG, GIF, WebP, HEIC)'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 15 * 1024 * 1024, // 15MB per file
        files: 10                    // max 10 files
    }
});

// ============================================================================
// ADMIN AUTHENTICATION MIDDLEWARE
// ============================================================================

function requireAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Autenticazione richiesta' });
    }
    const token = authHeader.split(' ')[1];
    // Simple static token: base64 of "username:password"
    const expected = Buffer.from(
        `${process.env.ADMIN_USERNAME || 'admin'}:${process.env.ADMIN_PASSWORD || 'admin1234'}`
    ).toString('base64');
    
    if (token !== expected) {
        return res.status(403).json({ error: 'Credenziali non valide' });
    }
    next();
}

// ============================================================================
// INPUT VALIDATION HELPERS
// ============================================================================

function validateReport(body) {
    const errors = [];
    const validCategories = ['ingombranti', 'abbandono', 'cestino', 'altro'];
    const validStatuses = ['Nuova', 'In Lavorazione', 'Risolta'];

    if (!body.category || !validCategories.includes(body.category)) {
        errors.push('Categoria non valida. Scegli tra: ingombranti, abbandono, cestino, altro.');
    }
    if (body.notes && body.notes.length > 2000) {
        errors.push('Le note non possono superare i 2000 caratteri.');
    }
    if (body.latitude && isNaN(parseFloat(body.latitude))) {
        errors.push('Latitudine non valida.');
    }
    if (body.longitude && isNaN(parseFloat(body.longitude))) {
        errors.push('Longitudine non valida.');
    }
    return errors;
}

// ============================================================================
// API ROUTES
// ============================================================================

// --- Health Check ---
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'ASM Molfetta API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// ============================================================================
// REPORTS API
// ============================================================================

/**
 * POST /api/reports
 * Create a new citizen report with optional photo uploads.
 * Body (multipart/form-data):
 *   - category: string (required)
 *   - notes: string (optional)
 *   - latitude: string (optional)
 *   - longitude: string (optional)
 *   - address: string (optional)
 *   - photos: file[] (optional, max 10)
 */
app.post('/api/reports', upload.array('photos', 10), async (req, res) => {
    try {
        // Validate input
        const errors = validateReport(req.body);
        if (errors.length > 0) {
            // Clean up uploaded files if validation fails
            if (req.files) {
                req.files.forEach(f => fs.unlink(f.path, () => {}));
            }
            return res.status(400).json({ error: 'Dati non validi', details: errors });
        }

        const { category, notes, latitude, longitude, address } = req.body;

        // Build photos JSON array from uploaded files
        const photoFilenames = req.files ? req.files.map(f => f.filename) : [];
        const photosJson = JSON.stringify(photoFilenames);

        // Insert report into database
        const result = await dbRun(
            `INSERT INTO reports (category, notes, latitude, longitude, address, photos)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [category, notes || null, latitude || null, longitude || null, address || null, photosJson]
        );

        const newReport = await dbGet('SELECT * FROM reports WHERE id = ?', [result.lastID]);

        // Send email notification (async, don't block response)
        const photoPaths = req.files ? req.files.map(f => f.path) : [];
        sendReportEmail(newReport, photoPaths).catch(err => {
            console.error('⚠️  Errore invio email:', err.message);
        });

        return res.status(201).json({
            success: true,
            message: 'Segnalazione registrata con successo!',
            report: {
                id: newReport.id,
                category: newReport.category,
                status: newReport.status,
                created_at: newReport.created_at,
                photos_count: photoFilenames.length
            }
        });

    } catch (err) {
        console.error('❌ Errore creazione segnalazione:', err);
        // Clean up files on error
        if (req.files) {
            req.files.forEach(f => fs.unlink(f.path, () => {}));
        }
        return res.status(500).json({ error: 'Errore interno del server. Riprova più tardi.' });
    }
});

// ============================================================================
// ADMIN API (Protected)
// ============================================================================

/**
 * POST /api/admin/login
 * Authenticate admin and receive access token.
 */
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
    const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin1234';

    if (!username || !password) {
        return res.status(400).json({ error: 'Username e password sono obbligatori.' });
    }

    if (username === ADMIN_USER && password === ADMIN_PASS) {
        // Generate simple base64 token
        const token = Buffer.from(`${username}:${password}`).toString('base64');
        return res.json({
            success: true,
            token,
            admin: { username }
        });
    }

    return res.status(403).json({ error: 'Credenziali non valide. Riprova.' });
});

/**
 * GET /api/admin/reports
 * List all reports with optional filters.
 * Query params: status, category, limit, offset
 */
app.get('/api/admin/reports', requireAdmin, async (req, res) => {
    try {
        const { status, category, limit = 50, offset = 0 } = req.query;
        
        let sql = 'SELECT * FROM reports WHERE 1=1';
        const params = [];

        if (status) { sql += ' AND status = ?'; params.push(status); }
        if (category) { sql += ' AND category = ?'; params.push(category); }
        
        sql += ' ORDER BY created_at DESC';
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const reports = await dbAll(sql, params);

        // Parse photos JSON, add photo URLs
        const enriched = reports.map(r => ({
            ...r,
            photos: JSON.parse(r.photos || '[]'),
            photo_urls: JSON.parse(r.photos || '[]').map(f => `/uploads/${f}`)
        }));

        // Get total count for pagination
        let countSql = 'SELECT COUNT(*) as total FROM reports WHERE 1=1';
        const countParams = [];
        if (status) { countSql += ' AND status = ?'; countParams.push(status); }
        if (category) { countSql += ' AND category = ?'; countParams.push(category); }
        const { total } = await dbGet(countSql, countParams);

        return res.json({ reports: enriched, total, limit: parseInt(limit), offset: parseInt(offset) });

    } catch (err) {
        console.error('❌ Errore get reports:', err);
        return res.status(500).json({ error: 'Errore caricamento segnalazioni.' });
    }
});

/**
 * GET /api/admin/reports/:id
 * Get a single report by ID.
 */
app.get('/api/admin/reports/:id', requireAdmin, async (req, res) => {
    try {
        const report = await dbGet('SELECT * FROM reports WHERE id = ?', [req.params.id]);
        if (!report) return res.status(404).json({ error: 'Segnalazione non trovata.' });
        
        const photos = JSON.parse(report.photos || '[]');
        return res.json({
            ...report,
            photos,
            photo_urls: photos.map(f => `/uploads/${f}`)
        });
    } catch (err) {
        console.error('❌ Errore get report:', err);
        return res.status(500).json({ error: 'Errore caricamento segnalazione.' });
    }
});

/**
 * PUT /api/admin/reports/:id
 * Update report status.
 * Body: { status: 'Nuova' | 'In Lavorazione' | 'Risolta' }
 */
app.put('/api/admin/reports/:id', requireAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['Nuova', 'In Lavorazione', 'Risolta'];

        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ error: `Status non valido. Usa uno tra: ${validStatuses.join(', ')}` });
        }

        const report = await dbGet('SELECT id FROM reports WHERE id = ?', [req.params.id]);
        if (!report) return res.status(404).json({ error: 'Segnalazione non trovata.' });

        await dbRun('UPDATE reports SET status = ? WHERE id = ?', [status, req.params.id]);
        const updated = await dbGet('SELECT * FROM reports WHERE id = ?', [req.params.id]);

        return res.json({ success: true, report: updated });

    } catch (err) {
        console.error('❌ Errore update report:', err);
        return res.status(500).json({ error: 'Errore aggiornamento segnalazione.' });
    }
});

/**
 * DELETE /api/admin/reports/:id
 * Delete a report and its associated photos.
 */
app.delete('/api/admin/reports/:id', requireAdmin, async (req, res) => {
    try {
        const report = await dbGet('SELECT * FROM reports WHERE id = ?', [req.params.id]);
        if (!report) return res.status(404).json({ error: 'Segnalazione non trovata.' });

        // Delete associated photos
        const photos = JSON.parse(report.photos || '[]');
        photos.forEach(filename => {
            const filepath = path.join(uploadsDir, filename);
            fs.unlink(filepath, err => {
                if (err && err.code !== 'ENOENT') console.warn('⚠️  Impossibile eliminare foto:', filepath);
            });
        });

        await dbRun('DELETE FROM reports WHERE id = ?', [req.params.id]);
        return res.json({ success: true, message: 'Segnalazione eliminata.' });

    } catch (err) {
        console.error('❌ Errore delete report:', err);
        return res.status(500).json({ error: 'Errore eliminazione segnalazione.' });
    }
});

/**
 * GET /api/admin/stats
 * Dashboard statistics
 */
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {
        const [total, nuove, inLavorazione, risolte] = await Promise.all([
            dbGet('SELECT COUNT(*) as count FROM reports'),
            dbGet("SELECT COUNT(*) as count FROM reports WHERE status = 'Nuova'"),
            dbGet("SELECT COUNT(*) as count FROM reports WHERE status = 'In Lavorazione'"),
            dbGet("SELECT COUNT(*) as count FROM reports WHERE status = 'Risolta'"),
        ]);

        const recentReports = await dbAll(
            'SELECT id, category, status, created_at FROM reports ORDER BY created_at DESC LIMIT 5'
        );

        const byCategory = await dbAll(
            'SELECT category, COUNT(*) as count FROM reports GROUP BY category'
        );

        return res.json({
            total: total.count,
            nuove: nuove.count,
            inLavorazione: inLavorazione.count,
            risolte: risolte.count,
            recentReports,
            byCategory
        });
    } catch (err) {
        console.error('❌ Errore stats:', err);
        return res.status(500).json({ error: 'Errore caricamento statistiche.' });
    }
});

// ============================================================================
// SPA CATCH-ALL (serve index.html for all non-API routes)
// ============================================================================
app.get('*', (req, res) => {
    // Don't catch API routes or file requests
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
        return res.status(404).json({ error: 'Endpoint non trovato.' });
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================================
// GLOBAL ERROR HANDLER
// ============================================================================
app.use((err, req, res, _next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Foto troppo grande. Limite: 15MB per foto.' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: 'Puoi allegare massimo 10 foto.' });
        }
        return res.status(400).json({ error: `Errore upload: ${err.message}` });
    }
    if (err.message && err.message.includes('Solo immagini')) {
        return res.status(400).json({ error: err.message });
    }
    console.error('❌ Errore server non gestito:', err);
    return res.status(500).json({ error: 'Errore interno del server.' });
});

// ============================================================================
// START SERVER
// ============================================================================
async function start() {
    try {
        await initDb();
        app.listen(PORT, () => {
            console.log('\n🌿 ========================================');
            console.log('   ASM Molfetta App - Server Avviato!');
            console.log('   ========================================');
            console.log(`   🌐 App Citizen: http://localhost:${PORT}`);
            console.log(`   🔐 Admin Panel: http://localhost:${PORT}/admin.html`);
            console.log(`   📡 API Health:  http://localhost:${PORT}/api/health`);
            console.log(`   ⚙️  Ambiente:    ${process.env.NODE_ENV || 'development'}`);
            console.log('   ========================================\n');
        });
    } catch (err) {
        console.error('❌ Errore avvio server:', err);
        process.exit(1);
    }
}

start();

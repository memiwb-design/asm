/* ==========================================================================
   ASM MOLFETTA APP - EMAIL SERVICE (Nodemailer)
   ========================================================================== */

const nodemailer = require('nodemailer');
const path = require('path');

let transporter = null;
let devMode = false;

function createTransporter() {
    const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;

    // If SMTP credentials are missing, use Ethereal for dev preview
    if (!SMTP_USER || !SMTP_PASS) {
        devMode = true;
        console.log('⚠️  Credenziali SMTP non configurate. Le email saranno simulate (log in console).');
        return null;
    }

    return nodemailer.createTransport({
        host: SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(SMTP_PORT) || 587,
        secure: SMTP_SECURE === 'true',
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
        tls: {
            rejectUnauthorized: false
        }
    });
}

function getTransporter() {
    if (!transporter && !devMode) {
        transporter = createTransporter();
    }
    return transporter;
}

/**
 * Send report email with optional photo attachments.
 * @param {Object} report - Report data from database
 * @param {string[]} photoPaths - Array of absolute file paths for attachments
 */
async function sendReportEmail(report, photoPaths = []) {
    const recipient = process.env.EMAIL_RECIPIENT || 'memiwb@gmail.com';
    const from = process.env.EMAIL_FROM || 'ASM Molfetta App <noreply@asm-molfetta.it>';

    const categoryLabels = {
        'ingombranti': 'Materiale Ingombrante',
        'abbandono': 'Rifiuti Abbandonati',
        'cestino': 'Cassonetto Pieno / Danneggiato',
        'altro': 'Segnalazione Altra Natura'
    };
    const categoryLabel = categoryLabels[report.category] || report.category;

    const mapLink = (report.latitude && report.longitude)
        ? `https://www.google.com/maps?q=${report.latitude},${report.longitude}`
        : null;

    const htmlBody = `
    <!DOCTYPE html>
    <html lang="it">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nuova Segnalazione ASM Molfetta</title>
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #f3f7f5; margin: 0; padding: 20px; color: #1a2e22; }
            .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
            .header { background: linear-gradient(135deg, #10b981, #059669); padding: 32px 28px; color: white; }
            .header h1 { margin: 0 0 4px 0; font-size: 22px; }
            .header p { margin: 0; opacity: 0.85; font-size: 14px; }
            .badge { display: inline-block; background: rgba(255,255,255,0.25); border-radius: 20px; padding: 4px 14px; font-size: 12px; margin-top: 10px; }
            .body { padding: 28px; }
            .field { margin-bottom: 18px; }
            .field label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #6b7280; font-weight: 600; margin-bottom: 4px; }
            .field .value { font-size: 15px; color: #111827; font-weight: 500; }
            .field .value.notes { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; font-size: 14px; color: #374151; white-space: pre-wrap; }
            .map-btn { display: inline-block; margin-top: 8px; background: #10b981; color: white; text-decoration: none; padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; }
            .report-id { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
            .report-id span.label { color: #15803d; font-size: 12px; font-weight: 700; text-transform: uppercase; }
            .report-id span.id { font-size: 18px; font-weight: 800; color: #166534; }
            .photos-section { margin-top: 20px; }
            .photos-section h3 { font-size: 13px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.6px; margin-bottom: 12px; }
            .footer { background: #f9fafb; padding: 18px 28px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; }
            .divider { height: 1px; background: #e5e7eb; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🌿 Nuova Segnalazione</h1>
                <p>Ricevuta tramite App ASM Molfetta</p>
                <div class="badge">${categoryLabel}</div>
            </div>
            <div class="body">
                <div class="report-id">
                    <span class="label">N° Segnalazione</span>
                    <span class="id">#${String(report.id).padStart(4, '0')}</span>
                </div>

                <div class="field">
                    <label>Tipo di Intervento</label>
                    <div class="value">${categoryLabel}</div>
                </div>

                <div class="field">
                    <label>Data e Ora</label>
                    <div class="value">${new Date(report.created_at).toLocaleString('it-IT', { dateStyle: 'full', timeStyle: 'short' })}</div>
                </div>

                <div class="field">
                    <label>Note del Cittadino</label>
                    <div class="value notes">${report.notes || 'Nessuna nota aggiuntiva fornita.'}</div>
                </div>

                <div class="divider"></div>

                <div class="field">
                    <label>📍 Geolocalizzazione</label>
                    <div class="value">${report.address || 'Indirizzo non disponibile'}</div>
                    ${report.latitude && report.longitude ? `
                    <div style="margin-top: 6px; color: #6b7280; font-size: 13px;">
                        Lat: ${report.latitude} | Lng: ${report.longitude}
                    </div>` : ''}
                    ${mapLink ? `<a href="${mapLink}" class="map-btn">📌 Apri in Google Maps</a>` : ''}
                </div>

                ${photoPaths.length > 0 ? `
                <div class="divider"></div>
                <div class="photos-section">
                    <h3>📷 Foto Allegate (${photoPaths.length})</h3>
                    <p style="color: #6b7280; font-size: 13px;">Le foto della segnalazione sono allegate a questa email come allegati.</p>
                </div>` : ''}
            </div>
            <div class="footer">
                Segnalazione inviata automaticamente dall'App ASM Molfetta &mdash; Servizi Municipalizzati di Molfetta (BA)
            </div>
        </div>
    </body>
    </html>
    `;

    const textBody = [
        `NUOVA SEGNALAZIONE ASM MOLFETTA`,
        `N° Segnalazione: #${String(report.id).padStart(4, '0')}`,
        `Tipo: ${categoryLabel}`,
        `Data: ${new Date(report.created_at).toLocaleString('it-IT')}`,
        `Note: ${report.notes || 'Nessuna'}`,
        `---`,
        `POSIZIONE GPS`,
        `Indirizzo: ${report.address || 'Non disponibile'}`,
        `Latitudine: ${report.latitude || 'Non disponibile'}`,
        `Longitudine: ${report.longitude || 'Non disponibile'}`,
        mapLink ? `Mappa: ${mapLink}` : '',
        `---`,
        `Foto allegate: ${photoPaths.length}`,
    ].filter(Boolean).join('\n');

    const mailOptions = {
        from,
        to: recipient,
        subject: `[ASM Molfetta] Nuova Segnalazione #${String(report.id).padStart(4, '0')} - ${categoryLabel}`,
        text: textBody,
        html: htmlBody,
        attachments: photoPaths.map((filePath, i) => ({
            filename: `foto_${i + 1}${path.extname(filePath) || '.jpg'}`,
            path: filePath,
        }))
    };

    // Development mode: just log to console
    if (devMode || !getTransporter()) {
        console.log('\n📧 ======================== EMAIL SIMULATA ========================');
        console.log(`   Da: ${from}`);
        console.log(`   A: ${recipient}`);
        console.log(`   Oggetto: ${mailOptions.subject}`);
        console.log(`   Allegati: ${photoPaths.length} foto`);
        console.log(`   Body (text):\n${textBody}`);
        console.log('=================================================================\n');
        return { messageId: 'dev-mode-simulated', simulated: true };
    }

    // Real send
    const info = await getTransporter().sendMail(mailOptions);
    console.log(`✅ Email inviata: ${info.messageId}`);
    return info;
}

module.exports = { sendReportEmail };

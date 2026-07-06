# 🌿 ASM Molfetta App - Guida al Deploy in Produzione

Questa guida descrive come pubblicare l'app ASM Molfetta su tre piattaforme di hosting principali.

---

## Prerequisiti

- Node.js 18+ installato
- Account su una delle piattaforme seguenti
- Credenziali SMTP per l'invio email (es. App Password Gmail)

---

## Struttura del Progetto

```
asm-molfetta-app/
├── public/             # Frontend (servito staticamente da Express)
│   ├── index.html      # App cittadini
│   ├── app.js
│   ├── style.css
│   ├── admin.html      # Pannello amministratore
│   ├── admin.js
│   ├── admin.css
│   ├── manifest.json   # PWA manifest
│   └── sw.js           # Service Worker
├── uploads/            # Foto caricate (cartella persistente)
├── server.js           # Backend Express
├── database.js         # Helper SQLite
├── mailer.js           # Servizio Email (Nodemailer)
├── database.sqlite     # Database (creato automaticamente all'avvio)
├── .env                # Variabili ambiente LOCALI (non in git)
├── .env.example        # Template variabili ambiente
├── package.json
└── DEPLOY.md           # Questa guida
```

---

## Configurazione dell'Ambiente

Prima del deploy, copia il file `.env.example` in `.env` e compila i valori:

```bash
cp .env.example .env
```

Le variabili principali da configurare:

| Variabile | Descrizione | Esempio |
|-----------|-------------|---------|
| `PORT` | Porta del server | `8080` |
| `NODE_ENV` | Ambiente | `production` |
| `SMTP_HOST` | Server SMTP | `smtp.gmail.com` |
| `SMTP_PORT` | Porta SMTP | `587` |
| `SMTP_USER` | Email mittente | `your@gmail.com` |
| `SMTP_PASS` | App Password Gmail | `xxxx xxxx xxxx xxxx` |
| `EMAIL_RECIPIENT` | Email destinatario | `memiwb@gmail.com` |
| `ADMIN_USERNAME` | Username pannello admin | `admin` |
| `ADMIN_PASSWORD` | Password pannello admin | `Password_Sicura!` |

> ⚠️ **Per Gmail**: vai su [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) per generare una App Password (richiede autenticazione 2FA attiva).

---

## Opzione A: Deploy su Render (Consigliato - Gratuito)

[Render](https://render.com) è la soluzione più semplice per questa architettura. Supporta SQLite con **persistent disk** e non richiede configurazione Docker.

### Passaggi

1. **Crea un account** su [render.com](https://render.com)

2. **Crea un repository Git** (GitHub, GitLab o Bitbucket) e carica il progetto:
   ```bash
   git init
   git add .
   git commit -m "Initial commit ASM Molfetta App"
   git remote add origin https://github.com/tuo-utente/asm-molfetta-app.git
   git push -u origin main
   ```

3. **Crea un nuovo Web Service** su Render:
   - Connetti il repository Git
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Region**: Europe (Frankfurt)

4. **Aggiungi un Persistent Disk** (fondamentale per SQLite e uploads):
   - Mount path: `/opt/render/project/src`
   - Size: 1 GB (gratuito nel piano Starter)

5. **Configura le variabili d'ambiente** in Render Dashboard → Environment:
   - Aggiungi tutte le variabili dal file `.env.example`
   - Imposta `NODE_ENV=production`
   - Inserisci le credenziali SMTP reali

6. **Deploy!** Render avvierà automaticamente il deploy a ogni push su `main`.

---

## Opzione B: Deploy su Railway

[Railway](https://railway.app) è un'ottima alternativa con un piano gratuito generoso.

### Passaggi

1. **Crea un account** su [railway.app](https://railway.app)

2. **Crea un nuovo progetto** → "Deploy from GitHub repo"

3. Configura le **Environment Variables** nella sezione Settings del servizio

4. Railway rileverà automaticamente che è un'app Node.js e userà `npm start` come comando

5. Per la persistenza di SQLite e uploads, usa i **Railway Volumes**:
   - Crea un Volume e montalo sulla directory `/app/uploads`
   - SQLite salverà automaticamente in `/app/database.sqlite`

---

## Opzione C: VPS Dedicato (Ubuntu + Nginx + PM2)

Per chi dispone di un server dedicato o VPS (es. DigitalOcean, Hetzner, OVH).

### Installazione

```bash
# 1. Clona il progetto sul server
git clone https://github.com/tuo-utente/asm-molfetta-app.git
cd asm-molfetta-app

# 2. Installa dipendenze
npm install --production

# 3. Configura le variabili d'ambiente
cp .env.example .env
nano .env   # Modifica con i valori reali

# 4. Installa PM2 (process manager per Node.js)
npm install -g pm2

# 5. Avvia l'app con PM2
pm2 start server.js --name "asm-molfetta"
pm2 startup    # Avvio automatico al riavvio del server
pm2 save
```

### Configurazione Nginx (Reverse Proxy)

```nginx
server {
    listen 80;
    server_name tuo-dominio.it www.tuo-dominio.it;

    # Aumenta limite upload per le foto
    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # Serve files di upload direttamente (opzionale, più performante)
    location /uploads {
        alias /percorso/al/progetto/uploads;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
```

### HTTPS con Let's Encrypt (Gratuito)

```bash
# Installa Certbot
sudo apt install certbot python3-certbot-nginx

# Genera certificato SSL
sudo certbot --nginx -d tuo-dominio.it -d www.tuo-dominio.it
```

---

## Accesso al Pannello Admin

Una volta avviato il server, accedi al pannello amministratore all'indirizzo:

```
http://localhost:8080/admin.html   (locale)
https://tuo-dominio.it/admin.html  (produzione)
```

**Credenziali predefinite di sviluppo** (cambiale prima del deploy!):
- Username: `admin`
- Password: `admin1234`

---

## Test dell'Invio Email

Per verificare che le email vengano inviate correttamente prima del deploy:

1. Configura le credenziali SMTP nel file `.env`
2. Avvia il server: `npm start`
3. Apri l'app cittadini e invia una segnalazione con una foto di test
4. Controlla la casella `memiwb@gmail.com` (o il valore di `EMAIL_RECIPIENT`)
5. In assenza di credenziali SMTP valide, il contenuto dell'email viene stampato in console per debug

---

## Comandi Utili

```bash
# Sviluppo (auto-reload)
npm run dev

# Produzione
npm start

# Verifica stato server (con PM2)
pm2 status asm-molfetta
pm2 logs asm-molfetta

# Backup database
cp database.sqlite database_backup_$(date +%Y%m%d).sqlite
```

---

## Note Importanti per la Produzione

> ⚠️ **Sicurezza**: Cambia SEMPRE `ADMIN_PASSWORD` e `SESSION_SECRET` prima di andare in produzione.

> ⚠️ **Backup**: SQLite è un file singolo. Imposta un backup automatico periodico di `database.sqlite` e della cartella `uploads/`.

> ℹ️ **Scalabilità**: SQLite è adatto per traffico medio. Se in futuro il numero di segnalazioni supera i 100.000 record o ci sono molti accessi simultanei, valuta la migrazione a PostgreSQL (senza modificare la logica applicativa, solo il driver).

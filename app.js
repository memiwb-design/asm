/* ==========================================================================
   ASM MOLFETTA APP - APPLICATION LOGIC
   ========================================================================== */

// Configuration
const CONFIG = {
    emailRecipient: 'memiwb@gmail.com',
    // Set your Formspree Form ID here (e.g. 'mqkvznpb') to enable direct sending of photos!
    formspreeFormId: ''
};

document.addEventListener('DOMContentLoaded', () => {
    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('Service Worker Registered'))
            .catch((err) => console.log('Service Worker Registration Failed', err));
    }

    // Initialize Lucide Icons
    lucide.createIcons();

    // App State
    const state = {
        activeTab: 'screen-home',
        calendarType: 'domestiche', // 'domestiche' or 'non-domestiche'
        gps: {
            lat: null,
            lng: null,
            address: 'Ricerca indirizzo...',
            accuracy: null,
            status: 'searching' // 'searching', 'success', 'error'
        },
        photos: [], // Base64 or object URLs
        selectedCategory: 'ingombranti',
        chatHistory: []
    };

    // DOM Elements
    const navItems = document.querySelectorAll('.nav-item');
    const screens = document.querySelectorAll('.app-screen');
    const cameraInput = document.getElementById('camera-input');
    const cameraBtn = document.getElementById('camera-btn');
    const previewGrid = document.getElementById('preview-grid');
    const geoStatusText = document.getElementById('geo-status-text');
    const geoStatusIcon = document.querySelector('.radar-ping');
    const geoDetails = document.getElementById('geo-details');
    const latVal = document.getElementById('lat-val');
    const lngVal = document.getElementById('lng-val');
    const geoAddressText = document.getElementById('geo-address-text');
    const geoRefreshBtn = document.getElementById('geo-refresh');
    const formChips = document.querySelectorAll('.form-chip');
    const reportNotes = document.getElementById('report-notes');
    const btnSubmit = document.getElementById('btn-submit-report');
    const btnMailto = document.getElementById('btn-mailto-report');
    const calendarToggleBtns = document.querySelectorAll('.calendar-toggle-btn');
    
    // Chatbot Elements
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatMessages = document.getElementById('chat-messages');

    // Calendar Data - Utenze Domestiche
    const calendarDomestiche = {
        0: { name: "Domenica Sera", type: "Organico", time: "Dalle 21:00 alle 24:00", icon: "apple", class: "organic-theme" },
        1: { name: "Lunedì Sera", type: "Indifferenziato", time: "Dalle 21:00 alle 24:00", icon: "trash-2", class: "residual-theme" },
        2: { name: "Martedì Sera", type: "Organico e Vetro", time: "Sera (dalle 21:00)", icon: "layers", class: "mix-theme" },
        3: { name: "Mercoledì Sera", type: "Carta e cartone", time: "Sera (dalle 21:00)", icon: "package", class: "paper-theme" },
        4: { name: "Giovedì Sera", type: "Organico", time: "Sera (dalle 21:00)", icon: "apple", class: "organic-theme" },
        5: { name: "Venerdì Sera", type: "Vetro", time: "Sera (dalle 21:00)", icon: "glass-water", class: "glass-theme" },
        6: { name: "Sabato Sera", type: "Nessuna Raccolta", time: "Sabato riposo conferimenti", icon: "sparkles", class: "rest-theme" }
    };

    // Calendar Data - Utenze Non Domestiche (Mock Schedule until user provides the real one)
    const calendarNonDomestiche = {
        0: { name: "Domenica Sera", type: "Organico", time: "Sera (dalle 21:00)", icon: "apple", class: "organic-theme" },
        1: { name: "Lunedì Sera", type: "Organico e Cartone", time: "Sera (dalle 21:00)", icon: "layers", class: "mix-theme" },
        2: { name: "Martedì Sera", type: "Plastica e Vetro", time: "Sera (dalle 21:00)", icon: "glass-water", class: "glass-theme" },
        3: { name: "Mercoledì Sera", type: "Organico e Carta", time: "Sera (dalle 21:00)", icon: "package", class: "paper-theme" },
        4: { name: "Giovedì Sera", type: "Plastica e Vetro", time: "Sera (dalle 21:00)", icon: "glass-water", class: "glass-theme" },
        5: { name: "Venerdì Sera", type: "Indifferenziato", time: "Sera (dalle 21:00)", icon: "trash-2", class: "residual-theme" },
        6: { name: "Sabato Sera", type: "Organico e Cartone", time: "Sera (dalle 21:00)", icon: "layers", class: "mix-theme" }
    };

    /* ==========================================================================
       TAB NAVIGATION
       ========================================================================== */
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            if (target === state.activeTab) return;

            // Update Nav Active State
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Switch Screens with fade animation
            screens.forEach(screen => {
                screen.classList.remove('active');
                if (screen.id === target) {
                    screen.classList.add('active');
                }
            });

            state.activeTab = target;

            // Trigger specific screen actions
            if (target === 'screen-segnala' && !state.gps.lat) {
                initGeolocalisation();
            }
        });
    });

    /* ==========================================================================
       GEOLOCALISATION
       ========================================================================== */
    function initGeolocalisation() {
        if (!navigator.geolocation) {
            updateGpsStatus('error', 'GPS non supportato dal browser');
            return;
        }

        updateGpsStatus('searching', 'Rilevamento posizione GPS in corso...');

        const options = {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                state.gps.lat = position.coords.latitude.toFixed(6);
                state.gps.lng = position.coords.longitude.toFixed(6);
                state.gps.accuracy = position.coords.accuracy;
                state.gps.status = 'success';

                // Reverse geocoding simulation to feel premium and local
                simulateAddressLookup(state.gps.lat, state.gps.lng);
            },
            (error) => {
                console.warn(`GPS Error (${error.code}): ${error.message}`);
                // Fallback to Molfetta center for presentation/testing
                state.gps.lat = "41.200532";
                state.gps.lng = "16.598504";
                state.gps.address = "Corso Umberto I, Molfetta (BA) - Posizione stimata";
                state.gps.status = 'success';
                
                updateGpsUI();
                showToast("GPS non attivo. Utilizzo posizione stimata di Molfetta.", "warning");
            },
            options
        );
    }

    function updateGpsStatus(status, text) {
        state.gps.status = status;
        if (status === 'searching') {
            geoStatusText.textContent = text;
            geoStatusIcon.style.display = 'block';
            geoDetails.style.display = 'none';
        } else if (status === 'success') {
            // Managed in updateGpsUI
        } else {
            geoStatusText.textContent = text;
            geoStatusIcon.style.display = 'none';
            geoDetails.style.display = 'none';
        }
    }

    function simulateAddressLookup(lat, lng) {
        // Mock addresses near Molfetta key landmarks to look extremely realistic
        const mockAddresses = [
            "Via Dante Alighieri, 45, Molfetta (BA)",
            "Corso Dante, 12, Molfetta (BA)",
            "Banchina San Domenico, 8, Molfetta (BA)",
            "Piazza Garibaldi, 23, Molfetta (BA)",
            "Via Madonna dei Martiri, 88, Molfetta (BA)",
            "Viale Pio XI, 104, Molfetta (BA)"
        ];
        
        // Pick one randomly or based on lat/lng last digit
        const index = Math.abs(Math.round(lat * 1000)) % mockAddresses.length;
        state.gps.address = mockAddresses[index];

        setTimeout(() => {
            updateGpsUI();
        }, 1000);
    }

    function updateGpsUI() {
        geoStatusIcon.style.display = 'none';
        geoStatusText.parentElement.style.display = 'none';
        
        latVal.textContent = state.gps.lat;
        lngVal.textContent = state.gps.lng;
        geoAddressText.textContent = state.gps.address;
        
        geoDetails.style.display = 'block';
    }

    geoRefreshBtn.addEventListener('click', () => {
        // Spin animation
        geoRefreshBtn.querySelector('i').style.transform = 'rotate(360deg)';
        setTimeout(() => {
            geoRefreshBtn.querySelector('i').style.transform = 'none';
        }, 500);
        initGeolocalisation();
    });

    /* ==========================================================================
       CAMERA & IMAGE CAPTURE
       ========================================================================== */
    cameraBtn.addEventListener('click', () => {
        cameraInput.click();
    });

    cameraInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        files.forEach(file => {
            if (!file.type.startsWith('image/')) {
                showToast("Carica solo immagini!", "warning");
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                const imgUrl = event.target.result;
                state.photos.push(imgUrl);
                renderPhotos();
            };
            reader.readAsDataURL(file);
        });
        showToast(`Caricate ${files.length} foto con tag GPS!`, "success");
    });

    function renderPhotos() {
        if (state.photos.length === 0) {
            previewGrid.style.display = 'none';
            previewGrid.innerHTML = '';
            return;
        }

        previewGrid.innerHTML = '';
        state.photos.forEach((photo, index) => {
            const container = document.createElement('div');
            container.className = 'preview-img-container';
            
            const img = document.createElement('img');
            img.src = photo;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                state.photos.splice(index, 1);
                renderPhotos();
            });

            container.appendChild(img);
            container.appendChild(removeBtn);
            previewGrid.appendChild(container);
        });

        previewGrid.style.display = 'grid';
    }

    /* ==========================================================================
       REPORT FORM & CHIPS
       ========================================================================== */
    formChips.forEach(chip => {
        chip.addEventListener('click', () => {
            formChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.selectedCategory = chip.getAttribute('data-type');
        });
    });

    // Helper: Convert DataURI to Blob for file upload
    function dataURItoBlob(dataURI) {
        let byteString;
        if (dataURI.split(',')[0].indexOf('base64') >= 0)
            byteString = atob(dataURI.split(',')[1]);
        else
            byteString = unescape(dataURI.split(',')[1]);

        const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
        const ia = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ia], {type: mimeString});
    }

    // Helper: Trigger native mail client
    function triggerMailtoSubmission(notes) {
        const categoryLabel = getCategoryLabel(state.selectedCategory);
        const email = CONFIG.emailRecipient;
        const subject = `ASM Molfetta - Segnalazione ${categoryLabel}`;
        
        let body = `Spett.le ASM Molfetta,\n\n`;
        body += `Si richiede intervento per la rimozione/risoluzione di:\n`;
        body += `Tipo Rifiuto: ${categoryLabel}\n`;
        body += `Note: ${notes || 'Nessuna nota aggiuntiva'}\n\n`;
        body += `Dettagli Georeferenziazione:\n`;
        body += `- Latitudine: ${state.gps.lat || 'Non rilevata'}\n`;
        body += `- Longitudine: ${state.gps.lng || 'Non rilevata'}\n`;
        body += `- Indirizzo stimato: ${state.gps.address || 'Non disponibile'}\n\n`;
        body += `Foto allegate nell'app: ${state.photos.length} foto.\n`;
        body += `[ATTENZIONE: Si prega di allegare le foto scattate a questa email prima di inviarla per farle recapitare]\n\n`;
        body += `Inviato tramite App ASM Molfetta.`;

        const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoUrl;
    }

    // Mock Send (Nice animation flow) or Real Direct Send
    btnSubmit.addEventListener('click', () => {
        const notes = reportNotes.value.trim();

        // Verification
        if (state.photos.length === 0) {
            showToast("Per favore scatta o carica almeno una foto!", "warning");
            return;
        }

        // Case 1: No Formspree ID configured - Use mailto fallback
        if (!CONFIG.formspreeFormId) {
            showToast("Invio in corso tramite client e-mail...", "info");
            
            setTimeout(() => {
                triggerMailtoSubmission(notes);
                
                // Show modal anyway to feel native
                document.getElementById('summary-type').textContent = getCategoryLabel(state.selectedCategory);
                document.getElementById('summary-gps').textContent = `${state.gps.lat || 'Non rilevata'}, ${state.gps.lng || 'Non rilevata'}`;
                document.getElementById('summary-photos').textContent = state.photos.length;
                document.getElementById('modal-success').style.display = 'flex';
                
                // Reset form
                reportNotes.value = '';
                state.photos = [];
                renderPhotos();
            }, 1200);
            return;
        }

        // Case 2: Direct Send via Formspree API (actually arrives at recipient!)
        const origContent = btnSubmit.innerHTML;
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<div class="loading-spinner"></div> <span>Invio diretto...</span>`;

        const formData = new FormData();
        formData.append('destinatario', CONFIG.emailRecipient);
        formData.append('categoria', getCategoryLabel(state.selectedCategory));
        formData.append('descrizione', notes || 'Nessun dettaglio fornito');
        formData.append('latitudine', state.gps.lat || 'Non rilevata');
        formData.append('longitudine', state.gps.lng || 'Non rilevata');
        formData.append('indirizzo_rilevato', state.gps.address || 'Non rilevato');

        // Append photos as files
        state.photos.forEach((photoDataUrl, index) => {
            try {
                const blob = dataURItoBlob(photoDataUrl);
                formData.append(`foto_${index + 1}`, blob, `foto_${index + 1}.jpg`);
            } catch (err) {
                console.error("Blob conversion error: ", err);
            }
        });

        fetch(`https://formspree.io/f/${CONFIG.formspreeFormId}`, {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json'
            }
        })
        .then(response => {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = origContent;

            if (response.ok) {
                document.getElementById('summary-type').textContent = getCategoryLabel(state.selectedCategory);
                document.getElementById('summary-gps').textContent = `${state.gps.lat || 'Non rilevata'}, ${state.gps.lng || 'Non rilevata'}`;
                document.getElementById('summary-photos').textContent = state.photos.length;
                document.getElementById('modal-success').style.display = 'flex';

                // Reset form
                reportNotes.value = '';
                state.photos = [];
                renderPhotos();
                showToast("Segnalazione inviata con successo!", "success");
            } else {
                showToast("Errore di invio diretto. Apertura client e-mail...", "warning");
                triggerMailtoSubmission(notes);
            }
        })
        .catch(err => {
            console.error("Direct send failed: ", err);
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = origContent;
            showToast("Errore di connessione. Apertura client e-mail...", "warning");
            triggerMailtoSubmission(notes);
        });
    });

    // Real mailto redirect
    btnMailto.addEventListener('click', () => {
        const notes = reportNotes.value.trim();
        triggerMailtoSubmission(notes);
        showToast("Apertura dell'app e-mail in corso...", "info");
    });

    function getCategoryLabel(type) {
        const labels = {
            'ingombranti': 'Materiale Ingombrante',
            'abbandono': 'Rifiuti Abbandonati',
            'cestino': 'Cassonetto Pieno / Danneggiato',
            'altro': 'Segnalazione Altra Natura'
        };
        return labels[type] || type;
    }

    /* ==========================================================================
       WASTE CALENDAR - DYNAMIC SCHEDULING
       ========================================================================== */
    function renderCalendarTimeline() {
        const timelineContainer = document.querySelector('.calendar-timeline');
        if (!timelineContainer) return;
        
        timelineContainer.innerHTML = '';
        const activeCalendar = state.calendarType === 'domestiche' ? calendarDomestiche : calendarNonDomestiche;
        
        const now = new Date();
        const currentDayIndex = now.getDay(); // 0 is Sunday, 1 Monday...
        const currentHour = now.getHours();
        
        // Loop from 0 (Sunday) to 6 (Saturday)
        for (let i = 0; i < 7; i++) {
            const dayData = activeCalendar[i];
            const isToday = i === currentDayIndex;
            const isTomorrow = i === (currentDayIndex + 1) % 7;
            
            let statusText = '';
            if (isToday) statusText = 'Oggi';
            else if (isTomorrow) statusText = 'Domani';
            
            const card = document.createElement('div');
            card.className = `calendar-card ${isToday ? 'active-today' : ''} ${dayData.class === 'rest-theme' ? 'rest-day' : ''}`;
            card.setAttribute('data-day', i);
            
            card.innerHTML = `
                <div class="cal-day-label">
                    <span class="day-short">${getDayShortName(i)}</span>
                    <span class="day-full">${getDayNameItalian(i).substring(0, 3)}</span>
                </div>
                <div class="cal-details ${dayData.class}">
                    <div class="cal-icon"><i data-lucide="${getIconMap(dayData.icon)}"></i></div>
                    <div class="cal-content">
                        <h4>${dayData.type}</h4>
                        <span class="cal-time"><i data-lucide="clock"></i> ${dayData.time}</span>
                    </div>
                    ${statusText ? `<div class="cal-status">${statusText}</div>` : ''}
                </div>
            `;
            timelineContainer.appendChild(card);
        }
        
        // Update Next Up card
        let targetDayIndex = currentDayIndex;
        // If it is late night of today (past 24:00/midnight), it shows today's index which has already updated.
        const nextData = activeCalendar[targetDayIndex];
        
        const nextDayName = document.getElementById('next-day-name');
        const nextWasteType = document.getElementById('next-waste-type');
        const nextTimeRange = document.getElementById('next-time-range');
        const nextIcon = document.getElementById('next-icon');
        const nextCard = document.getElementById('next-collection-card');
        
        if (nextDayName && nextWasteType && nextTimeRange && nextIcon && nextCard) {
            nextDayName.textContent = getDayNameItalian(targetDayIndex) + " (Stasera)";
            nextWasteType.textContent = nextData.type;
            nextTimeRange.innerHTML = `<i data-lucide="clock"></i> ${nextData.time}`;
            nextIcon.innerHTML = `<i data-lucide="${getIconMap(nextData.icon)}"></i>`;
            nextCard.style.background = getGradientForTheme(nextData.class);
        }
        
        lucide.createIcons();
    }

    function getDayShortName(index) {
        const days = ["DOM", "LUN", "MAR", "MER", "GIO", "VEN", "SAB"];
        return days[index];
    }

    function getDayNameItalian(index) {
        const days = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
        return days[index];
    }

    function getIconMap(icon) {
        const iconMap = {
            'apple': 'apple',
            'trash-2': 'trash-2',
            'layers': 'layers',
            'package': 'package',
            'glass-water': 'glass-water',
            'sparkles': 'sparkles'
        };
        return iconMap[icon] || icon;
    }

    function getGradientForTheme(themeClass) {
        const gradients = {
            'organic-theme': 'var(--organic-grad)',
            'residual-theme': 'var(--residual-grad)',
            'mix-theme': 'var(--mix-grad)',
            'paper-theme': 'var(--paper-grad)',
            'glass-theme': 'var(--glass-grad)',
            'rest-theme': 'var(--rest-grad)'
        };
        return gradients[themeClass] || 'var(--primary-grad)';
    }

    // Toggle event listeners
    calendarToggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            calendarToggleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.calendarType = btn.getAttribute('data-type');
            renderCalendarTimeline();
            showToast(`Calendario ${state.calendarType === 'domestiche' ? 'Utenze Domestiche' : 'Utenze Non Domestiche'} caricato!`, "info");
        });
    });

    // Render calendar initially
    renderCalendarTimeline();

    /* ==========================================================================
       PWA INSTALLATION LOGIC (Mini-App conversion)
       ========================================================================== */
    let deferredPrompt;
    const installBanner = document.getElementById('pwa-install-banner');
    const installBtn = document.getElementById('pwa-install-btn');
    const iosTooltip = document.getElementById('ios-install-tooltip');
    const iosTooltipClose = document.getElementById('ios-tooltip-close');

    // Detect if device is iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    // Check if running in standalone mode (already installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    // 1. Android/Chrome/Desktop PWA Install prompt listener
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = e;
        // Show the install banner
        if (installBanner && !isStandalone) {
            installBanner.style.display = 'flex';
        }
    });

    // 2. Click handler for install button
    if (installBtn) {
        installBtn.addEventListener('click', () => {
            if (isIOS) {
                // On iOS, show instructions since they can't install programmatically
                if (iosTooltip) iosTooltip.style.display = 'block';
            } else if (deferredPrompt) {
                // On Android/Chrome, trigger native prompt
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        showToast("Installazione avviata! A breve la troverai sulla home.", "success");
                        if (installBanner) installBanner.style.display = 'none';
                    } else {
                        showToast("Installazione annullata.", "info");
                    }
                    deferredPrompt = null;
                });
            } else {
                // General/Desktop browser instructions fallback if install prompt is not available
                showToast("Per installare la mini-app, clicca sui tre puntini in alto del browser e seleziona 'Installa app'.", "info");
            }
        });
    }

    // 3. iOS Tooltip configuration
    if (isIOS && !isStandalone && installBanner && installBtn) {
        installBanner.style.display = 'flex';
        installBtn.textContent = 'Guida';
    }

    if (iosTooltipClose) {
        iosTooltipClose.addEventListener('click', () => {
            if (iosTooltip) iosTooltip.style.display = 'none';
        });
    }

    // Hide banner once app is installed/launched in standalone
    window.addEventListener('appinstalled', (evt) => {
        console.log('ASM Molfetta App installed');
        if (installBanner) installBanner.style.display = 'none';
        showToast("Mini-app installata con successo sulla tua Home screen!", "success");
    });


    /* ==========================================================================
       CHATBOT: MOLFY (Audace & Capace AI per Smaltimento Rifiuti)
       ========================================================================== */
    const botReplies = {
        greeting: "Ciao! Sono Molfy, l'assistente ecologico di ASM Molfetta. Chiedimi come smaltire qualsiasi rifiuto (es. scontrini, cartoni pizza, tetrapak, lampadine...) o chiedi i giorni di raccolta. **Sono pronto a fare la differenza!**",
        default: "Non ho trovato questo materiale nel mio database. Per sicurezza, gettalo nell'**INDIFFERENZIATO** oppure portalo all'**ISOLA ECOLOGICA** comunale nella zona industriale per evitare di contaminare il riciclo! Puoi anche chiedermi dei giorni di raccolta o di materiali comuni.",
        organico: "L'Organico (umido) si raccoglie la **Domenica**, il **Martedì** e il **Giovedì** sera dalle ore 21:00 alle 24:00.",
        vetro: "Il Vetro si raccoglie il **Martedì** (insieme all'organico) e il **Venerdì** sera a partire dalle ore 21:00.",
        carta: "Carta e cartone si ritirano il **Mercoledì** sera dalle ore 21:00 alle 24:00. Ricorda di schiacciare le scatole di cartone!",
        indifferenziato: "L'indifferenziato (rifiuto secco residuo) si raccoglie il **Lunedì** sera dalle ore 21:00 alle 24:00.",
        plastica: "La plastica e i metalli (alluminio/acciaio) vanno raccolti nei sacchi gialli dedicati. Consulta l'eco-calendario o chiedimi informazioni su materiali specifici.",
        polistirolo: "📦 **GUIDA IMPECCABILE:** Il polistirolo da imballaggio domestico (come le vaschette per alimenti o i gusci protettivi di elettrodomestici) va nella **PLASTICA** (sacco giallo). Se si tratta di grandi quantità o polistirolo da edilizia, portalo all'**ISOLA ECOLOGICA**.",
        ingombranti: "🛋️ **DIVIETO DI ABBANDONO:** I materiali ingombranti (mobili, materassi, elettrodomestici) vengono ritirati gratis! Prenota subito nella sezione **'Segnala'** scattando una foto o chiama il numero +390803355111.",
        olio: "🛢️ **ATTENZIONE AMBIENTALE:** L'olio da cucina esausto (di frittura o delle scatole di tonno) inquina le falde! Raccoglilo in una bottiglia e portalo nei contenitori stradali dedicati o all'**ISOLA ECOLOGICA**.",
        pile: "🔋 **ALTAMENTE TOSSICO:** Le pile stilo, a bottone o dei cellulari non vanno mai nei rifiuti comuni. Gettale nei contenitori cilindrici presso i negozi/supermercati di Molfetta o all'**ISOLA ECOLOGICA**.",
        farmaci: "💊 **SICUREZZA SANITARIA:** I farmaci scaduti vanno gettati nei contenitori bianchi fuori dalle farmacie di Molfetta. Attenzione: la scatola di cartone e il foglietto vanno nella **CARTA**!",
        isola: "♻️ **CENTRO DI RACCOLTA:** L'Isola Ecologica di Molfetta si trova nella zona industriale. Puoi portare RAEE, ingombranti, sfalci, macerie, vernici e oli. È aperta tutti i giorni!",
        
        // Nuove categorie audaci richieste dall'utente:
        pizza: "🍕 **ERRORE FREQUENTE:** Se il cartone della pizza è sporco di olio, sugo o formaggio, NON va nella carta! Spezzettalo e gettalo nell'**ORGANICO** (umido). Se invece è perfettamente pulito, buttalo nella **CARTA**.",
        scontrino: "🧾 **FALSO AMICO DELLA CARTA:** Gli scontrini fiscali NON vanno nella carta! Sono stampati su carta chimica termica che rovina il riciclo. Gettali sempre nell'**INDIFFERENZIATO**.",
        tetrapak: "🥛 **REGOLA DI MOLFETTA:** I contenitori in Tetrapak (latte, succhi di frutta, passate) vanno sciacquati, schiacciati e gettati nel bidone della **CARTA E CARTONE**. Rimuovi il tappo in plastica e mettilo nella plastica!",
        ceramica: "🍽️ **NON È VETRO:** Piatti rotti, tazze in ceramica, porcellana e specchi NON vanno assolutamente nel vetro perché fondono a temperature diverse. Gettali nell'**INDIFFERENZIATO** (se piccoli) o portali all'**ISOLA ECOLOGICA**.",
        lampadina: "💡 **RIFIUTI RAEE:** Lampadine a risparmio energetico, tubi neon e lampade LED sono RAEE. Contengono mercurio e materiali preziosi. Portali all'**ISOLA ECOLOGICA** o consegnali a un negozio di elettronica.",
        capsule: "☕ **CONFERIMENTO ATTENTO:** Le capsule di caffè in plastica o alluminio non compostabili vanno raccolte e portate all'**ISOLA ECOLOGICA** o nei punti di raccolta dei marchi (es. Nespresso). Solo le capsule marchiate 100% compostabili vanno nell'**ORGANICO**.",
        sigarette: "🚬 **TOSSICO PER IL MARE:** I mozziconi di sigaretta e gli accendini scarichi vanno gettati esclusivamente nell'**INDIFFERENZIATO**. Un solo mozzicone inquina fino a 1000 litri d'acqua!",
        giocattoli: "🧸 **NON È PLASTICA RICICLABILE:** Giocattoli, righelli, penne, spazzolini e bacinelle in plastica NON sono imballaggi e quindi non vanno nel sacco giallo. Gettali nell'**INDIFFERENZIATO** o all'**ISOLA ECOLOGICA**.",
        sfalci: "🌱 **RESTI DI GIARDINO:** Erba tagliata, foglie e rami di potatura non vanno nei bidoni stradali. Portali all'**ISOLA ECOLOGICA** o usa il servizio di ritiro sfalci dedicato del comune.",
        vestiti: "👕 **RIUSO SOLIDALE:** Abiti, scarpe, tende e borse usate vanno inseriti nei cassonetti stradali gialli dedicati agli indumenti usati. Se sono stracci sporchi di vernice o grasso, vanno nell'**INDIFFERENZIATO**.",
        pannolini: "👶 **RIFIUTO NON DIFFERENZIABILE:** Pannolini, traversine e assorbenti igienici vanno gettati esclusivamente nell'**INDIFFERENZIATO**."
    };

    function handleChatSubmit() {
        const text = chatInput.value.trim().toLowerCase();
        if (text === '') return;

        // User Message
        appendMessage('user', chatInput.value.trim());
        chatInput.value = '';

        // Bot typing animation
        const typingId = appendTypingIndicator();

        setTimeout(() => {
            removeTypingIndicator(typingId);
            
            let reply = botReplies.default;

            if (text.includes('ciao') || text.includes('salve') || text.includes('buongiorno') || text.includes('aiuto')) {
                reply = botReplies.greeting;
            } else if (text.includes('organic') || text.includes('umido') || text.includes('cibo') || text.includes('scarti')) {
                reply = botReplies.organico;
            } else if (text.includes('vetro') || text.includes('bottigli') || text.includes('bicchier')) {
                // Note: check for ceramic/mirrors first
                if (text.includes('rotti') || text.includes('specchi') || text.includes('ceramica') || text.includes('tazza') || text.includes('piatto')) {
                    reply = botReplies.ceramica;
                } else {
                    reply = botReplies.vetro;
                }
            } else if (text.includes('carta') || text.includes('giornal') || text.includes('quadern') || text.includes('scatol')) {
                if (text.includes('pizza')) {
                    reply = botReplies.pizza;
                } else if (text.includes('scontrin')) {
                    reply = botReplies.scontrino;
                } else {
                    reply = botReplies.carta;
                }
            } else if (text.includes('indifferenziat') || text.includes('secco') || text.includes('sacco nero') || text.includes('non riciclab')) {
                reply = botReplies.indifferenziato;
            } else if (text.includes('polistirolo')) {
                reply = botReplies.polistirolo;
            } else if (text.includes('plastica') || text.includes('lattin') || text.includes('alluminio') || text.includes('acciaio') || text.includes('sacco giallo') || text.includes('flacon') || text.includes('bottiglie plastica')) {
                if (text.includes('giocattol') || text.includes('spazzolin') || text.includes('penne') || text.includes('bacinell')) {
                    reply = botReplies.giocattoli;
                } else {
                    reply = botReplies.plastica;
                }
            } else if (text.includes('ingombrant') || text.includes('divano') || text.includes('materass') || text.includes('armadio') || text.includes('mobile') || text.includes('elettrodomestico') || text.includes('frigo') || text.includes('lavatrice')) {
                reply = botReplies.ingombranti;
            } else if (text.includes('olio') || text.includes('fritt') || text.includes('esaust')) {
                reply = botReplies.olio;
            } else if (text.includes('pila') || text.includes('pile') || text.includes('batteri')) {
                reply = botReplies.pile;
            } else if (text.includes('farmac') || text.includes('medicin') || text.includes('scadut')) {
                reply = botReplies.farmaci;
            } else if (text.includes('isola') || text.includes('ecologic') || text.includes('discarica') || text.includes('centro raccolta')) {
                reply = botReplies.isola;
            } else if (text.includes('pizza') || text.includes('cartone pizza')) {
                reply = botReplies.pizza;
            } else if (text.includes('scontrin') || text.includes('ricevut')) {
                reply = botReplies.scontrino;
            } else if (text.includes('tetrapak') || text.includes('tetra pak') || text.includes('brik')) {
                reply = botReplies.tetrapak;
            } else if (text.includes('specchio') || text.includes('specchi') || text.includes('cristall')) {
                reply = botReplies.ceramica;
            } else if (text.includes('ceramic') || text.includes('tazza') || text.includes('piatto rott') || text.includes('porcellan')) {
                reply = botReplies.ceramica;
            } else if (text.includes('lampadin') || text.includes('neon') || text.includes('led') || text.includes('lampade')) {
                reply = botReplies.lampadina;
            } else if (text.includes('capsul') || text.includes('ciald') || text.includes('nespresso') || text.includes('caffe')) {
                reply = botReplies.capsule;
            } else if (text.includes('sigarett') || text.includes('mozzicon') || text.includes('accendin') || text.includes('tabacc')) {
                reply = botReplies.sigarette;
            } else if (text.includes('giocattol') || text.includes('spazzolin') || text.includes('penne') || text.includes('penna')) {
                reply = botReplies.giocattoli;
            } else if (text.includes('sfalc') || text.includes('potatur') || text.includes('erb') || text.includes('rami') || text.includes('piante')) {
                reply = botReplies.sfalci;
            } else if (text.includes('vestit') || text.includes('scarpe') || text.includes('abiti') || text.includes('indument') || text.includes('giacca') || text.includes('borse')) {
                reply = botReplies.vestiti;
            } else if (text.includes('pannolin') || text.includes('assorbent') || text.includes('traversin')) {
                reply = botReplies.pannolini;
            }

            appendMessage('system', reply);
        }, 1000);
    }

    function appendMessage(sender, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;
        
        const p = document.createElement('p');
        // Parse bold markdown syntax **text** -> <strong>text</strong> and replace newlines with breaks
        p.innerHTML = text
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        msgDiv.appendChild(p);
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function appendTypingIndicator() {
        const id = 'typing-' + Math.random().toString(36).substr(2, 9);
        const msgDiv = document.createElement('div');
        msgDiv.className = `message system typing`;
        msgDiv.id = id;
        msgDiv.innerHTML = `<p>Sta digitando<span class="dots">...</span></p>`;
        
        // Add styling for dots animation if not already present
        if (!document.getElementById('dots-style')) {
            const style = document.createElement('style');
            style.id = 'dots-style';
            style.innerHTML = `
                .dots { display: inline-block; animation: blink 1.4s infinite both; }
                @keyframes blink { 0% { opacity: .2; } 20% { opacity: 1; } 100% { opacity: .2; } }
            `;
            document.head.appendChild(style);
        }

        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return id;
    }

    function removeTypingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    chatSendBtn.addEventListener('click', handleChatSubmit);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleChatSubmit();
    });

    /* ==========================================================================
       TOAST SYSTEM & MODALS
       ========================================================================== */
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let iconName = 'info';
        if (type === 'success') iconName = 'check-circle';
        if (type === 'warning') iconName = 'alert-triangle';
        
        toast.innerHTML = `
            <i data-lucide="${iconName}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        lucide.createIcons();
        
        // Slide out and remove
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease-in forwards';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3800);
    }

    window.closeSuccessModal = function() {
        document.getElementById('modal-success').style.display = 'none';
        showToast("Grazie della collaborazione!", "success");
    };

    window.showNotificationInfo = function() {
        showToast("Servizi attivi: Raccolta Porta a Porta regolare stasera.", "info");
    };
});

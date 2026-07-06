/* ==========================================================================
   ASM MOLFETTA - ADMIN DASHBOARD JAVASCRIPT
   ========================================================================== */

(function () {
    'use strict';

    const API = '/api';
    let authToken = null;
    let currentReportId = null;
    let currentFilters = {};

    // ============================================================
    // INIT
    // ============================================================
    document.addEventListener('DOMContentLoaded', () => {
        lucide.createIcons();

        // Check for saved session
        const saved = sessionStorage.getItem('asm_admin_token');
        const savedUser = sessionStorage.getItem('asm_admin_user');
        if (saved) {
            authToken = saved;
            showDashboard(savedUser || 'Admin');
        }

        bindLoginForm();
        bindNavigation();
        bindFilters();
        bindModal();
    });

    // ============================================================
    // TOAST
    // ============================================================
    function toast(message, type = 'info') {
        const container = document.getElementById('admin-toast-container');
        const t = document.createElement('div');
        t.className = `admin-toast ${type}`;
        const icons = { success: 'check-circle', error: 'alert-circle', info: 'info' };
        t.innerHTML = `<i data-lucide="${icons[type] || 'info'}"></i><span>${message}</span>`;
        container.appendChild(t);
        lucide.createIcons();
        setTimeout(() => {
            t.style.opacity = '0';
            t.style.transform = 'translateX(100%)';
            t.style.transition = 'all 0.3s';
            setTimeout(() => t.remove(), 300);
        }, 3500);
    }

    // ============================================================
    // LOGIN
    // ============================================================
    function bindLoginForm() {
        const form = document.getElementById('login-form');
        const errorEl = document.getElementById('login-error');
        const togglePw = document.getElementById('toggle-pw');
        const pwInput = document.getElementById('admin-password');
        const btnLogin = document.getElementById('btn-login');

        // Password visibility toggle
        togglePw.addEventListener('click', () => {
            const isText = pwInput.type === 'text';
            pwInput.type = isText ? 'password' : 'text';
            document.getElementById('pw-eye-icon').setAttribute('data-lucide', isText ? 'eye' : 'eye-off');
            lucide.createIcons();
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorEl.style.display = 'none';

            const username = document.getElementById('admin-username').value.trim();
            const password = document.getElementById('admin-password').value;

            if (!username || !password) {
                errorEl.textContent = 'Inserisci username e password.';
                errorEl.style.display = 'block';
                return;
            }

            btnLogin.disabled = true;
            btnLogin.innerHTML = `<div class="spinner-sm"></div> Accesso...`;

            try {
                const res = await fetch(`${API}/admin/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await res.json();

                if (res.ok && data.success) {
                    authToken = data.token;
                    sessionStorage.setItem('asm_admin_token', authToken);
                    sessionStorage.setItem('asm_admin_user', data.admin.username);
                    showDashboard(data.admin.username);
                } else {
                    errorEl.textContent = data.error || 'Credenziali non valide.';
                    errorEl.style.display = 'block';
                }
            } catch (err) {
                errorEl.textContent = 'Errore di connessione al server.';
                errorEl.style.display = 'block';
            } finally {
                btnLogin.disabled = false;
                btnLogin.innerHTML = `<i data-lucide="log-in"></i> Accedi`;
                lucide.createIcons();
            }
        });
    }

    function showDashboard(username) {
        document.getElementById('login-screen').style.display = 'none';
        const app = document.getElementById('admin-app');
        app.style.display = 'grid';
        document.getElementById('admin-username-display').textContent = username;

        // Bind logout
        document.getElementById('btn-logout').addEventListener('click', () => {
            authToken = null;
            sessionStorage.removeItem('asm_admin_token');
            sessionStorage.removeItem('asm_admin_user');
            document.getElementById('login-screen').style.display = 'flex';
            app.style.display = 'none';
        });

        lucide.createIcons();
        loadDashboard();
    }

    // ============================================================
    // NAVIGATION
    // ============================================================
    function bindNavigation() {
        document.querySelectorAll('.sidebar-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.getAttribute('data-view');
                switchView(view);
            });
        });

        document.getElementById('btn-view-all').addEventListener('click', () => {
            switchView('reports');
        });
    }

    function switchView(view) {
        // Update sidebar active state
        document.querySelectorAll('.sidebar-btn').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-view') === view);
        });

        // Hide all views
        document.querySelectorAll('.admin-view').forEach(v => v.style.display = 'none');

        if (view === 'dashboard') {
            document.getElementById('view-dashboard').style.display = 'block';
            loadDashboard();
        } else if (view === 'reports') {
            document.getElementById('view-reports').style.display = 'block';
            loadReports();
        }
    }

    // ============================================================
    // DASHBOARD
    // ============================================================
    async function loadDashboard() {
        try {
            const res = await fetchWithAuth(`${API}/admin/stats`);
            if (!res.ok) throw new Error();
            const data = await res.json();

            document.getElementById('stat-total').textContent = data.total;
            document.getElementById('stat-nuove').textContent = data.nuove;
            document.getElementById('stat-lavorazione').textContent = data.inLavorazione;
            document.getElementById('stat-risolte').textContent = data.risolte;

            // Update nav badge
            const badge = document.getElementById('badge-nuove');
            badge.textContent = data.nuove > 0 ? data.nuove : '';

            renderRecentList(data.recentReports);
            renderCategoryBreakdown(data.byCategory, data.total);

        } catch (err) {
            document.getElementById('stat-total').textContent = '—';
        }
    }

    function renderRecentList(reports) {
        const container = document.getElementById('recent-list');
        if (!reports || reports.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <i data-lucide="inbox"></i>
                <h3>Nessuna segnalazione ancora</h3>
                <p>Le segnalazioni dei cittadini appariranno qui.</p>
            </div>`;
            lucide.createIcons();
            return;
        }

        container.innerHTML = reports.map(r => `
            <div class="recent-item" data-id="${r.id}">
                <span class="recent-item-id">#${String(r.id).padStart(4,'0')}</span>
                <div class="recent-item-info">
                    <div class="recent-item-category">${getCategoryLabel(r.category)}</div>
                    <div class="recent-item-date">${formatDate(r.created_at)}</div>
                </div>
                <span class="status-badge ${r.status.replace(' ', '-')}">${r.status}</span>
            </div>
        `).join('');

        container.querySelectorAll('.recent-item').forEach(item => {
            item.addEventListener('click', () => openReportModal(item.dataset.id));
        });
    }

    function renderCategoryBreakdown(byCategory, total) {
        const container = document.getElementById('category-breakdown');
        if (!byCategory || byCategory.length === 0) {
            container.innerHTML = '<div class="loading-placeholder">Nessun dato.</div>';
            return;
        }

        container.innerHTML = byCategory.map(item => {
            const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
            return `<div class="cat-row">
                <span class="cat-label">${getCategoryLabel(item.category)}</span>
                <div class="cat-bar-wrap">
                    <div class="cat-bar" style="width: ${pct}%"></div>
                </div>
                <span class="cat-count">${item.count}</span>
            </div>`;
        }).join('');
    }

    // ============================================================
    // REPORTS TABLE
    // ============================================================
    function bindFilters() {
        document.getElementById('btn-apply-filters').addEventListener('click', () => {
            currentFilters = {
                status: document.getElementById('filter-status').value,
                category: document.getElementById('filter-category').value
            };
            loadReports();
        });

        document.getElementById('btn-reset-filters').addEventListener('click', () => {
            document.getElementById('filter-status').value = '';
            document.getElementById('filter-category').value = '';
            currentFilters = {};
            loadReports();
        });
    }

    async function loadReports() {
        const container = document.getElementById('reports-table-container');
        container.innerHTML = '<div class="loading-placeholder padded">Caricamento segnalazioni...</div>';

        try {
            const params = new URLSearchParams({ limit: 100, ...currentFilters });
            const res = await fetchWithAuth(`${API}/admin/reports?${params}`);
            if (!res.ok) throw new Error();
            const data = await res.json();

            document.getElementById('reports-count-label').textContent =
                `${data.total} segnalazione${data.total !== 1 ? 'i' : ''} trovata${data.total !== 1 ? 'e' : ''}`;

            if (data.reports.length === 0) {
                container.innerHTML = `<div class="empty-state padded">
                    <i data-lucide="search-x"></i>
                    <h3>Nessuna segnalazione trovata</h3>
                    <p>Prova a modificare i filtri applicati.</p>
                </div>`;
                lucide.createIcons();
                return;
            }

            container.innerHTML = `
                <table class="reports-table">
                    <thead>
                        <tr>
                            <th>N°</th>
                            <th>Categoria</th>
                            <th>Note</th>
                            <th>Foto</th>
                            <th>Indirizzo</th>
                            <th>Stato</th>
                            <th>Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.reports.map(r => `
                            <tr data-id="${r.id}">
                                <td><strong>#${String(r.id).padStart(4,'0')}</strong></td>
                                <td><span class="cat-badge">${getCategoryLabel(r.category)}</span></td>
                                <td style="max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                    ${r.notes || '<em style="color:var(--text-3)">—</em>'}
                                </td>
                                <td>📷 ${r.photos.length}</td>
                                <td style="max-width:160px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--text-2)">
                                    ${r.address || '—'}
                                </td>
                                <td><span class="status-badge ${r.status.replace(' ', '-')}">${r.status}</span></td>
                                <td style="color:var(--text-3); white-space:nowrap;">${formatDate(r.created_at)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            container.querySelectorAll('tbody tr').forEach(row => {
                row.addEventListener('click', () => openReportModal(row.dataset.id));
            });

            lucide.createIcons();

        } catch (err) {
            container.innerHTML = '<div class="loading-placeholder padded" style="color:#dc2626;">Errore caricamento dati. Riprova.</div>';
        }
    }

    // ============================================================
    // REPORT MODAL
    // ============================================================
    function bindModal() {
        document.getElementById('modal-close').addEventListener('click', closeModal);
        document.getElementById('report-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeModal();
        });

        document.getElementById('btn-update-status').addEventListener('click', updateStatus);
        document.getElementById('btn-delete-report').addEventListener('click', deleteReport);
    }

    async function openReportModal(id) {
        currentReportId = id;
        document.getElementById('report-modal').style.display = 'flex';
        document.getElementById('modal-body').innerHTML = '<div class="loading-placeholder">Caricamento dettaglio...</div>';
        document.getElementById('modal-report-title').textContent = `Segnalazione #${String(id).padStart(4, '0')}`;

        try {
            const res = await fetchWithAuth(`${API}/admin/reports/${id}`);
            if (!res.ok) throw new Error();
            const r = await res.json();

            document.getElementById('modal-status-select').value = r.status;

            const mapUrl = (r.latitude && r.longitude)
                ? `https://www.google.com/maps?q=${r.latitude},${r.longitude}`
                : null;

            document.getElementById('modal-body').innerHTML = `
                <div class="modal-field">
                    <label>Tipo di Intervento</label>
                    <div class="field-val">${getCategoryLabel(r.category)}</div>
                </div>
                <div class="modal-field">
                    <label>Note del Cittadino</label>
                    <div class="field-val notes-val">${r.notes || 'Nessuna nota fornita.'}</div>
                </div>
                <div class="modal-field">
                    <label>📍 Posizione GPS</label>
                    <div class="field-val">${r.address || '—'}</div>
                    ${r.latitude && r.longitude ? `<div style="color:var(--text-3); font-size:13px; margin-top:3px;">Lat: ${r.latitude} | Lng: ${r.longitude}</div>` : ''}
                    ${mapUrl ? `<a href="${mapUrl}" target="_blank" class="map-link"><i data-lucide="map-pin"></i> Apri in Google Maps</a>` : ''}
                </div>
                <div class="modal-field">
                    <label>📅 Data Segnalazione</label>
                    <div class="field-val">${formatDateFull(r.created_at)}</div>
                </div>
                <div class="modal-field">
                    <label>📷 Foto Allegate (${r.photos.length})</label>
                    ${r.photos.length > 0
                        ? `<div class="photo-grid">
                            ${r.photo_urls.map(url => `
                                <div class="photo-thumb" onclick="window.open('${url}', '_blank')">
                                    <img src="${url}" alt="Foto segnalazione" loading="lazy">
                                </div>
                            `).join('')}
                          </div>`
                        : `<p class="no-photos">Nessuna foto allegata.</p>`
                    }
                </div>
            `;
            lucide.createIcons();

        } catch (err) {
            document.getElementById('modal-body').innerHTML = '<div class="loading-placeholder" style="color:#dc2626;">Errore caricamento dettaglio.</div>';
        }
    }

    function closeModal() {
        document.getElementById('report-modal').style.display = 'none';
        currentReportId = null;
    }

    async function updateStatus() {
        if (!currentReportId) return;
        const status = document.getElementById('modal-status-select').value;
        const btn = document.getElementById('btn-update-status');
        btn.disabled = true;

        try {
            const res = await fetchWithAuth(`${API}/admin/reports/${currentReportId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });

            if (res.ok) {
                toast(`Stato aggiornato a "${status}" con successo!`, 'success');
                closeModal();
                // Refresh current view
                const activeView = document.querySelector('.sidebar-btn.active')?.getAttribute('data-view');
                if (activeView === 'dashboard') loadDashboard();
                else loadReports();
            } else {
                const d = await res.json();
                toast(d.error || 'Errore aggiornamento.', 'error');
            }
        } catch (err) {
            toast('Errore di connessione.', 'error');
        } finally {
            btn.disabled = false;
        }
    }

    async function deleteReport() {
        if (!currentReportId) return;
        if (!confirm(`Eliminare definitivamente la segnalazione #${String(currentReportId).padStart(4,'0')}? Le foto verranno cancellate.`)) return;

        const btn = document.getElementById('btn-delete-report');
        btn.disabled = true;

        try {
            const res = await fetchWithAuth(`${API}/admin/reports/${currentReportId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                toast('Segnalazione eliminata con successo.', 'success');
                closeModal();
                const activeView = document.querySelector('.sidebar-btn.active')?.getAttribute('data-view');
                if (activeView === 'dashboard') loadDashboard();
                else loadReports();
            } else {
                const d = await res.json();
                toast(d.error || 'Errore eliminazione.', 'error');
            }
        } catch (err) {
            toast('Errore di connessione.', 'error');
        } finally {
            btn.disabled = false;
        }
    }

    // ============================================================
    // HELPERS
    // ============================================================
    function fetchWithAuth(url, options = {}) {
        return fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${authToken}`
            }
        });
    }

    function getCategoryLabel(cat) {
        const labels = {
            'ingombranti': 'Materiale Ingombrante',
            'abbandono': 'Rifiuti Abbandonati',
            'cestino': 'Cassonetto Pieno',
            'altro': 'Altra Segnalazione'
        };
        return labels[cat] || cat;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function formatDateFull(dateStr) {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('it-IT', { dateStyle: 'full' }) + ' alle ' +
               new Date(dateStr).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    }

})();

import DB from './data.js';

// DOM Elements
const userNameSpan = document.getElementById('user-name');
const tableBody = document.querySelector('#appointments-table tbody');
const filterDateInput = document.getElementById('filter-date');
const filterStatusInput = document.getElementById('filter-status');
const noDataMsg = document.getElementById('no-data');

// Stats Elements
const statToday = document.getElementById('stat-today');
const statPending = document.getElementById('stat-pending');
const statRevenue = document.getElementById('stat-revenue');

// Block Elements
const blockForm = document.getElementById('block-form');
const blockDate = document.getElementById('block-date');
const blockTime = document.getElementById('block-time');
const blockNote = document.getElementById('block-note');
const blocksList = document.getElementById('blocks-list');

// Init Auth
DB.initAuth((user) => {
    if (!user || user.role !== 'admin') {
        window.location.href = 'index.html';
        return;
    }

    userNameSpan.textContent = user.name || "Administrador";

    // Setup Listeners
    filterDateInput.addEventListener('change', loadFilteredApps);
    filterStatusInput.addEventListener('change', loadFilteredApps);
    blockDate.addEventListener('change', populateBlockTimes);
    blockForm.addEventListener('submit', handleBlockSubmit);

    // Initial Load
    loadFilteredApps();
    loadBlocks();
});

// Configure min date for block form
const todayStr = new Date().toISOString().split('T')[0];
filterDateInput.value = todayStr;
blockDate.min = todayStr;

window.clearDate = function () {
    filterDateInput.value = todayStr;
    loadFilteredApps();
};

window.loadAppointments = function () {
    loadFilteredApps();
};

async function loadFilteredApps() {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Cargando citas...</td></tr>';

    const allApps = await DB.getAllAppointments();

    // Filters
    const dateVal = filterDateInput.value;
    const statusVal = filterStatusInput.value;

    let filtered = allApps;

    if (dateVal) {
        filtered = filtered.filter(a => a.date === dateVal);
    }

    if (statusVal !== 'all') {
        filtered = filtered.filter(a => a.status === statusVal);
    }

    // Sort by Time
    filtered.sort((a, b) => {
        const timeA = DB.timeToMinutes(a.time);
        const timeB = DB.timeToMinutes(b.time);
        return timeA - timeB;
    });

    renderTable(filtered);
    calculateTodayStats(allApps);
}

function calculateTodayStats(allApps) {
    const t = new Date().toISOString().split('T')[0];
    // Today's appointments (not cancelled)
    const todaysApps = allApps.filter(a => a.date === t && a.status !== 'cancelled');

    statToday.textContent = todaysApps.length;

    const pending = todaysApps.filter(a => a.status === 'confirmed').length;
    statPending.textContent = pending;

    const revenue = todaysApps.reduce((sum, app) => sum + (app.price || 0), 0);
    statRevenue.textContent = `$${revenue.toLocaleString()}`;
}

async function renderTable(apps) {
    tableBody.innerHTML = '';

    if (apps.length === 0) {
        noDataMsg.style.display = 'block';
        return;
    }
    noDataMsg.style.display = 'none';

    // Need User List to map Client IDs to Names
    const allUsers = await DB.getAllUsers();

    apps.forEach(app => {
        const tr = document.createElement('tr');

        let statusClass = 'status-confirmed';
        let statusLabel = 'Confirmado';
        if (app.status === 'completed') { statusClass = 'status-completed'; statusLabel = 'Completado'; }
        if (app.status === 'cancelled') { statusClass = 'status-cancelled'; statusLabel = 'Cancelado'; }

        // Find Client
        const client = allUsers.find(u => u.id === app.clientId);
        const clientName = client ? (client.name || client.email) : 'Usuario Desconocido';
        const clientPhone = client ? (client.phone || '') : '';
        const vehicleStr = `${app.vehicle.make} ${app.vehicle.model} (${app.vehicle.plate})`;

        tr.innerHTML = `
            <td>
                <div style="font-family:monospace; font-weight:bold; font-size:0.9em;">${app.id}</div>
                <button class="action-btn" onclick="openQRModal('${app.id}', '${clientName}', '${vehicleStr}', '${app.date} ${app.time}')" title="Ver QR">
                    <i class="ph ph-qr-code"></i>
                </button>
            </td>
            <td>
                <div style="font-weight:600;">${clientName}</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">${vehicleStr}</div>
                ${clientPhone ? `<div style="font-size:0.75rem;"><a href="tel:${clientPhone}">${clientPhone}</a></div>` : ''}
            </td>
            <td>
                <div>${app.serviceName}</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">$${app.price} • ${app.duration} min</div>
            </td>
            <td>
                <div>${app.date}</div>
                <div style="font-size:1.1rem; font-weight:600;">${app.time}</div>
            </td>
            <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
            <td>
                <div style="display:flex; gap:0.5rem;">
                    ${app.status === 'confirmed' ? `
                    <button class="action-btn" style="color:var(--success);" onclick="updateAppStatus('${app.id}', 'completed')" title="Completar">
                        <i class="ph ph-check-circle" style="font-size:1.5rem;"></i>
                    </button>
                    <button class="action-btn" style="color:var(--danger);" onclick="updateAppStatus('${app.id}', 'cancelled')" title="Cancelar">
                        <i class="ph ph-x-circle" style="font-size:1.5rem;"></i>
                    </button>
                    ` : ''}
                </div>
            </td>
        `;

        tableBody.appendChild(tr);
    });
}

window.updateAppStatus = async function (id, newStatus) {
    if (confirm(`¿Cambiar estado a ${newStatus}?`)) {
        await DB.updateAppointmentStatus(id, newStatus);
        loadFilteredApps();
    }
};

window.openQRModal = function (folio, client, vehicle, datetime) {
    const container = document.getElementById('admin-qrcode');
    const modal = document.getElementById('qr-modal');
    const label = document.getElementById('qr-folio');

    container.innerHTML = '';
    const qrText = `FOLIO:${folio}|CLIENTE:${client}|AUTO:${vehicle}|FECHA:${datetime}`;

    new QRCode(container, {
        text: qrText,
        width: 150,
        height: 150
    });

    label.textContent = folio;
    modal.style.display = 'flex';
};

// --- SCHEDULE BLOCKS ---
function populateBlockTimes() {
    blockTime.innerHTML = '<option value="ALL">Todo el día</option>';
    if (!blockDate.value) return;

    const startMin = DB.timeToMinutes(DB.settings.openingTime);
    const endMin = DB.timeToMinutes(DB.settings.closingTime);
    const interval = DB.settings.slotInterval;

    for (let time = startMin; time < endMin; time += interval) {
        const timeStr = DB.minutesToTime(time);
        blockTime.innerHTML += `<option value="${timeStr}">${timeStr}</option>`;
    }
}

async function handleBlockSubmit(e) {
    e.preventDefault();
    const btn = blockForm.querySelector('button');
    btn.disabled = true;
    btn.textContent = "Bloqueando...";

    try {
        await DB.addBlockedSlot(blockDate.value, blockTime.value, blockNote.value);
        blockForm.reset();
        await loadBlocks();
        alert("Horario bloqueado correctamente.");
    } catch (err) {
        alert("Error al bloquear: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Bloquear";
    }
}

async function loadBlocks() {
    blocksList.innerHTML = '<p style="text-align:center; font-size:0.9rem; color:var(--text-muted);">Cargando...</p>';
    const blocks = await DB.getBlockedSlots();
    blocksList.innerHTML = '';

    if (blocks.length === 0) {
        blocksList.innerHTML = '<p style="text-align:center; font-size:0.9rem; color:var(--text-muted);">Sin bloqueos activos</p>';
        return;
    }

    blocks.forEach(b => {
        const div = document.createElement('div');
        div.style.padding = '0.5rem';
        div.style.border = '1px solid var(--border)';
        div.style.borderRadius = 'var(--radius)';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.fontSize = '0.85rem';

        const info = `
            <div>
                <strong>${b.date}</strong> - ${b.time === 'ALL' ? '<span style="color:var(--danger)">Todo el día</span>' : b.time}
                ${b.note ? `<br><span style="color:var(--text-muted)">${b.note}</span>` : ''}
            </div>
        `;

        div.innerHTML = info + `
            <button class="action-btn" style="color:var(--danger);" onclick="removeBlock('${b.id}')" title="Eliminar Bloqueo">
                <i class="ph ph-trash" style="font-size:1.2rem;"></i>
            </button>
        `;

        blocksList.appendChild(div);
    });
}

window.removeBlock = async function (id) {
    if (confirm('¿Eliminar este bloqueo?')) {
        await DB.removeBlockedSlot(id);
        loadBlocks();
    }
};

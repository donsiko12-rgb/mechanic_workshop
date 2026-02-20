import DB from './data.js';

// DOM Elements
const userNameSpan = document.getElementById('user-name');
const serviceSelect = document.getElementById('service-select');
const dateInput = document.getElementById('date-input');
const slotsContainer = document.getElementById('slots-container');
const selectedTimeInput = document.getElementById('selected-time');
const bookingForm = document.getElementById('booking-form');
const appointmentsList = document.getElementById('appointments-list');
const successModal = document.getElementById('success-modal');
const folioDisplay = document.getElementById('folio-display');
const qrContainer = document.getElementById('qrcode');
const timeError = document.getElementById('time-error');

let services = [];
let currentUser = null;

// Init Auth
DB.initAuth(async (user) => {
    if (!user || user.role !== 'client') {
        window.location.href = 'index.html';
        return;
    }

    currentUser = user;
    userNameSpan.textContent = currentUser.name || currentUser.email;

    // Init form
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;
    dateInput.value = today;

    // Load Services from DB
    services = await DB.getServices();
    serviceSelect.innerHTML = '<option value="">Selecciona un servicio...</option>';
    services.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.name} (${s.duration} min) - $${s.price}`;
        serviceSelect.appendChild(opt);
    });

    // Load History
    renderHistory();
});


// --- EVENTS ---

// Date Change -> Load Slots
dateInput.addEventListener('change', loadSlots);
serviceSelect.addEventListener('change', loadSlots); // Service duration affects slots

async function loadSlots() {
    const date = dateInput.value;
    const serviceId = parseInt(serviceSelect.value);

    if (!date || !serviceId) {
        slotsContainer.innerHTML = '<p style="grid-column:1/-1; text-align:center; font-size:0.8rem; color:var(--text-muted);">Selecciona servicio y fecha</p>';
        return;
    }

    slotsContainer.innerHTML = '<p style="grid-column:1/-1; text-align:center;">Cargando horarios...</p>';

    const service = services.find(s => s.id === serviceId);
    const slots = await DB.getSlotsForDate(date, service.duration);

    slotsContainer.innerHTML = '';

    if (slots.length === 0) {
        slotsContainer.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:var(--danger);">No hay horarios disponibles.</p>';
        return;
    }

    slots.forEach(slot => {
        const div = document.createElement('div');
        div.className = `time-slot ${slot.available ? '' : 'disabled'}`;
        div.textContent = slot.time;

        if (slot.available) {
            div.onclick = () => selectSlot(div, slot.time);
        }

        slotsContainer.appendChild(div);
    });
}

window.selectSlot = function (el, time) {
    // Remove previous selection
    document.querySelectorAll('.time-slot.selected').forEach(d => d.classList.remove('selected'));

    // Select new
    el.classList.add('selected');
    selectedTimeInput.value = time;
    timeError.style.display = 'none';
};

// Form Submit
bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const serviceId = parseInt(serviceSelect.value);
    const date = dateInput.value;
    const time = selectedTimeInput.value;
    const make = document.getElementById('veh-make').value;
    const model = document.getElementById('veh-model').value;
    const plate = document.getElementById('veh-plate').value;

    if (!time) {
        alert("Por favor selecciona un horario.");
        return;
    }

    const submitBtn = document.querySelector('#booking-form button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Procesando...';
    submitBtn.disabled = true;

    try {
        const service = services.find(s => s.id === serviceId);

        const appointmentData = {
            clientId: currentUser.id,
            serviceId: service.id,
            serviceName: service.name,
            duration: service.duration,
            price: service.price,
            date: date,
            time: time,
            vehicle: { make, model, plate }
        };

        const newApp = await DB.createAppointment(appointmentData);

        // Show Success
        showSuccessModal(newApp);

    } catch (err) {
        console.error(err);
        if (err.message.includes("horario")) {
            timeError.style.display = 'block';
            loadSlots(); // Refresh UI
        }
        alert(err.message);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

function showSuccessModal(app) {
    folioDisplay.textContent = app.id;

    // Generate QR
    qrContainer.innerHTML = '';
    const qrText = `FOLIO:${app.id}|CLIENTE:${currentUser.name || currentUser.email}|AUTO:${app.vehicle.make} ${app.vehicle.model}|FECHA:${app.date} ${app.time}`;
    new QRCode(qrContainer, {
        text: qrText,
        width: 128,
        height: 128
    });

    successModal.style.display = 'flex';
}

async function renderHistory() {
    appointmentsList.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.9rem;">Cargando historial...</p>';

    const apps = await DB.getMyAppointments(currentUser.id);
    appointmentsList.innerHTML = '';

    if (apps.length === 0) {
        appointmentsList.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.9rem;">No tienes citas registradas.</p>';
        return;
    }

    apps.forEach(app => {
        const statusColors = {
            'confirmed': 'var(--primary)',
            'completed': 'var(--success)',
            'cancelled': 'var(--danger)'
        };

        const card = document.createElement('div');
        card.style.background = 'var(--background)';
        card.style.padding = '1rem';
        card.style.borderRadius = 'var(--radius)';
        card.style.borderLeft = `4px solid ${statusColors[app.status] || 'gray'}`;

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                <strong>${app.serviceName}</strong>
                <span style="font-size:0.8rem; font-weight:bold; color:${statusColors[app.status]}">${app.status.toUpperCase()}</span>
            </div>
            <div style="font-size:0.9rem; color:var(--text-muted); display:flex; gap:1rem;">
                <span><i class="ph ph-calendar"></i> ${app.date}</span>
                <span><i class="ph ph-clock"></i> ${app.time}</span>
            </div>
            <div style="font-size:0.8rem; margin-top:0.5rem;">
                🚗 ${app.vehicle.make} ${app.vehicle.model} (${app.vehicle.plate})
            </div>
        `;
        appointmentsList.appendChild(card);
    });
}

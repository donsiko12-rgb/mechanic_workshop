/**
 * AutoFix Manager - Local Data Layer
 * Handles LocalStorage "Database"
 */

const DB = {
    // Keys
    KEYS: {
        USERS: 'autofix_users',
        SERVICES: 'autofix_services',
        APPOINTMENTS: 'autofix_appointments',
        SETTINGS: 'autofix_settings',
        SESSION: 'autofix_session'
    },

    // Initialize Data
    init() {
        if (!localStorage.getItem(DB.KEYS.SETTINGS)) {
            localStorage.setItem(DB.KEYS.SETTINGS, JSON.stringify({
                openingTime: "09:00",
                closingTime: "18:00",
                slotInterval: 30 // minutes
            }));
        }

        if (!localStorage.getItem(DB.KEYS.SERVICES)) {
            localStorage.setItem(DB.KEYS.SERVICES, JSON.stringify([
                { id: 1, name: "Cambio de Aceite", duration: 30, price: 500, icon: "drop" },
                { id: 2, name: "Afinación Mayor", duration: 120, price: 2500, icon: "engine" },
                { id: 3, name: "Frenos", duration: 60, price: 1200, icon: "warning-circle" },
                { id: 4, name: "Diagnóstico General", duration: 30, price: 300, icon: "stethoscope" }
            ]));
        }

        if (!localStorage.getItem(DB.KEYS.USERS)) {
            // Default Admin
            const admin = {
                id: "admin_01",
                email: "admin@autofix.com",
                password: "admin", // In real app, hash this!
                name: "Administrador",
                role: "admin"
            };
            localStorage.setItem(DB.KEYS.USERS, JSON.stringify([admin]));
        }

        if (!localStorage.getItem(DB.KEYS.APPOINTMENTS)) {
            localStorage.setItem(DB.KEYS.APPOINTMENTS, JSON.stringify([]));
        }
    },

    // --- UTILS ---
    get(key) {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : null;
    },
    set(key, data) { localStorage.setItem(key, JSON.stringify(data)); },

    // --- AUTH ---
    login(email, password) {
        const users = DB.get(DB.KEYS.USERS) || [];
        const user = users.find(u => u.email === email && u.password === password);
        if (user) {
            DB.set(DB.KEYS.SESSION, user);
            return user;
        }
        return null;
    },

    register(user) {
        const users = DB.get(DB.KEYS.USERS) || [];
        if (users.find(u => u.email === user.email)) {
            throw new Error("El correo ya está registrado");
        }
        const newUser = { ...user, id: 'u_' + Date.now(), role: 'client' };
        users.push(newUser);
        DB.set(DB.KEYS.USERS, users);
        DB.set(DB.KEYS.SESSION, newUser);
        return newUser;
    },

    logout() {
        localStorage.removeItem(DB.KEYS.SESSION);
        window.location.href = 'index.html';
    },

    getCurrentUser() {
        return DB.get(DB.KEYS.SESSION);
    },

    // --- SERVICES ---
    getServices() { return DB.get(DB.KEYS.SERVICES); },

    // --- APPOINTMENTS & AVAILABILITY ---

    // Core function: Generate slots for a date
    getSlotsForDate(dateStr, serviceDuration) {
        const settings = JSON.parse(localStorage.getItem(DB.KEYS.SETTINGS));
        const appointments = DB.get(DB.KEYS.APPOINTMENTS).filter(a => a.date === dateStr && a.status !== 'cancelled');

        const slots = [];
        const startMin = DB.timeToMinutes(settings.openingTime);
        const endMin = DB.timeToMinutes(settings.closingTime);
        const interval = settings.slotInterval;

        // Loop through the day based on interval
        for (let time = startMin; time + serviceDuration <= endMin; time += interval) {
            const timeStr = DB.minutesToTime(time);
            const endTime = time + serviceDuration;

            // Check collision with existing appointments
            let isBooked = false;
            for (const app of appointments) {
                const appStart = DB.timeToMinutes(app.time);
                const appEnd = appStart + app.duration;

                // Collision Logic: (StartA < EndB) and (EndA > StartB)
                if (time < appEnd && endTime > appStart) {
                    isBooked = true;
                    break;
                }
            }

            slots.push({
                time: timeStr,
                available: !isBooked
            });
        }
        return slots;
    },

    createAppointment(appointmentData) {
        // Double check availability to prevent race conditions (simulated)
        const slots = DB.getSlotsForDate(appointmentData.date, appointmentData.duration);
        const requestedSlot = slots.find(s => s.time === appointmentData.time);

        if (!requestedSlot || !requestedSlot.available) {
            throw new Error("Este horario ya fue reservado, por favor selecciona otro.");
        }

        const newApp = {
            id: 'TM-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0'),
            ...appointmentData,
            status: 'confirmed',
            createdAt: new Date().toISOString()
        };

        const appointments = DB.get(DB.KEYS.APPOINTMENTS);
        appointments.push(newApp);
        DB.set(DB.KEYS.APPOINTMENTS, appointments);
        return newApp;
    },

    getMyAppointments(userId) {
        const apps = DB.get(DB.KEYS.APPOINTMENTS);
        return apps.filter(a => a.clientId === userId).reverse();
    },

    getAllAppointments() {
        return DB.get(DB.KEYS.APPOINTMENTS).reverse();
    },

    updateAppointmentStatus(id, status) {
        const apps = DB.get(DB.KEYS.APPOINTMENTS);
        const idx = apps.findIndex(a => a.id === id);
        if (idx !== -1) {
            apps[idx].status = status;
            DB.set(DB.KEYS.APPOINTMENTS, apps);
        }
    },

    // --- HELPERS ---
    timeToMinutes(timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    },

    minutesToTime(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }
};

// Initialize on load
DB.init();

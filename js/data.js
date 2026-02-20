import { auth, db } from './firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    addDoc,
    query,
    where,
    orderBy,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

/**
 * AutoFix Manager - Firebase Data Layer
 */

const DB = {
    // Current user state
    currentUser: null,
    settings: {
        openingTime: "09:00",
        closingTime: "18:00",
        slotInterval: 30 // minutes
    },

    // Initialize Authentication Listener
    initAuth(callback) {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Fetch user data from Firestore
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    DB.currentUser = { id: user.uid, ...userDoc.data() };
                } else {
                    DB.currentUser = { id: user.uid, email: user.email, role: 'client' };
                }
            } else {
                DB.currentUser = null;
            }
            if (callback) callback(DB.currentUser);
        });
    },

    // --- AUTH ---
    async login(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Get role
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                return { id: user.uid, ...userDoc.data() };
            }
            return { id: user.uid, email: user.email, role: 'client' };
        } catch (error) {
            console.error("Login error:", error);
            throw new Error("Credenciales incorrectas o error de red.");
        }
    },

    async register(userData) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
            const user = userCredential.user;

            // Save additional data to Firestore
            const newUser = {
                email: userData.email,
                name: userData.name,
                phone: userData.phone || '',
                role: 'client'
            };

            await setDoc(doc(db, "users", user.uid), newUser);
            return { id: user.uid, ...newUser };
        } catch (error) {
            console.error("Register error:", error);
            if (error.code === 'auth/email-already-in-use') {
                throw new Error("El correo ya está registrado");
            }
            throw new Error("Error al registrar: " + error.message);
        }
    },

    async logout() {
        try {
            await signOut(auth);
            window.location.href = 'index.html';
        } catch (error) {
            console.error("Logout error:", error);
        }
    },

    getCurrentUser() {
        return DB.currentUser;
    },

    // --- SERVICES ---
    async getServices() {
        // We can either fetch from Firestore or keep them hardcoded for MVP
        // Let's hardcode for fewer reads if they don't change often, 
        // but for a real app we'd fetch from Firestore:
        try {
            const querySnapshot = await getDocs(collection(db, "services"));
            if (querySnapshot.empty) {
                // Seed initial services if empty
                const defaultServices = [
                    { id: 1, name: "Cambio de Aceite", duration: 30, price: 500, icon: "drop" },
                    { id: 2, name: "Afinación Mayor", duration: 120, price: 2500, icon: "engine" },
                    { id: 3, name: "Frenos", duration: 60, price: 1200, icon: "warning-circle" },
                    { id: 4, name: "Diagnóstico General", duration: 30, price: 300, icon: "stethoscope" }
                ];

                for (const s of defaultServices) {
                    await setDoc(doc(db, "services", s.id.toString()), s);
                }
                return defaultServices;
            }

            const services = [];
            querySnapshot.forEach((doc) => {
                services.push({ id: parseInt(doc.id), ...doc.data() });
            });
            return services;
        } catch (error) {
            console.error("Error getting services:", error);
            return [];
        }
    },

    // Admin specific - get all users to map IDs to names
    async getAllUsers() {
        try {
            const querySnapshot = await getDocs(collection(db, "users"));
            const users = [];
            querySnapshot.forEach((doc) => {
                users.push({ id: doc.id, ...doc.data() });
            });
            return users;
        } catch (error) {
            console.error("Error getting users:", error);
            return [];
        }
    },

    // --- APPOINTMENTS & AVAILABILITY ---

    // Core function: Generate slots for a date
    async getSlotsForDate(dateStr, serviceDuration) {
        try {
            // Get appointments for that day from Firestore
            const q = query(collection(db, "appointments"),
                where("date", "==", dateStr),
                where("status", "in", ["confirmed", "completed"])
            );

            const querySnapshot = await getDocs(q);
            const appointments = [];
            querySnapshot.forEach((doc) => {
                appointments.push(doc.data());
            });

            const slots = [];
            const startMin = DB.timeToMinutes(DB.settings.openingTime);
            const endMin = DB.timeToMinutes(DB.settings.closingTime);
            const interval = DB.settings.slotInterval;

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
        } catch (error) {
            console.error("Error generating slots:", error);
            return [];
        }
    },

    async createAppointment(appointmentData) {
        try {
            // Double check availability to prevent race conditions
            const slots = await DB.getSlotsForDate(appointmentData.date, appointmentData.duration);
            const requestedSlot = slots.find(s => s.time === appointmentData.time);

            if (!requestedSlot || !requestedSlot.available) {
                throw new Error("Este horario ya fue reservado, por favor selecciona otro.");
            }

            const newAppId = 'TM-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');

            const newApp = {
                id: newAppId,
                ...appointmentData,
                status: 'confirmed',
                createdAt: new Date().toISOString()
            };

            await setDoc(doc(db, "appointments", newAppId), newApp);
            return newApp;
        } catch (error) {
            console.error("Error creating appointment:", error);
            throw error;
        }
    },

    async getMyAppointments(userId) {
        try {
            const q = query(
                collection(db, "appointments"),
                where("clientId", "==", userId)
            );

            // Note: ordering by createdAt might require an index in Firestore. 
            // We sort client-side for simplicity if no index exists.
            const querySnapshot = await getDocs(q);
            const apps = [];
            querySnapshot.forEach((doc) => {
                apps.push(doc.data());
            });

            // Sort client-side descending
            return apps.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } catch (error) {
            console.error("Error getting my appointments:", error);
            return [];
        }
    },

    async getAllAppointments() {
        try {
            // Order by requires index, doing client side for now
            const querySnapshot = await getDocs(collection(db, "appointments"));
            const apps = [];
            querySnapshot.forEach((doc) => {
                apps.push(doc.data());
            });

            return apps.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } catch (error) {
            console.error("Error getting all appointments:", error);
            return [];
        }
    },

    async updateAppointmentStatus(id, status) {
        try {
            const appRef = doc(db, "appointments", id);
            await updateDoc(appRef, {
                status: status
            });
            return true;
        } catch (error) {
            console.error("Error updating status:", error);
            return false;
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

// Expose DB to global scope since HTML uses `onclick="DB.logout()"`
window.DB = DB;

export default DB;

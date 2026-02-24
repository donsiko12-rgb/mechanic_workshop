import DB from './data.js';

// DOM Elements
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

// State
let isRegistering = false;
let userRedirect = 'client_dashboard.html';
let adminRedirect = 'admin_dashboard.html';

// Initialize Auth Listener
DB.initAuth((user) => {
    if (user) {
        // User is logged in, redirect based on role
        if (user.role === 'admin') window.location.href = adminRedirect;
        else window.location.href = userRedirect;
    }
});

// Handle Submit
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;

    // Disable button to prevent double-click
    const submitBtn = document.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Cargando...';
    submitBtn.disabled = true;

    try {
        if (isRegistering) {
            // Basic register flow (name and phone simulated/prompted for simplicity or added to form)
            const name = prompt("Por favor ingresa tu Nombre Completo:");
            if (!name) {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                return;
            }
            const phone = prompt("Por favor ingresa tu Teléfono:");

            const user = await DB.register({ email, password, name, phone });
            alert("Registro exitoso. Bienvenido " + user.name);
            window.location.href = userRedirect;
        } else {
            const user = await DB.login(email, password);
            if (user) {
                if (user.role === 'admin') window.location.href = adminRedirect;
                else window.location.href = userRedirect;
            }
        }
    } catch (err) {
        console.error(err);
        alert(err.message);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

// Toggle Register Mode
window.toggleRegister = function () {
    isRegistering = !isRegistering;
    const title = document.querySelector('.brand h1');
    const submitBtn = document.querySelector('button[type="submit"]');
    const toggleBtn = document.querySelector('.btn-outline');

    if (isRegistering) {
        title.textContent = "Crear Cuenta";
        submitBtn.textContent = "Registrarse";
        toggleBtn.textContent = "¿Ya tienes cuenta? Iniciar Sesión";
    } else {
        title.textContent = "AutoFix Manager";
        submitBtn.textContent = "Iniciar Sesión";
        toggleBtn.textContent = "Registrarse como Cliente";
    }
};

// Demo Admin Helper
window.fillAdmin = function () {
    emailInput.value = "admin@autofix.com";
    passwordInput.value = "admin123";
};

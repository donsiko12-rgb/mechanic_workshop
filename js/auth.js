
// DOM Elements
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

// State
let isRegistering = false;
let userRedirect = 'client_dashboard.html';
let adminRedirect = 'admin_dashboard.html';

// Check if already logged in
const currentUser = DB.getCurrentUser();
if (currentUser) {
    if (currentUser.role === 'admin') window.location.href = adminRedirect;
    else window.location.href = userRedirect;
}

// Handle Submit
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;

    try {
        if (isRegistering) {
            // Basic register flow (name and phone simulated/prompted for simplicity or added to form)
            // For MVP, we'll prompt
            const name = prompt("Por favor ingresa tu Nombre Completo:");
            if (!name) return;
            const phone = prompt("Por favor ingresa tu Teléfono:");

            const user = DB.register({ email, password, name, phone });
            alert("Registro exitoso. Bienvenido " + user.name);
            window.location.href = userRedirect;
        } else {
            const user = DB.login(email, password);
            if (user) {
                if (user.role === 'admin') window.location.href = adminRedirect;
                else window.location.href = userRedirect;
            } else {
                alert("Credenciales incorrectas");
            }
        }
    } catch (err) {
        alert(err.message);
    }
});

// Toggle Register Mode
function toggleRegister() {
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
}

// Demo Admin Helper
function fillAdmin() {
    emailInput.value = "admin@autofix.com";
    passwordInput.value = "admin";
}

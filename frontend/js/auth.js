console.log("✅ El archivo auth.js ha cargado correctamente");

// --- OJITO VER CONTRASEÑA ---
function initTogglePassword(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.querySelector('i').classList.toggle('fa-eye', !isPassword);
        btn.querySelector('i').classList.toggle('fa-eye-slash', isPassword);
    });
}
initTogglePassword('toggle-password-login', 'password-login');
initTogglePassword('toggle-password-registro', 'password');

// --- MANEJO DE REGISTRO ---
const formRegistro = document.getElementById('form-registro');
if (formRegistro) {
    console.log("Formulario de registro detectado");
    formRegistro.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("Iniciando envío de datos de registro...");

        const nombre_usuario = document.getElementById('nombre').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const res = await fetch('http://localhost:3000/api/auth/registrar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre_usuario, email, password })
            });

            const data = await res.json();
            alert(data.message);
            if (res.ok) window.location.href = 'login.html';

        } catch (error) {
            console.error("❌ Error en la conexión:", error);
            alert("No se pudo conectar con el servidor. Revisa la terminal de VS Code.");
        }
    });
}

// --- MANEJO DE LOGIN ---
const formLogin = document.getElementById('form-login');
if (formLogin) {
    console.log("Formulario de login detectado");
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();

        const emailInput = document.getElementById('email-login');
        const passInput = document.getElementById('password-login');

        if (!emailInput || !passInput) {
            console.error("No se encontraron los inputs de login");
            return;
        }

        const email = emailInput.value.trim();
        const password = passInput.value;

        if (!email) {
            alert('Ingresa tu correo electrónico');
            return;
        }
        if (!password) {
            alert('Ingresa tu contraseña');
            return;
        }

        try {
            const res = await fetch('http://localhost:3000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('usuario', JSON.stringify(data.usuario));
                if (data.usuario.rol === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'index.html';
                }
            } else {
                alert(data.message || 'Correo o contraseña incorrectos');
            }
        } catch (error) {
            console.error("❌ Error en el login:", error);
            alert('No se pudo conectar con el servidor. Revisa que el backend esté en ejecución.');
        }
    });
}

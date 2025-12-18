const ENDPOINT = "http://localhost:5001";
const mainAccess = document.getElementById("main-access");
const verification = document.getElementById("verification");
const verifyCode = document.getElementById("verify-code");

const services = {
    alexicon: { name: 'Alexicon', accent: '#7700ff', route: '/alexicon' },
    yipnet: { name: 'YipNet', accent: '#7700ff', route: '/yipnet' },
    alyx: { name: 'Alyx', acccent: '#7700ff', route: '/alyx' },
};

const urlParams = new URLSearchParams(window.location.search);
const serviceKey = urlParams.get("service");
const service = services[serviceKey];
const id = urlParams.get('id');
const verify_key = urlParams.get('verify_key');

function waitFor(fn, { timeoutMs = 5000, intervalMs = 30 } = {}) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        const t = setInterval(() => {
        if (fn()) { clearInterval(t); return resolve(true); }
        if (Date.now() - start > timeoutMs) {
            clearInterval(t);
            reject(new Error("Timeout esperando window.alexicon"));
        }
        }, intervalMs);
    });
}

async function checkSession() {
    const token = JSON.parse(localStorage.getItem("AlexiconUserData") || "{}")?.token;
    if (!token) return;

    // Espera a que el script externo ya haya registrado la función
    await waitFor(() => window.alexicon?.CHECK_SESSION);

    const result = await window.alexicon.CHECK_SESSION(ENDPOINT, token);
    console.log(result);

    if (result.status === "ok") window.location.href = ENDPOINT + service?.route;
}

checkSession().catch(console.error);
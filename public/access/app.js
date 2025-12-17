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
const service = services[urlParams.get("service")];
const id = urlParams.get('id');
const verify_key = urlParams.get('verify_key');
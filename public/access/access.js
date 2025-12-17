
const accessMessage = document.getElementById("access-message");
const accessStep1 = document.getElementById("access-step-1");
const accessStep2 = document.getElementById("access-step-2");
const accessSwitchText = document.getElementById("access-switch-text");
const accessSwitchBtn = document.getElementById("access-switch-btn");
const loginBtn = document.getElementById("login-btn");
const nextBtn = document.getElementById("next-btn");
const arrowBackBtn = document.getElementById("arrow-back-btn");
const registerBtn = document.getElementById("register-btn");
const passwordShow = document.getElementById("password-show");

const form = {
    email: document.getElementById("email"),
    password: document.getElementById("password"),
    firstName: document.getElementById("first-name"),
    lastName: document.getElementById("last-name"),
    nickname: document.getElementById("nickname"),
    birthday: document.getElementById("birthday"),
    otherGender: document.getElementById("other-gender"),
    gender: () => document.querySelector('input[name="gender"]:checked'),
};

let accessMode = ""; // 'register' | 'login'
let currentStep = 0; // 1 | 2
let showPassword = false;

function setElements(mode = accessMode, step = currentStep){
    accessMode = mode;
    currentStep = mode === "login" ? 1 : step;

    const isRegister = accessMode === "register";

    accessMessage.textContent = isRegister
        ? `Create an Alexicon account to access ${service?.name}`
        : `Login into ${service?.name} with your Alexicon account`;
    accessStep1.style.display = currentStep == 1 ? "flex" : "none";
    accessStep2.style.display = currentStep == 2 ? "flex" : "none";
    accessSwitchText.textContent = isRegister ? "Already have an account?" : "Don't have an account?";
    accessSwitchBtn.textContent = isRegister ? "Login" : "Register";
    loginBtn.style.display = isRegister ? "none" : "flex";
    nextBtn.style.display = (isRegister && currentStep == 1) ? "flex" : "none";
    arrowBackBtn.style.display = (isRegister && currentStep == 2) ? "flex" : "none";
    registerBtn.style.display = (isRegister && currentStep == 2) ? "flex" : "none";
    setMicroMessage("micro-message", false);
}

accessSwitchBtn.onclick = () => {
    if(accessMode == "login") return setElements("register");
    if(accessMode == "register") return setElements("login");
}

passwordShow.onclick = () => {
    showPassword = !showPassword;
    console.log(showPassword)
    form.password.setAttribute("type", showPassword ? "text" : "password");
}

// setup

mainAccess.style.display = "flex";
verification.style.display = "none";
verifyCode.style.display = "none";
document.getElementById("title").textContent = `${service?.name} - Access`;
setElements("register", 1);
form.otherGender.style.display = "none";

// workflow

function setMicroMessage(element, text){
    const microMessage = document.getElementById(element);
    const messageExists = (typeof text == "string" && text.trim().length > 0);
    microMessage.textContent = messageExists ? text : '';
    if(messageExists) {
        microMessage.classList.add('micro-message'); 
    }else{
        microMessage.classList.remove('micro-message'); 
    }
}

function validateEmail(email) {
  	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateUsername(text) {
  	return typeof text === "string" && text.length >= 2;
}

function validateDate(date) {
  	return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function validateGender(gender) {
  	return /^[a-zA-Z]+$/.test(gender);
}

function validatePassword(password) {
  	return /^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*\W)(?!.* ).{8,128}$/.test(password);
}

nextBtn.onclick = () => {
    if(!validateEmail(form.email.value)) return setMicroMessage("micro-message", "Invalid email");
    if(!validatePassword(form.password.value)) return setMicroMessage("micro-message", "Password must be 8–128 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character (no spaces).");
    setElements("register", 2);
};

arrowBackBtn.onclick = () => setElements("register", 1);

document.querySelectorAll('.gender-label').forEach(label => {
    label.addEventListener('click', () => {
        const genderValue = form.gender().value;
        form.otherGender.style.display = genderValue == "other" ? "flex" : "none";
    });
});

// on login:
loginBtn.onclick = async () => {
    setMicroMessage("micro-message", false);
    if(!validateEmail(form.email.value)) return setMicroMessage("micro-message", "Invalid email.");
    if(!validatePassword(form.password.value)) return setMicroMessage("micro-message", "Password must be 8-128 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character (no spaces).");    

    const payload = {
        access_word: form.email.value,
        password: form.password.value,
    };

    const result = await window.alexicon.LOGIN(ENDPOINT, payload);

    if(result.response == "User does not exist.") return setMicroMessage("micro-message", "This user doesn't exists.");

    if(result.response == "Correct login."){
        localStorage.setItem("AlexiconUserData", JSON.stringify({
            sessionActive: true,
            userData: result.user_data,
            token: result.access_token,
            verificationEmail: form.email.value,
        }));
        if(result.user_data.verified == 0) return toVerify();
        window.location.href = ENDPOINT+service?.route;
    }else{
        setMicroMessage("micro-message", "Something went wrong. Please retry later.");
    }
}

// on register:
registerBtn.onclick = async () => {
    setMicroMessage("micro-message", false);

    if(!validateUsername(form.firstName.value.trim())) return setMicroMessage("micro-message", "Name must be at least 2 characters.");
    if(!validateUsername(form.lastName.value.trim())) return setMicroMessage("micro-message", "Last name must be at least 2 characters.");
    if(!validateDate(form.birthday.value)) return setMicroMessage("micro-message", "Date invalid or missing.");
    if(form.gender().value == "other"){
        if(!validateGender(form.otherGender.value)) return setMicroMessage("micro-message", "Other gender must contain only alphabetic characters.");
    }else{
        if(!form.gender()?.value) return setMicroMessage("micro-message", "Gender required.");
    }
    
    const payload = {
        email: form.email.value,
        password: form.password.value,
        name: form.firstName.value,
        surname: form.lastName.value,
        nickname: form.nickname.value,
        birthday: form.birthday.value,
        gender: form.gender().value == "other" ? form.otherGender.value : form.gender().value,
    };

    const result = await window.alexicon.REGISTER(ENDPOINT, payload);

    if(result.response == "User added successfully."){
        localStorage.setItem("AlexiconUserData", JSON.stringify({
            sessionActive: true,
            userData: result.user_data,
            token: result.access_token,
            verificationEmail: form.email.value,
        }));
        if(result.user_data.verified == 0) return toVerify();
        console.log("ERROR: REGISTERED BUT ALREADY MARKED AS VERIFIED (???)");
    }else
    if(result.response == "User exists"){
        setMicroMessage("micro-message", "User already exists.");
    }else{
        setMicroMessage("micro-message", "Something went wrong. Please retry later.");
    }
}
const verifyTitle = document.getElementById("verify-title");
const verifyText = document.getElementById("verify-text");
const reSendEmail = document.getElementById("re-send-email");
const watch = document.getElementById("watch");

const AlexiconUserData = JSON.parse(localStorage.getItem("AlexiconUserData") || '{}');
const canReSendIn = 1000 * 60 * 2;
let countdown = null;
let countdownDisplay;

function formatMs(ms){
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${String(sec).padStart(2, "0")}`;
}

function setCountdown(){
    clearInterval(countdown);
    countdownEndAt = Date.now() + canReSendIn;
    watch.textContent = `Did't receive the email? Resend in ${formatMs(canReSendIn)}.`;

    countdown = setInterval(() => {
        const remaining = countdownEndAt - Date.now();
        watch.textContent = `Did't receive the email? Resend in ${formatMs(remaining)}.`;

        if (remaining <= 0) {
            clearInterval(countdown);
            countdown = null;
            watch.textContent = "Did't receive the email?";
        }
    }, 250);

    countdown = setInterval(() => {
        watch.innerHTML = "";
    }, canReSendIn);
}

function toVerify(){
    mainAccess.style.display = "none";
    verification.style.display = "flex";
    verifyCode.style.display = "none";
    verifyTitle.textContent = `Welcome to ${service?.name}`;
    verifyText.innerHTML = `Hi, ${AlexiconUserData?.userData?.name}, we have sent a verification email to your address <b>${AlexiconUserData?.verificationEmail}</b>.`;
    
    const expirationDate = AlexiconUserData?.userData?.verify_key_refresh; 
    const startMs = Date.parse(expirationDate);     // o: new Date(expirationDateStr).getTime()
    const nowMs = Date.now();
    const passedMoreThan2Minutes = (nowMs - startMs) > canReSendIn;
    console.log({ passedMoreThan2Minutes });
    if(!passedMoreThan2Minutes){
        setCountdown();
    }else{
        watch.textContent = "Didn't receive your email? Try re send it:";
    }
}

reSendEmail.onclick = async () => {
    const result = await window.alexicon.REFRESH_VERIFY_KEY(ENDPOINT, AlexiconUserData?.verificationEmail);

    console.log(result?.response);
    if(result.response == "If the account exists, a new verification code was generated."){
        setCountdown();
        setMicroMessage("micro-message-verify", "New email sent.");
    }else
    if(result.response == "Please wait a bit before requesting a new code."){
        setMicroMessage("micro-message-verify", result.response);
    }else{
        setMicroMessage("micro-message-verify", "Something went wrong. Please retry later.");
    }
}

// workflow on verify

function waitForVerify(timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const t = setInterval(() => {
        if (window.alexicon?.VERIFY) {
            clearInterval(t);
            resolve();
        } else if (Date.now() - start > timeoutMs) {
            clearInterval(t);
            reject(new Error("VERIFY not loaded"));
        }
        }, 25);
    });
}

async function verifyKey() {
    await waitForVerify();
    const result = await window.alexicon.VERIFY(ENDPOINT, id, verify_key);
    
    console.log(result);

    if (result?.status === "ok") {
        window.location.href = ENDPOINT+service?.route;
    }else{
        document.getElementById("verify-code-message").textContent = ("Something went wrong. Please try login again.");
    }
}

if(id && verify_key){
    mainAccess.style.display = "none";
    verification.style.display = "none";
    verifyCode.style.display = "flex";
    document.getElementById("verify-code-title").textContent = `Email confirmation`;
    verifyKey();
}
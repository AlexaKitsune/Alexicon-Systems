export function TOKEN(){
    return JSON.parse(localStorage.getItem("AlexiconUserData")).token;
}

function buildFormData(obj = {}){
    const fd = new FormData();
    Object.entries(obj).forEach(([key, val]) => {
        if (val == null) return;

        if (val instanceof Blob || val instanceof File) {
            fd.append(key, val);
        } else if (Array.isArray(val)) {
        // Permite múltiples archivos o valores
        val.forEach(item => {
            if (item instanceof Blob || item instanceof File) fd.append(key, item);
            else if (typeof item === 'object') fd.append(key, JSON.stringify(item));
            else fd.append(key, String(item));
        });
        } else if (typeof val === 'object') {
            // Objetos: los mandamos como JSON en formData
            fd.append(key, JSON.stringify(val));
        } else {
            fd.append(key, String(val));
        }
    });
    return fd;
}

// ENDPOINT FUNCTIONS

// alexicon/block
export async function BLOCK(endpoint_, token_, data_){
    const response = await fetch(`${endpoint_}/alexicon/block`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// alexicon/check_session
export async function CHECK_SESSION(endpoint_, token_) {
    const response = await fetch(`${endpoint_}/alexicon/check_session`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token_}` }
    });
    return await response.json();
}

// alexicon/follow
export async function FOLLOW(endpoint_, token_, data_){
    const response = await fetch(`${endpoint_}/alexicon/follow`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// alexicon/login
export async function LOGIN(endpoint_, userData_){
    const response = await fetch(`${endpoint_}/alexicon/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(userData_)
    })
    return await response.json();
}

// alexicon/logout
export async function LOGOUT(endpoint_, token_){
    const response = await fetch(`${endpoint_}/alexicon/logout`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        }
    })
    return await response.json();
}

// alexicon/notifications
export async function NOTIFICATIONS(endpoint_, token_){
    const response = await fetch(`${endpoint_}/alexicon/notifications`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        }
    })
    return await response.json();
}

// alexicon/notification_seen
export async function NOTIFICATION_SEEN(endpoint_, token_, data_){
    const response = await fetch(`${endpoint_}/alexicon/notification_seen`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// alexicon/on

// alexicon/refresh_verify_key
export async function REFRESH_VERIFY_KEY(endpoint_, email_) {
    const response = await fetch(`${endpoint_}/alexicon/refresh_verify_key`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: email_ })
    })
    return await response.json();
}

// alexicon/register
export async function REGISTER(endpoint_, userData_){
    const response = await fetch(`${endpoint_}/alexicon/register`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(userData_)
    })
    return await response.json();
}

// alexicon/report
export async function REPORT(endpoint_, token_, data_){
    const response = await fetch(`${endpoint_}/alexicon/report`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// alexicon/retrieve_users
export async function RETRIEVE_USERS(endpoint_, data_){
    const response = await fetch(`${endpoint_}/alexicon/retrieve_users`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// alexicon/retrieve
export async function RETRIEVE(endpoint_, profileId_){
    const response = await fetch(`${endpoint_}/alexicon/retrieve?id=${profileId_}`, {
        method: "GET",
    })
    return await response.json();
}

// alexicon/update_pass
export async function UPDATE_PASS(endpoint_, token_, data_){
    const response = await fetch(`${endpoint_}/alexicon/update_pass`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// alexicon/update_pics
export async function UPDATE_PICS(endpoint_, token_, data_){
    const response = await fetch(`${endpoint_}/alexicon/update_pics`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// alexicon/update_profile
export async function UPDATE_PROFILE(endpoint_, token_, data_){
    const response = await fetch(`${endpoint_}/alexicon/update_profile`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// alexicon/upload
export async function UPLOAD(endpoint_, token_, formData_){
    const formData = buildFormData(formData_);
    const response = await fetch(`${endpoint_}/alexicon/upload`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token_}`
        },
        body: formData
    })
    return await response.json();
}

function parseContentDispositionFilename(cd) {
    if (!cd) return null;
    const m = /filename="(.+?)"/i.exec(cd);
    return m ? m[1] : null;
}

// alexicon/media/file
export async function MEDIA_FILE(endpoint_, token_=null, id_){
    const url = `${endpoint_}/alexicon/media/file/${id_}`;
    const headers = {};
    if (token_) headers["Authorization"] = `Bearer ${token_}`;
    
    const response = await fetch(url, { method: "GET", headers, cache: "no-store" });

    const type = response.headers.get("content-type") || "";
    const filename =
        response.headers.get("X-Filename") ||
        parseContentDispositionFilename(response.headers.get("Content-Disposition"));

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    return { url: blobUrl, type, filename, isBlob: true };
}

// alexicon/verify
export async function VERIFY(endpoint_, id_, verify_key_) {
    const response = await fetch(`${endpoint_}/alexicon/verify?id=${id_}&verify_key=${verify_key_}`, {
        method: "GET",
    })
    return await response.json(); 
}
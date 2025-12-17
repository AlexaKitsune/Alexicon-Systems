// yipnet/comment
export async function COMMENT(endpoint_, token_, data_){
    const response = await fetch(`${endpoint_}/yipnet/comment`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// yipnet/delete
export async function DELETE(endpoint_, token_, data_){
    const response = await fetch(`${endpoint_}/yipnet/delete`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// yipnet/get_messages
export async function GET_MESSAGES(endpoint_, token_, profileId_){
    const response = await fetch(`${endpoint_}/yipnet/get_messages?user=${profileId_}`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token_}`
        }
    })
    return await response.json();
}

// yipnet/get_single_comment

// yipnet/get_single_post
export async function GET_SINGLE_POST(endpoint_, token_=null, postId_){
    const headers = {
        "Content-Type": "application/json"
    };
    if (token_) headers["Authorization"] = `Bearer ${token_}`;
    const response = await fetch(`${endpoint_}/yipnet/get_single_post?id=${postId_}`, {
        method: "GET",
        headers
    })
    return await response.json();
}

// yipnet/list_comments
export async function LIST_COMMENTS(endpoint_, token_, postId_){
    const response = await fetch(`${endpoint_}/yipnet/list_comments/${postId_}`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token_}`
        }
    })
    return await response.json();
}

// yipnet/list_messages
export async function LIST_MESSAGES(endpoint_, token_){
    const response = await fetch(`${endpoint_}/yipnet/list_messages`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token_}`
        }
    })
    return await response.json();
}

// yipnet/list_posts
export async function LIST_POSTS(endpoint_, token_, profileId_){
    const response = await fetch(`${endpoint_}/yipnet/list_posts/${profileId_}`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token_}`
        }
    })
    return await response.json();
}

// yipnet/message
export async function MESSAGE(endpoint_, token_, data_){
    const response = await fetch(`${endpoint_}/yipnet/message`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// yipnet/newsfeed
export async function NEWSFEED(endpoint_, token_){
    const response = await fetch(`${endpoint_}/yipnet/newsfeed`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        }
    })
    return await response.json();
}

// yipnet/post
export async function POST(endpoint_, token_, data_){
    const response = await fetch(`${endpoint_}/yipnet/post`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// yipnet/retrieve_posts
export async function RETRIEVE_POSTS(endpoint_, token_, data_){
    const response = await fetch(`${endpoint_}/yipnet/retrieve_posts`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// yipnet/vote
export async function VOTE(endpoint_, token_, voteData_){
    const response = await fetch(`${endpoint_}/yipnet/vote`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(voteData_)
    })
    return await response.json();
}
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function sendTestMessage() {
    const payload = {
        event: "message",
        session: "test_session",
        me: { id: "212600000000@c.us" }, // The clinic number
        payload: {
            id: "msg_123",
            timestamp: Date.now() / 1000,
            from: "21277777777@c.us", // The patient number
            to: "212600000000@c.us",
            body: "Salam, I want an appointment.",
            hasMedia: false,
            fromMe: false,
            type: "chat"
        }
    };

    try {
        const res = await fetch('http://localhost:3001/waha/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const text = await res.text();
        console.log("Webhook Response HTTP", res.status, text);
    } catch (e) {
        console.error("Webhook POST Error:", e);
    }
}

sendTestMessage();

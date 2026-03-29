// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyA-6qtVYHfipL_c6g5JzXKXCxMN5WDKU7A",
    authDomain: "asteroid-cdc13.firebaseapp.com",
    databaseURL: "https://asteroid-cdc13-default-rtdb.firebaseio.com",
    projectId: "asteroid-cdc13",
    storageBucket: "asteroid-cdc13.appspot.com",
    messagingSenderId: "793353824502",
    appId: "1:793353824502:web:3ac24821911d14773ba4d7",
    measurementId: "G-GV72TMNNGR"
};

// Your VAPID key
const vapidKey = "BL9j8VcXPanjQUt2M5XQbNqIXhqtL6PixhVNyfKcVIpINxeWfhDqKB3Z_pnzy-amdWsXUIVpqN2nVE8kttZAYJk"; // Replace with real key

console.log('Initializing Firebase...');

// Initialize Firebase (ONCE)
firebase.initializeApp(firebaseConfig);

// Get Firebase services
const messaging = firebase.messaging();
const database = firebase.database();

console.log('Firebase ready');

// DOM elements
const statusEl = document.getElementById('status');
const tokenEl = document.getElementById('token');
const enableBtn = document.getElementById('enableBtn');

// Check support
if (!('Notification' in window)) {
    statusEl.textContent = '❌ This browser does not support notifications';
    enableBtn.disabled = true;
} else if (!('serviceWorker' in navigator)) {
    statusEl.textContent = '❌ This browser does not support service workers';
    enableBtn.disabled = true;
} else {
    statusEl.textContent = '✅ Ready - Click button to enable notifications';
}

// Request permission and get token
enableBtn.addEventListener('click', async () => {
    try {
        statusEl.textContent = '⏳ Requesting permission...';
        enableBtn.disabled = true;
        
        const permission = await Notification.requestPermission();
        console.log('Permission:', permission);
        
        if (permission === 'granted') {
            statusEl.textContent = '⏳ Getting token...';
            
            // Get FCM token - Firebase will register the service worker automatically
            const token = await messaging.getToken({ 
                vapidKey: vapidKey,
                serviceWorkerRegistration: await navigator.serviceWorker.register('/firebase-messaging-sw.js')
            });
            
            console.log('FCM Token:', token);
            
            if (token) {
                tokenEl.innerHTML = `<strong>✅ Token:</strong><br><code>${token}</code>`;
                
                // Save to database
                await database.ref('owner_token').set(token);
                console.log('Token saved to database');
                
                statusEl.textContent = '✅ Notifications enabled!';
            } else {
                statusEl.textContent = '❌ Failed to get token';
                enableBtn.disabled = false;
            }
        } else {
            statusEl.textContent = '❌ Permission denied';
            enableBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error:', error);
        statusEl.textContent = `❌ Error: ${error.message}`;
        enableBtn.disabled = false;
    }
});

// Handle foreground messages
messaging.onMessage((payload) => {
    console.log('📨 Foreground message:', payload);
    
    const title = payload.notification?.title || 'New Notification';
    const options = {
        body: payload.notification?.body || 'You have a message',
        icon: '/icon.png',
        badge: '/badge.png',
        requireInteraction: true, // ⭐ STAYS UNTIL CLOSED
        silent: false, // ⭐ ENABLES SOUND
        tag: payload.data?.boostId || `notification-${Date.now()}`,
        renotify: true, // ⭐ ALWAYS PLAY SOUND
        vibrate: [200, 100, 200],
        data: payload.data
    };
    
    if (Notification.permission === 'granted') {
        new Notification(title, options);
    }
});

// Check if already enabled
if (Notification.permission === 'granted') {
    statusEl.textContent = '✅ Notifications already enabled';
    enableBtn.textContent = 'Notifications Enabled';
    enableBtn.disabled = true;
    
    // Get and display existing token
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .then(registration => {
            return messaging.getToken({ vapidKey: vapidKey, serviceWorkerRegistration: registration });
        })
        .then(token => {
            if (token) {
                console.log('Existing token:', token);
                tokenEl.innerHTML = `<strong>Token:</strong><br><code>${token}</code>`;
            }
        })
        .catch(error => console.error('Error:', error));
}

console.log('App loaded');
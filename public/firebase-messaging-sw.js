// Firebase Messaging Service Worker
console.log('Service Worker: Loading...');

// Import Firebase scripts for service worker (compat SDK)
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

console.log('Service Worker: Firebase scripts imported');

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

console.log('Service Worker: Initializing Firebase...');

// Initialize Firebase in the service worker
firebase.initializeApp(firebaseConfig);

console.log('Service Worker: Firebase initialized');

// Get messaging instance
const messaging = firebase.messaging();

console.log('Service Worker: Messaging instance created');

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('🔔 Service Worker: BACKGROUND MESSAGE RECEIVED!', payload);
    
    const notificationTitle = payload.notification?.title || 'New Notification';
    const notificationOptions = {
        body: payload.notification?.body || 'You have a new message',
        icon: payload.notification?.icon || '/icon.png',
        badge: '/badge.png',
        tag: payload.data?.boostId || `notification-${Date.now()}`, // Unique tag for each notification
        requireInteraction: true, // ⭐ KEEPS NOTIFICATION UNTIL CLOSED
        silent: false, // ⭐ ENABLES SOUND
        renotify: true, // ⭐ PLAYS SOUND EVEN FOR SAME TAG
        vibrate: [200, 100, 200], // Vibration pattern (for mobile)
        data: payload.data
    };
    
    console.log('🔔 Service Worker: Showing persistent notification with sound');
    
    // Show notification
    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('🔔 Service Worker: Notification clicked');
    
    event.notification.close();
    
    // Navigate to your app
    event.waitUntil(
        clients.openWindow('https://asteroid-cdc13.web.app/')
    );
});

// Add push event listener for debugging
self.addEventListener('push', (event) => {
    console.log('🔔 Service Worker: PUSH EVENT RECEIVED!', event);
    if (event.data) {
        console.log('🔔 Push data:', event.data.text());
    }
});

console.log('Service Worker: Ready and listening');
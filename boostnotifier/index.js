const {onValueCreated} = require("firebase-functions/v2/database");
const admin = require("firebase-admin");

// Initialize Firebase Admin
admin.initializeApp();

// Trigger when a new boostSong is created
exports.sendBoostNotification = onValueCreated(
    "/boostSongs/{boostId}",
    async (event) => {
        const boostId = event.params.boostId;
        const boostData = event.data.val();
        
        console.log('New boost song created:', boostId, boostData);
        
        try {
            // Get the owner token from /owner_token
            const tokenSnapshot = await admin.database().ref('owner_token').once('value');
            const token = tokenSnapshot.val();
            
            if (!token) {
                console.log('No owner token found');
                return null;
            }
            
            console.log('Sending notification to token:', token);
            
            // Prepare the notification message (FCM HTTP v1 format)
            const message = {
                token: token,
                notification: {
                    title: '🎵 New Boost Song!',
                    body: boostData.title || `Boost #${boostId} has been created`,
                },
                data: {
                    boostId: boostId,
                    timestamp: Date.now().toString(),
                    click_action: '/'
                },
                webpush: {
                    fcmOptions: {
                        link: '/'
                    },
                    notification: {
                        icon: '/icon.png',
                        badge: '/badge.png',
                        requireInteraction: true, // ⭐ PERSISTENT
                        silent: false, // ⭐ WITH SOUND
                        renotify: true, // ⭐ ALWAYS NOTIFY
                        tag: `boost-${boostId}`,
                        vibrate: [200, 100, 200]
                    }
                }
            };
            
            // Send the notification
            const response = await admin.messaging().send(message);
            console.log('Successfully sent notification:', response);
            
            return response;
            
        } catch (error) {
            console.error('Error sending notification:', error);
            throw error;
        }
    }
);
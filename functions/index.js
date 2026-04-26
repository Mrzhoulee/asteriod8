const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.notifyBoostChange = functions.database
  .ref("/boostSongs/{boostId}")
  .onCreate(async (snapshot, context) => {

    const tokenSnap = await admin.database().ref("/owner_token").once("value");
    const token = tokenSnap.val();

    if (!token) {
      console.log("No token found");
      return null;
    }

    const boostData = snapshot.val();

    const message = {
      token: token,
      notification: {
        title: "🚀 New Boost!",
        body: `Song boosted: ${boostData.songName || "Unknown"}`
      }
    };

    return admin.messaging().send(message);
  });

// Notify fan when artist answers their Q&A question.
exports.notifyQAAnswer = functions.database
  .ref("/ARTIST_QA/{artistKey}/{questionId}/answer")
  .onCreate(async (snapshot, context) => {
    const { artistKey, questionId } = context.params;

    const qSnap = await admin.database()
      .ref(`/ARTIST_QA/${artistKey}/${questionId}`)
      .once("value");
    const q = qSnap.val();
    if (!q || !q.fcmToken) {
      console.log("[notifyQAAnswer] no FCM token for question", questionId);
      return null;
    }

    const artistSnap = await admin.database()
      .ref(`/PROFILES/${artistKey}`)
      .once("value");
    const artistName = (artistSnap.val() || {}).nickname || "An artist";

    const question = String(q.question || "").substring(0, 80);
    const answer = String(snapshot.val() || "").substring(0, 120);

    const message = {
      token: q.fcmToken,
      notification: {
        title: `${artistName} answered your question 🎵`,
        body: answer || `They replied to: "${question}"`,
      },
      webpush: {
        notification: {
          icon: "https://www.asteroid8.net/favicon.ico",
          click_action: `https://www.asteroid8.net/qa.html?artist=${encodeURIComponent(artistKey)}`,
        },
        fcm_options: {
          link: `https://www.asteroid8.net/qa.html?artist=${encodeURIComponent(artistKey)}`,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
        fcm_options: {
          image: "https://www.asteroid8.net/favicon.ico",
        },
      },
    };

    try {
      await admin.messaging().send(message);
      console.log("[notifyQAAnswer] sent push to", q.fcmToken.substring(0, 20), "...");
    } catch (e) {
      console.warn("[notifyQAAnswer] send failed:", e.message);
    }
    return null;
  });

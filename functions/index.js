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

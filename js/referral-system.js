/**
 * Asteroid Referral-Based Featuring System
 * Modular logic - UI and logic separated
 */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  increment,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  addDoc,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// Must match the main app (index.html / studio.html) so Storage/Auth use one project.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA-6qtVYHfipL_c6g5JzXKXCxMN5WDKU7A",
  authDomain: "asteroid-cdc13.firebaseapp.com",
  databaseURL: "https://asteroid-cdc13-default-rtdb.firebaseio.com",
  projectId: "asteroid-cdc13",
  storageBucket: "asteroid-cdc13.appspot.com",
  messagingSenderId: "793353824502",
  appId: "1:793353824502:web:3ac24821911d14773ba4d7",
  measurementId: "G-GV72TMNNGR"
};

const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const auth = getAuth(app);

// --- Constants ---
const VIP_TRIAL_DAYS = 30;
const COLL = {
  users: "users",
  songs: "songs",
  featureQueue: "featureQueue"
};

// --- Utils ---
function generateReferralCode() {
  return "AST" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getReferralFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("ref") || params.get("referral") || localStorage.getItem("pending_referral_code");
}

function savePendingReferral(code) {
  if (code) localStorage.setItem("pending_referral_code", code);
}

function clearPendingReferral() {
  localStorage.removeItem("pending_referral_code");
}

// --- VIP Logic ---
function isWithinVipTrial(vipStartDate) {
  if (!vipStartDate) return false;
  const start = vipStartDate.toDate ? vipStartDate.toDate() : new Date(vipStartDate);
  const now = new Date();
  const msDiff = now - start;
  const daysDiff = msDiff / (1000 * 60 * 60 * 24);
  return daysDiff < VIP_TRIAL_DAYS;
}

function getVipDaysRemaining(vipStartDate) {
  if (!vipStartDate) return 0;
  const start = vipStartDate.toDate ? vipStartDate.toDate() : new Date(vipStartDate);
  const end = new Date(start);
  end.setDate(end.getDate() + VIP_TRIAL_DAYS);
  const now = new Date();
  const msRemaining = end - now;
  return Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
}

// --- Eligibility Check ---
async function checkAndUpdateEligibility(userRef, userData) {
  const { vipStatus, vipStartDate, songCount, referralCount, userUid, username } = userData;
  const withinTrial = vipStatus && isWithinVipTrial(vipStartDate);
  const eligible = withinTrial && songCount >= 1 && referralCount >= 1;

  await updateDoc(userRef, {
    vipStatus: withinTrial,
    eligibleForFeature: eligible
  });

  if (eligible) {
    await addToFeatureQueueIfNotExists(userUid, username, referralCount, songCount);
  }

  return eligible;
}

// --- Feature Queue (no duplicates) ---
async function addToFeatureQueueIfNotExists(userUid, username, referralCount, songCount) {
  const q = query(
    collection(db, COLL.featureQueue),
    where("userUid", "==", userUid),
    where("processed", "==", false)
  );
  const snap = await getDocs(q);
  if (!snap.empty) return;

  await addDoc(collection(db, COLL.featureQueue), {
    userUid,
    username,
    referralCount,
    songCount,
    timestamp: serverTimestamp(),
    processed: false
  });
}

// --- User Creation (on signup) ---
export async function createOrUpdateUserOnSignup(user, referredByCode = null) {
  const userRef = doc(db, COLL.users, user.uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    clearPendingReferral();
    return snap.data();
  }

  const referralCode = generateReferralCode();
  const userData = {
    email: user.email || "",
    username: user.displayName || user.email?.split("@")[0] || "Artist",
    vipStatus: true,
    vipStartDate: Timestamp.now(),
    referralCode,
    referredBy: referredByCode || null,
    referralCount: 0,
    songCount: 0,
    eligibleForFeature: false
  };

  await setDoc(userRef, userData);

  if (referredByCode) {
    const referrerQuery = query(collection(db, COLL.users), where("referralCode", "==", referredByCode));
    const referrerSnap = await getDocs(referrerQuery);
    if (!referrerSnap.empty) {
      const referrerDoc = referrerSnap.docs[0];
      const referrerRef = referrerDoc.ref;
      await updateDoc(referrerRef, { referralCount: increment(1) });
      const referrerData = (await getDoc(referrerRef)).data();
      await checkAndUpdateEligibility(referrerRef, { ...referrerData, userUid: referrerDoc.id, username: referrerData.username });
    }
  }

  clearPendingReferral();
  return userData;
}

// --- Process Referral URL (call on page load before signup) ---
export function processReferralURL() {
  const code = getReferralFromURL();
  if (code) savePendingReferral(code);
}

// --- On Signup (call after auth succeeds) ---
export async function handleNewUserSignup(user) {
  const referredBy = getReferralFromURL();
  return createOrUpdateUserOnSignup(user, referredBy);
}

// --- Song Upload (call when artist uploads a song) ---
export async function onSongUploaded(ownerUid, title) {
  const songRef = doc(collection(db, COLL.songs));
  await setDoc(songRef, {
    ownerUid,
    title,
    uploadDate: Timestamp.now(),
    plays: 0,
    likes: 0
  });

  const userRef = doc(db, COLL.users, ownerUid);
  await updateDoc(userRef, { songCount: increment(1) });

  const userSnap = await getDoc(userRef);
  const userData = userSnap.data();
  await checkAndUpdateEligibility(userRef, {
    ...userData,
    userUid: ownerUid,
    username: userData.username
  });
}

// --- VIP Status Check (scheduled / on login) ---
export async function updateVipStatusIfExpired(uid) {
  const userRef = doc(db, COLL.users, uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const d = snap.data();
  if (!d.vipStatus) return;
  if (isWithinVipTrial(d.vipStartDate)) return;

  await updateDoc(userRef, {
    vipStatus: false,
    eligibleForFeature: false
  });
}

// --- Live User Data (for dashboard) ---
export function subscribeToUser(uid, callback) {
  const userRef = doc(db, COLL.users, uid);
  return onSnapshot(userRef, async (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    const data = snap.data();
    const vipStart = data.vipStartDate;
    const withinTrial = data.vipStatus && isWithinVipTrial(vipStart);
    const daysRemaining = getVipDaysRemaining(vipStart);
    callback({
      ...data,
      daysRemaining,
      withinTrial,
      referralLink: `${window.location.origin}${window.location.pathname}?ref=${data.referralCode}`
    });
  }, (err) => {
    console.error("subscribeToUser error:", err);
    callback(null);
  });
}

// --- Top VIP Artists (for Charts page) ---
export function subscribeToTopVipArtists(limitCount = 50, callback) {
  const q = query(
    collection(db, COLL.users),
    where("vipStatus", "==", true),
    orderBy("referralCount", "desc"),
    limit(limitCount)
  );
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({
      uid: d.id,
      ...d.data()
    }));
    callback(list);
  }, (err) => {
    console.error("subscribeToTopVipArtists error:", err);
    callback([]);
  });
}

// --- Exports for integration ---
export {
  db,
  auth,
  onAuthStateChanged,
  FIREBASE_CONFIG,
  VIP_TRIAL_DAYS,
  getReferralFromURL,
  savePendingReferral,
  getVipDaysRemaining,
  isWithinVipTrial
};

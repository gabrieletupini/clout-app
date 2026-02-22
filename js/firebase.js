import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js';
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
  query, where, orderBy, onSnapshot, serverTimestamp, getDoc, setDoc
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCSaED62ctLIbA1bgBcN_x9uEgDGTNS1ZA",
  authDomain: "clout-db.firebaseapp.com",
  projectId: "clout-db",
  storageBucket: "clout-db.firebasestorage.app",
  messagingSenderId: "17956645416",
  appId: "1:17956645416:web:ee056d6526ab5f1f19631d",
  measurementId: "G-RCYJBG5DJE"
};

let db;
let syncCallback = null;

export function initFirebase() {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  return db;
}

// Sync status — calls back with 'synced', 'error', or 'syncing'
export function onSyncStatus(callback) {
  syncCallback = callback;
}

function reportSync(status) {
  if (syncCallback) syncCallback(status);
}

function pad(n) { return String(n).padStart(2, '0'); }

// ===== Days CRUD =====

export function subscribeToMonth(year, month, callback) {
  const startDate = `${year}-${pad(month)}-01`;
  const endDate = `${year}-${pad(month)}-31`;

  const q = query(
    collection(db, 'days'),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date')
  );

  return onSnapshot(q, (snapshot) => {
    reportSync('synced');
    const daysMap = new Map();
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      daysMap.set(data.date, { docId: docSnap.id, ...data });
    });
    callback(daysMap);
  }, (err) => {
    console.error('Firestore subscribe error:', err);
    reportSync('error');
  });
}

export async function createDay(data) {
  reportSync('syncing');
  const docRef = await addDoc(collection(db, 'days'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  reportSync('synced');
  return docRef.id;
}

export async function updateDay(docId, fields) {
  reportSync('syncing');
  await updateDoc(doc(db, 'days', docId), {
    ...fields,
    updatedAt: serverTimestamp()
  });
  reportSync('synced');
}

export async function deleteDay(docId) {
  reportSync('syncing');
  await deleteDoc(doc(db, 'days', docId));
  reportSync('synced');
}

export async function moveDayToDate(docId, newDate) {
  reportSync('syncing');
  await updateDoc(doc(db, 'days', docId), {
    date: newDate,
    updatedAt: serverTimestamp()
  });
  reportSync('synced');
}

// ===== Settings CRUD =====

const SETTINGS_REF = () => doc(db, 'settings', 'config');

export async function getSettings() {
  const snap = await getDoc(SETTINGS_REF());
  return snap.exists() ? snap.data() : null;
}

export async function saveSettings(data) {
  reportSync('syncing');
  await setDoc(SETTINGS_REF(), {
    ...data,
    updatedAt: serverTimestamp()
  }, { merge: true });
  reportSync('synced');
}

export function subscribeToSettings(callback) {
  return onSnapshot(SETTINGS_REF(), (snap) => {
    reportSync('synced');
    callback(snap.exists() ? snap.data() : null);
  }, (err) => {
    console.error('Settings subscribe error:', err);
    reportSync('error');
  });
}

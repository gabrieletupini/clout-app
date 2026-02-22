import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js';
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
  query, where, orderBy, onSnapshot, serverTimestamp
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

export function initFirebase() {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  return db;
}

export function getDb() {
  return db;
}

// Pad month/day to 2 digits
function pad(n) { return String(n).padStart(2, '0'); }

// Subscribe to real-time updates for a given month.
// callback receives a Map<dateString, { docId, ...data }>
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
    const daysMap = new Map();
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      daysMap.set(data.date, { docId: docSnap.id, ...data });
    });
    callback(daysMap);
  });
}

export async function createDay(data) {
  const docRef = await addDoc(collection(db, 'days'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

export async function updateDay(docId, fields) {
  await updateDoc(doc(db, 'days', docId), {
    ...fields,
    updatedAt: serverTimestamp()
  });
}

export async function deleteDay(docId) {
  await deleteDoc(doc(db, 'days', docId));
}

export async function moveDayToDate(docId, newDate) {
  await updateDoc(doc(db, 'days', docId), {
    date: newDate,
    updatedAt: serverTimestamp()
  });
}

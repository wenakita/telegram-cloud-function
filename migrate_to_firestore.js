const admin = require('firebase-admin');
const fs = require('fs');
const { parse } = require('csv-parse/sync');

// Use Application Default Credentials (ADC)
admin.initializeApp();

const db = admin.firestore();

// Load your CSV or JSON data
const csvData = fs.readFileSync('./users.csv', 'utf8');
const records = parse(csvData, { columns: true });

async function migrate() {
  for (const user of records) {
    // Example: adapt field names as needed
    await db.collection('users').doc(user.telegram_id).set({
      username: user.username,
      telegram_id: user.telegram_id,
      referral_code: user.referral_code,
      referred_by: user.referred_by,
      points: Number(user.points) || 0,
      joined_at: user.joined_at ? new Date(user.joined_at) : admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  console.log('Migration complete!');
}

migrate();
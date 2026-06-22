#!/usr/bin/env node
/**
 * migrate-encryption.cjs — One-time migration of v1 ciphertexts to v2.
 * Run: node scripts/migrate-encryption.cjs
 *
 * Prerequisites: STORAGE_ENCRYPTION_KEY must be set in environment.
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { loadDB, saveDB } = require('../server/db.cjs');
const { decrypt, encrypt, isLegacyCiphertext } = require('../server/config.cjs');

function migrateCollection(name, encryptedFields) {
  const records = loadDB(name);
  let migrated = 0;

  for (const record of records) {
    let changed = false;
    for (const field of encryptedFields) {
      if (record[field] && isLegacyCiphertext(record[field])) {
        const plaintext = decrypt(record[field]);
        record[field] = encrypt(plaintext);
        changed = true;
      }
    }
    if (changed) migrated++;
  }

  if (migrated > 0) {
    saveDB(name, records);
  }

  return migrated;
}

console.log('Starting encryption migration (v1 → v2)...\n');

const accountsMigrated = migrateCollection('accounts', [
  'encrypted_token',
  'encrypted_token_secret',
]);
console.log(`accounts: ${accountsMigrated} records migrated`);

console.log('\nMigration complete.');

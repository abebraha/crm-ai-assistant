#!/usr/bin/env node
/**
 * Quick setup helper — generates required secrets and prints setup instructions.
 * Run with: node scripts/setup.js
 */
const crypto = require('crypto');

const nextAuthSecret   = crypto.randomBytes(32).toString('base64');
const encryptionSecret = crypto.randomBytes(32).toString('hex');

console.log('\n🚀 CRM AI Assistant — Setup\n');
console.log('Copy the following into your .env.local:\n');
console.log('─'.repeat(60));
console.log(`NEXTAUTH_SECRET=${nextAuthSecret}`);
console.log(`ENCRYPTION_SECRET=${encryptionSecret}`);
console.log('─'.repeat(60));
console.log('\nThen:\n');
console.log('  1. Add your OPENAI_API_KEY to .env.local');
console.log('  2. Run: npm run db:push   (creates the database)');
console.log('  3. Run: npm run dev');
console.log('  4. Open http://localhost:3000 and create your account');
console.log('  5. Go to Settings to connect your CRM\n');
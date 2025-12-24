n/**
 * Export .env variables for Vercel Dashboard
 * 
 * Usage:
 *   node scripts/export-env-for-vercel.js
 * 
 * This will output all variables in format ready to copy-paste to Vercel
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env');

if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const lines = envContent.split('\n');

console.log('\n📋 Vercel Environment Variables\n');
console.log('='.repeat(60));
console.log('Copy these to Vercel Dashboard → Settings → Environment Variables\n');

const variables = [];

lines.forEach((line, index) => {
  // Skip comments and empty lines
  if (line.trim().startsWith('#') || !line.trim()) {
    return;
  }

  // Parse KEY=VALUE
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let value = match[2].trim();
    
    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    variables.push({ key, value });
    
    console.log(`Name: ${key}`);
    console.log(`Value: ${value}`);
    console.log(`Environment: Production, Preview, Development`);
    console.log('---\n');
  }
});

console.log('='.repeat(60));
console.log(`\n✅ Total: ${variables.length} variables`);
console.log('\n📝 Instructions:');
console.log('1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables');
console.log('2. Add each variable above');
console.log('3. Click "Save"');
console.log('4. Redeploy your project\n');


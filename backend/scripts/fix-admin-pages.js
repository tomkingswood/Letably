#!/usr/bin/env node
/**
 * Script to fix admin pages to use agency context
 * Run from backend folder: node scripts/fix-admin-pages.js
 */

const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, '../../frontend/app/[agency]/admin');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Skip if already has useAgency import
  if (content.includes("import { useAgency }") || content.includes("from '@/lib/agency-context'")) {
    // Just fix the paths
  } else {
    // Add useAgency import after other imports
    if (content.includes("from 'next/navigation'")) {
      content = content.replace(
        "from 'next/navigation';",
        "from 'next/navigation';\nimport { useAgency } from '@/lib/agency-context';"
      );
      modified = true;
    }
  }

  // Add useAgency hook if not present
  if (!content.includes('useAgency()') && content.includes('export default function')) {
    // Find the first useState or useEffect and add useAgency before it
    const hookMatch = content.match(/(\s+)(const \[|useEffect)/);
    if (hookMatch) {
      const indent = hookMatch[1];
      content = content.replace(
        hookMatch[0],
        `${indent}const { agencySlug } = useAgency();\n${hookMatch[0]}`
      );
      modified = true;
    }
  }

  // Replace hardcoded paths
  // href="/admin/..." -> href={`/${agencySlug}/admin/...`}
  const hrefRegex = /href="\/admin\/([^"]+)"/g;
  if (hrefRegex.test(content)) {
    content = content.replace(/href="\/admin\/([^"]+)"/g, 'href={`/${agencySlug}/admin/$1`}');
    modified = true;
  }

  // href="/admin" -> href={`/${agencySlug}/admin`}
  if (content.includes('href="/admin"')) {
    content = content.replace(/href="\/admin"/g, 'href={`/${agencySlug}/admin`}');
    modified = true;
  }

  // router.push('/admin/...') -> router.push(`/${agencySlug}/admin/...`)
  const routerPushRegex = /router\.push\('\/admin\/([^']+)'\)/g;
  if (routerPushRegex.test(content)) {
    content = content.replace(/router\.push\('\/admin\/([^']+)'\)/g, 'router.push(`/${agencySlug}/admin/$1`)');
    modified = true;
  }

  // router.push('/admin') -> router.push(`/${agencySlug}/admin`)
  if (content.includes("router.push('/admin')")) {
    content = content.replace(/router\.push\('\/admin'\)/g, 'router.push(`/${agencySlug}/admin`)');
    modified = true;
  }

  // router.push('/') -> router.push(`/${agencySlug}`)
  if (content.includes("router.push('/')")) {
    content = content.replace(/router\.push\('\/'\)/g, 'router.push(`/${agencySlug}`)');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated: ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('.tsx')) {
      processFile(filePath);
    }
  }
}

console.log('Fixing admin pages...');
walkDir(adminDir);
console.log('Done!');

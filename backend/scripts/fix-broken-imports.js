#!/usr/bin/env node
/**
 * Fix broken import statements from previous script
 */

const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, '../../frontend/app/[agency]/admin');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Fix pattern: import { useState, const { agencySlug } = useAgency();\n useEffect }
  // Should be: import { useState, useEffect }
  const brokenPattern1 = /import \{ ([^}]*), const \{ agencySlug \} = useAgency\(\);\n\s*([^}]+) \} from 'react';/g;
  if (brokenPattern1.test(content)) {
    content = content.replace(brokenPattern1, "import { $1, $2 } from 'react';");
    modified = true;
  }

  // Fix pattern: import { const { agencySlug } = useAgency();\n useEffect }
  const brokenPattern2 = /import \{ const \{ agencySlug \} = useAgency\(\);\n\s*([^}]+) \} from 'react';/g;
  if (brokenPattern2.test(content)) {
    content = content.replace(brokenPattern2, "import { $1 } from 'react';");
    modified = true;
  }

  // Fix pattern: import React, { useState, const { agencySlug } = useAgency();\n useEffect }
  const brokenPattern3 = /import React, \{ ([^}]*), const \{ agencySlug \} = useAgency\(\);\n\s*([^}]+) \} from 'react';/g;
  if (brokenPattern3.test(content)) {
    content = content.replace(brokenPattern3, "import React, { $1, $2 } from 'react';");
    modified = true;
  }

  if (modified) {
    // Ensure useAgency import exists
    if (!content.includes("from '@/lib/agency-context'")) {
      content = content.replace(
        "from 'next/navigation';",
        "from 'next/navigation';\nimport { useAgency } from '@/lib/agency-context';"
      );
    }

    // Add useAgency hook after useRouter if not present
    if (!content.includes('const { agencySlug } = useAgency()')) {
      content = content.replace(
        /const router = useRouter\(\);(\n)/,
        'const router = useRouter();\n  const { agencySlug } = useAgency();$1'
      );
    }

    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${filePath}`);
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

console.log('Fixing broken imports...');
walkDir(adminDir);
console.log('Done!');

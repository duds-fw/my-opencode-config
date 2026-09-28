---
name: scaffold
description: Use when creating new projects, files, or boilerplate. Front-load keywords: create, new, scaffold, template, init, setup, generate.
---

# Project Scaffolding Skill

When creating new projects or files:

## TypeScript Project
```bash
mkdir -p src tests docs
npm init -y
npm install -D typescript @types/node tsx
npx tsc --init --strict --outDir dist --rootDir src
```

## Add Common Tools
```bash
npm install -D eslint prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install -D vitest @vitest/coverage-v8
npm install -D husky lint-staged
```

## ESLint Config (eslint.config.js)
```js
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  { files: ['**/*.ts'], languageOptions: { parser: tsParser } },
  { plugins: { '@typescript-eslint': tsPlugin }, rules: tsPlugin.configs.recommended.rules },
  { ignores: ['dist/', 'node_modules/'] }
];
```

## File Templates

### index.ts
```typescript
export function main(): void {
  // TODO: Implement
}

main();
```

### utils.ts
```typescript
/**
 * Utility functions
 */

export function formatDate(date: Date): string {
  return date.toISOString();
}
```

## Git Init
```bash
git init
echo "node_modules/\ndist/\n.env" > .gitignore
git add .
git commit -m "feat: initial project setup"
```

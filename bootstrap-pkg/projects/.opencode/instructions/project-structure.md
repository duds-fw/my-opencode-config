# Project Structure Instructions

When creating new projects, follow this structure:

## TypeScript/Node.js Projects
```
project/
├── src/
│   ├── index.ts          # Entry point
│   ├── types/            # Type definitions
│   ├── utils/            # Utility functions
│   └── services/         # Business logic
├── tests/
│   ├── unit/             # Unit tests
│   └── integration/      # Integration tests
├── docs/                 # Documentation
├── .github/workflows/    # CI/CD
├── package.json
├── tsconfig.json
├── .eslintrc.js
├── .prettierrc
└── README.md
```

## Best Practices
- Use strict TypeScript configuration
- Implement proper error handling
- Write comprehensive tests
- Document public APIs
- Use conventional commits
- Set up CI/CD early

/** Unit tests run on plain `npm test`; `*.api.test.ts` suites need the emulators (`npm run test:api`). */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      { tsconfig: { module: 'commonjs', strict: true, types: ['jest', 'node'] } },
    ],
  },
};

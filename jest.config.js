/** `npm test` runs the unit suites; `npm run test:api` (API_TESTS=1) runs the `*.api.test.ts` suites, which need the emulators. */
const api = Boolean(process.env.API_TESTS);

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [api ? '**/*.api.test.ts' : '**/*.test.ts'],
  testPathIgnorePatterns: api ? [] : ['\\.api\\.test\\.ts$'],
  // The first calls into a cold emulator take seconds; the 5 s default fails setup hooks.
  testTimeout: api ? 30000 : 5000,
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      { tsconfig: { module: 'commonjs', strict: true, types: ['jest', 'node'] } },
    ],
  },
};

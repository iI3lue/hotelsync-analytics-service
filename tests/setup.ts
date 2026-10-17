/**
 * Entorno de tests: corre ANTES de importar los módulos bajo test.
 * `NODE_ENV=test` evita que index.ts levante el servidor y el dispatcher.
 */
process.env.NODE_ENV = "test";
process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET ?? "analytics-test-secret";

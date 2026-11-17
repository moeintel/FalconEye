import { createAccountFixture } from './account-fixture.mjs';

const port = Number(process.env.FIXTURE_PORT ?? 5001);
const appOrigin = process.argv[2];
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('FIXTURE_PORT must be a valid TCP port.');
}
if (!appOrigin) {
  throw new Error('Pass the allowed application origin as the first argument, for example http://127.0.0.1:5173.');
}

const fixture = await createAccountFixture({
  port,
  appOrigin,
  emailFlowsReady: true,
  adminConfigured: true,
});
console.log(`Isolated account fixture listening at ${fixture.baseUrl}; callback origin is ${appOrigin}.`);
console.log(`Fixture-only confirmation links: ${fixture.baseUrl}/fixture/latest-link`);

const shutdown = async () => {
  await fixture.close();
  process.exit(0);
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

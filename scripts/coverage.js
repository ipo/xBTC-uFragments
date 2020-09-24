const { runCoverage } = require('@openzeppelin/test-environment');

async function main () {
  await runCoverage(
    ['mocks', 'usingtellor/', 'lib/Select.sol'],
    'yarn compile',
    './node_modules/.bin/mocha --exit --timeout 10000 --recursive'.split(' '),
  );
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

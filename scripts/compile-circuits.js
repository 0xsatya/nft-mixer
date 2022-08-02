const util = require('util');
const exec = util.promisify(require('child_process').exec);
const download = require('download');
const fs = require('fs');
const logger = require('js-logger');
const { zKey, wtns, groth16, r1cs } = require('snarkjs');
const { config } = require('../package.json');
const paths = require('../utils/params');

logger.useDefaults();

async function main() {
  const circuitName = paths.circuitName;
  const circuitPath = paths.circuitPath;
  const circuitBuildPath = paths.circuitBuildPath;
  const contractPath = paths.contractPath;
  const circuitInputPath = paths.circuitInputPath;
  const solidityVersion = config.solidity.version;
  const toBuild = true;

  await exec(
    `npx mkdirp ${circuitBuildPath}/build && npx mkdirp ${circuitBuildPath}/output && npx mkdirp ${circuitBuildPath}/solidity`,
  );

  if (!fs.existsSync(circuitPath)) {
    fs.mkdirSync(circuitPath, { recursive: true });
  }

  if (toBuild) {
    if (!fs.existsSync(`${circuitBuildPath}/tau/powersOfTau28_hez_final_15.ptau`)) {
      const url = 'https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau';
      await download(url, `${circuitBuildPath}/tau/`);
    }

    logger.log(
      `circom2 ${circuitPath}/${circuitName}.circom --r1cs --wasm --sym --output ${circuitBuildPath}/build`,
    );

    logger.log('----------- compiling circuit --------');
    await exec(
      `circom2 ${circuitPath}/${circuitName}.circom --r1cs --wasm --sym --output ${circuitBuildPath}/build`,
    );

    logger.log('exporting circuit to json format');
    const circuitJson = await r1cs.exportJson(`${circuitBuildPath}/build/${circuitName}.r1cs`, logger);
    fs.writeFileSync(`${circuitBuildPath}/output/${circuitName}.json`, JSON.stringify(circuitJson), 'utf-8');

    logger.log('-----------zKey-----------');
    await zKey.newZKey(
      `${circuitBuildPath}/build/${circuitName}.r1cs`,
      `${circuitBuildPath}/tau/powersOfTau28_hez_final_15.ptau`,
      `${circuitBuildPath}/build/${circuitName}_0000.zkey`,
      logger,
    );

    logger.log('-----------beacon-----------');
    await zKey.beacon(
      `${circuitBuildPath}/build/${circuitName}_0000.zkey`,
      `${circuitBuildPath}/output/${circuitName}_final.zkey`,
      'Final Beacon',
      '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      10,
      logger,
    );

    logger.log('-----------verification key-----------');
    const verificationKey = await zKey.exportVerificationKey(
      `${circuitBuildPath}/output/${circuitName}_final.zkey`,
      logger,
    );
    // logger.log(verificationKey);

    fs.writeFileSync(
      `${circuitBuildPath}/output/verification_key.json`,
      JSON.stringify(verificationKey),
      'utf-8',
    );

    logger.log('-----------witness-----------');
    await wtns.calculate(
      JSON.parse(fs.readFileSync(`${circuitInputPath}`, 'utf8')),
      `${circuitBuildPath}/build/${circuitName}_js/${circuitName}.wasm`,
      `${circuitBuildPath}/output/${circuitName}.wtns`,
    );

    logger.log('-----------proof & publicSignals-----------');
    const { proof, publicSignals } = await groth16.prove(
      `${circuitBuildPath}/output/${circuitName}_final.zkey`,
      `${circuitBuildPath}/output/${circuitName}.wtns`,
      logger,
    );

    // logger.log(proof);
    // logger.log(publicSignals);

    fs.writeFileSync(`${circuitBuildPath}/output/proof.json`, JSON.stringify(proof), 'utf-8');
    fs.writeFileSync(`${circuitBuildPath}/output/public.json`, JSON.stringify(publicSignals), 'utf-8');
  }

  logger.log('-----------verify proof-----------');
  const verificationResult = await groth16.verify(
    JSON.parse(fs.readFileSync(`${circuitBuildPath}/output/verification_key.json`, 'utf8')),
    JSON.parse(fs.readFileSync(`${circuitBuildPath}/output/public.json`, 'utf8')),
    JSON.parse(fs.readFileSync(`${circuitBuildPath}/output/proof.json`, 'utf8')),
  );

  logger.log(verificationResult);

  let solidityVerifier = await zKey.exportSolidityVerifier(
    `${circuitBuildPath}/output/${circuitName}_final.zkey`,
    {
      groth16: fs.readFileSync('./node_modules/snarkjs/templates/verifier_groth16.sol.ejs', 'utf8'),
    },
    logger,
  );

  solidityVerifier = solidityVerifier.replace(
    /pragma solidity \^\d+\.\d+\.\d+/,
    `pragma solidity ^${solidityVersion}`,
  );

  fs.writeFileSync(`${circuitBuildPath}/solidity/${circuitName}Verifier.sol`, solidityVerifier, 'utf-8');

  fs.writeFileSync(`${contractPath}/Verifier.sol`, solidityVerifier, 'utf-8');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

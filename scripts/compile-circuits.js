const util = require('util');
const exec = util.promisify(require('child_process').exec);
const download = require('download');
const fs = require('fs');
const logger = require('js-logger');
// const rimraf = require("rimraf");
const { zKey, wtns, groth16, r1cs } = require('snarkjs');
const { config } = require('../package.json');

logger.useDefaults();

async function main() {
  const CIRCUIT = 'nftMixer'; //"multiplier2"; //;
  const buildPath = `./circuits/${CIRCUIT}`;
  const PATH = `circuit-build-${CIRCUIT}`;
  const contractPath = './contracts';
  const INPUT = `${CIRCUIT}-input`;
  const solidityVersion = config.solidity.version;
  const toBuild = true;

  await exec(`npx mkdirp ${PATH}/build && npx mkdirp ${PATH}/output && npx mkdirp ${PATH}/solidity`);

  if (!fs.existsSync(buildPath)) {
    fs.mkdirSync(buildPath, { recursive: true });
  }

  if (toBuild) {
    if (!fs.existsSync(`${PATH}/tau/powersOfTau28_hez_final_15.ptau`)) {
      const url = 'https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau';
      await download(url, `${PATH}/tau/`);
    }

    logger.log(`circom2 ${buildPath}/${CIRCUIT}.circom --r1cs --wasm --sym --output ./${PATH}/build`);

    logger.log('----------- compiling circuit --------');
    await exec(`circom2 ${buildPath}/${CIRCUIT}.circom --r1cs --wasm --sym --output ./${PATH}/build`);

    logger.log('exporting circuit to json format');
    const circuitJson = await r1cs.exportJson(`${PATH}/build/${CIRCUIT}.r1cs`, logger);
    fs.writeFileSync(`${PATH}/output/${CIRCUIT}.json`, JSON.stringify(circuitJson), 'utf-8');

    logger.log('-----------zKey-----------');
    await zKey.newZKey(
      `${PATH}/build/${CIRCUIT}.r1cs`,
      `${PATH}/tau/powersOfTau28_hez_final_15.ptau`,
      `${PATH}/build/${CIRCUIT}_0000.zkey`,
      logger,
    );

    logger.log('-----------beacon-----------');
    await zKey.beacon(
      `${PATH}/build/${CIRCUIT}_0000.zkey`,
      `${PATH}/output/${CIRCUIT}_final.zkey`,
      'Final Beacon',
      '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
      10,
      logger,
    );

    logger.log('-----------verification key-----------');
    const verificationKey = await zKey.exportVerificationKey(`${PATH}/output/${CIRCUIT}_final.zkey`, logger);
    // logger.log(verificationKey);

    fs.writeFileSync(`${PATH}/output/verification_key.json`, JSON.stringify(verificationKey), 'utf-8');

    logger.log('-----------witness-----------');
    await wtns.calculate(
      JSON.parse(fs.readFileSync(`${buildPath}/${INPUT}.json`, 'utf8')),
      `${PATH}/build/${CIRCUIT}_js/${CIRCUIT}.wasm`,
      `${PATH}/output/${CIRCUIT}.wtns`,
    );

    logger.log('-----------proof & publicSignals-----------');
    const { proof, publicSignals } = await groth16.prove(
      `${PATH}/output/${CIRCUIT}_final.zkey`,
      `${PATH}/output/${CIRCUIT}.wtns`,
      logger,
    );

    // logger.log(proof);
    // logger.log(publicSignals);

    fs.writeFileSync(`${PATH}/output/proof.json`, JSON.stringify(proof), 'utf-8');
    fs.writeFileSync(`${PATH}/output/public.json`, JSON.stringify(publicSignals), 'utf-8');
  }

  logger.log('-----------verify proof-----------');
  const verificationResult = await groth16.verify(
    JSON.parse(fs.readFileSync(`${PATH}/output/verification_key.json`, 'utf8')),
    JSON.parse(fs.readFileSync(`${PATH}/output/public.json`, 'utf8')),
    JSON.parse(fs.readFileSync(`${PATH}/output/proof.json`, 'utf8')),
  );

  logger.log(verificationResult);

  let solidityVerifier = await zKey.exportSolidityVerifier(
    `${PATH}/output/${CIRCUIT}_final.zkey`,
    {
      groth16: fs.readFileSync('./node_modules/snarkjs/templates/verifier_groth16.sol.ejs', 'utf8'),
    },
    logger,
  );

  solidityVerifier = solidityVerifier.replace(
    /pragma solidity \^\d+\.\d+\.\d+/,
    `pragma solidity ^${solidityVersion}`,
  );

  fs.writeFileSync(`${PATH}/solidity/${CIRCUIT}Verifier.sol`, solidityVerifier, 'utf-8');

  fs.writeFileSync(`${contractPath}/Verifier.sol`, solidityVerifier, 'utf-8');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

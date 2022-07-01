const util = require("util");
const exec = util.promisify(require("child_process").exec);
const download = require("download");
const fs = require("fs");
const logger = require("js-logger");
// const rimraf = require("rimraf");
const { zKey, wtns, groth16 } = require("snarkjs");
const { config } = require("../package.json");

logger.useDefaults();

async function main() {
  const buildPath = "./circuits/multiplier";
  const CIRCUIT = "multiplier";
  const PATH = `circuit-build-${CIRCUIT}`;
  const INPUT = `${CIRCUIT}-input`;
  const solidityVersion = config.solidity.version;

  await exec(
    `npx mkdirp ${PATH}/build && npx mkdirp ${PATH}/keys && npx mkdirp ${PATH}/solidity`
  );

  if (!fs.existsSync(buildPath)) {
    fs.mkdirSync(buildPath, { recursive: true });
  }

  if (!fs.existsSync(`${PATH}/tau/powersOfTau28_hez_final_15.ptau`)) {
    const url =
      "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau";

    await download(url, `${PATH}/tau/`);
  }

  logger.log(
    `circom ${buildPath}/${CIRCUIT}.circom --r1cs --wasm --sym --output ./${PATH}/build`
  );

  logger.log("----------- compiling circuit --------");
  await exec(
    `circom2 ${buildPath}/${CIRCUIT}.circom --r1cs --wasm --sym --output ./${PATH}/build`
  );

  logger.log("-----------zKey-----------");
  await zKey.newZKey(
    `${PATH}/build/${CIRCUIT}.r1cs`,
    `${PATH}/tau/powersOfTau28_hez_final_15.ptau`,
    `${PATH}/keys/${CIRCUIT}_0000.zkey`,
    logger
  );

  logger.log("-----------beacon-----------");
  await zKey.beacon(
    `${PATH}/keys/${CIRCUIT}_0000.zkey`,
    `${PATH}/keys/${CIRCUIT}_final.zkey`,
    "Final Beacon",
    "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
    10,
    logger
  );

  logger.log("-----------verification key-----------");
  const verificationKey = await zKey.exportVerificationKey(
    `${PATH}/keys/${CIRCUIT}_final.zkey`,
    logger
  );
  // logger.log(verificationKey);

  fs.writeFileSync(
    `${PATH}/keys/verification_key.json`,
    JSON.stringify(verificationKey),
    "utf-8"
  );

  logger.log("-----------witness-----------");
  await wtns.calculate(
    JSON.parse(fs.readFileSync(`${buildPath}/${INPUT}.json`, "utf8")),
    `${PATH}/build/${CIRCUIT}_js/${CIRCUIT}.wasm`,
    `${buildPath}/${CIRCUIT}.wtns`
  );

  logger.log("-----------proof-----------");
  const { proof, publicSignals } = await groth16.prove(
    `${PATH}/keys/${CIRCUIT}_final.zkey`,
    `${buildPath}/${CIRCUIT}.wtns`,
    logger
  );

  // logger.log(proof);
  // logger.log(publicSignals);

  fs.writeFileSync(`${buildPath}/proof.json`, JSON.stringify(proof), "utf-8");
  fs.writeFileSync(
    `${buildPath}/public.json`,
    JSON.stringify(publicSignals),
    "utf-8"
  );

  logger.log("-----------verify proof-----------");
  const verificationResult = await groth16.verify(
    JSON.parse(fs.readFileSync(`${PATH}/keys/verification_key.json`, "utf8")),
    JSON.parse(fs.readFileSync(`${buildPath}/public.json`, "utf8")),
    JSON.parse(fs.readFileSync(`${buildPath}/proof.json`, "utf8"))
  );

  logger.log(verificationResult);

  let solidityVerifier = await zKey.exportSolidityVerifier(
    `${PATH}/keys/${CIRCUIT}_final.zkey`,
    {
      groth16: fs.readFileSync(
        "./node_modules/snarkjs/templates/verifier_groth16.sol.ejs",
        "utf8"
      ),
    },
    logger
  );

  solidityVerifier = solidityVerifier.replace(
    /pragma solidity \^\d+\.\d+\.\d+/,
    `pragma solidity ^${solidityVersion}`
  );

  fs.writeFileSync(
    `${PATH}/solidity/${CIRCUIT}Verifier.sol`,
    solidityVerifier,
    "utf-8"
  );

  // fs.renameSync(
  //   `${buildPath}/circuit_js/circuit.wasm`,
  //   `${buildPath}/circuit.wasm`
  // );
  // rimraf.sync(`${buildPath}/circuit_js`);
  // rimraf.sync(`${buildPath}/powersOfTau28_hez_final_14.ptau`);
  // rimraf.sync(`${buildPath}/circuit_0000.zkey`);
  // rimraf.sync(`${buildPath}/circuit.r1cs`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

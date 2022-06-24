const { promisify } = require("util");
const _exec = promisify(require("child_process").exec);
const download = require("download");
const fs = require("fs");
const logger = require("js-logger");
const rimraf = require("rimraf");
const { zKey } = require("snarkjs");
const { config } = require("../package.json");

logger.useDefaults();

async function exec(command) {
  const { stderr, stdout } = await _exec(command);

  if (stderr) {
    throw new Error(stderr);
  }

  logger.info(stdout);
}

async function main() {
  // const buildPath = config.paths.build.snark;
  const buildPath = "./circuits";
  const solidityVersion = config.solidity.version;

  if (!fs.existsSync(buildPath)) {
    fs.mkdirSync(buildPath, { recursive: true });
  }

  if (!fs.existsSync(`${buildPath}/powersOfTau28_hez_final_14.ptau`)) {
    const url =
      "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_14.ptau";

    await download(url, buildPath);
  }
  logger.debug("here");
  await exec(`npm run circom2 --r1cs --wasm ./circuits/circuit.circom`);
  logger.debug("here i'm");
  await zKey.newZKey(
    `${buildPath}/circuit.r1cs`,
    `${buildPath}/powersOfTau28_hez_final_14.ptau`,
    `${buildPath}/circuit_0000.zkey`,
    logger
  );

  await zKey.beacon(
    `${buildPath}/circuit_0000.zkey`,
    `${buildPath}/circuit_final.zkey`,
    "Final Beacon",
    "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
    10,
    logger
  );

  let verifierCode = await zKey.exportSolidityVerifier(
    `${buildPath}/circuit_final.zkey`,
    {
      groth16: fs.readFileSync(
        "./node_modules/snarkjs/templates/verifier_groth16.sol.ejs",
        "utf8"
      ),
    },
    logger
  );
  verifierCode = verifierCode.replace(
    /pragma solidity \^\d+\.\d+\.\d+/,
    `pragma solidity ^${solidityVersion}`
  );

  fs.writeFileSync(
    `${config.paths.contracts}/Verifier.sol`,
    verifierCode,
    "utf-8"
  );

  const verificationKey = await zKey.exportVerificationKey(
    `${buildPath}/circuit_final.zkey`,
    logger
  );
  fs.writeFileSync(
    `${buildPath}/verification_key.json`,
    JSON.stringify(verificationKey),
    "utf-8"
  );

  fs.renameSync(
    `${buildPath}/circuit_js/circuit.wasm`,
    `${buildPath}/circuit.wasm`
  );
  rimraf.sync(`${buildPath}/circuit_js`);
  rimraf.sync(`${buildPath}/powersOfTau28_hez_final_14.ptau`);
  rimraf.sync(`${buildPath}/circuit_0000.zkey`);
  rimraf.sync(`${buildPath}/circuit.r1cs`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

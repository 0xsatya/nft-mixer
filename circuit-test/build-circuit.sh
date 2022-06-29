#!/bin/bash -e
POWERS_OF_TAU=15 # circuit will support max 2^POWERS_OF_TAU constraints  
CIRCUIT=multiplier2
mkdir -p tau
mkdir -p build
mkdir -p keys
mkdir -p solidity

if [ ! -f tau/ptau$POWERS_OF_TAU ]; then
  echo "Downloading powers of tau file"
  curl -L https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_$POWERS_OF_TAU.ptau --create-dirs -o artifacts/circuits/ptau$POWERS_OF_TAU
fi

if [ "$1" == "build" ]; then
  echo "compiling, building circuit and generating keys..."
  # Compile the circuit
  circom circuits/${CIRCUIT}.circom --r1cs --wasm --sym --c -o build
  # circom circuits/${CIRCUIT}.circom --json -o build/circuits
  npx snarkjs r1cs info build/${CIRCUIT}.r1cs
  npx snarkjs r1cs export json build/${CIRCUIT}.r1cs build/${CIRCUIT}.r1cs.json

  echo "----- Generate .zkey file -----"
  # Generate a .zkey file that will contain the proving and verification keys together with all phase 2 contributions
  snarkjs groth16 setup build/${CIRCUIT}.r1cs tau/ptau15 keys/${CIRCUIT}_0000.zkey

  echo "----- Contribute to the phase 2 of the ceremony -----"
  # Contribute to the phase 2 of the ceremony
  snarkjs zkey contribute keys/${CIRCUIT}_0000.zkey keys/${CIRCUIT}_final.zkey --name="1st Contributor Name" -v -e="some random text"

  echo "----- Export the verification key -----"
  # Export the verification key
  snarkjs zkey export verificationkey keys/${CIRCUIT}_final.zkey keys/verification_key.json

fi

# generate witness from input.json file
node build/${CIRCUIT}_js/generate_witness.js build/${CIRCUIT}_js/${CIRCUIT}.wasm circuits/input.json circuits/${CIRCUIT}.wtns

echo "----- Generate zk-proof -----"
# Generate a zk-proof associated to the circuit and the witness. This generates proof.json and public.json
snarkjs groth16 prove keys/${CIRCUIT}_final.zkey circuits/${CIRCUIT}.wtns circuits/proof.json circuits/public.json

echo "----- Verify the proof -----"
# Verify the proof
snarkjs groth16 verify keys/verification_key.json circuits/public.json circuits/proof.json

if [ "$1" == "build" ]; then
  echo "----- Generate Solidity verifier -----"
  # Generate a Solidity verifier that allows verifying proofs on Ethereum blockchain
  snarkjs zkey export solidityverifier keys/${CIRCUIT}_final.zkey solidity/${CIRCUIT}Verifier.sol
  # Update the solidity version in the Solidity verifier
  sed -i '' 's/0.6.11;/0.8.4;/' solidity/${CIRCUIT}Verifier.sol
  # Update the contract name in the Solidity verifier
  sed -i '' "s/contract Verifier/contract ${CIRCUIT}Verifier/" solidity/${CIRCUIT}Verifier.sol

  echo "----- Generate and print parameters of call -----"
  # Generate and print parameters of call
  # snarkjs generatecall | tee parameters.txt
fi

# npx circom -v -r artifacts/circuits/transaction$1.r1cs -w artifacts/circuits/transaction$1.wasm -s artifacts/circuits/transaction$1.sym circuits/transaction$1.circom
# npx snarkjs groth16 setup artifacts/circuits/transaction$1.r1cs artifacts/circuits/ptau$POWERS_OF_TAU artifacts/circuits/tmp_transaction$1.zkey
# echo "qwe" | npx snarkjs zkey contribute artifacts/circuits/tmp_transaction$1.zkey artifacts/circuits/transaction$1.zkey
# npx snarkjs zkey export solidityverifier artifacts/circuits/transaction$1.zkey artifacts/circuits/Verifier$1.sol
# sed -i.bak "s/contract Verifier/contract Verifier${1}/g" artifacts/circuits/Verifier$1.sol
# zkutil setup -c artifacts/circuits/transaction$1.r1cs -p artifacts/circuits/transaction$1.params
# zkutil generate-verifier -p artifacts/circuits/transaction$1.params -v artifacts/circuits/Verifier.sol
# npx snarkjs info -r artifacts/circuits/transaction$1.r1cs

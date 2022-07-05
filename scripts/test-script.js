const snarkjs = require('snarkjs');
const fs = require('fs');

async function main() {
  const input = JSON.parse(fs.readFileSync('circuits/input.json'))
  console.log('input data :', input);
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    'build/multiplier2_js/multiplier2.wasm',
    'keys/multiplier2_final.zkey'
  )
  console.log('Proof: ')
  console.log(JSON.stringify(proof, null, 1))
  console.log('Public Signals: ')
  console.log(JSON.stringify(publicSignals, null, 1))
  
  const vKey = JSON.parse(fs.readFileSync('keys/verification_key.json'))
  const res = await snarkjs.groth16.verify(vKey, publicSignals, proof)
  if (res === true) {
    console.log('Verification OK')
  } else {
    console.log('Invalid proof')
  }
}

main().then(() => process.exit())

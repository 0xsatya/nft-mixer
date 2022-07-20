# NFT Mixer

## How to run circuit
1. run the following command
   $ yarn   //to install dependencies

   // If running below command for the first time, set following param at line 18 of scripts/compile-circuts.js
   // toBuild = true;
   // if toBuild is true, circuit is build and compiled again.
   // if toBuild is false, compiled circuit is used to verify proof, provided all files are available.
   $ yarn build:circuit // it runs scripts/compile-circuits.js file
   
   // below command to deposit the nfttoken with commitment
   $ node ./src/cli.js deposit

## Whats done
1. NFTEscrow contract is implemented.
2. Circuit implemented. Circuit code can be checked at circuits/nftMixer/nftMixer.circom.
3. Js script (scripts/compile-circuits.js) has been implemented which does following
   1. downloads a ptau file (creating afresh takes some time. Before deploying to mainnet, we may use the tornado one or create a new one. It is mandatory for trusted setup in zksnark.) 
   2. build circuit and create r1cs, wasm, js file to use circuits from js file
   3. create json version of r1cs circuit file to be used from js (frontend)
   4. create a proving and verification key file
   5. creates witness (signals) file from input.json (contains all the input params - pvt and public) as .wtns file.
   6. create proof and publicSignal json file. These files contain data to proof some data.
   7. verifies proof using publicSignal and proof file. (proof working fine for js files ie frontend)
4. Upgraded cli.js to use latest libraries to do the following:-
   1. DEPOSIT NFT - create a commitment and deposit a NFT token.
   2. WITHDRAW NFT - Pending....!!!


## Proof of concept
1. compiling circuit, circuit-build-nftMixer folder is created. This folder contains all the files which may used to create proof and verify proof.
2.  once proof and publicSignal file is created..the same can be used to verify if user has some pvt data.
3.  If any param of the output/public.json file is changed..the proof will not work. Which shows the correct working of zksnark.

## Important terms and usecses
1. pedersan hash - 
2. posedein hash - 
   
## Main issues/tasks pending for resolution
1. 


## Instructions for using hardhat projects.
# Advanced Sample Hardhat Project

This project demonstrates an advanced Hardhat use case, integrating other tools commonly used alongside Hardhat in the ecosystem.

The project comes with a sample contract, a test for that contract, a sample script that deploys that contract, and an example of a task implementation, which simply lists the available accounts. It also comes with a variety of other tools, preconfigured to work with the project code.

Try running some of the following tasks:

```shell
npx hardhat accounts
npx hardhat compile
npx hardhat clean
npx hardhat test
npx hardhat node
npx hardhat help
REPORT_GAS=true npx hardhat test
npx hardhat coverage
npx hardhat run scripts/deploy.js
node scripts/deploy.js
npx eslint '**/*.js'
npx eslint '**/*.js' --fix
npx prettier '**/*.{json,sol,md}' --check
npx prettier '**/*.{json,sol,md}' --write
npx solhint 'contracts/**/*.sol'
npx solhint 'contracts/**/*.sol' --fix
```

# Etherscan verification

To try out Etherscan verification, you first need to deploy a contract to an Ethereum network that's supported by Etherscan, such as Ropsten.

In this project, copy the .env.example file to a file named .env, and then edit it to fill in the details. Enter your Etherscan API key, your Ropsten node URL (eg from Alchemy) and the private key of the account which will send the deployment transaction. With a valid .env file in place.. first deploy your contract:

```shell
hardhat run --network ropsten scripts/deploy.js
```

Then, copy the deployment address and paste it in to replace `DEPLOYED_CONTRACT_ADDRESS` in this command:

```shell
npx hardhat verify --network ropsten DEPLOYED_CONTRACT_ADDRESS "Hello, Hardhat!"
```

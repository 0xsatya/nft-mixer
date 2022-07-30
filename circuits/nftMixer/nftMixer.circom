pragma circom 2.0.3;

//-------------Merkle Tree--------------
include "../../node_modules/circomlib/circuits/bitify.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/switcher.circom";

// Verifies that merkle proof is correct for given merkle root and a leaf
// pathIndices bits is an array of 0/1 selectors telling whether given pathElement is on the left or right side of merkle path
template MerkleProof(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal output root;

    component switcher[levels];
    component hasher[levels];

    for (var i = 0; i < levels; i++) {
        switcher[i] = Switcher();
        switcher[i].L <== i == 0 ? leaf : hasher[i - 1].out;
        switcher[i].R <== pathElements[i];
        switcher[i].sel <== pathIndices[i];

        hasher[i] = Poseidon(2);
        hasher[i].inputs[0] <== switcher[i].outL;
        hasher[i].inputs[1] <== switcher[i].outR;
    }

    root <== hasher[levels - 1].out;
    log(root);
}
//---------END--------------

template CommitmentHasher() {
    signal input nullifier;
    signal input secret;
    signal input nftAddress;
    signal input tokenId;
    signal output commitment;
    signal output nullifierHash;

    component commitmentHasher = Poseidon(4);
    component nullifierHasher = Poseidon(3);

    nullifierHasher.inputs[0] <== nullifier;
    nullifierHasher.inputs[1] <== nftAddress;
    nullifierHasher.inputs[2] <== tokenId;

    commitmentHasher.inputs[0] <== nullifier;
    commitmentHasher.inputs[1] <== nftAddress;
    commitmentHasher.inputs[2] <== tokenId;
    commitmentHasher.inputs[3] <== secret;

    commitment <== commitmentHasher.out;
    nullifierHash <== nullifierHasher.out;
    log(commitment);
    log(nullifierHash);
}

// Verifies that commitment that corresponds to given secret and nullifier is included in the merkle tree of deposits
template Withdraw(levels) {
    signal input root;
    signal input nullifierHash;
    signal input nftAddress;
    signal input tokenId;
    signal input recipient; // not taking part in any computations
    signal input relayer;  // not taking part in any computations
    signal input fee;      // not taking part in any computations
    signal input refund;   // not taking part in any computations
    signal input nullifier; // private
    signal input secret; // private
    signal input pathElements[levels]; // private
    signal input pathIndices[levels]; // private

    component hasher = CommitmentHasher();
    hasher.nullifier <== nullifier;
    hasher.secret <== secret;
    hasher.nftAddress <== nftAddress;
    hasher.tokenId <== tokenId;
    hasher.nullifierHash === nullifierHash;

    component tree = MerkleProof(levels);
    tree.leaf <== hasher.commitment;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }
    tree.root === root;

    // Add hidden signals to make sure that tampering with recipient or fee will invalidate the snark proof
    // Most likely it is not required, but it's better to stay on the safe side and it only takes 2 constraints
    // Squares are used to prevent optimizer from removing those constraints
    signal recipientSquare;
    signal feeSquare;
    signal relayerSquare;
    signal refundSquare;

    recipientSquare <== recipient * recipient;
    feeSquare <== fee * fee;
    relayerSquare <== relayer * relayer;
    refundSquare <== refund * refund;

}

component main {public [root , nullifierHash]} = Withdraw(5);
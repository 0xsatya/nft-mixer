pragma circom 2.0.3;

include "../../node_modules/circomlib/circuits/bitify.circom";
include "../../node_modules/circomlib/circuits/pedersen.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";

//-------------Merkle Tree--------------
include "../../node_modules/circomlib/circuits/mimcsponge.circom";

// Computes MiMC([left, right])
template HashLeftRight() {
    signal input left;
    signal input right;
    signal output hash;

    component hasher = MiMCSponge(2, 220, 1);
    hasher.ins[0] <== left;
    hasher.ins[1] <== right;
    hasher.k <== 0;
    hash <== hasher.outs[0];
}

// if s == 0 returns [in[0], in[1]]
// if s == 1 returns [in[1], in[0]]
template DualMux() {
    signal input in[2];
    signal input s;
    signal output out[2];

    s * (1 - s) === 0;
    out[0] <== (in[1] - in[0])*s + in[0];
    out[1] <== (in[0] - in[1])*s + in[1];
}

// Verifies that merkle proof is correct for given merkle root and a leaf
// pathIndices input is an array of 0/1 selectors telling whether given pathElement is on the left or right side of merkle path
template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    component selectors[levels];
    component hashers[levels];

    for (var i = 0; i < levels; i++) {
        selectors[i] = DualMux();
        selectors[i].in[0] <== i == 0 ? leaf : hashers[i - 1].hash;
        selectors[i].in[1] <== pathElements[i];
        selectors[i].s <== pathIndices[i];

        hashers[i] = HashLeftRight();
        hashers[i].left <== selectors[i].out[0];
        hashers[i].right <== selectors[i].out[1];
    }

    root === hashers[levels - 1].hash;
}
//---------END--------------

// computes Pedersen(nullifier + secret)

template CommitmentHasher() {
    signal input nullifier;
    signal input secret;
    signal input nftAddress;
    signal input tokenId;
    signal output commitment;
    signal output nullifierHash;

    component commitmentHasher = Pedersen(496);
    component nullifierHasher = Pedersen(372);
    component nullifierBits = Num2Bits(124);
    component nftAdrBits = Num2Bits(124);
    component tokenIdBits = Num2Bits(124);
    component secretBits = Num2Bits(124);
    nullifierBits.in <== nullifier;
    nftAdrBits.in <== nftAddress;
    tokenIdBits.in <== tokenId;
    secretBits.in <== secret;
    for (var i = 0; i < 124; i++) {
        nullifierHasher.in[i] <== nullifierBits.out[i];
        nullifierHasher.in[i + 124] <== nftAdrBits.out[i];
        nullifierHasher.in[i + 248] <== tokenIdBits.out[i];
        commitmentHasher.in[i] <== nullifierBits.out[i];
        commitmentHasher.in[i + 124] <== nftAdrBits.out[i];
        commitmentHasher.in[i + 248] <== tokenIdBits.out[i];
        commitmentHasher.in[i + 372] <== secretBits.out[i];
    }

    commitment <== commitmentHasher.out[0];
    nullifierHash <== nullifierHasher.out[0];
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

    log(hasher.nullifier);
    log(hasher.secret);
    log(hasher.nftAddress);
    log(hasher.nullifierHash);

    component tree = MerkleTreeChecker(levels);
    tree.leaf <== hasher.commitment;
    tree.root <== root;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    component nullPosHash3 = Poseidon(3);
    nullPosHash3.inputs[0] <== hasher.nullifierHash;
    nullPosHash3.inputs[1] <== nftAddress;
    nullPosHash3.inputs[2] <== tokenId;

    log(nullPosHash3.out);

    // Add hidden signals to make sure that tampering with recipient or fee will invalidate the snark proof
    // Most likely it is not required, but it's better to stay on the safe side and it only takes 2 constraints
    // Squares are used to prevent optimizer from removing those constraints
    signal recipientSquare;
    signal feeSquare;
    signal relayerSquare;
    signal refundSquare;
    signal nullPosHash3Square;
    recipientSquare <== recipient * recipient;
    feeSquare <== fee * fee;
    relayerSquare <== relayer * relayer;
    refundSquare <== refund * refund;
    nullPosHash3Square <== nullPosHash3.out * nullPosHash3.out;
}

component main {public [root , nullifierHash, tokenId, nftAddress]} = Withdraw(5);
// component main {public [root , nullifierHash]} = Withdraw(1);

/* INPUT = {
    "root": "16296659098868975318610681305956664471851509760143234002578597065987613223531",
    "
    -
    ": "11172816448033496386538185216595920505082224450690847824246062112016923332446",
    "recipient": "222",
    "relayer": "333",
    "fee": "100",
    "refund": "20",
    "nullifier": "444",
    "nftAddress": "3444465656",
    "tokenId": "100",
    "secret": "555",
    "pathElements": [0],
    "pathIndices": [0]
} */
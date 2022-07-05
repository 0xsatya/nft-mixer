pragma circom 2.0.3;

include "circomlib/circuits/pedersen.circom";

//-------------Merkle Tree--------------
include "circomlib/circuits/mimcsponge.circom";

template CommitmentHasher() {
    signal input nullifier;
    signal input secret;
    signal input nftAddress;
    signal input tokenId;
    signal output commitment;
    signal output nullifierHash;

    component commitmentHasher = Pedersen(496);
    component nullifierHasher = Pedersen(248);
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
        commitmentHasher.in[i] <== nullifierBits.out[i];
        commitmentHasher.in[i + 124] <== nftAdrBits.out[i];
        commitmentHasher.in[i + 248] <== tokenIdBits.out[i];
        commitmentHasher.in[i + 372] <== secretBits.out[i];
    }

    commitment <== commitmentHasher.out[0];
    nullifierHash <== nullifierHasher.out[0];

    log(nullifierHash);
}

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
    log(hash);
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
    signal leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal input nullifier; // private
    signal input secret; // private
    signal input nftAddress;
    signal input tokenId;

    component hasher = CommitmentHasher();
    hasher.nullifier <== nullifier;
    hasher.secret <== secret;
    hasher.nftAddress <== nftAddress;
    hasher.tokenId <== tokenId;

    leaf <== hasher.commitment;

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

    log(hashers[levels - 1].hash);

    root === hashers[levels - 1].hash;

    log(root);
}
//---------END--------------

component main { public [ root ] } = MerkleTreeChecker(1);

/* INPUT = {
    "root": "16296659098868975318610681305956664471851509760143234002578597065987613223531",
    "nullifier": "444",
    "nftAddress": "3444465656",
    "tokenId": "100",
    "secret": "555",
    "pathElements": [0],
    "pathIndices": [0]
} */
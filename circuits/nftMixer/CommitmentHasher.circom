pragma circom 2.0.3;

// include "../node_modules/circomlib/circuits/pedersen.circom";
include "circomlib/circuits/pedersen.circom";

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
}

component main = CommitmentHasher();

/* INPUT = {
    "nullifier": "444",
    "nftAddress": "3444465656",
    "tokenId": "100",
    "secret": "555"
} */
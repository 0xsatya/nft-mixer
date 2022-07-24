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

component main {public [root , nullifierHash, tokenId, nftAddress]} = Withdraw(5);


/* INPUT = {
   "root": "15422450860642959401994522592643672225183994426690238024212785312315337756947",
  "nullifierHash": "5072522042668011353578334305078070707741586918795301843874436756501142793719",
  "recipient": "0",
  "relayer": "0",
  "fee": "0",
  "refund": "0",
  "nftAddress": "403582410511719803810147802798835900462401609230",
  "tokenId": "1",
  "nullifier": "210733339782241298390483527077649642502448230129729672540867244084969133628",
  "secret": "356439268849017672378176255596374543069591350800777706073974238001278413862",
  "pathElements": [
    "1370249852395389490700185797340442620366735189419093909046557908847258978065",
    "20122204553284712344786466658994391541833426160960221854991496635886370527620",
    "12959104310435437682912257788821373460597012131383568128950576651488139660892",
    "21568003495674585404769563812603668309721450590662683958500410089914896533118",
    "2720731473839415670069385258043208861626446995757708692017668074540554339558"
  ],
  "pathIndices": [0, 0, 0, 0, 0]
} */
const CryptoJS = require("crypto-js");
const _ = require('lodash');
const hexToBinary = require("hex-to-binary");
const Wallet = require("./wallet");
const Transaction = require("./transaction");
const MemPool = require("./mempool");

const { getBalance, getPublicFromWallet, createTx, getPrivateFromWallet } = Wallet;

const { createCoinbaseTx, proccessTxs } = Transaction;

const { addToMemPool, getMempool, updateMempool } = MemPool;


const BLOCK_GENERATION_INTERVAL = 10;
const DIFFICULTY_ADJUSMENT_INTERVAL = 10;

class Block {
  constructor(index, hash, previousHash, timestamp, data, difficulty, nonce) {
    this.index = index;
    this.hash = hash;
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.data = data;
    this.difficulty = difficulty;
    this.nonce = nonce;
  }
}

const genesisTx = {
  txIns: [{ signature: "", txOutId: "", txOutIndex: 0 }],
  txOuts: [
    {
      address:
      "04f69ce04cc9496a72edb501756a9d0274f9a1a139ec39cff2e413dd7f1cdb46ebc4cb0c6f87954c58eff59b876267596abdd5fcbf31f8f9b2119c5654e37d3242",
      amount: 50
    }
  ],
  id: "ae3f6ea737e64059af3b3685cd43294f3595aa4be10e7074f73887370aeeb2c9"
  // id: "c937d7297410bfadedffe28349fa547ae01be8177af52dda0eae896fabe56212"
};

const genesisBlock = new Block(
  0,
  'f60c6c0ac370b1e22c5f8d420c0f2083bd5593b4dfd9c0ed2b73d381d90e41a8',
  "",
  1542614386,
  [genesisTx],
  0,
  0
);

let blockchain = [genesisBlock];

let uTxOuts = proccessTxs(blockchain[0].data, [], 0);

const getNewestBlock = () => blockchain[blockchain.length - 1];

const getTimestamp = () => Math.round(new Date().getTime() / 1000);

const getBlockChain = () => blockchain;

const createHash = (index, previousHash, timestamp, data, difficulty, nonce) =>
  CryptoJS.SHA256(
    index + previousHash + timestamp + JSON.stringify(data) + difficulty + nonce
  ).toString();

const createNewBlock = () => {
  const coinbaseTx = createCoinbaseTx(getPublicFromWallet(), getNewestBlock().index + 1);

  const blockData = [coinbaseTx].concat(getMempool());
  return createNewRowBlock(blockData);
};

  const createNewRowBlock = data => {
    const previousBlock = getNewestBlock();
    const newBlockIndex = previousBlock.index + 1;
    const newTimestamp = getTimestamp();
    const difficulty = findDifficulty();
    const newBlock = findBlock(
      newBlockIndex,
      previousBlock.hash,
      newTimestamp,
      data,
      difficulty
    );
    addBlockToChain(newBlock);
    require("./p2p").broadcastNewBlock();
    // P2P.broadcastNewBlock();
    return newBlock;
  };

const findDifficulty = () => {
  const newestBlock = getNewestBlock();
  if(newestBlock.index % DIFFICULTY_ADJUSMENT_INTERVAL === 0 && newestBlock.index !== 0) {
    return calculateNewDifficulty(newestBlock, getBlockChain());
  } else {
    return newestBlock.difficulty;
  }
};

const calculateNewDifficulty = (newestBlock, blockchain) => {
  const lastCalulateBlck = blockchain[blockchain.length - DIFFICULTY_ADJUSMENT_INTERVAL];
  const timeExpected = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSMENT_INTERVAL;
  const timeTaken = newestBlock.timestamp - lastCalulateBlck.timestamp;
  if(timeTaken < timeExpected / 2) {
    return lastCalulateBlck.difficulty + 1;
  } else if(timeTaken > timeExpected * 2) {
    return lastCalulateBlck.difficulty - 1;
  } else {
    return lastCalulateBlck.difficulty;
  }
};

const findBlock = (index, previousHash, timestamp, data, difficulty) => {
  let nonce = 0;
  while(true) {
    console.log("Current nonce :" , nonce);
    const hash = createHash(
      index,
      previousHash,
      timestamp,
      data,
      difficulty,
      nonce
    );
    if(hashMatchesDifficulty(hash, difficulty)) {
      return new Block(
        index,
        hash,
        previousHash,
        timestamp,
        data,
        difficulty,
        nonce
      );
    }
      nonce++;
  }
};

const hashMatchesDifficulty = (hash, difficulty = 0) => {
  const hashInBinary = hexToBinary(hash);
  const requiredZeros = "0".repeat(difficulty);
  console.log("trying difficulty: ", difficulty, " with hash: " , hash);

  return hashInBinary.startsWith(requiredZeros);
}

const getBlocksHash = block =>
      createHash(block.index, block.previousHash, block.timestamp, block.data, block.difficulty, block.nonce);

const isTimeStampValid = (newBlock, oldBlock) => {
  return (oldBlock.timestamp - 60 < newBlock.timestamp &&
     newBlock.timestamp - 60 < getTimestamp()
   );
}

const isBlockValid = (candidateBlock, latestBlock) => {
  if(!isBlockStructorValid(candidateBlock)){
    console.log('The new candidateBlock structure is not vaild');
    return false;
  }
  else if(latestBlock.index + 1 !== candidateBlock.index) {
    console.log('The candidate block does not have a valid index');
    return false;
  } else if(latestBlock.hash !== candidateBlock.previousHash) {
    console.log('The previousHash of the candidate block is not the hash of the lastet block');
    return false;
  } else if(getBlocksHash(candidateBlock) !== candidateBlock.hash) {
    console.log('The hash of the block is invalid');
    return false;
  } else if(!isTimeStampValid(candidateBlock, latestBlock)) {
    console.log('The timeStamp of this bloock is doddy');
    return false;
  }
  return true;
};

const isBlockStructorValid = block => {
  return (
    typeof block.index === "number" &&
    typeof block.hash === "string" &&
    typeof block.previousHash === "string" &&
    typeof block.timestamp === "number" &&
    typeof block.data === "object"
  );
};

const isChainValid = candidateChain => {
  const isGenesisValid = block => {
    return JSON.stringify(block) === JSON.stringify(genesisBlock);
  };
  if(!isGenesisValid(candidateChain[0])) {
    console.log("the candidateChain's genesisBlock is not the same as our genesisBlock");
    return null;
  }

  let foreifhUTxOuts = [];

  for(let i = 0; i < candidateChain.length; i++) {
    const currentBlock = candidateChain[i];
    if(i !== 0 && !isBlockValid(currentBlock, candidateChain[i - 1])) {
      return null;
    }

    foreifhUTxOuts = proccessTxs(currentBlock.data, foreifhUTxOuts, currentBlock.index);

    if(foreifhUTxOuts === null) {
      return null;
    }

  }
  return true;
};

const sumDifficulty = anyBlockChain =>
 anyBlockChain
 .map(block => block.difficulty)
 .map(difficulty => Math.pow(2, difficulty))
 .reduce((a, b) => a + b);

const replaceChain = candidateChain => {
  const foreignUTxOuts = isChainValid(candidateChain);
  const validChain = foreignUTxOuts !== null;

  if(validChain && sumDifficulty(candidateChain) > sumDifficulty(getBlockChain())) {
    blockchain = candidateChain;
    uTxOuts = foreignUTxOuts;
    updateMempool(uTxOuts);
    require("./p2p").broadcastNewBlock();
    return true;
  } else {
    return false;
  }
};

const addBlockToChain = candidateBlock => {
  if(isBlockValid(candidateBlock, getNewestBlock())) {
    const proccessedTxs = proccessTxs(candidateBlock.data, uTxOuts, candidateBlock.index);

    if(proccessedTxs === null) {
      console.log("Could not proccess txs");
      return false;
    } else {
      blockchain.push(candidateBlock);
      uTxOuts = proccessedTxs;
      updateMempool(uTxOuts);
      return true;
    }

    return true;
  } else {
    return false;
  }
};

const getUTxOutList = () => _.cloneDeep(uTxOuts);

const getAccountBalance = () => getBalance(getPublicFromWallet(), uTxOuts);

const sendTx = (address, amount) => {
  const tx = createTx(
          address,
          amount,
          getPrivateFromWallet(),
          getUTxOutList(),
          getMempool()
        );

      addToMemPool(tx, getUTxOutList());
      require("./p2p").broadcastMempool();
      return tx;
};

const handleIncomingTx = tx => {
  addToMemPool(tx, getUTxOutList());
};

module.exports = {
  getBlockChain,
  createNewBlock,
  getNewestBlock,
  isBlockStructorValid,
  addBlockToChain,
  replaceChain,
  getAccountBalance,
  sendTx,
  handleIncomingTx,
  getUTxOutList
};

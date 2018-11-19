const CryptoJS = require("crypto-js");
const hexToBinary = require("hex-to-binary");

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

const genesisBlock = new Block(
  0,
  '889C2E5365A91A9E03EC656E1AE87BC73D3BB4AC8CD1F5092D9497A21605F48B',
  null,
  1542270887.582,
  "this is the genesis~!",
  0,
  0
);

let blockchain = [genesisBlock];

const getNewestBlock = () => blockchain[blockchain.length - 1];

const getTimestamp = () => Math.round(new Date().getTime() / 1000);

const getBlockChain = () => blockchain;

const createHash = (index, previousHash, timestamp, data, difficulty, nonce) =>
  CryptoJS.SHA256(
    index + previousHash + timestamp + JSON.stringify(data) + difficulty + nonce
  ).toString();

const findDifficulty = (blockchain) => {
  const newstBlock = blockchain[blockchain.length - 1];
  if(newstBlock.index % DIFFICULTY_ADJUSMENT_INTERVAL === 0 && newstBlock.index !== 0) {

  } else {
    return newstBlock.difficulty;
  }
}

const createNewBlock = data => {
  const previousBlock = getNewestBlock();
  const newBlockIndex = previousBlock.index + 1;
  const newTimestamp = getTimestamp();
  const difficulty = findDifficulty(getBlockChain());
  const newBlock = findBlock(
    newBlockIndex,
    previousBlock.hash,
    newTimestamp,
    data,
    difficulty
  );
  addBlockToChain(newBlock);
  require("./p2p").broadcastNewBlock();
  return newBlock;
};

const findBlock = (index, previousHash, timestamp, data, difficulty) => {
  let nonce = 0;
  while(true) {
    console.log("Current nonce :" , nonce);
    const hash = createHash(
      index, previousHash, timestamp, data, difficulty, nonce
    );
    if(hashMatchesDifficulty(hash, difficulty)) {
      return new Block(
        index, hash, previousHash, timestamp, data, difficulty, nonce
      );
    }
      nonce++;

  }
};

const hashMatchesDifficulty = (hash, difficulty) => {
  const hashInBinary = hexToBinary(hash);
  const requiredZeros = "0".repeat(difficulty);
  console.log("trying difficulty: ", difficulty, " with hash: " , hash);

  return hashInBinary.startsWith(requiredZeros);
}

const getBlocksHash = block =>
      createHash(block.index, block.previousHash, block.timestamp, block.data, block.difficulty, block.nonce);

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
  }
  return true;
};

const isBlockStructorValid = block => {
  return (
    typeof block.index === "number" &&
    typeof block.hash === "string" &&
    typeof block.previousHash === "string" &&
    typeof block.timestamp === "number"
     // && typeof block.data === "object"
  );
};

const isChainValid = candidateChain => {
  const isGenesisValid = block => {
    return JSON.stringify(block) === JSON.stringify(genesisBlock);
  };
  if(!isGenesisValid(candidateChain[0])) {
    console.log("the candidateChain's genesisBlock is not the same as our genesisBlock");
    return false;
  }
  for(let i = 1; i < candidateChain.length; i++) {
    if(!isBlockValid(candidateChain[i], candidateChain[i - 1])) {
      return false;
    }
  }
  return true;
};

const replaceChain = candidateChain => {
  if(isChainValid(candidateChain) && candidateChain.length > getBlockChain().length) {
    blockchain = candidateChain;
    return true;
  } else {
    return false;
  }
};

const addBlockToChain = candidateBlock => {
  if(isBlockValid(candidateBlock, getNewestBlock())) {
    getBlockChain().push(candidateBlock);
    return true;
  } else {
    return false;
  }
};

module.exports = {
  getBlockChain,
  createNewBlock,
  getNewestBlock,
  isBlockStructorValid,
  addBlockToChain,
  replaceChain
};

const CryptoJS = require("crypto-js");

class Block {
  constructor(index, hash, previousHash, timestamp, data) {
    this.index = index;
    this.hash = hash;
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.data = data;
  }
}

const genesisBlock = new Block(
  0,
  '889C2E5365A91A9E03EC656E1AE87BC73D3BB4AC8CD1F5092D9497A21605F48B',
  null,
  1542270887.582,
  "this is the genesis~!"
);

let blockchain = [genesisBlock];

const getLastBlock = () => blockchain[blockchain.length -1];

const getTimestamp = () => new Date().getTime() / 1000;

const createHash =  (index, previousHash, timestamp, data) =>
  CryptoJS.SHA256(index + previousHash + timestamp + JSON.stringify(data)).toString();

const createNewBlock = data => {
  const previousBlock = getLastBlock();
  const newBlockIndex = previousBlock.index + 1;
  const newTimestamp = getTimestamp();

  const newHash = createHash(newBlockIndex, previousBlock.hash, newTimestamp, data);

  const newBlock = new Block(newBlockIndex, newHash, previousBlock.hash, newTimestamp, data);

  return newBlock;
};

const getBlocksHash = (block) => createHash(block.index, block.previousHash, block.timestamp, block.data);

const isNewBlockValid = (candidateBlock, latestBlock) => {
  if(latestBlock.index + 1 !== candidateBlock.index) {
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

const isNewStructorValid = (block) => {
  return (
    typeof block.index === 'number' &&
    typeof block.hash === 'string' &&
    typeof block.previousHash === 'string' &&
    typeof block.timestamp === 'number' &&
    typeof block.data === 'data'
  );
};

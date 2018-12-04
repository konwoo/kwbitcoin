const elliptic = require("elliptic");
const _ = require("lodash");
const path = require("path");
const fs = require("fs");
const Transactions = require("./transaction");

const { getPublicKey, getTxId, signTxin, TxIn, TxOut, Transaction } = Transactions;

const ec = new elliptic.ec("secp256k1");

const privateKeyLocation = path.join(__dirname, "privateKey");

const generatePrivateKey = () => {
  const keyPair = ec.genKeyPair();
  const privateKey = keyPair.getPrivate();

  return privateKey.toString(16);
};

const getPrivateFromWallet = () => {
  const buffer = fs.readFileSync(privateKeyLocation, "utf8");
  return buffer.toString();
};

const getPublicFromWallet = () => {
  const privateKey = getPrivateFromWallet();
  const key = ec.keyFromPrivate(privateKey, "hex");

  return key.getPublic().encode("hex");
};

const getBalance = (address, uTxOuts) => {
  return _(uTxOuts)
  .filter(uTxO => uTxO.address === address)
  .map(uTxO => uTxO.amount)
  .sum();
};


const initWallet = () => {
  if(fs.existsSync(privateKeyLocation)) {
    return;
  }
  const newPrivateKey = generatePrivateKey();

  fs.writeFileSync(privateKeyLocation, newPrivateKey);
};

const findAmountInUTxOuts = (amountNeeded, myUTxOuts) => {
  let currentAmount = 0;
  const incluededUTxOuts = [];
  for(const myUTxOut of myUTxOuts){
    incluededUTxOuts.push(myUTxOut);
    currentAmount = currentAmount + myUTxOut.amount;
    if(currentAmount >= amountNeeded) {
      const leftOverAmount = currentAmount - amountNeeded;
      return { incluededUTxOuts, leftOverAmount };
    }
  }
  throw Error("Not enough founds");
  return false;
};

const createTxOut = (receiverAddress, myAddress, amount, leftOverAmount) => {
  const receiverTxOut = new TxOut(receiverAddress, amount);

  if(leftOverAmount === 0) {
    return [receiverTxOut];
  } else {
    const leftOverTxOut = new TxOut(myAddress, leftOverAmount);
    return [receiverTxOut, leftOverTxOut];
  }
};

const filterUTxOutsFromMempool = (uTxOutList, mempool) => {
  const txIns = _(mempool)
  .map(tx => tx.txIns)
  .flatten()
  .value();

  const removables = [];

  for(const uTxOut of uTxOutList) {
    const txIn = _.find(
      txIns, txIn =>
       txIn.txOutIndex === uTxOut.txOutIndex && txIn.txOutId === uTxOut.txOutId
     );
     if(txIn !== undefined) {
       removables.push(uTxOut);
     }
  }

  return _.without(uTxOutList, ...removables);
};

const createTx = (receiverAddress, amount, privateKey, uTxOutList, memPool) => {
  const myAddress = getPublicKey(privateKey);
  const myUTxOuts = uTxOutList.filter(uTxO => uTxO.address === myAddress);

  const filterUTXOuts = filterUTxOutsFromMempool(myUTxOuts, memPool);

  const { incluededUTxOuts, leftOverAmount } = findAmountInUTxOuts(amount, filterUTXOuts);

  const toUnsignedTxIns = uTxOut => {
    const txIn = new TxIn();
    txIn.txOutId = uTxOut.txOutId;
    txIn.txOutIndex = uTxOut.txOutIndex;
    return txIn;
  };

  const unSignedTxIns = incluededUTxOuts.map(toUnsignedTxIns);

  const tx = new Transaction();

  tx.txIns = unSignedTxIns;
  tx.txOuts = createTxOut(receiverAddress, myAddress, amount, leftOverAmount);

  tx.id = getTxId(tx);

  tx.txIns = tx.txIns.map((txIn, index) => {
    txIn.signature = signTxin(tx, index, privateKey, uTxOutList);
    return txIn;
  });

  return tx;
};

module.exports = {
  initWallet,
  getBalance,
  getPublicFromWallet,
  createTx,
  getPrivateFromWallet
};

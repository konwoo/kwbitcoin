const WebSockets = require("ws");
const Blockchain = require("./blockchain");

const { getNewestBlock, isBlockStructorValid, addBlockToChain, replaceChain, getBlockChain } = Blockchain;

const sockets = [];

// Message Types
const GET_LATEST = "GET_LATEST";
const GET_ALL = "GET_ALL";
const BLOCKCHAIN_RESPONSE = "BLOCKCHAIN_RESPONSE";

// Message Creator
const getLatest = () => {
  return {
    type: GET_LATEST,
    data: null
  };
};

const getAll = () => {
  return {
    type: GET_ALL,
    data: null
  };
};

const blockchainResponse = data => {
  return {
    type: BLOCKCHAIN_RESPONSE,
    data: data
  };
};

const getSocket = () => sockets;

const startP2pServer = server => {
  const wsServer = new WebSockets.Server({ server });
  wsServer.on("connection", ws => {
    initSocketConnection(ws);
  });
  console.log(`KWCoin P2P Server runniung`);
};

const initSocketConnection = ws => {
  sockets.push();
  handleSocketMessage(ws);
  handleSocketError(ws);
  sendMessage(ws, getLatest());
};

const parseData = data => {
  try {
    return JSON.parse(data);
  } catch (e) {
    console.log(e);
    return null;
  }
};

const handleSocketMessage = ws => {
  ws.on("message", data => {
    const message = parseData(data);
    if(message === null){
      return;
    }
    console.log(message);
    switch(message.type) {
      case GET_LATEST:
        sendMessage(ws, responseLatest());
        break;
      case GET_ALL:
        sendMessage(ws, responseAll());
        break;
      case BLOCKCHAIN_RESPONSE:
        const receiveBlocks = message.data
        if(receiveBlocks === null) {
          break;
        }
        handleBlockChainResponse(receiveBlocks);
        break;
    }
  });
};

const handleBlockChainResponse = receiveBlocks => {
  if(receiveBlocks.length === 0) {
    console.log("receiveBlocks have a length of 0...");
    return;
  }

  const latestBlockReceived = receiveBlocks[receiveBlocks.length - 1];
  if(!isBlockStructorValid(latestBlockReceived)) {
    console.log("the block structure of the block received is not valid");
    return;
  }

  const newstBlock = getNewestBlock();
  if(latestBlockReceived.index > newstBlock.index) {
      if(newstBlock.hash === latestBlockReceived.previousHash) {
        if(addBlockToChain(latestBlockReceived)) {
          console.log("HERE!!! HERE IS BROADCASTNEWBLOCK!");
          broadcastNewBlock();
        }
      } else if (receiveBlocks.length === 1) {
        sendMessageAll(getAll());
      } else {
        replaceChain(receiveBlocks);
      }
  }
};

const sendMessage = (ws, message) => ws.send(JSON.stringify(message));

const sendMessageAll = (message) =>
  sockets.forEach(ws => sendMessage(ws, message));

const responseLatest = () => blockchainResponse([getNewestBlock()]);

const responseAll = () => blockchainResponse(getBlockChain());

const broadcastNewBlock = () => sendMessageAll(responseLatest());

const handleSocketError = ws => {
  const closeSocketConnection = ws => {
    ws.close();
    sockets.splice(sockets.indexOf(ws), 1);
  };
  ws.on("close", () => closeSocketConnection(ws));
  ws.on("error", () => closeSocketConnection(ws));
};

const connectToPeers = newPeer => {
  const ws = new WebSockets(newPeer);
  ws.on("open", () => {
    initSocketConnection(ws);
  });
  ws.on("error", () => console.log("connection failed"));
  ws.on("close", () => console.log("connection failed"));
};

module.exports = {
  startP2pServer,
  connectToPeers,
  broadcastNewBlock
};

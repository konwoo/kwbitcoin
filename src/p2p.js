const WebSockets = require("ws");
const Blockchain = require("./blockchain");
const MemPool = require("./mempool");

const {
        getNewestBlock,
        isBlockStructorValid,
        addBlockToChain,
        replaceChain,
        getBlockChain,
        handleIncomingTx
       } = Blockchain;

const { getMempool } = MemPool;

const sockets = [];

// Message Types
const GET_LATEST = "GET_LATEST";
const GET_ALL = "GET_ALL";
const BLOCKCHAIN_RESPONSE = "BLOCKCHAIN_RESPONSE";
const REQUEST_MEMPOOL = "REQUEST_MEMPOOL";
const MEMPOOL_RESPONSE = "MEMPOOL_RESPONSE"

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

const getAllMempool = () => {
  return {
    type: REQUEST_MEMPOOL,
    data: null
  };
};

const mempoolResponse = data => {
  return {
    type: MEMPOOL_RESPONSE,
    data: data
  };
};

const getSocket = () => sockets;

const startP2pServer = server => {
  const wsServer = new WebSockets.Server({ server });
  wsServer.on("connection", ws => {
    initSocketConnection(ws);
  });
  wsServer.on("error", ws => {
    console.log("error");
  });
  console.log(`KWCoin P2P Server runniung`);
};

const initSocketConnection = ws => {
  sockets.push(ws);
  handleSocketMessages(ws);
  handleSocketError(ws);
  sendMessage(ws, getLatest());
  setTimeout(() => {
    sendMessageAll(ws, getAllMempool());
  }, 1000);
  setInterval(() => {
    if (sockets.includes(ws)) {
      sendMessage(ws, "");
    }
  }, 1000);
};

const parseData = data => {
  try {
    return JSON.parse(data);
  } catch (e) {
    console.log(e);
    return null;
  }
};

const handleSocketMessages = ws => {
  ws.on("message", data => {
    const message = parseData(data);
    if(message === null){
      console.log("WS MESSAGE IS NULL");
      return;
    }
    switch(message.type) {
      case GET_LATEST:
        console.log("GET_LATEST");
        sendMessage(ws, responseLatest());
        break;
      case GET_ALL:
        console.log("GET_ALL");
        sendMessage(ws, responseAll());
        break;
      case BLOCKCHAIN_RESPONSE:
        console.log("BLOCKCHAIN_RESPONSE");
        const receivedBlocks = message.data;
        if(receivedBlocks === null) {
          break;
        }
        handleBlockchainResponse(receivedBlocks);
        break;
      case REQUEST_MEMPOOL:
        sendMessage(ws, returnMempool());
        break;
      case MEMPOOL_RESPONSE:
        const receivedTxs = message.data;
        if(receivedTxs === null) {
          return ;
        }
        receivedTxs.forEach(tx => {
          try {
            handleIncomingTx(tx);
            broadcastMempool();
          } catch (e) {
            console.log(e);
          }
        });
        break;
    }
  });
};

const handleBlockchainResponse = receivedBlocks => {
  if (receivedBlocks.length === 0) {
    console.log("Received blocks have a length of 0");
    return;
  }

  const latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
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
      } else if (receivedBlocks.length === 1) {
        console.log("receivedBlocks have length 1");
        sendMessageAll(getAll());
      } else {
        console.log("This Function name is replaceChain");
        replaceChain(receivedBlocks);
      }
  }
};

const returnMempool = () => mempoolResponse(getMempool());

const sendMessage = (ws, message) => ws.send(JSON.stringify(message));

const sendMessageAll = message =>
  sockets.forEach(ws => sendMessage(ws, message));

const responseLatest = () => blockchainResponse([getNewestBlock()]);

const responseAll = () => blockchainResponse(getBlockChain());

const broadcastNewBlock = () => sendMessageAll(responseLatest());

const broadcastMempool = () => sendMessageAll(returnMempool());

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
  broadcastNewBlock,
  broadcastMempool
};

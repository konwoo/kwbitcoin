const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const BlockChain = require("./blockchain");
const P2P = require("./p2p");

const { getBlockChain, createNewBlock } = BlockChain;
const { startP2pServer, connectToPeers } = P2P;

// Do HTTP_PORT 4000, do not forget abouy typing 'export HTTP_PORT=4000' in your console..
const PORT = process.env.HTTP_PORT || 3000;

const app = express();

app.use(bodyParser.json());
app.use(morgan("combined"));


app.get("/blocks", (req, res) => {
  res.send(getBlockChain());
});

app.post("/blocks", (req, res) => {
  const { body: { data } } = req;
  const newBlock = createNewBlock(data);

  res.send(newBlock);
});

app.post("/peers", (req, res) => {
  const { body: { peer } } = req;
  connectToPeers(peer);
  res.send()
})

const server = app.listen(PORT, () => console.log(`KWCoin Server running on, ${PORT} 🤔`));

startP2pServer(server);

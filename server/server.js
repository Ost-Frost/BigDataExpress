// Loads the configuration from config.env to process.env
require('dotenv').config({ path: './config.env' });

const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const cors = require('cors');
const path = require('path');

process.env.TZ = 'Europe/Berline' 

let credentials = null;
try {
  const privateKey = fs.readFileSync('/var/opt/ssl/ole-reimers.key');
  const certificate = fs.readFileSync('/var/opt/ssl/ole-reimers.crt');
  credentials = {key: privateKey, cert: certificate};
} catch (e) {}

const PORT = process.env.PORT || 80;
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// release
const releaseDates = [
  new Date(2024, 8, 27, 0, 0, 0),
  new Date(2024, 9, 4, 0, 0, 0),
  new Date(2024, 9, 11, 0, 0, 0),
  new Date(2024, 9, 18, 0, 0, 0),
  new Date(2024, 9, 25, 0, 0, 0),
]

app.get('/release/maxCardIndex', (req, res) => {
  const today = new Date();

  for (let releaseDateIndex = 0; releaseDateIndex < releaseDates.length; releaseDateIndex++) {
    if (today < releaseDates[releaseDateIndex]) {
      res.send({
        maxCardIndex: releaseDateIndex - 1
      });
      return;
    }
  }
  res.send({
    maxCardIndex: releaseDates.length - 1
  });
});

app.get('/release/nextReleaseDate', (req, res) => {
  const today = new Date();

  for (let releaseDateIndex = 0; releaseDateIndex < releaseDates.length; releaseDateIndex++) {
    if (today < releaseDates[releaseDateIndex]) {
      res.send({
        releaseDate: releaseDates[releaseDateIndex].toUTCString()
      });
      return;
    }
  }
  res.send({
    releaseDate: false
  });
});

for (let releaseDateIndex = 0; releaseDateIndex < releaseDates.length; releaseDateIndex++) {
  const today = new Date();

  if (today >= releaseDates[releaseDateIndex]) {
    app.get('/release/' + releaseDateIndex, (req, res) => {
      res.sendFile(path.join(__dirname, 'release', releaseDateIndex + '.json'));
    });

    app.get('/releaseAssets/' + releaseDateIndex + '.png', (req, res) => {
      res.sendFile(path.join(__dirname, 'release', 'releaseAssets', releaseDateIndex + '.png'));
    });
  }
}

// angular
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const httpServer = http.createServer(app);
httpServer.listen(80);

if (credentials) {
  const httpsServer = https.createServer(credentials, app);
  httpsServer.listen(443);
}

// Loads the configuration from config.env to process.env
require('dotenv').config({ path: './config.env' });

const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const nodemailer = require("nodemailer");
const pug = require('pug');

process.env.TZ = 'Europe/Berlin' 
let password = null;
let compileOrderTemplate = null;
let compilePresentTemplate = null;
let credentials = null;

try {
  const privateKey = fs.readFileSync('/var/opt/ssl/ole-reimers.key');
  const certificate = fs.readFileSync('/var/opt/ssl/ole-reimers.crt');
  credentials = {key: privateKey, cert: certificate};
} catch (e) {}

try {
  password = fs.readFileSync('/var/opt/mail/password.key');
  //password = fs.readFileSync('C:\\var\\opt\\mail\\password.key');
  compileOrderTemplate = pug.compileFile(path.join(__dirname, 'templates', 'order.pug'));
  compilePresentTemplate = pug.compileFile(path.join(__dirname, 'templates', 'present.pug'));
} catch(e) {}

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
  app.get('/release/' + releaseDateIndex, (req, res) => {
    const today = new Date();
    if (today >= releaseDates[releaseDateIndex]) {
      res.sendFile(path.join(__dirname, 'release', releaseDateIndex + '.json'));
    } else {
      res.sendStatus(404);
    }
  });

  app.get('/releaseAssets/' + releaseDateIndex + '.png', (req, res) => {
    const today = new Date();
    if (today >= releaseDates[releaseDateIndex]) {
      res.sendFile(path.join(__dirname, 'release', 'releaseAssets', releaseDateIndex + '.png'));
    } else {
      res.sendStatus(404);
    }
  });
}

// mails

function validateEmail(email) {
  if (typeof email != "string") return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

app.post('/order', (req, res) => {
  if (!password) { res.sendStatus(500); return; }
  if (!compileOrderTemplate) { res.sendStatus(500); return; }
  if (!compilePresentTemplate) { res.sendStatus(500); return; }

  data = req.body;

  if (data.type !== "present" && data.type !== "order") {
    res.status(400).json({
      message: "Bitte verwende einen gültigen Auftragstypen"
    });
    return;
  }
  if (!validateEmail(data.email)) {
    res.status(400).json({
      message: "Bitte gib eine gültige E-Mail Adresse ein."
    });
    return;
  }

  if (typeof data.price != "number" || typeof data.amount != "number" || typeof data.name != "string" || typeof data.message != "string") {
    res.status(400).json({
      message: "Bitte gib gültige Werte ein."
    });
    return;
  }

  const transporter = nodemailer.createTransport({
    port: 587,
    host: "smtp.ionos.de",
    auth: {
      user: "shop@ole-reimers.de",
      pass: password
    }
  });

  let message = "";

  if (data.type === "present") {
    const mailHtml = compilePresentTemplate(data);

    message = {
      from: 'Ole Reimers Shop <shop@ole-reimers.de>',
      to: data.email,
      bcc: "ole.reimers@gmx.de",
      subject: "Geschenkbestätigung Ole Reimers Shop",
      html:  mailHtml
    };
  } else {
    const mailHtml = compileOrderTemplate(data);

    message = {
      from: "Ole Reimers Shop <shop@ole-reimers.de>",
      to: data.email,
      bcc: "ole.reimers@gmx.de",
      subject: "Bestellbestätigung Ole Reimers Shop",
      html:  mailHtml
    };
  }
  

  transporter.verify(function (error, success) {
    if (error) {
      res.sendStatus(500);
      return;
    } else {
      transporter.sendMail(message);
      res.sendStatus(201);
      return;
    }
  });
});

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

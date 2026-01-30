
const express = require("express");
const app = express();
const cors = require("cors");
const fs = require("fs");
const mongoose = require("mongoose");


app.use(cors());
app.use(express.json());


// ------------------ STATS FILE ------------------

function readStats() {
  return JSON.parse(fs.readFileSync("data.json"));
}

function writeStats(data) {
  fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
}


// ------------------ BAD FEEDBACK FILE ------------------

function readBadFeedback() {
  return JSON.parse(fs.readFileSync("badFeedback.json"));
}

function writeBadFeedback(data) {
  fs.writeFileSync("badFeedback.json", JSON.stringify(data, null, 2));
}


// ------------------ FEEDBACK API (MONTH-WISE) ------------------

app.post("/api/feedback", async (req, res) => {

  const { type } = req.body;

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;

  let stats = await Stats.findOne({ month: monthKey });

  if (!stats) {
    stats = new Stats({
      month: monthKey,
      total: 0,
      positive: 0,
      negative: 0
    });
  }

  stats.total++;

  if (type === "positive") {
    stats.positive++;
  } else {
    stats.negative++;
  }

  await stats.save();

  res.json({ success: true });
});



// ------------------ STATS API (CURRENT MONTH DEFAULT) ------------------

app.get("/api/stats", async (req, res) => {

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;

  const month = req.query.month || currentMonth;

  const stats = await Stats.findOne({ month });

  res.json(stats || {
    total: 0,
    positive: 0,
    negative: 0
  });

});



// ------------------ SAVE BAD FEEDBACK ------------------

app.post("/api/bad-feedback", async (req, res) => {

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;

  const feedback = new BadFeedback({
    name: req.body.name,
    email: req.body.email,
    message: req.body.message,
    month: monthKey,
    date: new Date()
  });

  await feedback.save();

  res.json({ success: true });
});



// ------------------ GET BAD FEEDBACK ------------------

app.get("/api/bad-feedback", (req, res) => {

  let list = readBadFeedback();
  const month = req.query.month;

  // If month filter present
  if (month) {
    list = list.filter(item => item.month === month);
  }

  res.json(list);

});



// ------------------ SERVER ------------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});



//db

mongoose.connect("mongodb+srv://reviewbooster:Dhoni1234@reviewbooster.bprbbl3.mongodb.net/reviewbooster")
.then(() => console.log("MongoDB Connected Successfully"))
.catch(err => console.log(err));
//schemas


const statsSchema = new mongoose.Schema({
  month: String,
  total: Number,
  positive: Number,
  negative: Number
});

const Stats = mongoose.model("Stats", statsSchema);



const badFeedbackSchema = new mongoose.Schema({
  name: String,
  email: String,
  message: String,
  month: String,
  date: Date
});

const BadFeedback = mongoose.model("BadFeedback", badFeedbackSchema);
=======
const express = require("express");
const app = express();
const cors = require("cors");
const fs = require("fs");

app.use(cors());
app.use(express.json());


// ------------------ STATS FILE ------------------

function readStats() {
  return JSON.parse(fs.readFileSync("data.json"));
}

function writeStats(data) {
  fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
}


// ------------------ BAD FEEDBACK FILE ------------------

function readBadFeedback() {
  return JSON.parse(fs.readFileSync("badFeedback.json"));
}

function writeBadFeedback(data) {
  fs.writeFileSync("badFeedback.json", JSON.stringify(data, null, 2));
}


// ------------------ FEEDBACK API (MONTH-WISE) ------------------

app.post("/api/feedback", (req, res) => {

  const { type } = req.body;

  let stats = readStats();

  const now = new Date();

  // Month Key Example: 2026-1
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;

  // Create month if not exists
  if (!stats[monthKey]) {
    stats[monthKey] = {
      total: 0,
      positive: 0,
      negative: 0
    };
  }

  // Update counters
  stats[monthKey].total++;

  if (type === "positive") {
    stats[monthKey].positive++;
  } else {
    stats[monthKey].negative++;
  }

  writeStats(stats);

  res.json({ success: true });
});


// ------------------ STATS API (CURRENT MONTH DEFAULT) ------------------

app.get("/api/stats", (req, res) => {

  let stats = readStats();

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;

  // If month param exists → use it
  const month = req.query.month || currentMonth;

  res.json(stats[month] || {
    total: 0,
    positive: 0,
    negative: 0
  });

});


// ------------------ SAVE BAD FEEDBACK ------------------

app.post("/api/bad-feedback", (req, res) => {

  let list = readBadFeedback();

const now = new Date();
const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;

list.push({
  name: req.body.name,
  email: req.body.email,
  message: req.body.message,
  date: new Date(),
  month: monthKey
});


  writeBadFeedback(list);

  res.json({ success: true });

});


// ------------------ GET BAD FEEDBACK ------------------

app.get("/api/bad-feedback", (req, res) => {

  let list = readBadFeedback();
  const month = req.query.month;

  // If month filter present
  if (month) {
    list = list.filter(item => item.month === month);
  }

  res.json(list);

});



// ------------------ SERVER ------------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});


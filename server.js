const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");

app.use(cors());
app.use(express.json());

/* =======================
   MongoDB Connection
======================= */

mongoose
  .connect(
    "mongodb+srv://reviewbooster:Dhoni1234@reviewbooster.bprbbl3.mongodb.net/reviewbooster"
  )
  .then(() => console.log("MongoDB Connected Successfully"))
  .catch(err => console.log(err));

/* =======================
   Schemas & Models
======================= */

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

/* =======================
   Routes
======================= */

// Health check (optional but good)
app.get("/", (req, res) => {
  res.send("Review Booster API Running 🚀");
});

// -------- SAVE GOOD / BAD CLICK --------
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

// -------- GET MONTH STATS --------
app.get("/api/stats", async (req, res) => {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;
  const month = req.query.month || defaultMonth;

  const stats = await Stats.findOne({ month });

  res.json(
    stats || {
      total: 0,
      positive: 0,
      negative: 0
    }
  );
});

// -------- SAVE BAD FEEDBACK --------
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

// -------- GET BAD FEEDBACK (MONTH WISE) --------
app.get("/api/bad-feedback", async (req, res) => {
  const month = req.query.month;

  let data;

  if (month) {
    data = await BadFeedback.find({ month }).sort({ date: -1 });
  } else {
    data = await BadFeedback.find().sort({ date: -1 });
  }

  res.json(data);
});

/* =======================
   Server Start
======================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

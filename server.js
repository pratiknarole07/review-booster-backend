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
  businessId: String,
  month: String,
  total: Number,
  positive: Number,
  negative: Number
});


const Stats = mongoose.model("Stats", statsSchema);

const badFeedbackSchema = new mongoose.Schema({
  businessId: String,
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

  const { type, businessId } = req.body;

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth()+1}`;

  let stats = await Stats.findOne({ businessId, month: monthKey });

  if (!stats) {
    stats = new Stats({
      businessId,
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

  const { businessId, month } = req.query;

  const stats = await Stats.findOne({ businessId, month });

  res.json(stats || {
    total: 0,
    positive: 0,
    negative: 0
  });

});

// -------- GET BAD FEEDBACK (MONTH WISE) --------
app.post("/api/bad-feedback", async (req, res) => {

  const { businessId, name, email, message } = req.body;

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth()+1}`;

  const feedback = new BadFeedback({
    businessId,
    name,
    email,
    message,
    month: monthKey,
    date: new Date()
  });

  await feedback.save();

  res.json({ success: true });

});

//fetch bad feedback


app.post("/api/bad-feedback", async (req, res) => {

  const { businessId, name, email, message } = req.body;

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth()+1}`;

  const feedback = new BadFeedback({
    businessId,
    name,
    email,
    message,
    month: monthKey,
    date: new Date()
  });

  await feedback.save();

  res.json({ success: true });

});


/* =======================
   Server Start
======================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});


const businessSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  businessId: String,
  googleReviewLink: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Business = mongoose.model("Business", businessSchema);


app.post("/api/login", async (req, res) => {

  const { email, password } = req.body;

  const business = await Business.findOne({ email, password });

  if (!business) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  res.json({
    success: true,
    businessId: business.businessId,
    businessName: business.name,
    googleReviewLink: business.googleReviewLink
  });

});



app.post("/api/create-business", async (req, res) => {

  const { name, email, password, googleReviewLink } = req.body;

  const businessId = "biz_" + Date.now();

  const business = new Business({
    name,
    email,
    password,
    businessId,
    googleReviewLink
  });

  await business.save();

  res.json({
    success: true,
    businessId
  });

});

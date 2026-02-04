const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const axios = require("axios");

app.use(cors());
app.use(express.json());

/* =======================
 MongoDB Connection
======================= */

mongoose.connect(
 "mongodb+srv://reviewbooster:Dhoni1234@reviewbooster.bprbbl3.mongodb.net/reviewbooster"
)
.then(() => console.log("MongoDB Connected Successfully"))
.catch(err => console.log(err));


/* =======================
 Schemas
======================= */

// -------- Business (Clients) --------

const businessSchema = new mongoose.Schema({
 name: String,
 email: String,
 password: String,
 businessId: String,
 googleReviewLink: String,
 googleReviewCount: { type:Number, default:0 },
 createdAt: {
   type: Date,
   default: Date.now
 }
});

const Business = mongoose.model("Business", businessSchema);


// -------- Monthly Stats --------

const statsSchema = new mongoose.Schema({
 businessId: String,
 month: String,
 total: { type:Number, default:0 },     // WhatsApp Sent
 positive: { type:Number, default:0 },  // Google Reviews
 negative: { type:Number, default:0 }   // Bad Feedback
});

const Stats = mongoose.model("Stats", statsSchema);


// -------- Bad Feedback --------

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
 Health Check
======================= */

app.get("/", (req,res)=>{
 res.send("Review Booster API Running 🚀");
});


/* =======================
 CREATE BUSINESS (ADMIN)
======================= */

app.post("/api/create-business", async (req, res) => {

 try {

   const { name, email, password, googleReviewLink } = req.body;

   if (!name || !email || !password || !googleReviewLink) {
     return res.status(400).json({ success:false });
   }

   const exist = await Business.findOne({ email });

   if (exist) {
     return res.json({ success:false, message:"Already exists" });
   }

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

 } catch (err) {
   console.log(err);
   res.status(500).json({ success:false });
 }

});


/* =======================
 LOGIN
======================= */

app.post("/api/login", async (req, res) => {

 try {

   const { email, password } = req.body;

   const business = await Business.findOne({ email, password });

   if (!business) {
     return res.json({ success:false });
   }

   res.json({
     success:true,
     businessId: business.businessId,
     businessName: business.name,
     googleReviewLink: business.googleReviewLink
   });

 } catch(err){
   res.status(500).json({ success:false });
 }

});


/* =======================
 GET BUSINESS (PUBLIC)
======================= */

app.get("/api/get-business/:id", async (req, res) => {

 const business = await Business.findOne({
   businessId: req.params.id
 });

 if(!business){
   return res.status(404).json({ error: "Business not found" });
 }

 res.json({
   googleReviewLink: business.googleReviewLink
 });

});


/* =======================
 INCREASE TOTAL (WhatsApp Sent)
======================= */

app.post("/api/increase-total", async (req,res)=>{

 const { businessId } = req.body;

 const now = new Date();
 const monthKey = `${now.getFullYear()}-${now.getMonth()+1}`;

 let stats = await Stats.findOne({ businessId, month: monthKey });

 if(!stats){
   stats = new Stats({
     businessId,
     month: monthKey
   });
 }

 stats.total++;

 await stats.save();

 res.json({ success:true });

});


/* =======================
 SAVE BAD FEEDBACK
======================= */

app.post("/api/bad-feedback", async (req,res)=>{

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


 // Update Monthly Stats

 let stats = await Stats.findOne({ businessId, month: monthKey });

 if(!stats){
   stats = new Stats({
     businessId,
     month: monthKey
   });
 }

 stats.total++;
 stats.negative++;

 await stats.save();

 res.json({ success:true });

});


/* =======================
 GET BAD FEEDBACK
======================= */

app.get("/api/bad-feedback", async (req,res)=>{

 const { businessId, month } = req.query;

 const list = await BadFeedback.find({
   businessId,
   month
 }).sort({ date:-1 });

 res.json(list);

});


/* =======================
 GOOGLE REVIEW SYNC (APIFY)
======================= */

app.post("/api/sync-google-reviews", async (req,res)=>{

 try{

   const { businessId } = req.body;

   const APIFY_URL =
    "https://api.apify.com/v2/datasets/MlpncVBqr6RE8ubW9/items?clean=true";

   const response = await axios.get(APIFY_URL);

   const data = response.data;

   if(!data || data.length === 0){
     return res.json({ success:false });
   }

   const googleCount = data[0].reviewsCount;

   // Update Business table
   await Business.updateOne(
     { businessId },
     { googleReviewCount: googleCount }
   );

   // Monthly stats update
   const now = new Date();
   const monthKey = `${now.getFullYear()}-${now.getMonth()+1}`;

   let stats = await Stats.findOne({ businessId, month: monthKey });

   if(!stats){
     stats = new Stats({
       businessId,
       month: monthKey
     });
   }

   stats.positive = googleCount;

   await stats.save();

   res.json({
     success:true,
     googleReviewCount: googleCount
   });

 }catch(err){

   console.log("Apify Error:", err.message);

   res.status(500).json({ success:false });

 }

});


/* =======================
 GET STATS
======================= */

app.get("/api/stats", async (req,res)=>{

 const { businessId, month } = req.query;

 const stats = await Stats.findOne({ businessId, month });

 res.json(stats || {
   total:0,
   positive:0,
   negative:0
 });

});


/* =======================
 SERVER START
======================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
 console.log("Server running on port", PORT);
});

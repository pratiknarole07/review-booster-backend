const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");

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
     return res.status(400).json({ 
       success: false, 
       message: "All fields required" 
     });
   }

   const exist = await Business.findOne({ email });

   if (exist) {
     return res.json({ 
       success: false, 
       message: "Business already exists" 
     });
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

   console.error("Create business error:", err);

   res.status(500).json({
     success: false,
     error: err.message
   });

 }

});


/* =======================
 LOGIN API
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

   console.error(err);
   res.status(500).json({ success:false });

 }

});


/* =======================
 SAVE GOOD/BAD CLICK
======================= */

app.post("/api/feedback", async (req,res)=>{

 const { type, businessId } = req.body;

 const now = new Date();
 const monthKey = `${now.getFullYear()}-${now.getMonth()+1}`;

 let stats = await Stats.findOne({ businessId, month: monthKey });

 if(!stats){
   stats = new Stats({
     businessId,
     month: monthKey,
     total:0,
     positive:0,
     negative:0
   });
 }

 stats.total++;

 if(type==="positive"){
   stats.positive++;
 } else {
   stats.negative++;
 }

 await stats.save();

 res.json({ success:true });

});


app.get("/api/bad-feedback", async (req, res) => {

  const { businessId, month } = req.query;

  const data = await BadFeedback.find({
    businessId,
    month
  }).sort({ date: -1 });

  res.json(data);

});


/* =======================
 GET STATS (MONTH WISE)
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

 res.json({ success:true });

});


/* =======================
 GET BAD FEEDBACK (MONTH)
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
 Server Start
======================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
 console.log("Server running on port", PORT);
});

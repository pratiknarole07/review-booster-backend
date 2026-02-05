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

// ===== Business =====
const businessSchema = new mongoose.Schema({
 name:String,
 email:String,
 password:String,
 businessId:String,

 googleReviewLink:String,

 // ⭐ NEW FIELDS
 apifyDatasetId:String,
 placeId:String,

 googleReviewCount:{ type:Number, default:0 },
 createdAt:{ type:Date, default:Date.now }
});


const Business = mongoose.model("Business", businessSchema);


// ===== Monthly Stats =====

const statsSchema = new mongoose.Schema({
 businessId:String,
 month:String,
 total:{ type:Number, default:0 },     
 positive:{ type:Number, default:0 },  
 negative:{ type:Number, default:0 }   
});

const Stats = mongoose.model("Stats", statsSchema);


// ===== Bad Feedback =====

const badFeedbackSchema = new mongoose.Schema({
 businessId:String,
 name:String,
 email:String,
 message:String,
 month:String,
 date:Date
});

const BadFeedback = mongoose.model("BadFeedback", badFeedbackSchema);


/* =======================
 Health Check
======================= */

app.get("/", (req,res)=>{
 res.send("Review Booster API Running 🚀");
});


/* =======================
 Create Business
======================= */

app.post("/api/create-business", async (req,res)=>{

 const { name,email,password,googleReviewLink } = req.body;

 const exist = await Business.findOne({ email });
 if(exist) return res.json({ success:false });

 const businessId = "biz_" + Date.now();

 await Business.create({
  name,email,password,googleReviewLink,businessId
 });

 res.json({ success:true, businessId });

});


/* =======================
 Login
======================= */

app.post("/api/login", async (req,res)=>{

 const { email,password } = req.body;

 const business = await Business.findOne({ email,password });

 if(!business) return res.json({ success:false });

 res.json({
  success:true,
  businessId:business.businessId,
  businessName:business.name,
  googleReviewLink:business.googleReviewLink
 });

});


/* =======================
 Public Business
======================= */

app.get("/api/get-business/:id", async (req,res)=>{

 const business = await Business.findOne({
  businessId:req.params.id
 });

 if(!business) return res.json({ success:false });

 res.json({
  googleReviewLink:business.googleReviewLink
 });

});


/* =======================
 Increase WhatsApp Total
======================= */

app.post("/api/increase-total", async (req,res)=>{

 const { businessId } = req.body;

 const now = new Date();
 const monthKey = `${now.getFullYear()}-${now.getMonth()+1}`;

 let stats = await Stats.findOne({ businessId, month:monthKey });

 if(!stats){
  stats = new Stats({ businessId, month:monthKey });
 }

 stats.total++;

 await stats.save();

 res.json({ success:true });

});


/* =======================
 Save Bad Feedback
======================= */

app.post("/api/bad-feedback", async (req,res)=>{

 const { businessId,name,email,message } = req.body;

 const now = new Date();
 const monthKey = `${now.getFullYear()}-${now.getMonth()+1}`;

 await BadFeedback.create({
  businessId,name,email,message,
  month:monthKey,
  date:new Date()
 });

 let stats = await Stats.findOne({ businessId, month:monthKey });

 if(!stats){
  stats = new Stats({ businessId, month:monthKey });
 }

 stats.total++;
 stats.negative++;

 await stats.save();

 res.json({ success:true });

});


/* =======================
 Get Bad Feedback
======================= */

app.get("/api/bad-feedback", async (req,res)=>{

 const { businessId,month } = req.query;

 const list = await BadFeedback.find({
  businessId,month
 }).sort({ date:-1 });

 res.json(list);

});


/* =======================
 Sync Google Reviews (MONTHLY)
======================= */
app.post("/api/sync-google-reviews", async (req,res)=>{

 try{

  const { businessId } = req.body;

  // get business
  const business = await Business.findOne({ businessId });

  if(!business || !business.apifyDatasetId){
    return res.json({ success:false, msg:"Dataset not set" });
  }

  const APIFY_URL =
   `https://api.apify.com/v2/datasets/${business.apifyDatasetId}/items?clean=true`;

  const response = await axios.get(APIFY_URL);
  const data = response.data;

  if(!data || data.length===0){
    return res.json({ success:false });
  }

  // total google reviews
  const liveTotal = data[0].reviewsCount;

  // monthly calc
  const now = new Date();
  const currentMonth = now.getMonth()+1;
  const currentYear = now.getFullYear();

  let monthlyCount = 0;

  data.forEach(r=>{
   const dateValue = r.publishedAtDate || r.reviewDate;
   if(!dateValue) return;

   const d = new Date(dateValue);

   if(
    d.getMonth()+1 === currentMonth &&
    d.getFullYear() === currentYear
   ){
    monthlyCount++;
   }
  });

  // save live total
  await Business.updateOne(
   { businessId },
   { googleReviewCount: liveTotal }
  );

  const monthKey = `${currentYear}-${currentMonth}`;

  let stats = await Stats.findOne({ businessId, month:monthKey });

  if(!stats){
   stats = new Stats({ businessId, month:monthKey });
  }

  stats.positive = monthlyCount;
  await stats.save();

  res.json({
   success:true,
   liveTotal,
   monthlyCount
  });

 }
 catch(err){
  console.log(err);
  res.status(500).json({ success:false });
 }

});




/* =======================
 Recalculate Any Month (ADMIN TOOL)
======================= */

app.post("/api/recalculate-month", async (req,res)=>{

 try{

  const { businessId, year, month } = req.body;

  const APIFY_URL =
   "https://api.apify.com/v2/datasets/MlpncVBqr6RE8ubW9/items?clean=true";

  const response = await axios.get(APIFY_URL);

  const businessData = response.data[0];

  const reviews = businessData.reviews;

  let count = 0;

  reviews.forEach(r => {

    if(!r.publishedAtDate) return;

    const d = new Date(r.publishedAtDate);

    if(
      d.getFullYear() === year &&
      (d.getMonth()+1) === month
    ){
      count++;
    }

  });

  const monthKey = `${year}-${month}`;

  let stats = await Stats.findOne({ businessId, month:monthKey });

  if(!stats){
    stats = new Stats({ businessId, month:monthKey });
  }

  stats.positive = count;

  await stats.save();

  res.json({
    success:true,
    fixedMonth: monthKey,
    correctedCount: count
  });

 }
 catch(err){
  console.log(err);
  res.status(500).json({ success:false });
 }

});

/* =======================
 Get Dashboard Stats
======================= */

app.get("/api/stats", async (req,res)=>{

 const { businessId,month } = req.query;

 const stats = await Stats.findOne({ businessId,month });

 res.json(stats || {
  total:0,
  positive:0,
  negative:0
 });

});


/* =======================
 Server Start
======================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
 console.log("Server running on port",PORT);
});





const cron = require("node-cron");

cron.schedule("0 * * * *", async ()=>{

 console.log("Auto syncing all clients...");

 const businesses = await Business.find();

 for(const biz of businesses){

   if(!biz.apifyDatasetId) continue;

   try{

    const url =
    `https://api.apify.com/v2/datasets/${biz.apifyDatasetId}/items?clean=true`;

    const response = await axios.get(url);
    const data = response.data;

    if(!data || data.length===0) continue;

    const liveTotal = data[0].reviewsCount;

    const now = new Date();
    const m = now.getMonth()+1;
    const y = now.getFullYear();

    let monthly = 0;

    data.forEach(r=>{
      const dt = new Date(r.publishedAtDate || r.reviewDate);
      if(dt.getMonth()+1===m && dt.getFullYear()===y){
        monthly++;
      }
    });

    const monthKey = `${y}-${m}`;

    let stats = await Stats.findOne({
      businessId: biz.businessId,
      month: monthKey
    });

    if(!stats){
      stats = new Stats({
        businessId: biz.businessId,
        month: monthKey
      });
    }

    stats.positive = monthly;
    await stats.save();

    await Business.updateOne(
      { businessId: biz.businessId },
      { googleReviewCount: liveTotal }
    );

   }catch(e){
     console.log("Sync error for",biz.name);
   }

 }

 console.log("All clients synced");

});

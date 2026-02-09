const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const axios = require("axios");
const cron = require("node-cron");

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
 apifyDatasetId:String,
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

// ===== LEVEL 2 Review Requests =====
const reviewRequestSchema = new mongoose.Schema({
 businessId:String,
 customerName:String,
 sentTime:Date,
 status:{ type:String, default:"waiting" },
 matchedAt:Date
});
const ReviewRequest = mongoose.model("ReviewRequest", reviewRequestSchema);

/* =======================
 Health
======================= */
app.get("/", (req,res)=>{
 res.send("Review Booster Running 🚀");
});

/* =======================
 Create Business
======================= */
app.post("/api/create-business", async (req,res)=>{

 const {name,email,password,googleReviewLink,apifyDatasetId} = req.body;

 const exist = await Business.findOne({ email });
 if(exist) return res.json({ success:false });

 const businessId = "biz_" + Date.now();

 await Business.create({
  name,email,password,googleReviewLink,apifyDatasetId,businessId
 });

 res.json({ success:true,businessId });

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
 Save Positive Name (LEVEL 2)
======================= */
app.post("/api/save-review-request", async(req,res)=>{

 const { businessId, customerName } = req.body;

 await ReviewRequest.create({
  businessId,
  customerName: customerName.toLowerCase(),
  sentTime:new Date(),
  status:"waiting"
 });

 res.json({ success:true });
});

/* =======================
 Increase WhatsApp Total
======================= */
app.post("/api/increase-total", async (req,res)=>{

 const { businessId } = req.body;
 const now = new Date();
 const monthKey = `${now.getFullYear()}-${now.getMonth()+1}`;

 let stats = await Stats.findOne({ businessId,month:monthKey });
 if(!stats) stats = new Stats({ businessId,month:monthKey });

 stats.total++;
 await stats.save();

 res.json({ success:true });
});

/* =======================
 Bad Feedback
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

 let stats = await Stats.findOne({ businessId,month:monthKey });
 if(!stats) stats = new Stats({ businessId,month:monthKey });

 stats.total++;
 stats.negative++;

 await stats.save();

 res.json({ success:true });
});



/* =======================
 Get Bad Feedback List (FIX)
======================= */
app.get("/api/bad-feedback", async (req,res)=>{

 try{

  const { businessId, month } = req.query;

  if(!businessId || !month){
    return res.json([]);
  }

  const list = await BadFeedback.find({
    businessId,
    month
  }).sort({ date:-1 });

  res.json(list);

 }catch(err){
  res.json([]);
 }

});
/* =======================
 Get Stats
======================= */
app.get("/api/stats", async (req,res)=>{

 const { businessId,month } = req.query;
 const stats = await Stats.findOne({ businessId,month });

 res.json(stats || { total:0,positive:0,negative:0 });
});

/* =======================
 Sync Google (manual button)
======================= */
app.post("/api/sync-google-reviews", async (req,res)=>{

 try{

  const { businessId } = req.body;
  const business = await Business.findOne({ businessId });

  if(!business || !business.apifyDatasetId){
   return res.json({ success:false,msg:"Dataset not set" });
  }

  const url=`https://api.apify.com/v2/datasets/${business.apifyDatasetId}/items?clean=true`;
  const response = await axios.get(url);
  const data=response.data;

  if(!data || data.length===0) return res.json({ success:false });

  const liveTotal=data[0].reviewsCount;

  await Business.updateOne({ businessId },{ googleReviewCount:liveTotal });

  res.json({ success:true,liveTotal });

 }catch(err){
  res.json({ success:false });
 }

});

/* =======================
 LEVEL 2 MATCHING CRON (5 MIN)
======================= */
cron.schedule("*/5 * * * *", async ()=>{

 console.log("Checking new reviews...");

 const businesses = await Business.find();

 for(const biz of businesses){

  if(!biz.apifyDatasetId) continue;

  try{

   const url=`https://api.apify.com/v2/datasets/${biz.apifyDatasetId}/items?clean=true`;
   const response=await axios.get(url);
   const data=response.data;

   if(!data || data.length===0) continue;

   const reviews=data[0].reviews || data;

   const pending=await ReviewRequest.find({
    businessId:biz.businessId,
    status:"waiting"
   });

   for(const req of pending){

    for(const r of reviews){

     if(!r.name || !r.publishedAtDate) continue;

     const reviewName=r.name.toLowerCase().trim();
     const reviewTime=new Date(r.publishedAtDate);
     const sentTime=new Date(req.sentTime);

    

    const diff=Math.abs(reviewTime - sentTime)/(1000*60*60);

if(
 reviewName.includes(req.customerName) &&
 diff<=48
){

      console.log("Matched:",reviewName);

      req.status="done";
      req.matchedAt=new Date();
      await req.save();

      const now=new Date();
      const monthKey=`${now.getFullYear()}-${now.getMonth()+1}`;

      let stats=await Stats.findOne({
       businessId:biz.businessId,
       month:monthKey
      });

      if(!stats){
       stats=new Stats({
        businessId:biz.businessId,
        month:monthKey
       });
      }

      stats.positive+=1;
      await stats.save();
     }
    }
   }

  }catch(e){
   console.log("Match error:",biz.name);
  }
 }

 console.log("Match check done");

});



 


/* =======================
 Start Server
======================= */
const PORT=process.env.PORT||3000;
app.listen(PORT,()=>{
 console.log("Server running on",PORT);
});



/* =======================
 Get Business Public Data (IMPORTANT)
======================= */
app.get("/api/get-business/:id", async (req,res)=>{

 try{

   const business = await Business.findOne({
     businessId: req.params.id
   });

   if(!business){
     return res.json({ success:false, msg:"Business not found" });
   }

   res.json({
     success:true,
     googleReviewLink: business.googleReviewLink
   });

 }catch(err){
   res.json({ success:false });
 }

});



/* =======================
 RUN APIFY SCRAPER CRON (10 MIN)
======================= */

cron.schedule("*/10 * * * *", async ()=>{

 console.log("Running Apify scrapers for all businesses...");

 const businesses = await Business.find();

 for(const biz of businesses){

  // must have google map link saved
  if(!biz.googleReviewLink) continue;

  try{

   const response = await axios.post(
    "https://api.apify.com/v2/acts/compass~google-maps-reviews-scraper/runs?token=apify_api_OGYVaSsmeyn1EpOrX8ab4q43J6yL9O0fj9Ew",
    {
      startUrls:[{ url: biz.googleReviewLink }],
      maxReviews:200,
      reviewsSort:"newest",
      language:"en"
    }
   );

   const datasetId = response.data.data.defaultDatasetId;

   console.log("New dataset for",biz.name,":",datasetId);

   // save latest dataset id
   await Business.updateOne(
     { businessId: biz.businessId },
     { apifyDatasetId: datasetId }
   );

  }catch(err){
   console.log("Apify run error:",biz.name);
  }

 }

 console.log("Apify run complete");

});


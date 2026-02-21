const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const axios = require("axios");
const cron = require("node-cron");

app.use(cors());
app.use(express.json());

/* =======================
 MongoDB
======================= */
mongoose.connect("mongodb+srv://reviewbooster:Dhoni1234@reviewbooster.bprbbl3.mongodb.net/reviewbooster")
.then(()=>console.log("Mongo Connected"))
.catch(err=>console.log(err));

/* =======================
 SCHEMAS
======================= */

// BUSINESS
const businessSchema = new mongoose.Schema({
 name:String,
 email:String,
 password:String,
 businessId:String,
 googleReviewLink:String,
 apifyDatasetId:String,
 createdAt:{type:Date,default:Date.now}
});
const Business = mongoose.model("Business",businessSchema);

// MONTHLY STATS
const statsSchema = new mongoose.Schema({
 businessId:String,
 month:String,
 total:{type:Number,default:0},
 positive:{type:Number,default:0},
 negative:{type:Number,default:0}
});
const Stats = mongoose.model("Stats",statsSchema);

// NEGATIVE FEEDBACK
const badSchema = new mongoose.Schema({
 businessId:String,
 name:String,
 email:String,
 message:String,
 month:String,
 date:Date
});
const BadFeedback = mongoose.model("BadFeedback",badSchema);

// MAIN TRACKING (MOST IMPORTANT)
const requestSchema = new mongoose.Schema({
 businessId:String,
 customerName:String,
 mobile:String,

 status:{type:String,default:"sent"}, 
 // sent | opened | positive | negative

 sentTime:{type:Date,default:Date.now},
 resendCount:{type:Number,default:0}
});
const ReviewRequest = mongoose.model("ReviewRequest",requestSchema);

/* =======================
 HEALTH
======================= */
app.get("/",(req,res)=>res.send("Server Running 🚀"));

/* =======================
 CREATE BUSINESS
======================= */
app.post("/api/create-business", async(req,res)=>{
 const {name,email,password,googleReviewLink,apifyDatasetId} = req.body;

 const exist = await Business.findOne({email});
 if(exist) return res.json({success:false});

 const businessId="biz_"+Date.now();

 await Business.create({
  name,email,password,googleReviewLink,apifyDatasetId,businessId
 });

 res.json({success:true,businessId});
});

/* =======================
 LOGIN
======================= */
app.post("/api/login", async(req,res)=>{
 const {email,password}=req.body;

 const b = await Business.findOne({email,password});
 if(!b) return res.json({success:false});

 res.json({
  success:true,
  businessId:b.businessId,
  businessName:b.name,
  googleReviewLink:b.googleReviewLink
 });
});

/* =======================
 SAVE REQUEST (WHEN SEND WHATSAPP)
======================= */
app.post("/api/save-request", async(req,res)=>{
 const {businessId,customerName,mobile}=req.body;

 await ReviewRequest.create({
  businessId,
  customerName:customerName.toLowerCase(),
  mobile,
  status:"sent"
 });

 // monthly total++
 const now=new Date();
 const month=`${now.getFullYear()}-${now.getMonth()+1}`;

 let stats=await Stats.findOne({businessId,month});
 if(!stats) stats=new Stats({businessId,month});

 stats.total++;
 await stats.save();

 res.json({success:true});
});

/* =======================
 MARK OPENED
======================= */
app.post("/api/opened", async(req,res)=>{
 const {businessId,name}=req.body;

 await ReviewRequest.updateOne({
  businessId,
  customerName:name.toLowerCase()
 },{
  status:"opened"
 });

 res.json({success:true});
});

/* =======================
 MARK POSITIVE
======================= */
app.post("/api/mark-positive", async(req,res)=>{
 const {businessId,name}=req.body;

 await ReviewRequest.updateOne({
  businessId,
  customerName:name.toLowerCase()
 },{
  status:"positive"
 });

 const now=new Date();
 const month=`${now.getFullYear()}-${now.getMonth()+1}`;

 let stats=await Stats.findOne({businessId,month});
 if(!stats) stats=new Stats({businessId,month});

 stats.positive++;
 await stats.save();

 res.json({success:true});
});

/* =======================
 BAD FEEDBACK
======================= */
app.post("/api/bad-feedback", async(req,res)=>{
 const {businessId,name,email,message}=req.body;

 const now=new Date();
 const month=`${now.getFullYear()}-${now.getMonth()+1}`;

 await BadFeedback.create({
  businessId,name,email,message,
  month,
  date:new Date()
 });

 await ReviewRequest.updateOne({
  businessId,
  customerName:name.toLowerCase()
 },{
  status:"negative"
 });

 let stats=await Stats.findOne({businessId,month});
 if(!stats) stats=new Stats({businessId,month});

 stats.negative++;
 await stats.save();

 res.json({success:true});
});

/* =======================
 GET DASHBOARD STATS
======================= */
app.get("/api/stats", async(req,res)=>{
 const {businessId,month}=req.query;
 const stats=await Stats.findOne({businessId,month});
 res.json(stats || {total:0,positive:0,negative:0});
});

/* =======================
 GET USER LISTS
======================= */
app.get("/api/user-status", async(req,res)=>{

 const { businessId, month } = req.query;

 if(!businessId || !month){
  return res.json({positive:[],negative:[],nothing:[]});
 }

 // month format: 2026-2
 const [year,m] = month.split("-");
 const start = new Date(year, m-1, 1);
 const end = new Date(year, m, 1);

 const positive = await ReviewRequest.find({
  businessId,
  status:"positive",
  sentTime:{ $gte:start, $lt:end }
 });

 const negative = await ReviewRequest.find({
  businessId,
  status:"negative",
  sentTime:{ $gte:start, $lt:end }
 });

 const nothing = await ReviewRequest.find({
  businessId,
  status:"sent",
  sentTime:{ $gte:start, $lt:end }
 });

 res.json({positive,negative,nothing});

});

/* =======================
 GET NEGATIVE LIST
======================= */
app.get("/api/bad-feedback", async(req,res)=>{
 const {businessId,month}=req.query;

 const list=await BadFeedback.find({
  businessId,month
 }).sort({date:-1});

 res.json(list);
});

/* =======================
 GET GOOGLE LINK
======================= */
app.get("/api/get-business/:id", async(req,res)=>{
 const b=await Business.findOne({businessId:req.params.id});
 if(!b) return res.json({success:false});

 res.json({
  success:true,
  googleReviewLink:b.googleReviewLink
 });
});

/* =======================
 START SERVER
======================= */
const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log("Server running",PORT));

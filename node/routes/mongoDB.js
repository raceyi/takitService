/*let express = require('express'),
    router = express.Router();
let crypto = require('crypto');

let MongoClient = require('mongodb').MongoClient
let Server = require('mongodb').Server;

//let mongoclient = new MongoClient(new Server('10.21.68.4',27017,{'native_parser':true}));
//let db = mongoclient.db('takit');
let connection=MongoClient.connect();
let db = null;


MongoClient.connect("mongodb://10.21.68.4:27017/takit",(err,database)=>{
    if(err){
        console.log("mongodb connection error:"+JSON.stringify(err));
    }else{
        console.log("mongodb connection success");
        db=database;
    }
});


router.findCoupons=(couponInfo,next)=>{
    console.log("findCoupons couponInfo:"+JSON.stringify(couponInfo));

    db.collection('coupon').find(couponInfo).toArray((err,result)=>{
        if(err){
            console.log("mongoDB.findCoupons error:"+JSON.stringify(err));
            next(err);
        }else{
            console.log("mongodb findCoupons success");

            (result.length===0) ? next(null,[])
                                : next(null,result);
        } 
    });
}


// let mongoose = require('mongoose')
//     Schema = mongoose.Schema;

// mongoose.connect('mongodb://10.21.68.4:27017/takit');
// let db = mongoose.connection;

// db.on('error', console.error.bind(console, 'connection error:'));
// db.once('open', () => {
//   console.log(" we're connected! ");
// });

// //user
// let coupon = new Schema({
//     couponNO : {type : String, unique : true, required:true},
//     couponName : String,
//     couponType : String,
//     availShops : [{takitId:String,
//                    availMenus:[]}],
//     expiryDate : Date,
//     discountRate : String
// });

// let Coupon = mongoose.model('Coupon', coupon);

// router.findCoupon=(couponInfo,next){
//     Coupon.find({"email":user.email}, (err,result)=>{
//         err ? next(err)
//             : (result.length === 0) ? next("not exist user")
//                                     : next(null,result[0]);
//     });
// }

// router.saveUser=(user,next)=>{
	
// 	let salt = crypto.randomBytes(16).toString('hex');
// 	let secretPwd = crypto.createHash('sha256').update(user.password + salt).digest('hex');

// 	let newUser = new User({email:user.email,
// 							password:secretPwd,
// 						    salt:salt});

// 	newUser.save((err, data)=>{
// 		err ? next(err) 
//             : next(null,data)
// 	});
// }

// router.findUser= (user,next)=>{
// 	User.find({"email":user.email}, (err,result)=>{
//         err ? next(err)
//             : (result.length === 0) ? next("not exist user")
//                                     : next(null,result[0]);
//     });
// }

// router.findUserById = (uid,next)=>{
//     console.log(uid);
//     User.find({_id:uid},(err,result)=>{
//         err ? next(err)
//             : (result.length === 0) ? next("not exist user")
//                                     : next(null,result[0]);
              
//     });
// }


// router.updateChatLog = (data)=>{

//     User.update({ email: data.receiver }, { "$push": {"chatLog" : {"sender":data.sender, "msg":data.msg }}}, (err, result)=>{
//         err ? console.log(err)
//             : console.log(result)
//     })
// }

// router.updateFileList = (uid,fileName) =>{
//     User.update({_id:uid}, {"$addToSet":{"fileList":{"fileName":fileName}}},(err,result)=>{
//         err ? console.log(err)
//             : console.log(result)
//     });
// }

// router.updateFileListArray = (uid,idx,fileArray,next) =>{

//     console.log(fileArray[idx]);
//     fileArray[idx] = fileArray[idx].trim();

//     if(fileArray[idx].substring(fileArray[idx].length-1,fileArray[idx].length)==='/'){ //folder path not save
//         idx++;
//         if (idx >= fileArray.length-1) 
//                 next(null,"success");
//     }

//     User.update({_id:uid}, {"$addToSet":{"fileList":{"fileName":fileArray[idx]}}},(err,result)=>{
//         if(err){
//             console.log(err);
//             next(err);
//         }else{
//             console.log(result);
//             if (idx >= fileArray.length-1) 
//                 next(null,"success");
//             else{
//                 (idx++, router.updateFileListArray(uid,idx,fileArray,next))
//             }
//         }
//     });


// }


// router.findFileList = (uid,next)=>{
//     User.find({_id:uid},(err,res)=>{
//         err ? next(err)
//             : (res.length === 0) ? next("not exist user")
//                                     : next(null,res[0].fileList)
            
//     });
// }

module.exports=router;

*/

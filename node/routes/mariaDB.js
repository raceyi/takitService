let Client = require('mariasql'); //https://github.com/mscdex/node-mariasql
let crypto = require('crypto');
let timezoneJS = require('timezone-js');
let express = require('express');
let async = require('async');

let config = require('../config');
let moment = require('moment');
let index = require('./index');
let op = require('./op');
const fs=require('fs');

var AsyncLock = require('async-lock');
var lock = new AsyncLock();

let router = express.Router();

var mariaDBConfig = {
    host: config.mariaDB.host,
    user: config.mariaDB.user,     //
    password: config.mariaDB.password,      // Please input your password
    multiStatements: true,
    pingInactive: 300, //in seconds 
    pingWaitRes: 60, //in seconds. time for waiting ping response 
    db:config.mariaDB.db // DB name, takit, takitTest
}


var c = new Client(mariaDBConfig);

c.query('set names utf8;');
c.query("use "+mariaDBConfig.db+";");

c.on('close', function () {
    console.log("DB close c.connected:" + c.connected);
    console.log("DB close c.connecting:" + c.connecting);
}).on('error', function (err) {
    console.log('Client error: ' + err);
}).on('connect', function () {
    console.log('Client connected');
});

var recommendShops;

getRecommendShopsInfo(); //Please call it....

function getRecommendShopsInfo(){
    console.log("getRecommendShops\n");
    fs.readFile('recommend.shop', 'utf8', function(err, contents) {
        //console.log(contents);
        let recommends=JSON.parse(contents);
        console.log("recommends:"+JSON.stringify(recommends));
        recommendShopInfo(recommends,function (err, info){ 
            console.log("info:"+JSON.stringify(info));
            let updateRecommendShops=[];
            for(var i=0;i<info.length;i++){
                let shop=info[i];
                if(info[0].starCount!=0){
                    shop.rate=shop.starRating/shop.starCount;
                }else{
                    shop.rate=null;
                }
                updateRecommendShops.push(shop);
            }
            recommendShops=updateRecommendShops; //!!!Please use sync and wait later
            console.log("recommendShops:"+JSON.stringify(recommendShops));
        });
   });
}

router.getRecommendShops=function(){
    console.log("recommendShops:"+JSON.stringify(recommendShops));
    return recommendShops;
}

setInterval(()=>{
   getRecommendShopsInfo();
}, 60*60*1000); //every 60 minutes


var flag;
function performQuery(command, handler) {
    console.log("performQuery with command=" + command + " connected:" + c.connected + " connecting:" + c.connecting + " threadId" + c.threadId);
    if (!c.connected) {                         // Anyother way? It could be dangerous. any mutex? 
        c.connect(mariaDBConfig);
        c.on("ready", function () {
            console.log("mariadb ready");
            c.query('set names utf8;');
            c.query("use "+mariaDBConfig.db+";");
            c.query(command, handler);
        });
    } else {
        c.query(command, handler);
    }
}

function performQueryWithParam(command, value, handler) {
    console.log("performQuery with command=" + command + " connected:" + c.connected + " connecting:" + c.connecting + " threadId" + c.threadId);
    if (!c.connected) {                         // Anyother way? It could be dangerous. any mutex?
        c.connect(mariaDBConfig);
        c.on("ready", function () {
            console.log("mariadb ready");
            c.query('set names utf8;');
            c.query("use "+mariaDBConfig.db+";");
            c.query(command, value, handler);
        });
    } else {
        console.log("call c.query with value " + JSON.stringify(value));
        function defaultHandler() {
            console.log("c.query returns");
            flag = true;
            handler();
        }
        console.log("call c.query");
        c.query(command, value, handler);
    }
}


//encrypt data

function encryption(data, pwd) {
    var cipher = crypto.createCipher('aes256', pwd);
    var secretData = cipher.update(data, 'utf8', 'hex');
    secretData += cipher.final('hex');

    return secretData;
}

//decrypt decrepted data

function decryption(secretData, pwd) {
    var decipher = crypto.createDecipher('aes256', pwd);
    var data = decipher.update(secretData, 'hex', 'utf8');
    data += decipher.final('utf8');

    return data;
}

//decrpt userInfo,shopInfo ...etc
function decryptObj(obj) {
    if (obj.hasOwnProperty('referenceId') && obj.referenceId !== null) {
        obj.referenceId = decryption(obj.referenceId, config.rPwd);
    }

    if (obj.hasOwnProperty('email') && obj.email !== null) {
        obj.email = decryption(obj.email, config.ePwd);
    }

    if (obj.hasOwnProperty('phone') && obj.phone !== null) {
        obj.phone = decryption(obj.phone, config.pPwd);
    }

    if (obj.hasOwnProperty('userPhone') && obj.userPhone !== null) {
        obj.userPhone = decryption(obj.userPhone, config.pPwd);
    }

    if (obj.hasOwnProperty('account') && obj.account !== null) {
        obj.account = decryption(obj.account, config.aPwd);
    }
}

router.checkDeposit=function(cashId,next){
   var command = "select * from cashList where cashId=? and transactionType=\'deposit\'"; 
   var values=[cashId];
   performQueryWithParam(command, values, function (err, result) {
        console.log("c.query success");
        if (err) {
            next(err);
        } else {
            console.dir("[checkDeposit]:" + result.info.numRows);
            if (result.info.numRows === "0") {
                next(null,false);
            } else {
                next(null,true);
            }
        }
    });
}

router.existUserEmail = function (email, next) {
    var secretEmail = encryption(email, config.ePwd);

    var command = "select *from userInfo where email=?";
    var values = [secretEmail];
    console.log("existUserEmail is called. command:" + command);

    performQueryWithParam(command, values, function (err, result) {
        console.log("c.query success");
        if (err) {
            next(err);
        } else {
            console.dir("[existUser]:" + result.info.numRows);
            if (result.info.numRows === "0") {
                next("invaildId");
            } else {
                decryptObj(result[0]);
                next(null, result[0]);
            }
        }
    });
};

function recommendShopInfo(shops,next) {
          if(shops.length==0){
              console.log("no recommend shops");
              return;
          }
          let command;
          let values=[];

          //command="SELECT * from shopInfo where takitId=? OR takitId=? OR takitId=? OR takitId=? OR takitId=?";
          command = "SELECT * from shopInfo where takitId=? ";
        
          for(var i=1;i<shops.length;i++)
              command+="OR takitId=? ";
          command+=";";

          shops.forEach(shop=>{
              values.push(shop);
          });

          console.log("...command:"+command);
          performQueryWithParam(command, values, function (err, result) {
            if (err) {
                console.log("performQueryWithParam error");
                next(err);
            } else {
                let shopsResult=[];
                console.log("result:"+JSON.stringify(result));
                result.forEach(element => {
                    let shop={};
                    shop.starRating    =element.starRating;
                    shop.starCount     =element.starCount;
                    shop.classification=element.classification;
                    shop.takitId       =element.takitId;
                    shop.imagePath     =element.imagePath;
                    shop.paymethod     =element.paymethod;
                    shop.deliveryArea  =element.deliveryArea;
                    shop.ready         =element.ready;
                    shopsResult.push(shop);
                });
                let sortedShops=[];
                for(var i=0;i<shops.length;i++){
                    for(var j=0;j<shopsResult.length;j++){
                        if(shops[i]==shopsResult[j].takitId)
                            sortedShops.splice(i,0,shopsResult[j]);
                    }
                }
                next(null,sortedShops);
            }
          });
}

router.existEmailAndPassword = function (email, password, next) {
    let secretEmail = encryption(email, config.ePwd);

    let command = "SELECT userInfo.*, cashId FROM userInfo LEFT JOIN cash ON userInfo.userId = cash.userId WHERE email=?";
    let values = [secretEmail];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            //console.log("[existUser]:"+result.info.numRows);
            if (result.info.numRows === "0") {
                next("invalidId");
            } else {
                console.log(result);
                let userInfo = result[0];
                let secretPassword = crypto.createHash('sha256').update(password + userInfo.salt).digest('hex');

                if (secretPassword === userInfo.password) {
                    console.log("password success!!");
                    decryptObj(userInfo);
                    next(null, userInfo);
                } else {
                    next("passwordFail");
                }
            }
        }
    });
};

router.existUser = function (referenceId, next) {
    let secretReferenceId = encryption(referenceId, config.rPwd);
    let command = "SELECT userInfo.*, cashId FROM userInfo LEFT JOIN cash ON userInfo.userId = cash.userId WHERE referenceId=?";
    let values = [secretReferenceId]
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("query error:" + JSON.stringify(err));
            next(err);
        } else {
            console.dir("[existUser function numRows]:" + result.info.numRows);
            if (result.info.numRows === "0") {
                next("invalidId");
            } else {
                decryptObj(result[0]);
                next(null, result[0]);
            }
        }
    });
};

router.getUserPaymentInfo = function (id, successCallback, errorCallback) {
    var command = "select name,email,phone from userInfo where userId=\"" + id + "\";";
    console.log("command:" + command);
    performQuery(command, function (err, result) {
        if (err) {
            console.log(JSON.stringify(err));
            errorCallback(err);
        }
        console.dir("[getUserPaymentInfo]:" + result.info.numRows);
        if (result.info.numRows === "0") {
            errorCallback("invalid DB status");
        } else {
            console.log("result[0]:" + JSON.stringify(result[0]));
            successCallback(result[0]);
        }
    });
};


router.insertUser = function (userInfo, next) {
    console.log("userInfo:" + JSON.stringify(userInfo));

    // referenceId encrypt
    var secretReferenceId = encryption(userInfo.referenceId, config.rPwd);

    var salt;
    var secretPassword = '';

    //1. password encrypt	

    if (!userInfo.hasOwnProperty('password') && userInfo.password === undefined) {
        salt = null;
        secretPassword = null;
    } else {
        salt = crypto.randomBytes(16).toString('hex');
        secretPassword = crypto.createHash('sha256').update(userInfo.password + salt).digest('hex');
    }

    //2. email encrypt
    var secretEmail = encryption(userInfo.email, config.ePwd);

    //3. phone encrypt
    var secretPhone = encryption(userInfo.phone, config.pPwd);

    console.log("secretReferenceId :" + secretReferenceId + " secretEmail : " + secretEmail + " secretPhone:" + secretPhone);

    var command = 'INSERT IGNORE INTO userInfo (referenceId,password,salt,name,email,countryCode,phone,sex,age,lastLoginTime, receiptIssue,receiptId,receiptType,deviceUuid) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
    var values = [secretReferenceId, secretPassword, salt, userInfo.name, 
                    secretEmail, userInfo.countryCode, secretPhone, 
                    userInfo.sex,userInfo.birthYear,new Date().toISOString(), 
                    userInfo.receiptIssue, userInfo.receiptId, userInfo.receiptType, userInfo.uuid];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            console.log("insertUser func result" + JSON.stringify(result));
            if (result.info.affectedRows === '0') {

                next(null, "duplication")
            } else {
                //console.log(JSON.stringify(result));
                next(null, result.info.insertId);
            }
        }
    });
};

router.validUserwithPhone = function (userId, name, phone, next) {

    let command = "SELECT *FROM userInfo WHERE userId=? and name=? and phone = ?";
    var secretPhone = encryption(phone, config.pPwd);
    let values = [userId, name, secretPhone];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("validUserwithPhone function error:" + JSON.stringify(err));
            next(err);
        } else {
            if (result.info.numRows === "0") {
                next("invalidId");
            } else {
                console.log("validUserwithPhone function success");
                next(null, "validId");
            }
        }
    });
}

router.getUserInfo = function (userId, next) {
    var command = "SELECT *FROM userInfo WHERE userId=?";
    var values = [userId];
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("getUserInfo func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.dir("[Get userInfo]:" + result.info.numRows);
            if (result.info.numRows == 0) {
                next(null, {});
            } else {
                console.log("Query succeeded. " + JSON.stringify(result[0]));
                decryptObj(result[0]);
                next(null, result[0]);
            }
        }
    });
}

router.insertUnregisteredUser = function (referenceId,couponList) {
    var command = 'INSERT IGNORE INTO unregistered (referenceId,couponList) VALUES (?,?)';
    var values = [referenceId,couponList]; 
    
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
        } else {
            console.log("insertUnregisteredUser func result" + JSON.stringify(result));
        }
    });
}

router.checkUnregistedUser = function(uid,next){
    router.getUserInfo(uid, function (err, userInfo) {
        if(err) next(err); //Can it happen?
        else{ 
            let command = "SELECT * FROM unregistered WHERE referenceId=?";
            let values = [userInfo.referenceId];

            performQueryWithParam(command, values, function (err, result) {
                if (err) {
                    console.log(err);
                    next(err);
                } else {
                    if (result.info.numRows === "0") {
                        next(null); //New user comes
                    }else{
                        console.log("unregistered user");
                        console.log("result[0]:"+result[0].couponList);
                        next("unregisteredUser",result[0].couponList);
                    }
                }
            });
        }
    });
}


router.deleteUserInfo = function (userId, next) {
    console.log("userId:" + userId);
    // get user info from DB and then save referenceId into unregistered table
    router.getUserInfo(userId, function (err, userInfo) {
        if(err){
             next(err);
        }else{
                         
            var command = "DELETE FROM userInfo where userId=?"; 
            var values = [userId];

            performQueryWithParam(command, values, function (err, result) {
                if (err) {
                    console.log("deleteUserInfo function err:" + err);
                    next(err);
                } else {
                    router.insertUnregisteredUser(userInfo.referenceId,userInfo.couponList);
                    console.log("deleteUserInfo function Query succeeded" + JSON.stringify(result));
                    next(null);
                }
            });
        }
    }); 
}

router.updateUserInfo = function (userInfo, next) {
    console.log("update UserInfo function start");
    const values = {};
    values.email = encryption(userInfo.email, config.ePwd);
    values.salt = null;
    values.password = null;
    values.phone = null;
    values.name = userInfo.name;
    values.receiptIssue = userInfo.receiptIssue;
    values.receiptId = userInfo.receiptId;
    values.receiptType = userInfo.receiptType;
    values.taxIssueEmail=userInfo.taxIssueEmail;
    values.taxIssueCompanyName=userInfo.taxIssueCompanyName;

    if (userInfo.password !== undefined && userInfo.passsword !== null) {
        values.salt = crypto.randomBytes(16).toString('hex');
        values.password = crypto.createHash('sha256').update(userInfo.password + values.salt).digest('hex');
    }

    if (userInfo.hasOwnProperty('phone') && userInfo.phone !== null && userInfo.phone !== "") {
        values.phone = encryption(userInfo.phone, config.pPwd);
    }

    let command;
    if(userInfo.password == undefined){
          if (userInfo.hasOwnProperty('userId') && userInfo.userId !== null) {
            values.userId = userInfo.userId;
            command = "UPDATE userInfo set email=:email, phone=:phone, name=:name, receiptIssue=:receiptIssue,receiptId=:receiptId,receiptType=:receiptType,taxIssueEmail=:taxIssueEmail,taxIssueCompanyName=:taxIssueCompanyName where userId=:userId";
        } else {
            command = "UPDATE userInfo set receiptIssue=:receiptIssue,receiptId=:receiptId,receiptType=:receiptType,taxIssueEmail=:taxIssueEmail,taxIssueCompanyName=:taxIssueCompanyName where email=:email";
        }
        delete values.password;
        delete values.salt;
    }else{
        if (userInfo.hasOwnProperty('userId') && userInfo.userId !== null) {
            values.userId = userInfo.userId;
            command = "UPDATE userInfo set password=:password, salt=:salt, email=:email, phone=:phone, name=:name, receiptIssue=:receiptIssue,receiptId=:receiptId,receiptType=:receiptType,taxIssueEmail=:taxIssueEmail,taxIssueCompanyName=:taxIssueCompanyName where userId=:userId";
        } else {
            command = "UPDATE userInfo set password=:password, salt=:salt, receiptIssue=:receiptIssue,receiptId=:receiptId,receiptType=:receiptType,taxIssueEmail=:taxIssueEmail,taxIssueCompanyName=:taxIssueCompanyName where email=:email";
        }
    }

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("updateUserInfo func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.log("Query succeeded. " + JSON.stringify(result));
            next(null, "success");
        }
    });
}

router.updateSessionInfo = function (sessionInfo, next) {
    let command = "UPDATE userInfo set sessionId=:sessionId, lastLoginTime=:lastLoginTime, multiLoginCount=multiLoginCount+:multiLoginCount, deviceUuid=:deviceUuid where userId=:userId";

    performQueryWithParam(command, sessionInfo, function (err, result) {
        if (err) {
            console.log("updateUserInfo func Unable to query. Error:", JSON.stringify(err));
            next(err);
        } else {
            console.log("updateSessionInfo Query succeeded. " + JSON.stringify(result));
            next(null, "success");
        }
    });
};


//shop user 정보 가져옴.

router.existShopUser = function (referenceId, next) {
    console.log("refId:" + referenceId);

    var secretReferenceId = encryption(referenceId, config.rPwd);
    console.log(secretReferenceId);
//    var command = "SELECT shopUserInfo.*, name, email FROM shopUserInfo LEFT JOIN userInfo ON shopUserInfo.userId=userInfo.userId where shopUserInfo.referenceId=?";
    // kalen-begin
    var command = "SELECT shopUserInfo.* FROM shopUserInfo where shopUserInfo.referenceId=?";
    // kalen-end
    console.log("command:"+command);

    var values = [secretReferenceId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("existShopUser function query error:" + JSON.stringify(err));
            next(err);
        } else {
            console.log("[existShopUser function numRows]:" + result.info.numRows);

            if (result.info.numRows == "0") {
                next("no shopUser");
            } else {
                //shop이 여러개일 경우에 여러개 리턴
                let shopUserInfos = [];
                result.forEach(function (shopUser) {
                    decryptObj(shopUser);
                    shopUserInfos.push(shopUser);
                });
                console.log("shopUserInfos:" + JSON.stringify(shopUserInfos));
                next(null, shopUserInfos);
            }
        }
    });
}

///////////////여러개 샵 가지고 있으면 여러 레코드 검색됨
router.getShopUserInfo = function (userId, next) {
    let command = "SELECT shopUserInfo.*, name, email FROM shopUserInfo LEFT JOIN userInfo ON shopUserInfo.userId=userInfo.userId WHERE shopUserInfo.userId=?";
    let values = [userId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("shopUserInfo function query error:" + JSON.stringify(err));
            next(err);
        } else {
            console.dir("[shopUserInfo function numRows]:" + result.info.numRows);
            if (result.info.numRows === "0") {
                next("invalidId");
            } else {
                console.log("shopUserInfo success");
                let shopUserInfos = [];
                result.forEach(function (shopUserInfo) {
                    decryptObj(shopUserInfo);
                    shopUserInfos.push(shopUserInfo);
                });

                next(null, shopUserInfos);
            }
        }
    });
}

router.getShopUserInfoWithEmail = function (userId, next) {
    let command = "SELECT * FROM shopUserInfo WHERE shopUserInfo.userId=?";
    let values = [userId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("shopUserInfo function query error:" + JSON.stringify(err));
            next(err);
        } else {
            console.dir("[shopUserInfo function numRows]:" + result.info.numRows);
            if (result.info.numRows === "0") {
                next("invalidId");
            } else {
                console.log("shopUserInfo success");
                let shopUserInfos = [];
                result.forEach(function (shopUserInfo) {
                    decryptObj(shopUserInfo);
                    shopUserInfos.push(shopUserInfo);
                });

                next(null, shopUserInfos);
            }
        }
    });
}

///////////////////////////////////////////////////
router.getOnlyShopUserInfo = function (userId, next) {
    let command = "SELECT shopUserInfo.* FROM shopUserInfo WHERE shopUserInfo.userId=?";
    let values = [userId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("shopUserInfo function query error:" + JSON.stringify(err));
            next(err);
        } else {
            console.dir("[shopUserInfo function numRows]:" + result.info.numRows);
            if (result.info.numRows === "0") {
                next("invalidId");
            } else {
                console.log("shopUserInfo success");
                let shopUserInfos = [];
                result.forEach(function (shopUserInfo) {
                    decryptObj(shopUserInfo);
                    shopUserInfos.push(shopUserInfo);
                });

                next(null, shopUserInfos);
            }
        }
    });
}

router.saveCashBillKey=function(orderId,cashBillKey,next){
    console.log("saveCashBill orderId:"+orderId);
    let command = "UPDATE orders set cashBillKey=? where orderId=?";
    let values = [cashBillKey, orderId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            console.log("saveCashBillKey function result" + JSON.stringify(result));
            next(null);
        }
    });
}

router.saveCancelCashBillKey=function(orderId,cancelCashBillKey,next){
    let command = "UPDATE orders set cancelCashBillKey=? where orderId=?";
    let values = [cancelCashBillKey, orderId];
    
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            console.log("saveCancelCashBillKey function result" + JSON.stringify(result));
            next(null);
        }
    });
}

router.getRevokeRegistOrders=function(next){
    let date=new Date(Date.now()-24*60*60*1000*3); //3 days ago;
    let month= (date.getMonth()+1)<10?"0"+(date.getMonth()+1):date.getMonth()+1;
    let day  = date.getDate()<10? "0"+date.getDate():date.getDate();
    let timeString=date.getFullYear()+'-'+month+'-'+day;
    console.log("timeString:"+timeString);
    let command ="SELECT orders.cashBillKey,shopInfo.businessNumber,orders.orderId FROM orders LEFT JOIN shopInfo ON orders.takitId = shopInfo.takitId WHERE \
                  orders.orderStatus='cancelled' AND orders.cashBillKey IS NOT NULL AND orders.cancelCashBillKey IS NULL AND orders.orderedTime >?";
    let values = [timeString];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            console.log("getRevokeRegistOrders function result" + JSON.stringify(result));
            let orders=[];
            result.forEach(order=>{
                let info={cashBillKey:order.cashBillKey,corpNum:order.businessNumber,orderId:order.orderId};
                orders.push(info);
            })
            next(null,orders);
        }
    });
}

router.getRevokeRegistOrders(function(err,orders){
    console.log("getRevokeRegistOrders-orders:"+JSON.stringify(orders));
})

router.saveCouponList=function(userId,couponList,next){
    let command = "UPDATE userInfo set couponList=? where userId=?";
    let values = [couponList, userId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            console.log("saveCouponList function result" + JSON.stringify(result));
            next(null);
        }
    });  
}

router.getCouponList=function(userId,next){
    let command ="SELECT couponList FROM userInfo WHERE userId=?";

    let values = [userId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            console.log("getCouponList function result" + JSON.stringify(result));
            next(null,result[0].couponList);
        }
    });
}  

//userId+takitId 로 한명의 shopUser만 검색
router.updateShopRefId = function (userId, referenceId, next) {

    let secretReferenceId = encryption(referenceId, config.rPwd);
    let command = "UPDATE shopUserInfo set referenceId=? where userId=?";
    let values = [secretReferenceId, userId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            console.log("updateShopRefId function result" + JSON.stringify(result));
            next(null);
        }
    });
}

router.insertCashId = function (userId, cashId, password, next) {

    let salt = crypto.randomBytes(16).toString('hex');
    let secretPassword = crypto.createHash('sha256').update(password + salt).digest('hex');

    let command = "INSERT IGNORE INTO cash(userId, cashId, password, salt) values(?,?,?,?)";
    let values = [userId, cashId, secretPassword, salt];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("insertCashId func Unable to query. Error:", JSON.stringify(err));
            next(err);
        } else {
            if (result.info.affectedRows === '0') {
                next(null, "duplicationCashId");
            } else {
                console.log("insertCashId Query succeeded.");
                next(null, "success");
            }
        }
    });
};

router.updateCashPassword = function (userId, cashId, password, next) {

    let salt = crypto.randomBytes(16).toString('hex');
    let secretPassword = crypto.createHash('sha256').update(password + salt).digest('hex');

    let command = "UPDATE cash SET password=?, salt=? WHERE userId=? and cashId=?";
    let values = [secretPassword, salt, userId, cashId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("updateCashPassword func Unable to query. Error:", JSON.stringify(err));
            next(err);
        } else {
            console.log("updateCashPassword Query succeeded.");
            next(null, "success");
        }
    });
}


router.updateRefundCashInfo = function (cashId, amount, balance, next) {
    let command = "UPDATE cash SET balance=balance+?,refundCount=refundCount+1 WHERE cashId = ? and balance=?";
    let values = [amount, cashId, balance];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("updateRefundCashInfo function err:" + JSON.stringify(err));
            next(err);
        } else {
            console.log("updateRefundCashInfo:" + JSON.stringify(result));
            next(null, "success");
        }
    });
}



router.getCashInfo = function (cashId, next) {
    console.log("getCashInfo function start");

    let command = "SELECT *FROM cash WHERE cashId=?";
    let values = [cashId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("getCashInfo function err:" + JSON.stringify(err));
            next(err);
        } else {
            if (result.info.numRows === '0') {
                next("invalidId");
            } else {
                console.log(result);
                decryptObj(result[0]);
                next(null, result[0]);
            }
        }
    });
}

router.getCashInfoAndPushId = function (cashId, next) {
    console.log("router.getCashInfoAndPushId function start");

    let command = "SELECT cash.*, pushId, platform FROM cash LEFT JOIN userInfo ON cash.userId=userInfo.userId WHERE cashId=?";
    let values = [cashId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
			console.log(err);
            console.log("router.getCashInfoAndPushId err:" + JSON.stringify(err));
            next(err);
        } else {
            if (result.info.numRows === '0') {
                next("invalidId");
            } else {
                console.log(result);
                next(null, result[0]);
            }
        }
    });
}


//cashId를 모를때 userId 통해서 cashId 찾음.
router.getCashId = function (userId, next) {
    console.log("getCashId function start");

    let command = "SELECT cashId FROM cash LEFT JOIN userInfo ON cash.userId=userInfo.userId WHERE cash.userId=?";
    let values = [userId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("getCashId function err:" + JSON.stringify(err));
            next(err);
        } else {
            if (result.info.numRows === '0') {
                next("invalid userId");
            } else {
                console.log("getCashId function success");
                next(null, result[0].cashId);
            }
        }
    });
}

router.checkCashPwd = function (cashId, password, next) {
    console.log("checkCashPwd function start");

    let command = "SELECT password, salt FROM cash WHERE cashId=?";
    let values = [cashId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("checkCashPwd function err:" + JSON.stringify(err));
            next(err);
        } else {
            if (result.info.numRows === '0') {
                next("invalid cashId");
            } else {
                console.log("checkCashPwd function success");

                let secretPwd = crypto.createHash('sha256').update(password + result[0].salt).digest('hex');

                console.log("secret:" + secretPwd);
                console.log("pwd:" + result[0].password);
                if (secretPwd === result[0].password) {
                    console.log("correct password");
                    next(null, "correct cashPwd");
                } else {
                    next("invalid cash password");
                }

            }
        }
    });
}


router.findTakitId = function (req, next) {
    console.log("mariaDB.findTakitId " + req.body.hasOwnProperty("servicename") + " " + req.body.hasOwnProperty("shopname"));
    var command;
    if (req.body.hasOwnProperty("servicename") && req.body.hasOwnProperty("shopname")) {
        command = "SELECT serviceName,shopName from takit where serviceName LIKE _utf8\'" + req.body.servicename + "%\' and shopName LIKE _utf8\'" + req.body.shopname + "%\';";
    } else if (req.body.hasOwnProperty("servicename")) {
        command = "SELECT serviceName,shopName from takit where serviceName LIKE _utf8\'" + req.body.servicename + "%\';";
    } else if (req.body.hasOwnProperty("shopname")) {
        command = "SELECT serviceName,shopName from takit where shopName LIKE _utf8\'" + req.body.shopname + "%\';";
    } else {
        console.log("no param");
        next([]);
        return;
    }
    console.log("command:" + command);
    performQuery(command, function (err, result) {
        if (err) {
            console.log("findTakitId Error:" + JSON.stringify(err));
            next(JSON.stringify(err));
        } else {
            console.log("result:" + JSON.stringify(result));
            if (result == undefined) {
                next([]);
            } else {
                console.dir("result:" + result.info.numRows);
                var shoplist = [];
                var idx;
                for (idx = 0; idx < result.info.numRows; idx++) {
                    shoplist.push(result[idx].serviceName + "@" + result[idx].shopName);
                }
                console.log("shoplist:" + JSON.stringify(shoplist));
                next(shoplist);
            }
        }
    });
}

function queryCafeHomeCategory(cafeHomeResponse, req, res) {
    var url_strs = req.url.split("takitId=");
    var takitId = decodeURI(url_strs[1]);
    console.log("takitId:" + takitId);

    //console.log(cafeHomeResponse);
    var command = "SELECT *FROM categories WHERE takitId=? ORDER BY sequence";
    var values = [takitId];
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("queryCafeHomeCategory function Unable to query. Error:", JSON.stringify(err, null, 2));
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
            if (result.info.numRows == 0) {
                console.log("[queryCafeHomeCategory categories]:" + result.info.numRows);
                let response = new index.FailResponse("query failure");
                response.setVersion(config.MIGRATION, req.version);
                res.send(JSON.stringify(response));
            } else {
                //console.log("queryCafeHomeCategory func Query succeeded. " + JSON.stringify(result));

                var categories = [];
                result.forEach(function (item) {
                    //console.log(JSON.stringify(item));
                    categories.push(item);
                });

                cafeHomeResponse.categories = categories;
                //console.log("cafeHomeResponse:" + (JSON.stringify(cafeHomeResponse)));
                console.log("send res");
                res.end(JSON.stringify(cafeHomeResponse));

            }
        }
    });
}

function queryCafeHomeMenu(cafeHomeResponse, req, res) {
    console.log("req url:" + req.url);

    var url_strs = req.url.split("takitId=");
    var takitId = decodeURI(url_strs[1]);
    console.log(":takitId" + takitId);

    var menus = [];

    var command = "SELECT *FROM menus WHERE menuNO LIKE '" + takitId + "%'";
    console.log("queryCafeHomeMenu command:" + command);
    performQuery(command, function (err, result) {
        if (err) {
            console.error("queryCafeHomeMenu func Unable to query. Error:", JSON.stringify(err, null, 2));
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
            console.dir("[Get cafeHomeMenu]:" + result.info.numRows);
            if (result.info.numRows == 0) {
                let response = new index.FailResponse("query failure");
                response.setVersion(config.MIGRATION, req.version);
                res.send(JSON.stringify(response));
            } else {
                //console.log("queryCafeHomeMenu Query succeeded. " + JSON.stringify(result[0]));
                var menus = [];
                result.forEach(function (item) {
                    //console.log(JSON.stringify(item));
                    menus.push(item);
                });

                cafeHomeResponse.menus = menus;
                queryCafeHomeCategory(cafeHomeResponse, req, res);

            }
        }
    });
}

router.getPayMethod = function(req,res){
    var shops = JSON.parse(req.body.shops);
    console.log("getPayMethod:" + JSON.stringify(shops));

    let cafeHomeResponse = new index.SuccResponse();
    cafeHomeResponse.setVersion(config.MIGRATION, req.version);

    var command = "select takitId,paymethod from shopInfo where takitId=?";
    var values = [shops[0]];

    for(var i=1;i<shops.length;i++){
      command+="OR takitId=?";
      values.push(shops[i]);
    }
 
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
            if (result.info.numRows === "0") {
                let response = new index.FailResponse("query failure");
                response.setVersion(config.MIGRATION, req.version);
                res.send(JSON.stringify(response));
            } else {
               let response = new index.SuccResponse(); 
               response.setVersion(config.MIGRATION, req.version);
               console.log("result:"+JSON.stringify(result));
               response.payMethods=result;
               res.send(JSON.stringify(response));
            }
        }
    });
}

router.queryCafeHome = function (req, res) {
    console.log("queryCafeHome:" + JSON.stringify(req.url));
    var url_strs = req.url.split("takitId=");
    var takitId = decodeURI(url_strs[1]);
    console.log("takitId:" + takitId);
    let cafeHomeResponse = new index.SuccResponse();
    cafeHomeResponse.setVersion(config.MIGRATION, req.version);

    var command = "select *from shopInfo where takitId=?";
    var values = [takitId];
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
            if (result.info.numRows === "0") {
                console.log("queryCafeHome function's query failure");
                let response = new index.FailResponse("query failure");
                response.setVersion(config.MIGRATION, req.version);
                res.send(JSON.stringify(response));
            } else {
                result.forEach(function (item) {
                    delete item.account;
                    console.log(JSON.stringify(item));
                    cafeHomeResponse.shopInfo = item;
                    queryCafeHomeMenu(cafeHomeResponse, req, res);
                });
            }
        }
    });
};


function queryCafeHomeCategoryPost(cafeHomeResponse, req, res) {
    var takitId = req.body.takitId;
    console.log("takitId:" + takitId);

    //console.log(cafeHomeResponse);
    var command = "SELECT *FROM categories WHERE takitId=? ORDER BY sequence";
    var values = [takitId];
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("queryCafeHomeCategory function Unable to query. Error:", JSON.stringify(err, null, 2));
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
			var categories = [];
            //console.log("queryCafeHomeCategory func Query succeeded. " + JSON.stringify(result));
            if (result.info.numRows != 0) {
                var categories = [];
                result.forEach(function (item) {
                    //console.log(JSON.stringify(item));
                    categories.push(item);
                });
            }
                cafeHomeResponse.categories = categories;
                //console.log("cafeHomeResponse:" + (JSON.stringify(cafeHomeResponse)));
                console.log("send res");
                res.end(JSON.stringify(cafeHomeResponse));	
            
        }
    });
}

function queryCafeHomeMenuPost(cafeHomeResponse, req, res) {
    console.log("req url:" + req.url);

    var takitId = req.body.takitId;
    console.log(":takitId" + takitId);

    var menus = [];

    var command = "SELECT *FROM menus WHERE menuNO LIKE '" + takitId + "%'";
    console.log("queryCafeHomeMenu command:" + command);
    performQuery(command, function (err, result) {
        if (err) {
            console.error("queryCafeHomeMenu func Unable to query. Error:", JSON.stringify(err, null, 2));
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
        	//console.log("queryCafeHomeMenu Query succeeded. " + JSON.stringify(result[0]));
            var menus = [];
            if (result.info.numRows != 0) {
                result.forEach(function (item) {
                    //console.log(JSON.stringify(item));
                    menus.push(item);
                });
            }
                cafeHomeResponse.menus = menus;
                queryCafeHomeCategoryPost(cafeHomeResponse, req, res);
		
		}
    });
}

router.queryCafeHomePost = function (req, res) {
    console.log("queryCafeHomePost:" + JSON.stringify(req.url));
    var takitId = req.body.takitId;
    console.log("takitId:" + takitId);
    let cafeHomeResponse = new index.SuccResponse();
    cafeHomeResponse.setVersion(config.MIGRATION, req.version);

    var command = "select *from shopInfo where takitId=?";
    var values = [takitId];
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
            if (result.info.numRows === "0") {
                console.log("queryCafeHome function's query failure");
                let response = new index.FailResponse("query failure");
                response.setVersion(config.MIGRATION, req.version);
                res.send(JSON.stringify(response));
            } else {
                result.forEach(function (item) {
                    delete item.account;
                    //console.log("-----------------------hummmm"+JSON.stringify(item));
                    cafeHomeResponse.shopInfo = item;
                    queryCafeHomeMenuPost(cafeHomeResponse, req, res);
                });
            }
        }
    });
};

//shopList string으로 저장..
router.updateShopList = function (userId, shopList, next) {

    console.log("updateUserInfoShopList - userId:" + userId);

    let command = "UPDATE userInfo SET shopList=? where userId=?"; //userInfo에 shopList 넣기
    let values = [shopList, userId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("updateUserInfoShopList function Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.log("updateUserInfoShopList func Query succeeded. " + JSON.stringify(result));
            next(null);
        }
    });
};


//pushId
router.updatePushId = function (userId, token, platform, next) {
    var command = "UPDATE userInfo SET pushId=?, platform=? WHERE userId=?";
    var values = [token, platform, userId];
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("updatePushId func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.log("updatePushId func Query succeeded. " + JSON.stringify(result));
            console.log(result);
            next(null, "success");
        }
    });
};

router.removeSessionInfo = function (userId, pushId, platform, sessionId, next) {
    let command = "UPDATE userInfo SET pushId=?, platform=?, sessionId=? WHERE userId=?";
    let values = [pushId, platform, sessionId, userId];
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("updatePushId func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.log("updatePushId func Query succeeded. " + JSON.stringify(result));
            console.log(result);
            next(null, "success");
        }
    });
}

router.getPushId = function (userId, next) {
    let command = "select pushId,platform,SMSNoti from userInfo WHERE userId=?";
    let values = [userId];
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("getPushId func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            if (result.info.numRows == 0) {
                next("not exsit pushId");
            } else {
                console.log("getPushId func Query succeeded. " + JSON.stringify(result[0]));
                next(null, result[0]);
            }
        }
    });
};




router.updateShopPushId = function (userId, takitId, shopToken, platform, next) {
    var command = "UPDATE shopUserInfo SET shopPushId=?,platform=? WHERE userId=? AND takitId=?";
    var values = [shopToken, platform, userId, takitId];
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("updateShopPushId func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.log("updateShopPushId func Query succeeded. " + JSON.stringify(result));
            next(null, "success");
        }
    });
};


router.getShopPushId = function (takitId, next) {

    let command = "SELECT shopUserInfo.userId, shopPushId, shopUserInfo.platform, phone, myShopList from shopUserInfo"
        + " LEFT JOIN userInfo on shopUserInfo.userId = userInfo.userId WHERE takitId=? and GCMNoti=?"
    let values = [takitId, "on"];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("getShopPushId func Unable to query. Error:", JSON.stringify(err));
            next(err);
        } else {
            console.log("[getShopPushid func get shopPushId]:" + JSON.stringify(result));
            if (result.info.numRows === '0') {
                next("not exist shopUser");
            } else {
                decryptObj(result[0]);
                next(null, result[0]);
            }
        }
    });
}


router.getShopPushIdWithEmail=function(takitId,next){
    let command = "SELECT userId,shopPushId, platform, phone, myShopList from shopUserInfo"
        + " WHERE takitId=? and GCMNoti=? and email is not null"
    let values = [takitId, "on"];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("getShopPushId func Unable to query. Error:", JSON.stringify(err));
            next(err);
        } else {
            console.log("[getShopPushid func get shopPushId]:" + JSON.stringify(result));
            if (result.info.numRows === '0') {
                next("not exist shopUser");
            } else {
                decryptObj(result[0]);
                next(null, result[0]);
            }
        }
    });
}

router.updateShopBusiness = function (takitId, flag, next) {
    console.log("enter updateShopBusiness function");
    let command = "UPDATE shopInfo SET business=? WHERE takitId=?";
    let values = [flag, takitId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("updateShopBusiness func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.log("updateShopBusiness result:" + JSON.stringify(result));
            next(null, "success");
        }
    });
}

//SMS Noti 끄기
router.changeSMSNoti = function (userId, flag, next) {
    console.log("comes changeSMSNoti function");

    let command = "UPDATE userInfo SET SMSNoti=? where userId=?";
    let values = [flag, userId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("changeSMSNoti func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.log("changeSMSNoti Query succeeded. " + JSON.stringify(result));
            next(null);
        }
    });

}


router.getShopInfo = function (takitId, next) {  // shopInfo 조회해서 next로 넘겨줌.

    console.log("enter getShopInfo function");
    var command = "SELECT *FROM shopInfo WHERE takitId =?";
    var values = [takitId];
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("getShopInfo func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.dir("[exist shopInfo]:" + result.info.numRows);
            if (result.info.numRows === "0") {
                next("inexistant shop");
            } else {
                delete result[0].account;
                decryptObj(result[0]);
                next(null, result[0]);
            }
        }
    });
}

router.getShopInfoWithAccount = function (takitId, next) {  // shopInfo 조회해서 next로 넘겨줌.

    console.log("enter getShopInfo function");
    var command = "SELECT *FROM shopInfo WHERE takitId =?";
    var values = [takitId];
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("getShopInfo func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.dir("[exist shopInfo]:" + result.info.numRows);
            if (result.info.numRows === "0") {
                next("inexistant shop");
            } else {
                decryptObj(result[0]);
                next(null, result[0]);
            }
        }
    });
}

router.getDiscountRate = function (takitId, next) {
    console.log("enter getDiscountRate function");
    let command = "SELECT discountRate FROM shopInfo WHERE takitId=?";
    let values = [takitId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("getDiscountRate func Unable to query. Error:", JSON.stringify(err));
            next(err);
        } else {
            console.dir("[getDiscountRate in shopInfo]:" + result.info.numRows);
            if (result.info.numRows === "0") {
                next("inexistant shop");
            } else {
                next(null, result[0].discountRate);
            }
        }
    });

};

router.getAccountShop = function (takitId, next) {
    console.log("enter getAccountShop function");
    let command = "SELECT account,bankName,bankCode,depositer FROM shopInfo WHERE takitId =?";
    let values = [takitId];
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("getAccountShop func Unable to query. Error:", JSON.stringify(err));
            next(err);
        } else {
            console.dir("[exist getAccountShop]:" + result.info.numRows);
            if (result.info.numRows === "0") {
                next("incorrect takitId");
            } else {
                decryptObj(result[0]);
                next(null, result[0]);
            }
        }
    });
}

router.updateNotiMember = function (userId, takitId, onMyShopList, offMyShopList, next) {
    let command = "UPDATE shopUserInfo SET GCMNoti=(case when userId=? then 'on'"
        + "else 'off' end),"
        + "myShopList=(case when userId=? then ? "
        + "else ? end)where takitId=?";
    /*if userId 가 맞으면 'manager'로 변경
       else userId가 맞지 않고, if class==='manager' 이면(기존 manager인 사람) 'member'로 변경
                "          , else 나머지는 'member'
       */
    let values = [userId, userId, onMyShopList, offMyShopList, takitId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            console.log(result);
            next(null, "success");
        }
    });
};

//increaseOrderNumber function orderNumberCounter 수 증가 시키고, 마지막 주문 시간 재 설정.
function increaseOrderNumber(takitId, orderNumberCounterTime, next) {

    var command;
    var values;
    if(orderNumberCounterTime===null){
        command = "UPDATE shopInfo SET orderNumberCounter=orderNumberCounter+1,orderNumberCounterTime=? WHERE takitId=? and orderNumberCounterTime IS NULL";
        values = [new Date().toISOString(), takitId];
    }else{
        command = "UPDATE shopInfo SET orderNumberCounter=orderNumberCounter+1,orderNumberCounterTime=? WHERE takitId=? and orderNumberCounterTime=?";
        values = [new Date().toISOString(), takitId, orderNumberCounterTime];
    }

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("increaseOrderNumber func Unable to query. Error:", JSON.stringify(err, null, 2))
            next(err);
        } else {
            console.log("increaseOrderNumber func Query succeeded. " + JSON.stringify(result));
            (result.info.affectedRows === "0") 
            ? next("can't update orderNumberCounter") 
            : next(null);
        }
    });
}  //increaseOrderNumber function end.


router.getOrderNumber = function (shopInfo, next) {
  lock.acquire(shopInfo.takitId, function (done) {
    //orderNumberCounter = 오늘 주문수 계속 카운트.
    //orderNumberCounterTime = 가장 마지막으로 주문받은 시간 저장. => 오늘의 가장 첫 주문 확인 시에 필요.

    console.log("shopInfo in getOrderNumber:" + shopInfo);
    console.log("current orderNumberCounter:" + shopInfo.orderNumberCounter);
    console.log("current orderNuberTime:" + shopInfo.orderNumberCounterTime);

    //매일 카운트 수 리셋. orderNO도 리셋 하기 위한 작업.

    let timezone = shopInfo.timezone;   // 각 shop의 timezone
    let utcTime = new Date();
    let localTime; // 현재 localTime
    let counterLocalTime; //counterTime의 localTime
    let oldCounterTime = 0; // orderNumberCounterTime null이면 0 이전 counterTime

    if (shopInfo.orderNumberCounterTime !== null) {
        let counterTime = new Date(Date.parse(shopInfo.orderNumberCounterTime + " GMT"));
        console.log("first order time(counter time) : " + counterTime.toISOString());
        localTime = op.getTimezoneLocalTime(timezone, utcTime).toISOString(); //현재 시간의 localTime 계산
        counterLocalTime = op.getTimezoneLocalTime(timezone, counterTime).toISOString(); //이전의 orderNumberCounterTime(UTC로 저장되어 있음)의 로컬시간 계산.
        oldCounterTime = shopInfo.orderNumberCounterTime; //orderNumberCounterTime 시간이 있으면 이전 시간으로 저장.
        console.log("localTime:" + localTime.substring(0, 10));
        console.log("counterLocalTime:" + counterLocalTime.substring(0, 10));
    }


    //shop's default orderNumberCounter=0 and first order just let it 
    if(shopInfo.orderNumberCounterTime !== null && localTime.substring(0, 10) !== counterLocalTime.substring(0, 10)){
        var command = "UPDATE shopInfo SET orderNumberCounter=?, orderNumberCounterTime=? WHERE takitId=? and orderNumberCounterTime=?";
        var values = [1, utcTime.toISOString(), shopInfo.takitId, oldCounterTime];
        //orderNumberCounter를 하루의 시작 0으로 리셋

        performQueryWithParam(command, values, function (err, result) {
            if (err) {
                console.log("getOrderNumber func set orderNumberCounter with condition " + err);
                next(err);
                done(err);
            } else {
                console.dir("[getOrderNumber func update orderNumberCounter]:" + result.info.numRows);
                if(result.info.affectedRows === '0'){
                    next("can't update shopInfo");
                    done("can't update shopInfo");
                }else{
                    next(null, 1);
                    done(null,1);
                } 
            }
        });// end update orderNumberCounterTime
   
        //counterLocaltime이 어제 주문한 시간이라 localTime과 맞지 않으면(다음날이 된 경우) reset 돼야함

        // set orderNumberCounter as zero and then increment it
        console.log("reset orderNumberCounter")

    } else { //같은 날의 주문일 경우 or shop's first order
        increaseOrderNumber(shopInfo.takitId,shopInfo.orderNumberCounterTime, function (err,result) {
            if(err){
                next(err);
                done(err);
            }else{
                next(null,parseInt(shopInfo.orderNumberCounter)+1);
                done(null,"success");
            }
        });
    }
  });
};

router.insertOrderList=(userId,orderId,i,orderList,next)=>{
    //orderId,menu,length,next
	console.log("orderList:"+orderList+" userId:"+userId);
	let command = "INSERT INTO orderList(orderId,menuNO,menuName,quantity,options,price,amount,takitId,userId) values(?,?,?,?,?,?,?,?,?)";
    let menu = orderList.menus[i];
	console.log(i);
	console.log(menu);
    let values = [orderId, menu.menuNO, menu.menuName, menu.quantity, JSON.stringify(menu.options),menu.price, menu.amount,
                  orderList.takitId,userId];
                //orderList.menus.length>1 이면 장바구니 주문 => amount에는 discountAmount가 들어가야 함

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("saveOrder func insert orderList Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.log("saveOrder func insert orderList Query Succeeded");
            if(i < orderList.menus.length-1){
                i++;
                router.insertOrderList(userId,orderId,i,orderList,next);
            }else{
                next(null,orderId);
            }
        }
    });
}

function removeOrderList(orderId,next){
    let command = "DELETE from orderList where orderId=?";
    let values = [orderId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("removeOrderList func Unable to query. Error:", JSON.stringify(err, null, 2));
        } else {
            console.log("removeOrderList func Query Succeeded");
        }
    });
}

function removeKioskOrderList(orderId,next){
    let command = "DELETE from kioskOrderList where orderId=?";
    let values = [orderId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("removeKioskOrderList func Unable to query. Error:", JSON.stringify(err, null, 2));
        } else {
            console.log("removeKioskOrderList func Query Succeeded");
        }
    });
}

router.saveOrder = function (order, shopInfo, next) {
    console.log("[order:" + JSON.stringify(order) + "]");
    console.log("order's takeout:" + order.takeout);
    //1. user 검색
    router.getUserInfo(order.userId, function (err, userInfo) {
        if(err){
            next(err);
        }else{
        //2. order insert

        //3. encrypt phone
            let secretUserPhone = encryption(userInfo.phone, config.pPwd);
            let command = "INSERT INTO orders(takitId,shopName,orderName,payMethod,amount,takeout,orderNO,userId,userName,userPhone,orderStatus,orderList,userMSG,deliveryAddress,orderedTime,localOrderedTime,localOrderedDay,localOrderedHour,localOrderedDate,receiptIssue,receiptId,receiptType,deliveryFee, imp_uid,approval,card_info,total,payInfo,couponDiscount,stampUsage,couponDiscountAmount,stampIssueCount) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
      //payInfo는 주문시 상점의 할인결제옵션임. payMethod와 다름.재주문을 위해 저장함. 
            let values = [order.takitId,order.shopName, order.orderName, order.paymethod, order.amount, order.takeout, order.orderNO, userInfo.userId, userInfo.name, secretUserPhone, order.orderStatus, order.orderList,order.userMSG, order.deliveryAddress, order.orderedTime, order.localOrderedTime, order.localOrderedDay, order.localOrderedHour, order.localOrderedDate, userInfo.receiptIssue, userInfo.receiptId, userInfo.receiptType,order.deliveryFee,order.imp_uid,order.approval,order.card_info,order.total,order.payInfo,order.couponDiscount,order.stampUsage,order.couponDiscountAmount,order.stampIssueCount];
            performQueryWithParam(command, values, function (err, orderResult) {
                if (err) {
                    console.error("saveOrder func inser orders Unable to query. Error:", JSON.stringify(err, null, 2));
                    next(err);
                } else {
                    //console.dir("[Add orders]:"+result);
                    if (orderResult.info.affectedRows === '0') {
                        next("invalid orders");
                    } else {
                        console.log("saveOrder func Query succeeded. " + JSON.stringify(orderResult));
                        // 3.orderList insert
                        //let command = "INSERT INTO orderList(orderId,menuNO,menuName,quantity,options,price,amount) values(?,?,?,?,?,?)";
                        let orderList;
                        console.log("orderList...."+order.orderList);
                        if(typeof order.orderList === 'string'){
                            orderList = JSON.parse(order.orderList);
					    }else{
                            orderList = order.orderList;
                        }
						let i=0;
                        
                        router.insertOrderList(userInfo.userId,orderResult.info.insertId,i,orderList,next);						
                    }
                }
            });
        }
    });
};


//orderId로 order 검색할때
router.getOrder = function (orderId, next) {

    var command = "SELECT *FROM orders WHERE orderId=?";
    var values = [orderId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("getOrder func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.dir("[getOrder func Get MenuInfo]:" + result.info.numRows);
            if (result.info.numRows == 0) {
                next("not exist order");
            } else {
                console.log("getOrder func Query succeeded. " + JSON.stringify(result.info));
                decryptObj(result[0]);
                next(null, result[0]);
            }
        }
    });

}

// 5초전의 주문이라면 duplicate으로 에러처리한다. 
router.checkDuplicateUserOrder = function(userId,orderList, next){
    let command="SELECT orderedTime,orderList FROM orders WHERE userId="+userId +" ORDER BY orderId DESC LIMIT 1;" 
    performQuery(command, function(err,result){
        if(err){
            next(err);
        }else{
            if(result.info.numRows == 0){
                    next(null,"firstUser");
            }else{ // 
                let now= new Date();
                let lastOrderedTime = new Date(result[0].orderedTime);
                if(result[0].orderList==orderList && now.getTime()-lastOrderedTime.getTime()< 5*1000+9*60*60*1000){ // less than 5 seconds + 시차 
                    next("duplicate order");
                }else
                    next(null,result[0]);
            }
        }
    });
}


//user가 주문내역 검색할 때,
router.getOrdersUserDefault = function (params, next) {
     console.log("getOrdersUserDefault:"+JSON.stringify(params));

     var userId=params.userId;
     var lastOrderId=params.lastOrderId;
     var limit=params.limit;

     console.log("lastOrderId:" + lastOrderId+" limit:"+limit);
     var command;
     var values;

     if(params.keyword){
        if (lastOrderId == -1) {
         command = "SELECT *FROM orders WHERE userId=? AND orderId > ? AND takitId LIKE _utf8 \"%"+params.keyword+"%\" ORDER BY orderId DESC LIMIT " + limit;

       } else {
         command = "SELECT *FROM orders WHERE userId=? AND orderId < ? AND takitId LIKE _utf8 \"%"+params.keyword+"%\" ORDER BY orderId DESC LIMIT " + limit;
       }
       values = [userId, lastOrderId];            

     }else if( params.hasOwnProperty('startLocalTime') && params.hasOwnProperty('endLocalTime')){
       if (lastOrderId == -1) {
         command = "SELECT *FROM orders WHERE userId=? AND orderId > ?  AND localOrderedTime>=? AND localOrderedTime<=? ORDER BY orderId DESC LIMIT " + limit;

       } else {
         command = "SELECT *FROM orders WHERE userId=? AND orderId < ?  AND localOrderedTime>=? AND localOrderedTime<=? ORDER BY orderId DESC LIMIT " + limit;
       }
       values = [userId, lastOrderId,params.startLocalTime, params.endLocalTime];
     }else{
       if (lastOrderId == -1) {
         command = "SELECT *FROM orders WHERE userId=? AND orderId > ?  ORDER BY orderId DESC LIMIT " + limit;

       } else {
         command = "SELECT *FROM orders WHERE userId=? AND orderId < ?  ORDER BY orderId DESC LIMIT " + limit;
       }
       values = [userId, lastOrderId];
     }
     //해당 user와 shop에 맞는 orders 검색	
     performQueryWithParam(command, values, function (err, result) {
         if (err) {
             console.error("getOrdersUser func Unable to query. Error:", JSON.stringify(err, null, 2));
             next(err);
         } else {
             console.dir("[getOrdersUser func Get MenuInfo]:" + result.info.numRows);
             if (result.info.numRows == 0) {
                 next(null, result.info.numRows);
             } else {
                 console.log("getOrdersUser func Query succeeded. " + JSON.stringify(result.info));

                 var orders = [];

                 result.forEach(function (order) {
                     decryptObj(order);
                     orders.push(order);
                 });

                 next(null, orders);
             }
         }
     })
 }


router.getOrdersUser = function (body, next) {
    console.log("takitId:" + JSON.stringify(body));
    
    let days=31;

    //현재 월 아닌 전 달 기준으로 30일지 31일지 계산
    switch(new Date().getMonth()){
        case '2': case '4': case '6': case '9': case '11': 
        days=30; break;
    }
    
    body.limitTime=op.computeOptionTime(new Date(),86400000*days*parseInt(body.monthOption.substring(0,1)));
	console.log("1");

    let command="SELECT *FROM orders WHERE userId=:userId AND orderedTime > :limitTime  ORDER BY orderId DESC";
    //limitTime dateTime format으로 변경해야함 (필수는 아님 warning)

	console.log("2");
    //해당 user와 shop에 맞는 orders 검색	
    performQueryWithParam(command, body, function (err, result) {
        if (err) {
            console.error("getOrdersUser func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.dir("[getOrdersUser func Get MenuInfo]:" + result.info.numRows);
            if (result.info.numRows == 0) {
                next(null, result.info.numRows);
            } else {
                console.log("getOrdersUser func Query succeeded. " + JSON.stringify(result.info));

                var orders = [];

                result.forEach(function (order) {
                    decryptObj(order);
                    orders.push(order);
                });

                next(null, orders);
            }
        }
    })

}

router.getLocalTimeWithOption = function (option, timezone) {
    let startTime = op.getTimezoneLocalTime(timezone, new Date()).toISOString().substring(0, 11) + "00:00:00.000Z";
	console.log(startTime);
    let localStartTime = new Date(Date.parse(startTime));
    let offset = (new timezoneJS.Date(new Date(), timezone)).getTimezoneOffset(); // offset in minutes
    let queryStartTime;

	console.log(startTime)
    if (option === "today") {
        let todayStartTime = new Date(localStartTime.getTime() + (offset * 60 * 1000));
        console.log("todayStartTime in gmt:" + todayStartTime.toISOString());
        queryStartTime = todayStartTime.toISOString();
    } else if (option === "week") {
        let weekStartTime = new Date(localStartTime.getTime() - 24 * 60 * 60 * 6 * 1000 + (offset * 60 * 1000));
        console.log("weekStartTime in gmt:" + weekStartTime.toISOString());
        queryStartTime = weekStartTime.toISOString();
    } else if (option === "month") {
        let tomorrow = new Date(localStartTime.getTime() + (offset * 60 * 1000));
        let monthAgo = moment(tomorrow).subtract(1, 'M').toDate();
        queryStartTime = monthAgo.toISOString();
    } else {
        return;
    }
    return queryStartTime;
}

router.pollRecentOrder = function(orderNO,takitId,time,next){
    var command;
    var values;

    if(orderNO){
        command= "SELECT * FROM orders WHERE takitId=? AND orderedTime > ? AND orderNO >?";
        values = [takitId, time,orderNO];
    }else{ // shop이 모두 업데이트 되면 삭제하자.
        command= "SELECT * FROM orders WHERE takitId=? AND orderedTime > ? ";
        values = [takitId, time];
    }

    performQueryWithParam(command, values, function (err, result) {
            if (err) {
                console.error("queryOrders func Unable to query. Error:", JSON.stringify(err, null, 2));
                next(err);
            } else {
                console.dir("[queryOrders func pollRecentOrder]:" + result.info.numRows);
                if(result.info.numRows == 0) {
                    next(null,false);
                }else{
                    next(null,true);
                }
            }
    });
}

router.pollKioskRecentOrder = function(orderNO,takitId,time,next){
    var command;
    var values;

    if(orderNO){
        command= "SELECT * FROM kiosk WHERE takitId=? AND orderedTime > ? AND orderNO >?";
        values = [takitId, time,orderNO];
    }else{ // shop이 모두 업데이트 되면 삭제하자.
        command= "SELECT * FROM kiosk WHERE takitId=? AND orderedTime > ? ";
        values = [takitId, time];
    }

    performQueryWithParam(command, values, function (err, result) {
            if (err) {
                console.error("queryOrders func Unable to query. Error:", JSON.stringify(err, null, 2));
                next(err);
            } else {
                console.dir("[queryOrders func pollKioskRecentOrder]:" + result.info.numRows);
                if(result.info.numRows == 0) {
                    next(null,false);
                }else{
                    next(null,true);
                }
            }
    });
}

router.getOrdersShopWithStartTimeLimit=function(takitId,
                                        startTime,
                                        lastOrderId,
                                        limit,
                                        next){
        if (lastOrderId == -1) {
            var command = "SELECT *FROM orders WHERE takitId=? AND orderedTime > ? AND orderId > ?  ORDER BY orderId DESC LIMIT " + limit;
        } else {
            var command = "SELECT *FROM orders WHERE takitId=? AND orderedTime > ? AND orderId < ?  ORDER BY orderId DESC LIMIT " + limit;
        }
        var values = [takitId, startTime, lastOrderId];
        performQueryWithParam(command, values, function (err, result) {
            if (err) {
                console.error("queryOrders func Unable to query. Error:", JSON.stringify(err, null, 2));
                next(err);
            } else {
                console.dir("[queryOrders func Get MenuInfo]:" + result.info.numRows);
                if (result.info.numRows == 0) {
                    next("not exist orders");
                } else {
                    console.log("queryOrders func Query succeeded. " + JSON.stringify(result.info));

                    var orders = [];
                    result.forEach(function (order) {
                        decryptObj(order);
                        orders.push(order);
                    });
                    console.log("orders:"+JSON.stringify(orders));
                    next(null, orders);
                }
            }
        });
}

router.getKioskOrdersShop=function(takitId,option,lastOrderId, limit, next) {
    console.log("[getKioskOrdersShop]takitId:" + takitId);
    function queryOrders(startTime) {
        if (lastOrderId == -1) {
            var command = "SELECT *FROM kiosk WHERE takitId=? AND orderedTime > ? AND orderId > ?  ORDER BY orderId DESC LIMIT " + limit;
        } else {
            var command = "SELECT *FROM kiosk WHERE takitId=? AND orderedTime > ? AND orderId < ?  ORDER BY orderId DESC LIMIT " + limit;
        }
        var values = [takitId, startTime, lastOrderId];
        performQueryWithParam(command, values, function (err, result) {
            if (err) {
                console.error("queryOrders func Unable to query. Error:", JSON.stringify(err, null, 2));
                next(err);
            } else {
                console.dir("[queryOrders func Get MenuInfo]:" + result.info.numRows);
                if (result.info.numRows == 0) {
                    next("not exist orders");
                } else {
                    console.log("queryOrders func Query succeeded. " + JSON.stringify(result.info));

                    var orders = [];
                    result.forEach(function (order) {
                        decryptObj(order);
                        orders.push(order);
                    });
                    console.log("kiosk-orders:"+JSON.stringify(orders));
                    next(null, orders);
                }
            }
        });
    } //end queryOrders


    var command = "SELECT *FROM shopInfo WHERE takitId=?";
    var values = [takitId];
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("getOrdersShop func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.dir("[getOrdersShop func Get shopInfo]:" + result.info.numRows);
            if (result.info.numRows == 0) {
                next("not exist shop");
            } else {
                console.log("getOrdersShop func Query succeeded. " + JSON.stringify(result));
                console.log("timezone:" + result[0].timezone);

                let queryStartTime = router.getLocalTimeWithOption(option, result[0].timezone);

                console.log("queryStartTime:" + queryStartTime);
                queryOrders(queryStartTime);
            }
        }
    });
}


//shop에서 주문내역 검색할 때
router.getOrdersShop = function (takitId, option, lastOrderId, limit, next) {
    console.log("takitId:" + takitId);

    function queryOrders(startTime) {
        if (lastOrderId == -1) {

            var command = "SELECT *FROM orders WHERE takitId=? AND orderedTime > ? AND orderId > ?  ORDER BY orderId DESC LIMIT " + limit;
        } else {
            var command = "SELECT *FROM orders WHERE takitId=? AND orderedTime > ? AND orderId < ?  ORDER BY orderId DESC LIMIT " + limit;
        }
        var values = [takitId, startTime, lastOrderId];
        performQueryWithParam(command, values, function (err, result) {
            if (err) {
                console.error("queryOrders func Unable to query. Error:", JSON.stringify(err, null, 2));
                next(err);
            } else {
                console.dir("[queryOrders func Get MenuInfo]:" + result.info.numRows);
                if (result.info.numRows == 0) {
                    next("not exist orders");
                } else {
                    console.log("queryOrders func Query succeeded. " + JSON.stringify(result.info));

                    var orders = [];
                    result.forEach(function (order) {
                        decryptObj(order);
                        orders.push(order);
                    });
                    console.log("orders:"+JSON.stringify(orders));
                    next(null, orders);
                }
            }
        });
    } //end queryOrders

    var command = "SELECT *FROM shopInfo WHERE takitId=?";
    var values = [takitId];
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("getOrdersShop func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.dir("[getOrdersShop func Get shopInfo]:" + result.info.numRows);
            if (result.info.numRows == 0) {
                next("not exist shop");
            } else {
                console.log("getOrdersShop func Query succeeded. " + JSON.stringify(result));
                console.log("timezone:" + result[0].timezone);

                let queryStartTime = router.getLocalTimeWithOption(option, result[0].timezone);

                console.log("queryStartTime:" + queryStartTime);
                queryOrders(queryStartTime);
            }
        }
    });
};

router.getKioskPeriodOrdersShop = function (takitId, startTime, endTime, lastOrderId, limit, next) {
    console.log("takitId:" + takitId + " startTime:" + startTime + " end:" + endTime);

    //startTime and endTime => change to utc time
    async.waterfall([(callback)=>{
        router.getShopInfo(takitId,callback);
    },(shopInfo,callback)=>{

        let tmpEnd = endTime.split('T');
        endTime = tmpEnd[0]+"T23:59:59.999Z" // endTime은오늘의 마지막 시간으로 만들어줌

        startTime=startTime.replace('T',' ').replace('Z','');
        endTime=endTime.replace('T',' ').replace('Z','');

        let lcStartTime = op.getTimezoneLocalTime(shopInfo.timezone,new Date(startTime));
        let lcEndTime = op.getTimezoneLocalTime(shopInfo.timezone,new Date(endTime));
        let command;


        if (lastOrderId == -1) {
            command = "SELECT *FROM kiosk WHERE takitId=? AND orderedTime BETWEEN ? AND ? AND orderId > ?  ORDER BY orderId DESC LIMIT " + limit;
        } else {
            command = "SELECT *FROM kiosk WHERE takitId=? AND orderedTime BETWEEN ? AND ? AND orderId < ?  ORDER BY orderId DESC LIMIT " + limit;
        }
        let values = [takitId, lcStartTime.toISOString(), lcEndTime.toISOString(), lastOrderId];

        performQueryWithParam(command, values, callback);
    }],(err,result)=>{
        if (err) {
            console.log("getPeriodOrders func Unable to query. Error:");
            console.log(err);
            next(err);
        } else {
            console.log("[getPeriodOrders func Get MenuInfo]:" + result.info.numRows);

            if (result.info.numRows == 0) {
                next("not exist orders");
            } else {
                console.log("getPeriodOrders func Query succeeded. " + JSON.stringify(result.info));
                var orders = [];
                result.forEach(function (order) {
                    decryptObj(order);
                    orders.push(order);
                });

                next(null, orders);
            }
        }
    });
};

router.getPeriodOrdersShop = function (takitId, startTime, endTime, lastOrderId, limit, next) {
    console.log("takitId:" + takitId + " startTime:" + startTime + " end:" + endTime);

    //startTime and endTime => change to utc time
    async.waterfall([(callback)=>{
        router.getShopInfo(takitId,callback);
    },(shopInfo,callback)=>{

		let tmpEnd = endTime.split('T');
		endTime = tmpEnd[0]+"T23:59:59.999Z" // endTime은오늘의 마지막 시간으로 만들어줌

		startTime=startTime.replace('T',' ').replace('Z','');
        endTime=endTime.replace('T',' ').replace('Z','');

        let lcStartTime = op.getTimezoneLocalTime(shopInfo.timezone,new Date(startTime));
		let lcEndTime = op.getTimezoneLocalTime(shopInfo.timezone,new Date(endTime));
		let command;
		

        if (lastOrderId == -1) {
            command = "SELECT *FROM orders WHERE takitId=? AND orderedTime BETWEEN ? AND ? AND orderId > ?  ORDER BY orderId DESC LIMIT " + limit;
        } else {
            command = "SELECT *FROM orders WHERE takitId=? AND orderedTime BETWEEN ? AND ? AND orderId < ?  ORDER BY orderId DESC LIMIT " + limit;
        }
        let values = [takitId, lcStartTime.toISOString(), lcEndTime.toISOString(), lastOrderId];

        performQueryWithParam(command, values, callback);
    }],(err,result)=>{
        if (err) {
            console.log("getPeriodOrders func Unable to query. Error:");
            console.log(err);
            next(err);
        } else {
            console.log("[getPeriodOrders func Get MenuInfo]:" + result.info.numRows);

            if (result.info.numRows == 0) {
                next("not exist orders");
            } else {
                console.log("getPeriodOrders func Query succeeded. " + JSON.stringify(result.info));
                var orders = [];
                result.forEach(function (order) {
                    decryptObj(order);
                    orders.push(order);
                });

                next(null, orders);
            }
        }
    });
};


//order's noti mode 에서 필요한 order를 가져옴.
router.getOrdersNotiMode = function (userId, next) {
    console.log("getOrdersNotiMode comes!!!");

    let currentTime = new Date();
    console.log(currentTime);
    let currentTimeStr = currentTime.toISOString().substring(0, 19).replace('T', ' ');
    let yesterDayTime = new Date(currentTime.getTime() - 86400000) // 86400000 = 하루 만큼의 milliseconds
    console.log(yesterDayTime);
    let yesterDayTimeStr = yesterDayTime.toISOString().substring(0, 19).replace('T', ' ');

    console.log("getOrdersNotiMode comes!!!");
    let command = "SELECT *FROM orders WHERE userId=? and orderedTime >= ? and orderedTime <= ? and (orderStatus=? or orderStatus=?)";
    let values = [userId, yesterDayTimeStr, currentTimeStr, "paid", "checked"];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            console.log(result);

            let orders = [];
            result.forEach(function (order) {
                decryptObj(order);
                orders.push(order);
            })

            next(null, orders);
        }
    });
};


router.updateKioskOrderStatus = function (orderId, oldStatus, nextStatus, timeName, timeValue, cancelReason, next) {
    values = {};
    let command;

    values.nextStatus = nextStatus,
    values.timeValue = timeValue.toISOString(),
    values.orderId = orderId,
    values.oldStatus = oldStatus;

    //cancelled 상태면 이유 넣음. 아니면 그대로 null
    if (nextStatus === 'cancelled') {
        values.cancelReason = cancelReason;
        command = "UPDATE kiosk SET orderStatus=:nextStatus," + timeName + "=:timeValue, cancelReason=:cancelReason WHERE orderId=:orderId";
    }else if(nextStatus="pickup"){
        command = "UPDATE kiosk SET orderStatus=:nextStatus WHERE orderId=:orderId AND orderStatus=:oldStatus";
    }else{
        command = "UPDATE kiosk SET orderStatus=:nextStatus," + timeName + "=:timeValue WHERE orderId=:orderId AND orderStatus=:oldStatus";
    }

    performQueryWithParam(command, values, function (err, result) {
                    if (err) {
                        console.error("updateKioskOrderStatus func Unable to query. Error:", JSON.stringify(err, null, 2));
                        next(err);
                    } else {
                        console.dir("[updateKioskOrderStatus func Get MenuInfo]:" + result.info.affectedRows);
                        if (result.info.affectedRows == 0) {
                            next("can't update orders");
                        } else {
                            console.log("updateOrderStatus func Query succeeded. " + JSON.stringify(result[0]));
                            if(nextStatus ==='cancelled'){
                                removeKioskOrderList(orderId);
                            }
                            next(null, "success");
                        }
                    }
    });
}

router.updateOrderStatus = function (orderId, oldStatus, nextStatus, timeName, timeValue, cancelReason, timezone, next) {
    console.log("oldStatus:" + oldStatus + " nextStatus:" + nextStatus);
    //현재 db에 저장된 주문상태,   새로 update할 주문상태
    //timeName is checkedTime, completeTime, canceledTime ...

     //임시로 lock함수를 사용하여 해결함. 
  lock.acquire(orderId, function(done) {
  
    var command = "SELECT orderStatus,cancelledTime FROM orders WHERE orderId=?";  //orderStatus와 oldStatus 같은지 비교하기 위해 조회함===> 잘못됨. 수정필요함 ㅜㅜ

    var values = [orderId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("updateOrderStatus func  Unable to query. Error:", JSON.stringify(err, null, 2));
            done(err);
        } else {
            console.dir("[updateOrderStatus func]:" + result.info.numRows);
            if (result.info.numRows == 0) {
                done("not exist order");
            } else {
                console.log("updateOrderStatus func Query succeeded. " + JSON.stringify(result));

                values = {};

                //orderStatus === oldStatus 이면 update 실행. 다르면 실행x
                if(oldStatus === '' && nextStatus==='cancelled' && result[0].cancelledTime!=null){  
                    //상점주에 의한 cancel일 경우 모든 상태에서 주문취소가 가능하다. 이미 취소된 주문에 대해 두번 취소가되어 고객환불이 두번일어나는 경우를 막기위함
                    done('incorrect old orderStatus');
                } else if (result[0].orderStatus === oldStatus || oldStatus === '' || oldStatus === null) {
                    command = "UPDATE orders SET orderStatus=:nextStatus," + timeName + "=:timeValue, cancelReason=:cancelReason , localCancelledTime=:localCancelledTime WHERE orderId=:orderId";
                    values.nextStatus = nextStatus,
                        values.timeValue = timeValue.toISOString(),
                        values.orderId = orderId,
                        values.cancelReason = null;

                    //cancelled 상태면 이유 넣음. 아니면 그대로 null
                    if (nextStatus === 'cancelled') {
                        values.cancelReason = cancelReason;
                        values.localCancelledTime = op.getTimezoneLocalTime(timezone, timeValue);
                        console.log("!!!! localCancelledTime:"+values.localCancelledTime);
                    }
                } else {
                    done("incorrect old orderStatus");
                    return;
                }

                performQueryWithParam(command, values, function (err, result) {
                    if (err) {
                        console.error("updateOrderStatus func Unable to query. Error:", JSON.stringify(err, null, 2));
                        done(err);
                    } else {
                        console.dir("[updateOrderStatus func Get MenuInfo]:" + result.info.affectedRows);
                        if (result.info.affectedRows == 0) {
                            done("can't update orders");
                        } else {
                            console.log("updateOrderStatus func Query succeeded. " + JSON.stringify(result[0]));
                            if(nextStatus ==='cancelled'){
                                removeOrderList(orderId);
                            }
                            done(null, "success");
                        }
                    }
                });
            }

        }

    });},function(err, result) {
        if (err) {
            next(err);
        } else {
            next(null,"success"); 
        }
    });

};


//////// 매출 및 통계 API /////////

router.getSales = function (takitId, startTime, next) {
    //select sum(amount) from orders where takitId = "세종대@더큰도시락" and orderedTime < "2016-12-28";
    console.log("takitId:" + takitId);

    let command = "SELECT SUM(amount) AS sales FROM orders WHERE takitId=? AND (orderStatus='completed' OR orderStatus='pickup')AND orderedTime > ?";
    let values = [takitId, startTime];
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("querySales func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.dir("[querySales func Get MenuInfo]:" + result.info.numRows);
            if (result.info.numRows == 0) {
                next(null, 0);
            } else {
                console.log("querySales func Query succeeded. " + JSON.stringify(result.info));
				console.log(result);
                next(null, result[0].sales);
            }
        }
    });
}

router.getSalesPeriod = function (takitId, startTime, endTime, next) {
    console.log("takitId:" + takitId + " startTime:" + startTime + " end:" + endTime);

	async.waterfall([(callback)=>{
        router.getShopInfo(takitId,callback);
    },(shopInfo,callback)=>{
        let tmpEnd = endTime.split('T');
        endTime = tmpEnd[0]+"T23:59:59.999Z" // endTime은오늘의 마지막 시간으로 만들어줌

        startTime=startTime.replace('T',' ').replace('Z','');
        endTime=endTime.replace('T',' ').replace('Z','');
        let lcStartTime = op.getTimezoneLocalTime(shopInfo.timezone,new Date(startTime));
        let lcEndTime = op.getTimezoneLocalTime(shopInfo.timezone,new Date(endTime));

        let command = "SELECT SUM(amount) AS sales FROM orders WHERE takitId=? AND (orderStatus='completed' OR orderStatus='pickup' )AND orderedTime BETWEEN ? AND ?" //startTime과 endTime 위치 중요!!
        let values = [takitId, lcStartTime.toISOString(), lcEndTime.toISOString()];
        performQueryWithParam(command, values, callback);
    }],(err,result)=>{
        if (err) {
            console.error("getSalesPeriod func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.dir("[getSalesPeriod func Get MenuInfo]:" + result.info.numRows);

            if (result.info.numRows == 0) {
                next(null, 0);
            } else {
                console.log("getSalesPeriod func Query succeeded. " + JSON.stringify(result.info));
                next(null, result[0].sales);
            }
        }
    });
}

router.getStatsMenu = function (takitId, startTime, next) {
    //select menuName, SUM(quantity) FROM orderList where menuNO LIKE \'"+takitId+"%\'GROUP BY menuName";
    console.log("getStatsMenu comes");

    let command = "SELECT menuName, SUM(quantity) AS count, SUM(orderList.amount) AS menuSales FROM orderList LEFT JOIN orders ON orderList.orderId=orders.orderId WHERE (orderStatus='completed' OR orderStatus='pickup') AND menuNO LIKE '" + takitId + "%' AND orderedTime > ? GROUP BY menuName"
    let values = [startTime];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("getStatsMenu func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            if (result.info.numRows == 0) {
                next(null, 0);
            } else {
                console.log("getStatsMenu func Query succeeded. " + JSON.stringify(result.info));
                delete result.info;
				console.log(result);
                next(null, result);
            }
        }
    });
}

router.getPeriodStatsMenu = function (takitId, startTime, endTime, next) {
    console.log("getPeriodStatsMenu comes");

	async.waterfall([(callback)=>{
        router.getShopInfo(takitId,callback);
    },(shopInfo,callback)=>{
        let tmpEnd = endTime.split('T');
        endTime = tmpEnd[0]+"T23:59:59.999Z" // endTime은오늘의 마지막 시간으로 만들어줌

        startTime=startTime.replace('T',' ').replace('Z','');
        endTime=endTime.replace('T',' ').replace('Z','');
        let lcStartTime = op.getTimezoneLocalTime(shopInfo.timezone,new Date(startTime));
        let lcEndTime = op.getTimezoneLocalTime(shopInfo.timezone,new Date(endTime));

        let command = "SELECT menuName, SUM(quantity) AS count, SUM(orderList.amount) AS menuSales FROM orderList LEFT JOIN orders ON orderList.orderId=orders.orderId WHERE menuNO LIKE'" + takitId + "%' AND (orderStatus='completed' OR orderStatus='pickup') AND orderedTime BETWEEN ? AND ? GROUP BY menuName";
        let values = [lcStartTime.toISOString(), lcEndTime.toISOString()];

        performQueryWithParam(command, values,callback);

    }],(err,result)=>{
        if (err) {
            console.error("getPeriodStatsMenu func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            if (result.info.numRows == '0') {
                console.log(result.info.numRows);
                next(null,0);
            } else {
                console.log("getPeriodStatsMenu func Query succeeded. " + JSON.stringify(result.info));
                delete result.info;
                next(null, result);
            }
        }
    });

}

router.getKioskPeriodStatsMenu = function (takitId, startTime, endTime, next) {
    console.log("getKioskPeriodStatsMenu comes");

    async.waterfall([(callback)=>{
        router.getShopInfo(takitId,callback);
    },(shopInfo,callback)=>{
        let tmpEnd = endTime.split('T');
        endTime = tmpEnd[0]+"T23:59:59.999Z" // endTime은오늘의 마지막 시간으로 만들어줌

        startTime=startTime.replace('T',' ').replace('Z','');
        endTime=endTime.replace('T',' ').replace('Z','');
        let lcStartTime = op.getTimezoneLocalTime(shopInfo.timezone,new Date(startTime));
        let lcEndTime = op.getTimezoneLocalTime(shopInfo.timezone,new Date(endTime));

        let command = "SELECT menuName, SUM(quantity) AS count, SUM(orderList.amount) AS menuSales FROM kioskOrderList LEFT JOIN orders ON orderList.orderId=orders.orderId WHERE menuNO LIKE'" + takitId + "%' AND (orderStatus='completed' OR orderStatus='pickup') AND orderedTime BETWEEN ? AND ? GROUP BY menuName";
        let values = [lcStartTime.toISOString(), lcEndTime.toISOString()];

        performQueryWithParam(command, values,callback);

    }],(err,result)=>{
        if (err) {
            console.error("getPeriodStatsMenu func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            if (result.info.numRows == '0') {
                console.log(result.info.numRows);
                next(null,0);
            } else {
                console.log("getPeriodStatsMenu func Query succeeded. " + JSON.stringify(result.info));
                delete result.info;
                next(null, result);
            }
        }
    });

}
////////////매출 및 통계 end////////////



//////////////cash /////////////////
router.validCashId=(cashId,next)=>{
    let command = "SELECT *FROM cash WHERE cashId=?";
    let values=[cashId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("validUserwithPhone function error:" + JSON.stringify(err));
            next(err);
        } else {
            if (result.info.numRows === "0") {
                next(null,"valid");
            } else {
                console.log("validUserwithPhone function success");
                next(null, "duplication");
            }
        }
    });
}


router.updateBalanceCash = function (cashId, amount, balance, next) {

    let command = "UPDATE cash SET balance=balance+? WHERE cashId =? and balance=?";
    let values = [amount, cashId, balance];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("updateBalanceCash function err:" + JSON.stringify(err));
            next(err);
        } else {
            console.log("updateBalanceCash:" + JSON.stringify(result));
            if (amount !== 0 && result.info.affectedRows === "0") {
                next("already checked cash");
            } else {
                next(null, "success");
            }
        }
    });
};

router.updateBalanceCashWithCoupon = function (cashId, amount, next) {

    let command = "UPDATE cash SET balance=balance+? WHERE cashId =?";
    let values = [amount, cashId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("updateBalanceCash function err:" + JSON.stringify(err));
            next(err);
        } else {
            console.log("updateBalanceCash:" + JSON.stringify(result));
            if (amount !== 0 && result.info.affectedRows === "0") {
                next("fail to update BalanceCash");
            } else {
                router.getBalanceCash(cashId,function(err,result){
                    if(err){
                        next("balance query error");
                    }else{
                        console.log("!!!!!balance:"+result);
                        next(null,result);
                    }
                });         
            }
        }
    });
};


router.getBalanceCash = function (cashId, next) {

    let command = "SELECT balance FROM cash WHERE cashId = ?";
    let values = [cashId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("getBalanceCash function err:" + JSON.stringify(err));
            next(err);
        } else {
            if (result.info.numRows === "0") {
                next("incorrect cashId");
            } else {
                console.log("getBalanceCash:" + JSON.stringify(result));
                next(null, result[0].balance);
            }
        }
    });
}

router.insertCashList = function (cashList, next) {
    console.log("insertCashList comes");

    if (cashList.account !== undefined) {
        cashList.account = encryption(cashList.account, config.aPwd);
    }

    let command = "INSERT INTO cashList(cashId,transactionType,amount,fee,nowBalance,transactionTime,orderId,depositTime, bankCode,bankName ,account,confirm,couponName)" +
        "VALUES(:cashId,:transactionType,:amount,:fee, :nowBalance,:transactionTime,:orderId,:depositTime,:bankCode,:bankName, :account,:confirm,:couponName)";

    performQueryWithParam(command, cashList, function (err, result) {
        if (err) {
            console.log("insertCashList function err:" + JSON.stringify(err));
            next(err);
        } else {
            console.log("insertCashList:" + JSON.stringify(result));
            next(null, result.info.insertId);
        }
    });
}

router.getCashList = function (cashId, lastTuno, limit, next) {
    console.log("mariaDB.getCashList start!!");

    let command;
    if (lastTuno == -1) {
        command = "SELECT takitId,orderName,cashList.* FROM cashList LEFT JOIN orders ON cashList.orderId=orders.orderId  WHERE cashId =? AND cashTuno > ? AND transactionType!='wrong' ORDER BY transactionTime DESC LIMIT " + limit;
    } else {
        command = "SELECT takitId,orderName,cashList.* FROM cashList LEFT JOIN orders ON cashList.orderId=orders.orderId WHERE cashId =? AND cashTuno < ? AND transactionType!='wrong' ORDER BY transactionTime DESC LIMIT " + limit;
    }
    let values = [cashId, lastTuno];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("getCashList function Error:" + JSON.stringify(err));
            next(err);
        } else {
            console.log("result:" + JSON.stringify(result));
            if (result.info.numRows === '0') {
                next(null, "0");
            } else {
                console.log("getCashList find cashList");
                delete result.info;
                for (let i = 0; i < result.length; i++) {
                    if (result[i].account !== null) {
                        decryptObj(result[i]);
                    }
                }
                next(null, result);
            }
        }
    });
}

router.getCashListWithPeriod = function (cashId, lastTuno,start,end, limit, next) {
    console.log("mariaDB.getCashListWithPeriod start!!");

    let command;
    if (lastTuno == -1) {
        command = "SELECT takitId,orderName,cashList.* FROM cashList LEFT JOIN orders ON cashList.orderId=orders.orderId  WHERE cashId =? AND cashTuno > ? AND transactionTime>=? AND transactionTime<=? AND transactionType!='wrong' ORDER BY transactionTime DESC LIMIT " + limit;
    } else {
        command = "SELECT takitId,orderName,cashList.* FROM cashList LEFT JOIN orders ON cashList.orderId=orders.orderId WHERE cashId =? AND cashTuno < ? AND transactionTime>=? AND transactionTime<=? AND transactionType!='wrong' ORDER BY transactionTime DESC LIMIT " + limit;
    }
    let values = [cashId, lastTuno,start,end];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("getCashList function Error:" + JSON.stringify(err));
            next(err);
        } else {
            console.log("result:" + JSON.stringify(result));
            if (result.info.numRows === '0') {
                next(null, "0");
            } else {
                console.log("getCashList find cashList");
                delete result.info;
                for (let i = 0; i < result.length; i++) {
                    if (result[i].account !== null) {
                        decryptObj(result[i]);
                    }
                }
                next(null, result);
            }
        }
    });
}

router.updateCashList = function (cashList, next) {
    console.log("mariaDB.updateCashList start!!");

    let command = "UPDATE cashList SET cashId=:cashId,transactionType=:transactionType, transactionTime=:transactionTime, confirm=:confirm, nowBalance=:nowBalance WHERE cashTuno=:cashTuno";

    performQueryWithParam(command, cashList, function (err, result) {
        if (err) {
            console.log("updateCashList function Error:" + JSON.stringify(err));
            next(err);
        } else {
            console.log("result:" + JSON.stringify(result));
            next(null, "success");
        }
    });
}

router.confirmCashList = function (cashList, next) {
    console.log("mariaDB.updateCashList start!!");

    let command = "UPDATE cashList SET cashId=:cashId,transactionType=:transactionType, transactionTime=:transactionTime, confirm=:confirm, nowBalance=:nowBalance WHERE cashTuno=:cashTuno and confirm=0";

    performQueryWithParam(command, cashList, function (err, result) {
        if (err) {
            console.log("updateCashList function Error:" + JSON.stringify(err));
            next(err);
        } else {
            console.log("result:" + JSON.stringify(result));
            if(result.info.affectedRows==1)
                next(null, "success");
            else // humm.... confirm is not 0?
                next("already checked cash");
        }
    });
}

router.updateTransactionType = function (cashTuno, type, next) {
    console.log("mariaDB.updateTransactionType start!!");
    let command = "UPDATE cashList SET transactionType=? where cashTuno=?";
    let values = [type,cashTuno];


    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("getCashList function Error:" + JSON.stringify(err));
            next(err);
        } else {
            console.log("result:" + JSON.stringify(result));
            next(null, "success");
        }
    });
}

router.getCashListWithTuno = function (cashTuno, next) {
    console.log("mariaDB.getCashList start!!");

    let command = "SELECT * FROM cashList where cashTuno = ?"
    let values = [cashTuno];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("getCashListwithTuno function Error:" + JSON.stringify(err));
            next(err);
        } else {
            console.log("result:" + JSON.stringify(result));
            if (result.info.numRows === '0') {
                next("invalid cashTuno");
            } else {
                console.log("getCashListwithTuno find cashList");
                next(null, result[0]);
            }
        }
    });
}


router.getDepositedCash = function (cashList, next) {
    console.log("mariaDB.getDepositedCash start!!");

    console.log("cashList:" + JSON.stringify(cashList));
	let command = "SELECT * FROM cashList WHERE transactionType='deposit' and confirm=0 and cashId =:depositMemo and bankCode=:bankCode "
                    +"and amount=:amount and depositTime like '"+cashList.depositTime.substring(0,13)+"%'";

	if(cashList.bankCode =='-1' || cashList.bankCode=='-2' || cashList.bankCode=='-3'){
        command = "SELECT * FROM cashList WHERE transactionType='deposit' and confirm=0 and cashId =:depositMemo "
                    +"and amount=:amount and depositTime like '"+cashList.depositTime.substring(0,13)+"%'";
    }
    if(cashList.bankCode=='011'){ // 농협의 경우 012,011 모두 들어온다 
         command = "SELECT * FROM cashList WHERE transactionType='deposit' and confirm=0 and cashId =:depositMemo and (bankCode='011' or bankCode='012') "
                    +"and amount=:amount and depositTime like '"+cashList.depositTime.substring(0,13)+"%'";
    }	
    // let tomorrowTime = new Date(cashList.depositTime.getTime()+86400000).toISOString();
    // let yesterDayTime = new Date(cashList.depositTime.getTime()-86400000).toISOString(); //86400000 24시간 만큼의 milliseconds
    // console.log(tomorrowTime);
    // console.log(yesterDayTime);

    // //입금시각이 23인 경우 다음날의 날짜로도 검색
    // if(cashList.depositHour ===23){

    //     command = "SELECT * FROM cashList WHERE transactionType='deposit' and confirm=0 and cashId =:depositMemo and bankCode=:bankCode "
    //               +"and amount=:amount and (depositTime like '"+cashList.depositDate+"%' or depositTime like '"+tomorrowTime.substring(0,10)+"%')";
    // //입금시각이 00시인 경우 전 날짜로도 검색
    // }else if(cashList.depositHour === 0){
    //     command = "SELECT * FROM cashList WHERE transactionType='deposit' and confirm=0 and cashId =:depositMemo and bankCode=:bankCode "
    //               +"and amount=:amount and (depositTime like '"+cashList.depositDate+"%' or depositTime like '"+yesterDayTime.substring(0,10)+"%')";

    // }

    performQueryWithParam(command, cashList, function (err, result) {
        if (err) {
			console.log(err);
            console.log("mariaDB.getDepositedCash function Error:" + JSON.stringify(err));
            next(err);
        } else {
            console.log("result:" + JSON.stringify(result));
            if (result.info.numRows === '0') {
                next("incorrect depositor");
            } else {
                console.log("getDepositedCash find cashList");
                delete result.info;
                next(null, result);
            }
        }
    });
}



router.getPushIdWithCashId = function (cashId, next) {
    console.log("getPushIdWithCashId:" + cashId);
    let command = "SELECT pushId, platform FROM userInfo LEFT JOIN cash ON userInfo.userId=cash.userId WHERE cashId=?";
    let values = [cashId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("getPushIdWithCashId function Error:" + JSON.stringify(err));
            next(err);
        } else {
            console.log("result:" + JSON.stringify(result));
            if (result.info.numRows === '0') {
                next(null, "incorrect cashId");
            } else {
                console.log("getPushIdWithCashId function success");
                next(null, result[0]);
            }
        }
    });
}

router.getBankName = function(bankCode,next){
   let command = "SELECT bankName FROM bankInfo where bankCode =?";
   let values = [bankCode];

   performQueryWithParam(command, values, function(err,result){
      if(err){
         console.log("getBankName function Error:"+JSON.stringify(err));
         next(err);
      }else{
         console.log("result:"+JSON.stringify(result));
         if(result.info.numRows === '0'){
            next("incorrect bankCode");
         }else{
            console.log("getBankName function success");
            next(null,result[0].bankName);
         }
      }
   });
}

/*router.getBankName = function (branchCode, next) {
    console.log("getBankName start");
    let command = "SELECT bankName, branchName FROM bank WHERE branchCode LIKE \'" + branchCode.substring(0, 6) + "%\'";
    let values = [branchCode];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("getBankName function Error:" + JSON.stringify(err));
            next(err);
        } else {
            console.log("getBankName result:" + JSON.stringify(result));
            if (result.info.numRows === '0') {
                next("incorrect branchCode");
            } else {
                console.log("getBankName function success");
                next(null, result[0]);
            }
        }
    });
};*/


router.findBranchName = function (branchName, bankName, next) {
    console.log("mariaDB.findBranchName " + branchName, "and bankName " + bankName);
    let command = "SELECT branchCode, branchName FROM bank WHERE branchName LIKE _utf8 \'" + branchName + "%\' and bankName LIKE _utf8 \'" + bankName + "%\'";

    performQuery(command, function (err, result) {
        if (err) {
            console.log("findBranchName Error:" + JSON.stringify(err));
            next(err);
        } else {
            console.log("result:" + JSON.stringify(result));
            if (result.info.numRows === '0') {
                next(null, []);
            } else {
                console.dir("findBranchName result:" + result.info.numRows);
                delete result.info;
                next(null, result);
            }
        }
    });
}

router.updateConfirmCount = function (cashId, confirmCount, next) {
    console.log("updateConfirmCount start confirmCount:" + confirmCount);
    let command = "UPDATE cash SET confirmCount=? WHERE cashId=?";
    let values = [confirmCount, cashId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("updateConfirmCount function Error:" + JSON.stringify(err));
            next(err);
        } else {
            console.log("updateConfirmCount result:" + JSON.stringify(result));
            next(null, result[0]);
        }
    });
}


checkShopBalance=function(takitId,amount,config){
   return new Promise((resolve,reject)=>{    
       let command="SELECT sales,balance from shopInfo WHERE takitId=?";
       let values=[takitId];
       performQueryWithParam(command, values, function (err, result) {
            console.log("shop:"+takitId+" amount:"+amount+" "+config+"shop-balance:"+result[0].balance);
            resolve();
       })
   });
}

//shop-cash
router.updateSalesShop = function (takitId, amount, next) {
 checkShopBalance(takitId,amount,"before").then(()=>{
    console.log("updateShopSales start");

    let command = "UPDATE shopInfo SET sales=sales+?,balance=balance+? WHERE takitId=?";
    let values = [amount, amount, takitId];

    lock.acquire(takitId, function (done) {
      performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("updateSalesShop function Error:" + JSON.stringify(err));
            next(err);
            done(err); 
        } else {
            console.log("updateSalesShop result:" + JSON.stringify(result));
            checkShopBalance(takitId,amount,"after").then(()=>{
                 next(null,"success");
                 done(null,"success"); 
            });
        }
      });
    });
 });
}


router.updateCardSalesShop = function (takitId, amount, next) {
    console.log("updateShopSales start");
    let command = "UPDATE shopInfo SET sales=sales+?,cardBalance=balance+? WHERE takitId=?";
    let values = [amount, amount, takitId];

  lock.acquire(takitId, function (done) {
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("updateSalesShop function Error:" + JSON.stringify(err));
            next(err);
            done(err);
        } else {
            console.log("updateSalesShop result:" + JSON.stringify(result));
            next(null, "success");
            done(null, "success");
        }
    });
  });
}

router.updateWithdrawalShop = function (takitId, amount, balance, next) {
    let command = "UPDATE shopInfo SET balance=balance+?,withdrawalCount=withdrawalCount+1 WHERE takitId=? and balance=?";
    let values = [amount, takitId, balance];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("updateConfirmCount function Error:" + JSON.stringify(err));
            next(err);
        } else {
            console.log("updateConfirmCount result:" + JSON.stringify(result));
            next(null, "success");
        }
    });
}

router.updateBalanceShop = function (takitId, amount, next) {
    let command = "UPDATE shopInfo SET balance=balance+? WHERE takitId=?";
    let values = [amount, takitId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("updateBalanceShop function Error:" + JSON.stringify(err));
            next(err);
        } else {
            console.log("updateBalanceShop result:" + JSON.stringify(result));
            next(null, "success");
        }
    });
}

router.getBalnaceShop = function (takitId, next) {
    console.log("mariaDB.getBalnaceShop start!!");

    let command = "SELECT sales,balance FROM shopInfo where takitId = ?"
    let values = [takitId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("getBalnaceShop function Error:" + JSON.stringify(err));
            next(err);
        } else {
            console.log("result:" + JSON.stringify(result));
            if (result.info.numRows === '0') {
                next("invalid takitId");
            } else {
                console.log("getBalnaceShop find cashList");
                next(null, result[0]);
            }
        }
    });
}

router.insertWithdrawalList = function (takitId, amount, fee, nowBalance, next) {

    console.log("mariaDB.insertWithdrawalList start!!");

    let command = "INSERT INTO withdrawalList(takitId,amount,fee,nowBalance,withdrawalTime) VALUES(?,?,?,?,?)"
    let values = [takitId, amount, fee, nowBalance, new Date().toISOString()];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("insertWithdrawalList function Error:" + JSON.stringify(err));
            next(err);
        } else {
            console.log("result:" + JSON.stringify(result));
            next(null, result.info.insertId);
        }
    });
}

router.getWithdrawalList = function (takitId, lastWithdNO, limit, next) {
    console.log("mariaDB.getWithdrawalList start!!");

    let command;
    if (lastWithdNO == -1) {
        command = "SELECT * FROM withdrawalList WHERE takitId =? AND withdNO > ? ORDER BY withdNO DESC LIMIT " + limit;
    } else {
        command = "SELECT * FROM withdrawalList WHERE takitId =? AND withdNO < ? ORDER BY withdNO DESC LIMIT " + limit;
    }
    let values = [takitId, lastWithdNO];


    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log("getWithdrawalList function Error:" + JSON.stringify(err));
            next(err);
        } else {
            console.log("result:" + JSON.stringify(result));
            if (result.info.numRows === '0') {
                next(null, '0');
            } else {
                console.log("getWithdrawalList success");
                delete result.info;
                next(null, result);
            }
        }
    });
}

router.selectCategory=function(category,next){
        let command = "SELECT *FROM categories where takitId=:takitId and sequence >= :sequence";

        if(category.sequence ===null|| category.sequence === undefined){
            category.sequence = 0;
        }
        let values = [category.takitId, category.sequence];
        performQueryWithParam(command,values,function(err,result){
            if (err) {
                console.log("getWithdrawalList function Error:" + JSON.stringify(err));
                next(err);
            } else {
                console.log("result:" + JSON.stringify(result));
                if (result.info.numRows === '0') {
                    next(null,'0');
                } else {
                    console.log("getWithdrawalList success");
                    delete result.info;
                    next(null,result);
                }
            }
        });
};


router.insertTakitId = function (takitId, next) {
    let command = "INSERT INTO takit VALUES(:serviceName,:shopName)";

    performQueryWithParam(command, takitId, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            console.log("insertTakitId success");
            next(null, "success");
        }
    });
}

router.insertCategory = function (category, next) {
    let command = "INSERT INTO categories VALUES(:takitId,:categoryNO, :sequence,:categoryName,:categoryNameEn)";

    performQueryWithParam(command, category, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            console.log("insertCategory success");
            next(null, "success");
        }
    });
}


//이전 sequence정보 필요해 보임
router.updateCategory = function (category, next) {
    console.log("updateCategory start!");
    delete category.newSequence;
    delete category.oldSequence;

    let command = "UPDATE categories SET ";
    //WHERE takitId=? categoryNO=?";
    let keys = Object.keys(category);
    for (let i = 0; i < keys.length; i++) {
        if (category[keys[i]] !== "" &&  keys[i] !=="version") {
            command += keys[i] + "=:" + keys[i] + ", ";
        }
    }

    command += "WHERE takitId=:takitId and categoryNO=:categoryNO";
    console.log(typeof command);
    command = command.replace(", WHERE", " WHERE");
    console.log(command);

    performQueryWithParam(command, category, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            console.log("updateCategory success");
            next(null, "success");
        }
    });
};

router.deleteCategory=(category,next)=>{
	console.log("deleteCategory start");

	let command = "DELETE FROM categories where takitId=:takitId AND categoryNO=:categoryNO";
	
	performQueryWithParam(command, category, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
			console.log("deleteCategory success:"+JSON.stringify(result.info));
			if(result.info.affectedRows === '0'){
				next("not exist");
			}else{
            	next(null, "success");
			}
        }
    });

}

//update 될 sequence no보다 큰 sequence no들 +1로 update해줌
router.updateSequence=function(category,num,next){
    let command = "UPDATE categories SET sequence=sequence"+num+" WHERE sequence >= :sequence and takitId=:takitId";
    
    performQueryWithParam(command, category, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            console.log("updateSeqWhenAdd success");
            next(null, "success");
        }
    });
}


router.updateSeqWhenModify=function(category,next){
	//newSequence : want to update sequence,   //oldSequence : saved sequence before
	let command;
	if(category.oldSequence > category.newSequence){
    	command = "UPDATE categories SET sequence=(CASE WHEN sequence < :newSequence THEN sequence "
        	+ "WHEN sequence=:oldSequence THEN :newSequence WHEN sequence > :oldSequence THEN sequence "
        	+ "ELSE sequence+1 END)";
	}else{
		command = "UPDATE categories SET sequence=(CASE WHEN sequence > :newSequence THEN sequence "
            + "WHEN sequence=:oldSequence THEN :newSequence WHEN sequence < :oldSequence THEN sequence "
            + "ELSE sequence-1 END)";
	}

	command += " WHERE takitId=:takitId";

    performQueryWithParam(command, category, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            console.log("updateSeqWhenModify success");
            next(null, "success");
        }
    });
}

//shop user 정보 가져옴.


router.insertMenu = function (menu, next) {

	console.log(menu);
	
	if(menu.hasOwnProperty('options') && menu.options !== null){
		menu.options = JSON.stringify(menu.options);
	}

	if(menu.hasOwnProperty('optionsEn') && menu.optionsEn !== null){
        menu.optionsEn = JSON.stringify(menu.optionsEn);
    }


	//if(menu.optionsEn !== undefined){
	//	menu.optionsEn = JOSN.stringify(menu.optionsEn);	
	//}

	delete menu.delivery;

	let command = "INSERT INTO menus(";
    let keys = Object.keys(menu);

    //가지고 있는 키 만큼 query에 붙임
    console.log(keys);
    for (let i = 0; i < keys.length; i++) {
        if (menu[keys[i]] !== "" && keys[i] !== "oldMenuName" && keys[i] !== "version") {
            command += keys[i]+", ";
        }
    }	

	command += ") VALUES("
	command = command.replace(", )", ")");
	
	for (let i = 0; i < keys.length; i++) {
        if (menu[keys[i]] !== "" && keys[i] !== "oldMenuName" && keys[i] !== "version") {
            command += ":"+keys[i]+", ";
        }
    }
	
	command += ")";
	command = command.replace(", )", ")");
	
    performQueryWithParam(command, menu, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            console.log("insertMenu success");
            next(null, "success");
        }
    });
};

router.updateMenu = function (menu, next) {
	//menu.options = JOSN.stringify(menu.options);
    //menu.optionsEn = JOSN.stringify(menu.optionsEn);
	delete menu.filename;
	delete menu.categoryNO;
	delete menu.delivery;


	if(menu.hasOwnProperty('options') && menu.options !== null){
        menu.options = JSON.stringify(menu.options);
    }

	if(menu.hasOwnProperty('optionsEn') && menu.optionsEn !== null){
        menu.optionsEn = JSON.stringify(menu.optionsEn);
    }
	
    let command = "UPDATE menus SET ";
    let keys = Object.keys(menu);

	//가지고 있는 키 만큼 query에 붙임
    console.log(keys);
    for (let i = 0; i < keys.length; i++) {
        if (menu[keys[i]] !== "" && keys[i] !== "oldMenuName" && keys[i] !== "version") {
            command += keys[i] + "=:" + keys[i] + ", ";
        }
    }


    command += "WHERE menuNO=:menuNO and menuName=:oldMenuName";
    console.log(typeof command);
    command = command.replace(", WHERE", " WHERE");
    console.log(command);


    performQueryWithParam(command, menu, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            console.log("updateCategory success");
            next(null, "success");
        }
    });
};

router.deleteMenu=function(menu,next){
	let command = "DELETE FROM menus WHERE menuNO=:menuNO and menuName=:menuName";

	performQueryWithParam(command, menu, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            console.log("router.deleteMenu success");
            next(null, "success");
        }
    });
}

router.insertShopInfo = function (shopInfo, next) {
    let command = "INSERT INTO shopInfo(";

    let keys = Object.keys(shopInfo);
    for (let i = 0; i < keys.length; i++) {
        if (shopInfo[keys[i]] !== "") {
            command += keys[i] + ",";
        }
    }
    command += "VALUES(";
    command = command.replace(",VALUES", ") VALUES");

    for (let i = 0; i < keys.length; i++) {
        if (shopInfo[keys[i]] !== "") {
            command += ":" + keys[i] + ",";
        }
    }
    command += ")";
    command = command.replace(",)", ")");

    performQueryWithParam(command, shopInfo, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            console.log("insertShopInfo success");
            next(null, "success");
        }
    });
}

router.updateShopInfo = function (shopInfo, next) {
    let command = "UPDATE categories SET ";

    let keys = Object.keys(shopInfo);
    for (let i = 0; i < keys.length; i++) {
        if (shopInfo[keys[i]] !== "") {
            command += keys[i] + "=:" + keys[i] + ", ";
        }
    }
    command += "WHERE takitId=:takitId";
    console.log(typeof command);
    command = command.replace(", WHERE", " WHERE");
    console.log(command);

    performQueryWithParam(command, shopInfo, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            console.log("updateshopInfo success");
            next(null, "success");
        }
    });
};

router.getMenus = function (takitId, categoryNO, next) {
    let command = "select *from menus where menuNO=?";
    let values = [];
    values[0] = takitId + ";" + categoryNO;

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            console.log("updateshopInfo success");
            console.log(result);
            delete result.info;
            next(null, result);
        }
    });
}

router.getCategories = function (takitId, categoryNO, next) {
    let command = "select *from categories where categoryNO=? and takitId=?";
    let values = [categoryNO, takitId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            console.log("updateshopInfo success");
            console.log(result);
            delete result.info;
            next(null, result);
        }
    });
}

router.selectImagePath = (menu,next)=>{
    let command = "select * from menus where menuNO like '"+menu.takitId+"%' and imagePath=?";
    let values = [menu.fileName];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            if(result.info.numRows === '0'){
                next(null,"success");
            }else{
				if(result[0].menuName === menu.menuName && result[0].menuNO === menu.menuNO){
					next(null,"same menu");
				}else{
                	console.log("updateshopInfo success");
                	console.log(result);
                	delete result.info;
                	next("exist same image");
				}
            }
        }
    });

}

router.updateMenusWithNO = function (takitId, categoryNO) {

    let categories = {};
    let menus = [];
    router.getCategories(takitId, categoryNO + 1, function (err, result) {
        if (!err) {
            categories = result[0];

            router.getMenus(takitId, categoryNO, function (err, result) {
                if (!err) {
                    menus = result;
                    console.log("getName susccess:" + JSON.stringify(menus));
                    for (let i = 0; i < menus.length; i++) {
                        let command = "UPDATE menus SET menuNO=:newMenuNO,imagePath=:iamgePath where menuNO=:menuNO and menuName=:menuName";
                        let values = {};
                        values.newMenuNO = takitId + ";" + (categoryNO + 1);
                        values.iamgePath = takitId + ";" + (categoryNO + 1) + "_" + menus[i].menuName;
                        values.menuNO = takitId + ";" + categoryNO;
                        values.menuName = menus[i].menuName;
                        performQueryWithParam(command, values, function (err, result) {
                            if (err) {
                                console.log(err);
                            } else {
                                console.log(result);
                                console.log("updateshopInfo success");
                            }
                        });
                    }
                }
            });
        }
    });
}

//router.updateMenusWithNO("세종대@더큰도시락",13);

//user별, 상점별, 메뉴별 order를 count
router.selectOldOrders=(condition,next)=>{
    let command = "SELECT menuNO,menuName, SUM(quantity) AS orderCount, orderList.amount FROM orderList LEFT JOIN orders ON orderList.orderId=orders.orderId"
                    +" WHERE orders.userId=:userId AND orders.takitId=:takitId GROUP BY menuName ORDER BY SUM(quantity) DESC";

    performQueryWithParam(command,condition,(err,result)=>{
        if(err){
            console.log("selectOldOrders susccess:" + JSON.stringify(err));
            next(err);
        }else{
            if(result.info.numRows==='0'){
                next(null,"not exist oldOrders");
            }else{
                delete result.info;
                next(null,result);
            }
        }
    });
}

router.selectKeywordShopInfos=(body,next)=>{
    let command = "SELECT *FROM shopInfo where keyword=:keyword";

    performQueryWithParam(command,body,(err,result)=>{
        if(err){
            console.log("selectKewordShops susccess:" + JSON.stringify(err));
            next(err);
        }else{
            if(result.info.numRows==='0'){
                next(null,"not exist shops");
            }else{
                delete result.info;
                next(null,result);
            }
        }
    });
}

router.selectFavoriteShops=(userId,next)=>{
    let command = "select count(*) as count, shopInfo.* from shopInfo "+
                    "LEFT JOIN orders ON shopInfo.takitId=orders.takitId "+
                    "where userId=:userId group by orders.takitId order by count desc;";
    let values={userId:userId};

    performQueryWithParam(command,values,(err,result)=>{
        if(err){
            console.log("selectFavoriteShops error:" + JSON.stringify(err));
            next(err);
        }else{
            if(result.info.numRows==='0'){
                next(null,[]);
            }else{
                let shops=[];
                for(var i=0;i<result.info.numRows && i<4;i++)
                       shops.push(result[i]);
                next(null,shops);
            }
        }
    });
}

router.updateCouponList=(bodycouponList,next)=>{
    let command = "UPDATE userInfo set couponList=:couponList where userId=:userId";

    performQueryWithParam(command,body,(err,result)=>{
        if(err){
            console.log("selectFavoriteShops susccess:" + JSON.stringify(err));
            next(err);
        }else{
            if(result.info.numRows==='0'){
                next(null,"not exist shops");
            }else{
                delete result.info;
                next(null,result);
            }
        }
    });
}

router.selectOneMenu=(body,next)=>{
    let command = "SELECT * FROM menus WHERE menuNO=:menuNO AND menuName=:menuName";

    performQueryWithParam(command,body,(err,result)=>{
        if(err){
            console.log("selectOneMenu err:" + JSON.stringify(err));
            next(err);
        }else{
            if(result.info.numRows==='0'){
                next(null,"not exist shops");
            }else{
                delete result.info;
                next(null,result[0]);
            }
        }
    });
}

router.searchShop = function(keyword,next){ //Please change this code later...with limit
    let command;
    command = "SELECT takitId from shopInfo where takitId LIKE _utf8 \"%"+keyword+"%\"";

    performQuery(command,(err,result)=>{
        if(err){
            console.log(":" + JSON.stringify(err));
            next(err);
        }else{
                let shops=[];
                for(var i=0;i<10 && i<result.info.numRows;i++)
                    shops.push(result[i]);
                console.log("shops:"+JSON.stringify(shops));
                next(null,shops);
        }
    });
}

router.selectTakitId = (body, next) =>{
    console.log("mariaDB.selectTakitId " + body.hasOwnProperty("serviceName") + " " + body.hasOwnProperty("shopName"));
    var command;
    if (body.hasOwnProperty("serviceName") && body.hasOwnProperty("shopName")) {
        command = "SELECT * from shopInfo where takitId='" + body.serviceName+"@"+ body.shopName+"'";
    } else if (body.hasOwnProperty("serviceName")) {
        command = "SELECT * from shopInfo where takitId LIKE _utf8 '" + body.serviceName + "%' LIMIT "+body.offset+","+ body.count;
    } else if (body.hasOwnProperty("shopName")) {
        command = "SELECT * from shopInfo where takitId LIKE _utf8 '%" + body.shopName + "' LIMIT "+body.offset+","+body.count;
    } else {
        console.log("no param");
        next("not exist shop");
        return;
    }
    console.log("command:" + command);
    performQuery(command, function (err, result) {
        if (err) {
            console.log("findTakitId Error:" + JSON.stringify(err));
            next(err);
        } else {
            console.log("result:" + JSON.stringify(result));
            if (result.info.numRows==='0') {
                next(null,[]);
            } else {
                delete result.info;
                next(null,result);
            }
        }
    });
}

/*
let info={customer_uid:req.body.customer_uid,name:cardInfo.response.card_name,mask_no:cardInfo.response.card_number};
mariaDB.addPayInfo(uid,info,function(err,result){
*/
router.addPayInfo=function(id,info,next){
    var command = "select payInfo from userInfo where userId="+ id;
    console.log("command:" + command);
    performQuery(command, function (err, result) {
        console.log("addPayInfo performQuery");
        if (err) {
            console.log(JSON.stringify(err));
            next(err);
        }else{
            if (result.info.numRows === "0") {
                next("user doesn't exist");
            }else{
                console.log("result[0]:" + JSON.stringify(result[0]));
                let payInfo=[];
                if(result[0].payInfo!=null)
                    payInfo=JSON.parse(result[0].payInfo);
                payInfo.push({customer_uid:info.customer_uid,info:{name:info.name,mask_no:info.mask_no}});
                console.log("payInfo:"+JSON.stringify(payInfo));
                command = "UPDATE userInfo set payInfo =? where userId=?";
                let values=[JSON.stringify(payInfo),id]; 
                  
                performQueryWithParam(command, values, function (err, result) {
                    if (err) {
                        console.log("performQueryWithParam error");
                        next("mariaDB error");
                    } else {
                        console.log("result:"+JSON.stringify(result));
                        next(null,JSON.stringify(payInfo));
                    }
              });
            }
        }
    });
}

router.removePayInfo=function(id,customer_uid,next){
    var command = "select payInfo from userInfo where userId=\"" + id + "\";";
    console.log("command:" + command);
    performQuery(command, function (err, result) {
        if (err) {
            console.log(JSON.stringify(err));
            next(err);
        }else{
            if (result.info.numRows === "0") {
                next("user doesn't exist");
            }else{
                console.log("result[0]:" + JSON.stringify(result[0]));
                let payInfo=[];
                if(result[0].payInfo==null){
                    next("payInfo doesn't exist");
                }else{ 
                    payInfo=JSON.parse(result[0].payInfo);
                    let index=-1;
                    for(var i=0;i<payInfo.length;i++)
                        if(payInfo[i].customer_uid==customer_uid)
                           index=i; 
                    if(index==-1){
                        next("payInfo doesn have "+customer_uid);
                    }else{
                        payInfo.splice(index,1);
 
                        console.log("payInfo:"+JSON.stringify(payInfo));
                        command = "UPDATE userInfo set payInfo =? where userId=?";
                        let values=[JSON.stringify(payInfo),id];

                        performQueryWithParam(command, values, function (err, result) {
                           if(err){
                               console.log("performQueryWithParam error");
                               next("mariaDB error");
                           }else {
                               console.log("result:"+JSON.stringify(result));
                               next(null,JSON.stringify(payInfo));
                           }
                        });
                    }
                }
            }
        }   
    });
}

router.validPayInfo=function(userId,customer_uid,next){
    var command = "select payInfo from userInfo where userId=\"" + userId + "\";";
    console.log("command:" + command);
    performQuery(command, function (err, result) {
        if (err) {
            console.log(JSON.stringify(err));
            next(err);
        }else{
            if (result.info.numRows === "0") {
                next("user doesn't exist");
            }else{
                console.log("result[0]:" + JSON.stringify(result[0]));
                let payInfo=[];
                if(result[0].payInfo==null){
                    next("wrong payInfo");
                }else{
                    payInfo=JSON.parse(result[0].payInfo);
                    let index=-1;
                    for(var i=0;i<payInfo.length;i++){
                        console.log("(payInfo[i].customer_uid:"+(payInfo[i].customer_uid)); 
                        console.log("customer_uid:"+customer_uid);
                        if(payInfo[i].customer_uid==customer_uid)
                           index=i;
                    }
                    if(index==-1){
                        next("wrong payInfo");
                    }else{
                        console.log("info:"+payInfo[index].info);
                        next(null,payInfo[index].info);
                    }
                } 
            } 
        }
    });
};

router.checkShopUserWithEmailAndPassword = function (email, password, next) {
    let secretEmail = encryption(email, config.ePwd);
    console.log("email:"+email+"secretEmail:"+secretEmail);

    let command = "SELECT userId,password,salt FROM shopUserInfo where email=?";
    let values = [secretEmail];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            //console.log("[existUser]:"+result.info.numRows);
            if (result.info.numRows === "0") {
                next("invalidId");
            } else {
                console.log(result);
                let userInfo = result[0];
                let secretPassword = crypto.createHash('sha256').update(password + userInfo.salt).digest('hex');
                console.log("!!!!!secretPassword:"+secretPassword+ " salt:"+userInfo.salt);
                if (secretPassword === userInfo.password) {
                    console.log("password success!!");
                    decryptObj(userInfo);
                    next(null, userInfo);
                } else {
                    next("passwordFail");
                }
            }
        }
    });
}

router.modifyShopUserWithEmailAndPassword = function (email, password, next) {
    let secretEmail = encryption(email, config.ePwd);
    console.log("password:"+password+"email:"+email+"secretEmail:"+secretEmail);

    let salt = crypto.randomBytes(16).toString('hex');
    let secretPassword = crypto.createHash('sha256').update(password + salt).digest('hex');

    let command = "UPDATE shopUserInfo SET password=?,salt=? where email=?";
    let values = [secretPassword,salt,secretEmail];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            console.log(result);
            next(null,result);
        }
    });
}

router.saveReview=function(orderId,starRate,review,callback){
    let command = "UPDATE orders SET review=?,starRate=?,reviewTime=? WHERE orderId=?";
    let values = [review, starRate, new Date().toISOString(),orderId];
    
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
            callback(err);
        } else {
                console.log(result);
                callback(null,result);
        }
    });
}

router.updateShopRating=function(takitId,starRate,next){
    console.log("starRate:"+starRate);
    let command = "UPDATE shopInfo SET starRating=starRating+?,starCount=starCount+1 WHERE takitId=?";
    let values = [starRate, takitId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
                console.log(result);
                next(null,result);
        }
    });
}


checkMenuTimeConstraint=function(timeConstraint){
        var currTime = new Date();
        let currLocalTime=currTime.getMinutes()+ currTime.getHours()*60; //seoul time(KST) 
     
        if(timeConstraint){
                console.log("check timeConstraint "+currLocalTime);       
                if(timeConstraint.from && (!timeConstraint.to || timeConstraint.to==null)){
                        //current time in seconds is more than or equal to
                        if(currLocalTime<timeConstraint.fromMins)
                            return false;
                }else if((!timeConstraint.from || timeConstraint.from==null) && timeConstraint.to){
                        //current time is less then or equal to
                        console.log("currLocalTime:"+currLocalTime+"timeConstraint.ToMins:"+timeConstraint.toMins);
                        if(currLocalTime>timeConstraint.toMins){
                            return false;                        
                        }
                }else if(timeConstraint.from && timeConstraint.from!=null 
                        && timeConstraint.to!=null && timeConstraint.to){
                    if(timeConstraint.condition=='XOR'){
                        //current time is more than or equal to from OR 
                        //    current time is less than or equal to to
                        if(timeConstraint.fromMins<currLocalTime ||currLocalTime<timeConstraint.toMins)
                            return false;
                    }else if(timeConstraint.condition=='AND'){
                        //    current time is more than or equal to from AND
                        //    current time is less than or equal to to
                         if(timeConstraint.fromMins>currLocalTime ||currLocalTime>timeConstraint.toMins)
                            return false;
                    }
                }
        }        
        return true;
}

function checkIfAMenuSoldOut(menu,callback){ 
    // menu 가격의 validity(unitPrice)도 확인함.  
    // menu의 timeConstraints도확인함. 
    let command = "SELECT soldout,price,options,timeConstraint FROM menus where menuNO=? AND menuName=?";
    let values = [menu.menuNO, menu.menuName];

    console.log("menus:"+JSON.stringify(menu));

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
            callback(err);
        } else {
                //console.log("price:"+result[0].price);
                console.log("options:"+result[0].options);
                //console.log("soldout:"+result[0].soldout);
                if(result[0].options!=null){
                    let optionsObj=JSON.parse(result[0].options);
                    let optionPrice=0;
                    console.log("menu.options:"+menu.options);
                    menu.options.forEach(option=>{
                       let index=optionsObj.findIndex(function(element){
                                if(option.name==element.name) return true;
                                return false;
                            })
                        console.log("index:"+index);
                        if(index<0){
                             callback("invalidOption");
                             return;
                        } 
                        if(optionsObj[index].price!=option.price){
                             callback("invalidOption");
                             return;
                        }else{
                             optionPrice=optionPrice+option.price*option.number; 
                        }
                    });
                    let price=result[0].price;
                    if(typeof result[0].price ==='string')
                         price=parseInt(result[0].price);
                    console.log("computed price:"+(optionPrice+price));
                    console.log("menu.unitPrice:"+menu.unitPrice);
                    if(menu.unitPrice!=optionPrice+price){
                             callback("invalidPrice");
                             return;
                    }
                } 
                if(result[0].timeConstraint!=null){ // 시간제한 확인하자. 
                    let timeConstraint=JSON.parse(result[0].timeConstraint); 
                    if(!checkMenuTimeConstraint(timeConstraint)){
                        callback("invalidTimeContraint"); 
                        return;
                    }
                } 
                if (result[0].soldout=='0') { // 판매중
                    callback(null, "sale");
                } else {
                    callback("soldout",menu.menuName);
                }
        }
    });
}

router.checkIfMenuSoldOut=function(menus,next){
    async.each(menus,checkIfAMenuSoldOut,function(err,result){
              if(err){
                  next(err); 
               }else{
                  next(null,"sale");   
              }
    });
}

getFavoriteMenusInfo=function(menus,next){
    if(menus.length==0){
        next(null,[]);
    }else{
        let command="SELECT * from menus WHERE (menuNO=? AND menuName=?) ";
        let values=[menus[0].menuNO,menus[0].menuName];
        
        for(var i=1;i<4 && i<menus.length;i++){
           command+="OR (menuNO=? AND menuName=?)"; 
           values.push(menus[i].menuNO);
           values.push(menus[i].menuName);
        } 
        performQueryWithParam(command, values, function (err, result) {
            if(err){
                next(err);
            }else{
                console.log("result:"+JSON.stringify(result));
                menuInfos=[];
                for(var j=0;j<4 && j<result.length;j++){
                    menuInfos.push(result[j]);
                    let index=menuInfos[j].menuNO.indexOf(';');
                    menuInfos[j].takitId=menuInfos[j].menuNO.substr(0,index);
                    menuInfos[j].count=menus[j].count; //2018.07.04 
                }
                next(null,menuInfos);
            }
        })
    }
}

router.getFavoriteMenu=function(userId,next){
    //let command = "select menuNO, menuName, COUNT(*) from orderList GROUP BY menuNO,menuName order by count(*) desc where userId=?";
    let command ="select orderList.takitId,orderList.menuNO,orderList.menuName,menus.price,menus.imagePath, count(*) as count  from orderList LEFT JOIN menus ON orderList.menuNO=menus.menuNO AND orderList.menuName=menus.menuName where userId=? GROUP BY orderList.menuNO,orderList.menuName order by count desc" 

    let values = [userId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
            callback(err);
        } else {
                let menus=[];
                for(var i=0;i<4 && i<result.info.numRows;i++)
                    menus.push(result[i]); 
                console.log("menus:"+JSON.stringify(menus));
                getFavoriteMenusInfo(menus,function(err,menuInfos){
                   console.log("!!!!menuInfos:"+JSON.stringify(menuInfos));
                   if(err)
                       next(err);
                   else
                       next(null,menuInfos);
                });
        }
    });
}

router.configureMenuSoldOut=function(menu,next){
    console.log("configureMenuSoldOut:"+JSON.stringify(menu));
    let soldout=menu.soldout?1:0;

    let values = [soldout,menu.menuNO,menu.menuName];
    let command="UPDATE menus SET soldout=? where menuNO=? and menuName=?";

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
            callback(err);
        } else {
                next(null, menu.soldout);
        }
    });
}
////////////////////////////////SoldOut -begin ////////////////////////////////////////////
//  매일 00:00에 soldout flag를 false로 reset한다
//  성공한다면 shopInfo table에 soldoutDate설정값을 저장한다.
//  향후 상점 open시점에 맞추어 변경이 필요하다.
//////////////////////////////////////////////////////////////
function allSoldOutDate(next) {
    let command="select takitId ,soldoutDate from shopInfo;";
    console.log("command:" + command);
    performQuery(command, function (err, result) {
        if (err) {
            console.log("allSoldOutDate Error:" + JSON.stringify(err));
            next(JSON.stringify(err));
        } else {
            if (result == undefined) {
                next([]);
            } else {
                let shops=[];
                 result.forEach(element => {
                    let shop={};
                    shop.takitId       =element.takitId;
                    shop.soldoutDate   =element.soldoutDate;
                    shops.push(shop);
                });
                next(null, shops);
            }
        }
    });
}

function configureSoldout(){
  allSoldOutDate(function(err,shops){
    let now= new Date();
    let todayStr = now.getYear()+'-'+now.getMonth()+'-'+now.getDate();
    //console.log("todayStr:"+todayStr);
    //console.log("result:"+JSON.stringify(shops));
    for(var i=0;i<shops.length;i++){
        if(shops[i].soldoutDate==null || shops[i].soldoutDate!=todayStr){
            let takitId=shops[i].takitId;
            let command="UPDATE menus SET soldout=false where menuNO LIKE  _utf8\'" + takitId + "%\';";
              performQuery(command, function (err, result) {
              if (err) {
                  console.log("allSoldOutDate Error:" + JSON.stringify(err));
              } else {
                  //console.log("result:" + JSON.stringify(result));
                  if (result == undefined) {
                      console.log(result[i].takitId+"doesn't have menu yet");
                  } else {
                      //console.dir("result:" + result.info.numRows);
                  }
                  // update soldoutDate at shopInfo table 
                  let command="UPDATE shopInfo SET soldoutDate=\'"+todayStr+"\' where takitId=?";   
                  let values= [takitId];
                  performQueryWithParam(command, values, function (err, result) {
                      if(err){
                          console.log("fail to update soldoutDate in shopInfo");
                      }else{
                          console.log("update soldoutDate is done");
                      }                       
                  });
              }
         });
        }
    }
  });
}

configureSoldout();
let d = new Date();
let msSinceMidnight = d.getTime() - d.setHours(0,0,0,0);
let nextTimeout = 24*60*60*1000- msSinceMidnight;
console.log("nextTimeout:"+nextTimeout);
setTimeout(function(){ 
             configureSoldout();
             setInterval(configureSoldout,24*60*60*1000); // 24 hours later 
}, nextTimeout);
////////////////////////////////SoldOut -end////////////////////////////////////////////

////////////////////////////////////// Kiosk -begin////////////////////////////
router.saveKioskOrder=function(order, next) {
    let orderedTime=new Date();
    let command = "INSERT INTO kiosk(takitId,orderNO,orderName,amount,takeout,orderStatus,orderList,orderedTime,paymentType,receiptIssue,receiptType,receiptId,cardPayment,cardApprovalNO,cardApprovalDate,catid) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
            let values;
            if(order.paymentType=="card")
                values= [order.takitId,order.orderNO,order.orderName, order.amount,order.takeout,"paid", JSON.stringify(order.orderList),orderedTime.toISOString(),order.paymentType,
                          order.receiptIssue,order.receiptType,order.receiptId,order.cardPayment,order.approvalNO,order.approvalDate,order.catid];
            else if(order.paymentType=="cash")
                values= [order.takitId,order.orderNO,order.orderName, order.amount,order.takeout,"unpaid", JSON.stringify(order.orderList),orderedTime.toISOString(),order.paymentType,
                          order.receiptIssue,order.receiptType,order.receiptId,order.cardPayment,order.approvalNO,order.approvalDate,order.catid];
            //console.log("order.orderList:"+JSON.stringify(order.orderList));
            performQueryWithParam(command, values, function (err, orderResult) {
                if (err) {
                    console.error("saveOrder func inser orders Unable to query. Error:", JSON.stringify(err, null, 2));
                    next(err);
                } else {
                    //console.dir("[Add orders]:"+result);
                    if (orderResult.info.affectedRows === '0') {
                        next("invalid orders");
                    } else {
                        console.log("saveOrder func Query succeeded. " + JSON.stringify(orderResult));
                        // 3.orderList insert
						let i=0;
                        router.kioskInsertOrderList(order.takitId,parseInt(orderResult.info.insertId),i,order.orderList,next);
                    }
                }
            })
}

router.kioskInsertOrderList=function(takitId,orderId,i,orderList,next){
	let command = "INSERT INTO kioskOrderList(orderId,menuNO,menuName,quantity,options,price,amount) values(?,?,?,?,?,?,?)";
    let menu = orderList[i];
	console.log(i);
	//console.log(menu.options);

    let values = [orderId, menu.menuNO, menu.menuName, menu.quantity, JSON.stringify(menu.options),menu.unitPrice,menu.amount,
                  takitId];
               
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("saveOrder func insert kioskOrderList Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.log("saveOrder func insert kioskOrderList Query Succeeded");
            if(i < orderList.length-1){
                i++;
                router.kioskInsertOrderList(takitId,orderId,i,orderList,next);
            }else{
                next(null,orderId);
            }
        }
    });
}

router.searchOrderWithCardInfo=function(condition,next){
    let command = "SELECT * FROM kiosk WHERE cardApprovalNO=? AND cardApprovalDate=? AND catid=?";
    let values=[condition.approvalNO,condition.approvalDate,condition.catid];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("[searchOrderWithCardInfo]Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.log("[searchOrderWithCardInfo] Query Succeeded"+JSON.stringify(result));
            if(result.length === 0)
                next(null);
            else{
                next(null,result[0]);
            }
        }
    });
}


router.searchKioskOrder=function(condition,next){
    let command = "SELECT * FROM kiosk WHERE orderNO=? AND orderedTime>=? AND orderedTime<=? AND takitId=?"; 
    let values=[condition.orderNO,condition.start,condition.end,condition.takitId]; 
 
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("[searchKioskOrder]Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.log("[searchKioskOrder] Query Succeeded"+JSON.stringify(result));
            if(result.length === 0)
                next(null)
            else{
                next(null,result[0]);
            }
        }
    });
}

router.searchKioskOrderWithId=function(id,next){
    console.log("searchKioskOrderWithId-id:"+id);

    let command = "SELECT * FROM kiosk WHERE orderId=?";
    let values=[id];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("[searchKioskOrder]Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.log("[searchKioskOrder] Query Succeeded"+JSON.stringify(result));
            if(result.length === 0)
                next(null)
            else{
                next(null,result[0]);
            }
        }
    });
}


router.updateBusinessHour = function (shopInfo, next) {
    let command = "UPDATE shopInfo SET businessTime=:businessTime where takitId=:takitId";

    let values={};
    values.businessTime=shopInfo.businessTime;
    values.takitId=shopInfo.takitId;

    performQueryWithParam(command,values, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            console.log("updateshopInfo success "+JSON.stringify(result));
            next(null, "success");
        }
    });
};


router.getKioskPeriodStatsMenu = function (takitId, startTime, endTime, next) {
    console.log("getKioskPeriodStatsMenu comes");

    async.waterfall([(callback)=>{
        router.getShopInfo(takitId,callback);
    },(shopInfo,callback)=>{
        let tmpEnd = endTime.split('T');
        endTime = tmpEnd[0]+"T23:59:59.999Z" // endTime은오늘의 마지막 시간으로 만들어줌

        startTime=startTime.replace('T',' ').replace('Z','');
        endTime=endTime.replace('T',' ').replace('Z','');
        let lcStartTime = op.getTimezoneLocalTime(shopInfo.timezone,new Date(startTime));
        let lcEndTime = op.getTimezoneLocalTime(shopInfo.timezone,new Date(endTime));

        let command = "SELECT menuName, SUM(quantity) AS count, SUM(kioskOrderList.amount) AS menuSales FROM kioskOrderList LEFT JOIN kiosk ON kioskOrderList.orderId=kiosk.orderId WHERE menuNO LIKE'" + takitId + "%' AND (orderStatus='completed' OR orderStatus='pickup') AND orderedTime BETWEEN ? AND ? GROUP BY menuName";
        let values = [lcStartTime.toISOString(), lcEndTime.toISOString()];

        performQueryWithParam(command, values,callback);

    }],(err,result)=>{
        if (err) {
            console.error("getPeriodStatsMenu func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            if (result.info.numRows == '0') {
                console.log(result.info.numRows);
                next(null,0);
            } else {
                console.log("getPeriodStatsMenu func Query succeeded. " + JSON.stringify(result.info));
                delete result.info;
                next(null, result);
            }
        }
    });

}

router.getKioskStatsMenu = function (takitId, startTime, next) {
    //select menuName, SUM(quantity) FROM kioskOrderList where menuNO LIKE \'"+takitId+"%\'GROUP BY menuName";
    console.log("getKioskStatsMenu comes");

    let command = "SELECT menuName, SUM(quantity) AS count, SUM(kioskOrderList.amount) AS menuSales FROM kioskOrderList LEFT JOIN kiosk ON kioskOrderList.orderId=kiosk.orderId WHERE (orderStatus='completed' OR orderStatus='pickup') AND menuNO LIKE '" + takitId + "%' AND orderedTime > ? GROUP BY menuName"
    let values = [startTime];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("getKioskStatsMenu func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            if (result.info.numRows == 0) {
                next(null, 0);
            } else {
                console.log("getKioskStatsMenu func Query succeeded. " + JSON.stringify(result.info));
                delete result.info;
                console.log(result);
                next(null, result);
            }
        }
    });
}

router.getKioskSalesPeriod = function (takitId, startTime, endTime, next) {
    console.log("takitId:" + takitId + " startTime:" + startTime + " end:" + endTime);

    async.waterfall([(callback)=>{
        router.getShopInfo(takitId,callback);
    },(shopInfo,callback)=>{
        let tmpEnd = endTime.split('T');
        endTime = tmpEnd[0]+"T23:59:59.999Z" // endTime은오늘의 마지막 시간으로 만들어줌

        startTime=startTime.replace('T',' ').replace('Z','');
        endTime=endTime.replace('T',' ').replace('Z','');
        let lcStartTime = op.getTimezoneLocalTime(shopInfo.timezone,new Date(startTime));
        let lcEndTime = op.getTimezoneLocalTime(shopInfo.timezone,new Date(endTime));

        let command = "SELECT SUM(amount) AS sales FROM kiosk WHERE takitId=? AND (orderStatus='completed' OR orderStatus='pickup' )AND orderedTime BETWEEN ? AND ?" //startTime과 endTime 위치 중요!!
        let values = [takitId, lcStartTime.toISOString(), lcEndTime.toISOString()];
        performQueryWithParam(command, values, callback);
    }],(err,result)=>{
        if (err) {
            console.error("getSalesPeriod func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.dir("[getSalesPeriod func Get MenuInfo]:" + result.info.numRows);

            if (result.info.numRows == 0) {
                next(null, 0);
            } else {
                console.log("getSalesPeriod func Query succeeded. " + JSON.stringify(result.info));
                next(null, result[0].sales);
            }
        }
    });
}

router.getKioskSales = function (takitId, startTime, next) {
    //select sum(amount) from orders where takitId = "세종대@더큰도시락" and orderedTime < "2016-12-28";
    console.log("takitId:" + takitId);

    let command = "SELECT SUM(amount) AS sales FROM kiosk WHERE takitId=? AND (orderStatus='completed' OR orderStatus='pickup')AND orderedTime > ?";
    let values = [takitId, startTime];
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("querySales func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.dir("[querySales func Get MenuInfo]:" + result.info.numRows);
            if (result.info.numRows == 0) {
                next(null, 0);
            } else {
                console.log("querySales func Query succeeded. " + JSON.stringify(result.info));
                console.log(result);
                next(null, result[0].sales);
            }
        }
    });
}

router.getStampCount=function(uid, takitId,next){
  let command = "SELECT stampList  FROM userInfo WHERE userId=?";
    let values = [uid];
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("getStampCount func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.dir("[getStampCount] result.info.numRows:" + result.info.numRows);
            if (result.info.numRows == 0) {
                next(null, 0);
            } else {
                console.log("querySales func Query succeeded. " + JSON.stringify(result[0]));
                let count=0;
                if(result && result[0].stampList!=null){
                  let list=JSON.parse(result[0].stampList);
                  console.log("list... "+JSON.stringify(list));
                  for(var i=0;i<list.length;i++){
                    console.log("takitId:"+list[i].takitId);
                    if(list[i].takitId==takitId){
                        count=list[i].count;
                        console.log("count:"+count);
                        break;
                    }
                  }
                }
                console.log("getStampCount-count:"+count);
                next(null, count);
            }
        }
    });
}

router.saveStampCoupon=function(order,next){
    let command = "INSERT INTO stampCoupon(takitId,orderId,orderedTime,userId,issuedCount,stampCount,amount) values(?,?,?,?,?,?,?)";
    let values = [order.takitId, order.orderId, order.orderedTime, order.userId, order.couponDiscount, order.couponDiscount,order.couponDiscountAmount];
    console.log("saveStampCoupon:"+command);
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("saveStampCoupon func insert saveStampCoupon Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.log("saveStampCoupon Query Succeeded");
            next(null,"done");
        }
    });
}

router.updateUserStampList=function(userId,takitId,countIn,next){
    console.log("updateUserStampList");
    let count=countIn;
    if(typeof count ==="string"){
        count=parseInt(count);
    }
    console.log("****************************count:"+count);

    async.waterfall([(callback)=>{
        router.getUserInfo(userId,callback);
    },(userInfo,callback)=>{
    //기존 값을 읽은후에 update해야만 한다. 
      
      let stampList=[];
      if(userInfo.stampList!=null){
          stampList=JSON.parse(userInfo.stampList);
      }
          let index=stampList.findIndex(function(element){
                if(element.takitId==takitId){
                    return true;
                }
                return false;
           });
           if(index>=0){
                console.log("prev!!!!count is stampList[index].count:"+stampList[index].count); 
                stampList[index].count+=count;
                console.log("next!!!!!count is stampList[index].count:"+stampList[index].count); 
           }else{
                stampList.push({takitId:takitId,count:count});
           }
           let command = "UPDATE userInfo set stampList=? where userId=?";
           let values = [JSON.stringify(stampList), userId];

           performQueryWithParam(command, values, function (err, result) {
               if (err) {
                   console.log(err);
                   callback(err);
               }else {
                   console.log("updateUserStampList function result" + JSON.stringify(result));
                   //사용자의 stampList를 업데이트 한다.
                   callback(null);
               }
           });
      
     }],(err,result)=>{
               console.log("updateUserStampList: returns");
               if(err){
                   console.log("updateUserStampList-err:"+JSON.stringify(err));
                   if(next)
                       next(err);
               }else{
                   if(next)
                       next(null,"done");
               }
     });    
}


router.updateStampIssueCount=function(order,next){
    console.log("updateStampIssueCount");
    let command = "UPDATE orders set stampIssueCount=? where orderId=?";
    let values = [order.stampIssueCount, order.orderId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            console.log("updateStampIssueCount function result" + JSON.stringify(result));
            //사용자의 stampList를 업데이트 한다. 
            router.updateUserStampList(order.userId,order.takitId,order.stampIssueCount,next);
        }
    });
}

router.insertStampIssue=function(order,next){
    let command = "INSERT INTO stamp(takitId,orderId,count,userId,orderedTime) values(?,?,?,?,?)";
    let values = [order.takitId, order.orderId, order.stampIssueCount,order.userId,order.orderedTime];

    console.log("insertStampIssue:"+command);
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("insertStampIssue func insert Unable to query. Error:", JSON.stringify(err, null, 2));
            if(next)
                next(err);
        } else {
            console.log("insertStampIssue Query Succeeded ");
            if(next)
                next(null,"done");
        }
    });
}

router.getMenuStampCount=function(menus,next){
    let command="SELECT stampCount,menuNO,menuName from menus where (menuNO=\""+menus[0].menuNO+"\" AND menuName=\""+menus[0].menuName+"\")";
    for(let i=1;i<menus.length;i++){
       command=command+"OR (menuNO=\""+menus[i].menuNO+"\") AND menuName=(\""+menus[i].menuName+"\")";
    }
    console.log("command:"+command);

    performQueryWithParam(command, function (err, result) {
        if (err) {
            console.error("generateStamp func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.log("generateStamp func Query Succeeded:"+JSON.stringify(result));
            if(result.info.numRows == 0)
                next(null,[]);
            else{
                console.log("menuInfo:"+JSON.stringify(result));
                next(null,result);
            }
        }
    });
}

router.generateStamp=function(order,next){
    let issueStamp=0;
    let menus=[];
    console.log("order.orderList:"+order.orderList);

    let orderList=order.orderList;;
    if(typeof order.orderList ==="string"){
         orderList=JSON.parse(order.orderList);
    }
    orderList.menus.forEach((menu)=>{
         menus.push({menuNO:menu.menuNO,menuName:menu.menuName}); 
    });
    async.waterfall([(callback)=>{
         router.getMenuStampCount(menus,callback);
    },(menuInfos,callback)=>{
               console.log("menuInfos:"+JSON.stringify(menuInfos));
               orderList.menus.forEach((menu)=>{
                  let index=menuInfos.findIndex(function(element){
                               if(element.menuNO==menu.menuNO && element.menuName==menu.menuName)
                                   return true;
                               return false;
                            })
                   if(menuInfos[index].stampCount!=null){
                        let quantity=menu.quantity;
                        let stampCount=menuInfos[index].stampCount;
                        if(typeof quantity ==="string")
                            quantity=parseInt(quantity);
                        if(typeof stampCount ==="string")
                            stampCount=parseInt(stampCount);
                            issueStamp+=quantity*stampCount;
                   }
               })
               // update stampIssueCount of order.
               if(order.couponDiscount!=null){ //쿠폰으로 구매한 경우 제외한다.
                   let couponDiscount=order.couponDiscount;
                   if(typeof couponDiscount === "string")
                        couponDiscount=parseInt(couponDiscount);
                   issueStamp-=couponDiscount;
               } 
               order.stampIssueCount=issueStamp;
               router.updateStampIssueCount(order,callback);
     },(result,callback)=>{
               // insert stamp into stamp table.
                console.log("insertStampIssue....");
                router.insertStampIssue(order,callback);
     }],(err,result)=>{
           console.log("generateStamp done err:"+err);
           if(err){
                next(err);
           }else{
                next(null,"done");
           }
     });
}

router.getPeriodIssueStamp=function(takitId,startTime,endTime,next){
    async.waterfall([(callback)=>{
        router.getShopInfo(takitId,callback);
    },(shopInfo,callback)=>{
        let tmpEnd = endTime.split('T');
        endTime = tmpEnd[0]+"T23:59:59.999Z" // endTime은오늘의 마지막 시간으로 만들어줌

        startTime=startTime.replace('T',' ').replace('Z','');
        endTime=endTime.replace('T',' ').replace('Z','');
        let lcStartTime = op.getTimezoneLocalTime(shopInfo.timezone,new Date(startTime));
        let lcEndTime = op.getTimezoneLocalTime(shopInfo.timezone,new Date(endTime));

        let command = "SELECT SUM(count) as total FROM stamp WHERE takitId=? AND orderedTime BETWEEN ? AND ? AND cancel=?";
        let values = [takitId,lcStartTime.toISOString(), lcEndTime.toISOString(),false];

        performQueryWithParam(command, values,callback);
    }],(err,result)=>{
        if (err) {
            console.error("getPeriodStatsMenu func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            if (result.info.numRows == '0') {
                console.log(result.info.numRows);
                next(null,0);
            } else {
                console.log("getPeriodStatsMenu func Query succeeded. " + JSON.stringify(result.info));
                delete result.info;
                next(null, result[0].total);
            }
        }
    });
}

router.getPeriodCouponAmount=function(takitId,startTime,endTime,next){
    router.getShopInfo(takitId,function(err,shopInfo){
        if(err){
            next(err);
            return;
        }

        let tmpEnd = endTime.split('T');
        endTime = tmpEnd[0]+"T23:59:59.999Z" // endTime은오늘의 마지막 시간으로 만들어줌

        startTime=startTime.replace('T',' ').replace('Z','');
        endTime=endTime.replace('T',' ').replace('Z','');
        let lcStartTime = op.getTimezoneLocalTime(shopInfo.timezone,new Date(startTime));
        let lcEndTime = op.getTimezoneLocalTime(shopInfo.timezone,new Date(endTime));

        let command = "SELECT SUM(amount) as total FROM stampCoupon WHERE takitId=? AND cancel=? AND orderedTime BETWEEN ? AND ? ";
        let values = [takitId,false,lcStartTime.toISOString(), lcEndTime.toISOString()];

        performQueryWithParam(command, values,function(err,result){
          if (err) {
            console.error("stampCoupon func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
          } else {
            console.log("getPeriodCouponAmount:"+JSON.stringify(result));
            if (result.info.numRows == '0') {
                console.log(result.info.numRows);
                next(null,0);
            } else {
                console.log("getPeriodStatsMenu func Query succeeded. " + JSON.stringify(result.info));
                delete result.info;
                next(null, result[0].total);
            }
          }
       });
    });
}

router.getIssueStamp=function(takitId,startTime,next){
    console.log("takitId:" + takitId);

    let command = "SELECT SUM(count) as total FROM stamp WHERE takitId=? AND orderedTime > ? AND cancel=?";
    let values = [takitId, startTime,false];
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("getIssueStamp func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.dir("[getIssueStamp func Get MenuInfo]:" + result.info.numRows);
            if (result.info.numRows == 0) {
                next(null, 0);
            } else {
                console.log("getIssueStamp func Query succeeded. " + JSON.stringify(result.info));
                console.log(result);
                next(null, result[0].total);
            }
        }
    });
}

router.getCouponAmount=function(takitId,startTime,next){
    console.log("takitId:" + takitId);

    let command = "SELECT SUM(amount) as total FROM stampCoupon WHERE takitId=? AND orderedTime > ? AND cancel=?";
    let values = [takitId, startTime,false];
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("getCouponAmount func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        } else {
            console.dir("[getCouponAmount func]:" + result.info.numRows);
            if (result.info.numRows == 0) {
                next(null, 0);
            } else {
                console.log("getCouponAmount func Query succeeded. " + JSON.stringify(result.info));
                console.log(result);
                console.log("total:"+result[0].total);
                next(null, result[0].total);
            }
        }
    });

}

router.cancelStamp=function(order,next){
    let command = "UPDATE stamp set cancel=true where orderId=?";
    let values = [order.orderId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("cancelStamp func Unable to query. Error:", JSON.stringify(err, null, 2));
            if(next)
                next(err);
        } else {
            if(next) 
                next(null);
        }
    });
}

router.cancelStampCoupon=function(order,next){
    let command = "UPDATE stampCoupon set cancel=true where orderId=?";
    let values = [order.orderId];

    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.error("cancelStampCoupon func Unable to query. Error:", JSON.stringify(err, null, 2));
            if(next)
                next(err);
        } else {
            if(next)
                next(null);
        }
    });
}

router.checkRegisterNotiPhone=function(phone,next){
   var secretPhone = encryption(phone, config.pPwd);
   var command = "select * from kioskNotification where phone=? ";
   var values=[secretPhone];
   performQueryWithParam(command, values, function (err, result) {
        console.log("c.query success");
        if (err) {
            next(err);
        } else {
            console.dir("[checkRegisterNotiPhone]:" + result.info.numRows);
            if (result.info.numRows === "0") {
                next(null,null);
            } else {
                next(null,result[0]);
            }
        }
    });
}

insertWaiteeNumber=function(phone,waiteeNumber,next){
    var secretPhone = encryption(phone, config.pPwd);
    var command = 'INSERT INTO kioskNotification (phone,waiteeNumber) VALUES (?,?)';
    var values = [secretPhone,waiteeNumber];
   
    performQueryWithParam(command, values, function (err, result) {
        if (err) {
            console.log(err);
            next(err);
        } else {
            console.log("insertWaiteeNumber func result" + JSON.stringify(result));
            if(result.info.affectedRows==1)
                next(null,{waiteeNumber:waiteeNumber});
            else
                next("db error");
        }
    });

}


router.registerNotiPhone=function(phone,next){
   // last 4 digits
   if(!phone || phone.length<4){
       next("invalidPhone");
       return;    
   }
   let last4digits=phone.substr(phone.length-4,4);

   var command = "select * from kioskNotification where (waiteeNumber like \"%"+last4digits+"\") OR waiteeNumber= \""+last4digits+"\"";
   performQuery(command, function (err, result) {
        console.log("c.query success");
        if (err) {
            next(err);
        } else {
            console.dir("[registerNotiPhone]:" + result.info.numRows);
            if (result.info.numRows == 0) { // 마지막 4 digit으로 선택한다. 
                console.log("registerNotiPhone-waiteeNumber:"+last4digits);
                insertWaiteeNumber(phone,last4digits,next);    
            } else { // 앞의 digit들을 확인한다. 
                let array=result;
                array.forEach(noti=>{
                    noti.phone=decryption(noti.phone,config.pPwd);
                });
                lookForUniqueDigits(result,phone,5,function(err,digitNumber){
                    console.log("digitNumber:"+digitNumber);
                    let waiteeNumber=phone.substr(phone.length-digitNumber,digitNumber);
                    console.log("registerNotiPhone-waiteeNumber:"+waiteeNumber);
                    insertWaiteeNumber(phone,waiteeNumber,next);
                });
            }
        }
    });
}

router.saveKioskNotiPhone=function(phone,orderId,next){
    let values = {};
    let command;

    values.orderId = orderId;
    values.notiPhone = encryption(phone, config.pPwd);
    //cancelled 상태면 이유 넣음. 아니면 그대로 null
    command = "UPDATE kiosk SET notiPhone=:notiPhone WHERE orderId=:orderId";

    performQueryWithParam(command, values, function (err, result) {
                    if (err) {
                        console.error("saveKioskNotiPhone func Unable to query. Error:", JSON.stringify(err, null, 2));
                        next(err);
                    } else {
                        console.dir("[saveKioskNotiPhone func Get MenuInfo]:" + result.info.affectedRows);
                        if (result.info.affectedRows == 0) {
                            next("can't update orders");
                        } else {
                            console.log("saveKioskNotiPhone func Query succeeded. " + JSON.stringify(result[0]));
                            next(null, "success");
                        }
                    }
    });  

}

router.searchWaiteeNumber=function(waiteeNumber,callback){
   var command = "select * from kioskNotification where waiteeNumber=? ";
   var values=[waiteeNumber];
   performQueryWithParam(command, values, function (err, result) {
        console.log("c.query success");
        if (err) {
            next(err);
        } else {
            console.dir("[searchWaiteeNumber]:" + result.info.numRows);
            if (result.info.numRows === "0") {
                callback(null,null);
            } else {
                let phone=decryption(result[0].phone,config.pPwd);
                callback(null,phone);
            }
        }
    });
}

lookForUniqueDigits=function(array,phone,digitNumber,next){
   console.log("array:"+JSON.stringify(array));
   let subset=array.filter(function(element){
            if(phone.substr(phone.length-digitNumber)==element.phone.substr(phone.length-digitNumber)){
                              return true; 
            }
   });
   if(subset.length<=0){
       console.log("distinguish digits");
       next(null,digitNumber);
   }else{
       let waiteeSets=subset.filter(function(element){
                          if(element.waiteeNumber.length>=digitNumber) 
                              return true;
                         });
       if(waiteeSets.length<=0){
          console.log("already assinged digits");
          next(null,digitNumber); 
       }else
          lookForUniqueDigits(subset,phone,digitNumber+1,next);
   }
}

/*
let array=[{"phone":"01027228226","waiteeNumber":"8226"}, 
           {"phone":"01027328226","waiteeNumber":"28226"},
           {"phone":"01024328226","waiteeNumber":"328226"}];
lookForUniqueDigits(array,"01044328226",5,function(err,digitNumber){
    console.log("[lookForUniqueDigits]digitNumber:"+digitNumber);
})
*/

////////////////////////////////////// Kiosk -end ////////////////////////////
module.exports = router;


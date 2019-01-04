let express = require('express');
let request = require('request');
let async = require('async');
let Scheduler = require('redis-scheduler');
let redis = require('redis');
let timezoneJS = require('timezone-js');
let mariaDB = require('./mariaDB');
let noti = require('./notification');
let index = require('./index');
let config = require('../config');
let op = require('./op');

var AsyncLock = require('async-lock');
var lock = new AsyncLock();

let router = express.Router();
let redisCli = redis.createClient();
let scheduler = new Scheduler();

const NHCode = "011";

router.createCashId = function (req, res) {
    console.log("createCashId function start!!!");
    mariaDB.insertCashId(req.session.uid, req.body.cashId.toUpperCase(), req.body.password, function (err, result) {
        if (err) {
            res.send(JSON.stringify({ "result": "failure", "error": err }));
        } else {
            if (result === "duplicationCashId") {
                let response = new index.FailResponse("duplicationCashId");
                response.setVersion(config.MIGRATION, req.version);
                res.send(JSON.stringify(response));
            } else {
                mariaDB.checkUnregistedUser(req.session.uid,function(err,result){
                    if(err=="unregisteredUser"){ //Already registered user
                        let couponList=result;
                        console.log("couponList!!!"+couponList);
                        //save couponList from unregistered into userInfo.
                        if(couponList!=null){
                             mariaDB.saveCouponList(req.session.uid,couponList,function(err){ 
                             //기존 쿠폰을 다시 사용하지 못하도록한다.
                             if(err){
                                 console.log("fail to save couponlist into userInfo "+JSON.stringify(err));
                             }     
                           }); 
                        }
                        let response = new index.SuccResponse();
                        response.cashBalance=0;
                        response.setVersion(config.MIGRATION, req.version);
                        res.send(JSON.stringify(response));
                    }else{
                          let amount=0;
                          let seq;
                          mariaDB.getRegisterCount(function(err,counter){
                              if(!err && counter<=1000){  //선착순 1000명에게 전달함.
                                  amount=1000;
                                  seq=counter;
                              }
                              if(amount>0){//Add cash by 1000 won for promottion temporarily
                                mariaDB.updateBalanceCash(req.body.cashId.toUpperCase(), amount,0, function(err,result){
                                   if(err){
                                       console.log("error give won promotaion for "+ req.body.cashId.toUpperCase());
                                   }
                                   //1000원 입금을 고객에게 알리자.
                                   let response = new index.SuccResponse();
                                   response.cashBalance=amount;
                                   response.seq=seq;
                                   response.setVersion(config.MIGRATION, req.version);
                                   res.send(JSON.stringify(response));
                                   //update counter
                                   mariaDB.update2019RegisterCounter();
                               });
                              }else{
                                   let response = new index.SuccResponse();
                                   response.cashBalance=amount;
                                   response.seq=seq;
                                   response.setVersion(config.MIGRATION, req.version);
                                   res.send(JSON.stringify(response));
                                   //update counter
                                   mariaDB.update2019RegisterCounter();
                             }
                          });
                   }
               });
            }
        }
    });
};

router.modifyCashPwd = function (req, res) {
    console.log("modifyCashPwd function start!!");
    mariaDB.updateCashPassword(req.session.uid, req.body.cashId.toUpperCase(), req.body.password, function (err, result) {
        if (err) {
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        }
    });
}

router.checkCashInfo = function (req, res) {
    console.log("checkCashInfo function start");

    mariaDB.checkCashPwd(req.body.cashId.toUpperCase(), req.body.password, function (err, cashInfo) {
        if (err) {
            console.log(err);
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
            console.log("checkCashInfo success");
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        }
    });
}

router.validCashId = (req,res)=>{
    console.log("validCashId "+JSON.stringify(req.body));
    mariaDB.validCashId(req.body.cashId.toUpperCase(),(err,result)=>{
        if (err) {
            console.log(err);
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
            console.log("validCashId success");
            let response = new index.SuccResponse();
            response.duplication=result;
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        }
    });
}


//거래내역 조회
router.RetrieveAgreementAccountTransactionHistory = function (startDate, endDate, pageNO, num, next) {
    const form = {};
    form.command = "RetrieveAgreementAccountTransactionHistory"; //약정계좌 거래내역 조회
    form.startDate = startDate;
    form.endDate = endDate;
    form.pageNO = pageNO;
    form.num = num;

    console.log(form);
    request.post({ url: config.nhServer+'/NHPintech/nhpintechServlet', form: form }, function (err, response, result) {
		let body = JSON.parse(result);
        if (err) {
            console.log("RetrieveAgreementAccountTransactionHistory error" + JSON.stringify(err));
            next(err);
        } else if (body.status === "failure") {
            console.log("body:" + JSON.stringify(body)); // Show the HTML for the Google homepage.
            console.log("response:" + JSON.stringify(response));
            if (body.Header.Rpcd === "AC002") {
                next("no service time");
            } else {
                next(body.Header.Rsms);
            }
        } else if (!err && body.status === "OK") {
            console.log("body:" + JSON.stringify(body)); // Show the HTML for the Google homepage.
            console.log("response:" + JSON.stringify(response));
            next(null, body);
        }
    });
}

//입금이체 (takit계좌에서 농협 다른계좌로 송금)
router.ReceivedTransferAccountNumber = function (account, amount, next) {
    const form = {};
    form.command = "ReceivedTransferAccountNumber"; //약정계좌 거래내역 조회
    form.account = account;
    form.amount = amount;
    request.post({ url: config.nhServer+'/NHPintech/nhpintechServlet', form: form }, function (err, response, result) {
        let body = JSON.parse(result);
        if (err) {
            console.log(err);
            next(err);
        } else if (body.status === "failure") {
            console.log("body:" + JSON.stringify(body)); // Show the HTML for the Google homepage.
            console.log("response:" + JSON.stringify(response));
            if (body.Header.Rpcd === "AC002") {
                next("no service time");
            } else {
                next(body.Header.Rsms);
            }
        } else if (!err && body.status === "OK") {
            console.log("body:" + JSON.stringify(body)); // Show the HTML for the Google homepage.
            console.log("response:" + JSON.stringify(response));
            next(null, body);
        }
    });
}

//타행입금이체 (takit계좌에서 다른은행 계좌로 송금)
router.ReceivedTransferOtherBank = function (bankCode, account, amount, next) {
    const form = {};
    form.command = "ReceivedTransferOtherBank";
    form.bankCode = bankCode;
    form.account = account;
    form.amount = amount;
    request.post({ url: config.nhServer+'/NHPintech/nhpintechServlet', form: form }, function (err, response, result) {
        let body = JSON.parse(result);
        if (err) {
            console.log(err);
            next(err);
        } else if (body.status === "failure") {
            console.log("body:" + JSON.stringify(body)); // Show the HTML for the Google homepage.
            console.log("response:" + JSON.stringify(response));
            if (body.Header.Rpcd === "AC002") {
                next("no service time");
            } else {
                next(body.Header.Rsms);
            }
        } else if (body.status === "OK") {
            console.log("body:" + JSON.stringify(body)); // Show the HTML for the Google homepage.
            console.log("response:" + JSON.stringify(response));
            next(null, body);
        }
    });
}

//농협 예금주 조회
router.InquireDepositorAccountNumber = function (account, next) {
    const form = {};
    form.command = "InquireDepositorAccountNumber";
    form.account = account;
    request.post({ url: config.nhServer+'/NHPintech/nhpintechServlet', form: form }, function (err, response, result) {
        let body = JSON.parse(result);
        if (err) {
            console.log(err);
            next(err);
        } else if (body.status === "failure") {
            console.log("body:" + JSON.stringify(body)); // Show the HTML for the Google homepage.
            console.log("response:" + JSON.stringify(response));
            if (body.Header.Rpcd === "AC002") {
                next("no service time");
            } else {
                next(body.Header.Rsms);
            }
        } else if (!err && body.status === "OK") {
            console.log("body:" + JSON.stringify(body)); // Show the HTML for the Google homepage.
            console.log("response:" + JSON.stringify(response));
            next(null, body);
        }
    });
}



//타행 예금주 조회
router.InquireDepositorOtherBank = function (bankCode, account, next) {
    const form = {};
    form.command = "InquireDepositorOtherBank"; //약정계좌 거래내역 조회
    form.bankCode = bankCode;
    form.account = account;
    request.post({ url: config.nhServer+'/NHPintech/nhpintechServlet', form: form }, function (err, response, result) {
        let body = JSON.parse(result);
        if (err) {
            console.log(err);
            next(err);
        } else if (body.status === "failure") {
            console.log("body:" + JSON.stringify(body)); // Show the HTML for the Google homepage.
            console.log("response:" + JSON.stringify(response));
            if (body.Header.Rpcd === "AC002") {
                next("no service time");
            } else {
                next(body.Header.Rsms);
            }
        } else if (!err && body.status === "OK") {
            console.log("body:" + JSON.stringify(body)); // Show the HTML for the Google homepage.
            console.log("response:" + JSON.stringify(response));
            next(null, body);
        }
    });
}


/////////////// 캐쉬 전환 API /////////////////


function checkAccountHistory(pageNO, count, startDate, next) {
    //let CtntFlag = true;

    if (count === "100") { //마지막 조회 페이지의 100번째면 다음 페이지의 0부터 조회
        pageNO++;
        count = 0;
    }

    console.log(pageNO + " " + count + " " + " " + startDate);
    router.RetrieveAgreementAccountTransactionHistory(startDate, startDate, pageNO, "100", function (err, accHistory) {
        console.log("RetrieveAgreementAccountTransactionHistory success");
        if(err){
            next("now isn't service time");
        }else{
			//console.log("accHistory:"+accHistory);
            //accHistory;
            let i = 0;
            async.whilst(function () { return i < accHistory.Iqtcnt - count; },
                function (callback) {
                    let cashList = {};

                    cashList.cashId = accHistory.Rec[i].BnprCntn.toUpperCase();
                    cashList.transactionType = "deposit";
                    cashList.amount = parseInt(accHistory.Rec[i].Tram);
                    cashList.depositTime = accHistory.Rec[i].Trdd+accHistory.Rec[i].Txtm;
                    cashList.depositDate = accHistory.Rec[i].Trdd;
                    cashList.depositHour = accHistory.Rec[i].Txtm.substring(0,2)
                    cashList.transactionTime = new Date().toISOString();
                    cashList.confirm = 0;
                    cashList.bankCode = accHistory.Rec[i].HnisCd;
                    // cashList.branchCode = accHistory.Rec[i].HnbrCd;
					console.log(cashList);

                    // let NHisCd = ["010", "011", "012", "013", "014", "015", "016", "017", "018"];

                    // for (let idx = 0; idx < NHisCd.length; idx++) {
                    //     if (accHistory.Rec[i].HnisCd === NHisCd[idx]) {
                    //         cashList.branchCode = accHistory.Rec[i].HnisCd + accHistory.Rec[i].HnbrCd.substring(3, 6);
                    //         break;
                    //     }
                    // }

                    console.log(cashList);
                    async.waterfall([function (callback) {
						mariaDB.getBankName(cashList.bankCode,callback);
               		},function(result,callback){
                    	cashList.bankName = result;
                        mariaDB.insertCashList(cashList, callback);
                    }, function (cashTuno, callback) {
                        cashList.cashTuno = cashTuno;
                        async.parallel([function (callback) {
                            redisCli.hmset('cash_' + startDate, 'pageNO', pageNO, 'count', count + i + 1, callback);
                        }, function (callback) {
                            mariaDB.getPushIdWithCashId(cashList.cashId, callback);
                        }], callback);
                    }, function (result, callback) {
                        //send notification

                        console.log("cashHistory iteration : " + JSON.stringify(result));
                        const GCM = {};
                        GCM.title = "입금된 캐쉬를 확인해주세요";
                        GCM.content = cashList.amount + "캐쉬 확인 바로가기";
                        GCM.custom = JSON.stringify(cashList);
                        GCM.GCMType = "cash";

                        i++;
                        if (result[1] !== "incorrect cashId") {
                            noti.sendGCM(config.SERVER_API_KEY, GCM, [result[1].pushId], result[1].platform, "takit", callback);
                        } else {
                            callback(null, "incorrect cashId");
                        }
                    }], callback); //API_KEY,MSG,pushId, platform,
                }, function (err, result) {
                    if (err) {
                        console.log(err);
                        next(err);
                    } else {
                        if (accHistory.CtntDataYn === "N") {
                            CtntFlag = false;
                            next(null, result);
                        } else {
                            pageNO++;
                            count = 0;
                            checkAccountHistory(pageNO, count, startDate, next);
                        }
                    }
                });
            }
    });
        // }, function (err, result) {
        //     if (err) {
        //         next(err);
        //     } else {
        //         console.log("checkAccountHistory success");
        //         next(null, result);
        //     }
        // });
}


router.checkCashInstantly = function (req, res) {
    let nowTime = op.getTimezoneLocalTime('Asia/Seoul', new Date()).toISOString(); //농협 timezone= 'Asia/Seoul'
    let beforeTime = op.getTimezoneLocalTime('Asia/Seoul', new Date(new Date().getTime() - 350000)).toISOString(); //지금시간 local시간으로 -6분전 시간으로 계산
    //redis reset을 어떻게 한번만...? 시키나ㅜㅜ expire 시간 24시간+10분으로 설정하면 될 듯
    let startDate = beforeTime.substring(0, 10).replace(/-/gi, '');

    async.waterfall([function (callback) {
        redisCli.exists('cash_' + startDate, callback);
    }, function (result, callback) {
        if (result === 0) { //key가 없으면
            redisCli.hmset('cash_' + startDate, 'pageNO', '1', 'count', 0, function (err, result) {
                if (err) {
                    console.log(err);
                    callback(err);
                } else {
                    console.log(result);
                    redisCli.expire('cash_' + startDate, 87600); //60*60*24 + 60*20
                }
            });
        } else { //있으면
            callback(null, "key is already exists")
        }
    }, function (result, callback) {
        console.log("startDate:" + startDate);
        redisCli.hgetall('cash_' + startDate, callback);
    }, function (result, callback) {
        console.log(result);
        checkAccountHistory(result.pageNO, parseInt(result.count), startDate, callback);
    }], function (err, result) {
        if (err) {
            console.log(err);
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
            console.log(result);
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        }
    });
}

setInterval(function () {
    let nowTime = op.getTimezoneLocalTime('Asia/Seoul', new Date()); //농협 timezone= 'Asia/Seoul'    
    let beforeTime = op.getTimezoneLocalTime('Asia/Seoul', new Date(new Date().getTime() - 350000)).toISOString(); //지금시간 local시간으로 -6분전 시간으로 계산 //농협이 'Asia/Seoul' 이므로 이시간으로 맞춰줌
    //redis reset을 어떻게 한번만...? 시키나ㅜㅜ expire 시간 24시간+10분으로 설정하면 될 듯
    let startDate = beforeTime.substring(0, 10).replace(/-/gi, '');

    //if(nowTime.getUTCHours() == '0' && (nowTime.getUTCMinutes() >=0 || nowTime.getUTCMinutes() < 30)){
      //  console.log("NH isn't service time");
    //}else{
        async.waterfall([function (callback) {
            redisCli.exists('cash_' + startDate, callback);
        }, function (result, callback) {
            if (result === 0) { //key가 없으면
                redisCli.hmset('cash_' + startDate, 'pageNO', '1', 'count', 0, function (err, result) {
                    if (err) {
                        console.log(err);
                        callback(err);
                    } else {
                        console.log(result);
                        redisCli.expire('cash_' + startDate, 87600); //60*60*24 + 60*20
                    }
                });
            } else { //있으면
                callback(null, "key is already exists")
            }
        }, function (result, callback) {
            console.log("startDate:" + startDate);
            redisCli.hgetall('cash_' + startDate, callback);
        }, function (result, callback) {
            console.log(result);
            checkAccountHistory(result.pageNO, parseInt(result.count), startDate, callback);
        }], function (err, result) {
            if (err) {
                console.log("setInterval checkAccountHistory error: " + JSON.stringify(err));
            } else {
                console.log("setInterval checkAccountHistory success:" + JSON.stringify(result));
            }
        });
    //}
}, 15000); //15초 마다

//cash 수동 확인 -> cashId는 있고, 통장인자내역에 cashId를 넣지 않아서, user가 정보 넣고 조회 할 때
//depositTime, depositAmount, bankName,

function cashUserselfGCM(pushId,platform,cashList){
    const GCM = {};
    GCM.title = "입금된 캐쉬를 확인해주세요";
    GCM.content = cashList.amount + "캐쉬 확인 바로가기";
    GCM.custom = JSON.stringify(cashList);
    GCM.GCMType = "cash";

    noti.sendGCM(config.SERVER_API_KEY, GCM, [pushId], platform, "takit", function(err,result){ //API_KEY,MSG,pushId, platform,
        if(err){
            console.log(err);
        }else{
            console.log(result);
        }
    });

}

//cash 수동 확인 -> cashId는 있고, 통장인자내역에 cashId를 넣지 않아서, user가 정보 넣고 조회 할 때
//depositTime, depositAmount, bankName,
router.checkCashUserself = function (req, res) {
    console.log("checkCashUserself start");
    let nowTime = op.getTimezoneLocalTime('Asia/Seoul', new Date()); //농협이 'Asia/Seoul' 이므로 이시간으로 맞춰줌
    let beforeTime = op.getTimezoneLocalTime('Asia/Seoul', new Date(new Date().getTime() - 350000)).toISOString(); //지금시간 local시간으로 -6분전 시간으로 계산
    //redis reset을 어떻게 한번만...? 시키나ㅜㅜ expire 시간 24시간+10분으로 설정하면 될 듯
    let startDate = beforeTime.substring(0, 10).replace(/-/gi, ''); //입금시각?
    let cashList = {};
    let pushId;
    let platform;
    let output=[];

    async.waterfall([function (callback) {
        mariaDB.getCashInfoAndPushId(req.body.cashId.toUpperCase(), callback);
    }, function (result, callback) {
        console.log(result);
        console.log(result.confirmCount);
        if (result.confirmCount < 3) {
            pushId=result.pushId;
            platform=result.platform;
            mariaDB.updateConfirmCount(req.body.cashId.toUpperCase(), parseInt(result.confirmCount) + 1, callback);
        } else {
            callback("count excess");
        }
    }, function (result, callback) {
        redisCli.exists('cash_' + startDate, callback);
    }, function (result, callback) {
        if (result === 0) { //key가 없으면
            redisCli.hmset('cash_' + startDate, 'pageNO', '1', 'count', 0, function (err, result) {
                if (err) {
                    console.log(err);
                    callback(err);
                } else {
                    console.log(result);
                    redisCli.expire('cash_' + startDate, 87600); //60*60*24 + 60*20
                }
            });
        } else { //있으면
            callback(null, "key is already exists")
        }
    }, function (result, callback) {
        redisCli.hgetall("cash_" + startDate, callback);
    }, function (result, callback) {
        console.log(result);
        checkAccountHistory(result.pageNO, parseInt(result.count), startDate, callback); //캐쉬리스트 생성 전일 수 있으므로 
    }, function (result, callback) {
        console.log("req.body:" + JSON.stringify(req.body));
        
		cashList.depositTime = op.getTimezoneLocalTime('Asia/Seoul',new Date(req.body.depositTime)).toISOString();
        cashList.depositTime = cashList.depositTime.replace('T',' ');
        //let tmp = cashList.depositTime.toISOString();
        console.log(cashList.depositTime);
        cashList.depositMemo = req.body.depositMemo.toUpperCase();
        cashList.amount = req.body.amount;
        cashList.depositDate = cashList.depositTime.substring(0,11);
        cashList.depositHour = parseInt(cashList.depositTime.substring(11, 13));
        cashList.bankCode = req.body.bankCode;
        
		/*if(req.body.bankCode==='-1'){ // toss is wooribank code since 2017.07
            cashList.bankCode = '020';
        }
        if(req.body.bankCode==='-2'){ // kakaopay is wooribank code since 2017.07
            cashList.bankCode = '088';
        }*/

		mariaDB.getDepositedCash(cashList, callback);
    }, function (cashLists, callback) {
        //cashList 여러개 검색될 수 있으므로 여러개에 대해 보냄
        //let cashLists = result;

        for(let i=0; i<cashLists.length; i++){
            cashList.cashTuno = cashLists[i].cashTuno;
            cashList.bankName = cashLists[i].bankName;
            cashList.depositTime= cashLists[i].depositTime;

            output.push(cashList); // push전송대신 응답으로 전달한다.
        }
        mariaDB.updateConfirmCount(req.body.cashId, 0, callback);
    }], function (err, result) {
        if (err) {
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
            if (result === "gcm:400") {
                let response = new index.FailResponse(result);
                response.setVersion(config.MIGRATION, req.version);
                res.send(JSON.stringify(response));
            } else {
                let response = new index.SuccResponse();
                response.setVersion(config.MIGRATION, req.version);
                response.cashlist=output;
                res.send(JSON.stringify(response));
            }
        }
    });
}

//user가 잘못된 캐쉬 목록 들어와서 삭제했을 때
router.removeWrongCashList = function (req, res) {
    console.log("removeWrongCashList start!!");

    mariaDB.updateTransactionType(req.body.cashTuno, "wrong", function (err, result) {
        if (err) {
            console.log(err);
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
            console.log(result);
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        }
    });
}


//user가 확인버튼 눌렀을 때
router.addCash = function (req, res) {
    console.log("req.body:"+JSON.stringify(req.body));

    lock.acquire(req.body.cashId.toUpperCase(), function(callback) {
       let preBalance,preCashList;
       mariaDB.getCashListWithTuno(req.body.cashTuno,function(err,result){
            if(err){
                 callback(err);
            }
            console.log("preCashList:"+JSON.stringify(result));
            preCashList=result;
            mariaDB.getBalanceCash(req.body.cashId.toUpperCase(), function(err,result){
                if(err){
                    callback(err);
                }     
                preBalance=result;
                if (preCashList.confirm != '0') {
                    callback("already checked cash");
                }else{
                    const cashList = {};
                    cashList.cashId = req.body.cashId.toUpperCase();
                    cashList.cashTuno = req.body.cashTuno;
                    cashList.transactionTime = new Date().toISOString();
                    cashList.transactionType = "deposit";
                    cashList.confirm = 1;
                    cashList.nowBalance = parseInt(preBalance) + parseInt(req.body.amount);
                    mariaDB.confirmCashList(cashList, function(err,result){
                        if(err){
                            callback(err);
                        }else{
                           mariaDB.updateBalanceCash(req.body.cashId.toUpperCase(), parseInt(req.body.amount), preBalance, function(err,result){
								if(err)
									callback(err);
								else
									callback(null);
							}); 
                        } 
                    });
                 }
            });
       });
    }, function(err, result) {
        if (err) {
            console.log(err);
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
            console.log("addCash success:" + JSON.stringify(result));
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        }
    });
};


/////////// 캐쉬 전환 API end.


function pad(n, length) {
    while (n.toString().length < length) {
        n = '0' + n;
    }
    return n;
}


// user가 캐쉬로 주문하여 캐쉬 빠짐
router.payCash = function (cashId, amount,orderId, next) {
    let balance;

  lock.acquire(cashId.toUpperCase(), function(done) {
 
    async.waterfall([function (callback) {
        mariaDB.getBalanceCash(cashId.toUpperCase(), callback);
    }, function (result, callback) {
        balance = result;
        if (balance >= amount) { //갖고 있는 캐쉬가 구매하려는 상품의 가격보다 같거나 많으면 구매할 수 있음
            mariaDB.updateBalanceCash(cashId.toUpperCase(), -parseInt(amount), balance, callback); //지불할 캐쉬만큼 update
        }else{
            callback("check your balance");
        } 
    }, function (result,callback) {
            const cashList = {};
            cashList.cashId = cashId;
            cashList.transactionType = "payment";
            cashList.amount = amount;
            cashList.transactionTime = new Date().toISOString();
            cashList.confirm = 1;
            cashList.nowBalance = balance - amount;
            cashList.orderId = orderId;
            mariaDB.insertCashList(cashList, callback);
    }], function (err, result) {
        if (err) {
            console.log(err);
            done(err);
        } else {
            console.log("payCash success:" + JSON.stringify(result));
            done(null, "success");
        }
    });
   },function(err, result) {
        if (err) {
            next(err);
        } else {
            next(null,"success"); 
        }
    });
};



//////// 주문 취소로 cash로 환불 //////

router.cancelCash = function (cashId,orderId,amount, next) {
	console.log("cancel cash start");
	let balance;

  lock.acquire(cashId.toUpperCase(), function(done) {
    async.waterfall([function(callback){
        mariaDB.getBalanceCash(cashId,callback);
    },function(result,callback){
        balance = result;
        mariaDB.updateBalanceCash(cashId.toUpperCase(), parseInt(amount), balance, callback);
    }, function (result, callback) {
        mariaDB.getBalanceCash(cashId, callback)
    }, function (balance, callback) {
        const cashList = {};

        console.log("amount :" + amount);
        cashList.cashId = cashId.toUpperCase();
        cashList.transactionType = "cancel";
        cashList.amount = amount;
        cashList.transactionTime = new Date().toISOString();
        cashList.confirm = 1;
        cashList.nowBalance = balance;
        cashList.orderId=orderId;
        mariaDB.insertCashList(cashList, callback);
    }], function (err, result) {
        if (err) {
            console.log(err);
            done(err);
        } else {
            console.log("addCash success:" + JSON.stringify(result));
            done(null, "success");
        }
    });},function (err, result) {
        if (err) {
            //console.log(err);
            next(err);
        } else {
            //console.log("addCash success:" + JSON.stringify(result));
            next(null, "success");
        }
    });
}


///////////환불 API////////////

router.registRefundAccount = function (req, res) {
    console.log("body:"+JSON.stringify(req.body));

    async.waterfall([function (callback) {
        if (req.body.bankCode === NHCode) { //농협일때
            router.InquireDepositorAccountNumber(req.body.account, callback);
        } else { //타행일때
            router.InquireDepositorOtherBank(req.body.bankCode, req.body.account, callback);
        }
    }, function (result, callback) {
        if (result.Dpnm === req.body.depositorName) { //Dpnm Header에 있는 정보 아님
            callback(null, "success");
        } else {
            callback("incorrect depositor");
        }
    }], function (err, result) {
        if (err) {
            console.log(err);
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
            console.log(result);
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        }
    });
};

//2.출금 이체

//환불 횟수 조회 (4회 초과 시 수수료)
router.checkRefundCount = function (req, res) {
    console.log("checkRefundCount start!!!");

    mariaDB.getCashInfo(req.body.cashId.toUpperCase(), function (err, result) {
        if (err) {
            console.log("err");
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
            console.log("result");
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION, req.version);
            if (result.refundCount >= 4 && req.body.bankCode === NHCode && result.balance >= 150) {
                console.log("환불 4회 초과 입니다.")
                response.fee = "150";
                res.send(JSON.stringify(response));
            } else if (result.refundCount >= 4 && req.body.bankCode !== NHCode && result.balance >= 400) {
                console.log("환불 4회 초과 입니다.")
                response.fee = "400";
                res.send(JSON.stringify(response));
            } else if (result.refundCount < 4) {
                console.log("환불 4회 이하 입니다.")
                response.fee = "0";
                res.send(JSON.stringify(response));
            } else {
                response = new index.FailResponse("check your balance");
                response.setVersion(config.MIGRATION, req.version);
                res.send(JSON.stringify(response));
            }
        }
    });
};


//parameter: depositorName, bankCode,account,withdrawalAmount <-> deposit
router.refundCash = function (req, res) {

    let cashList = {};
    let cashInfo = {};
    cashList.fee = 0;

 mariaDB.checkDeposit(req.body.cashId.toUpperCase(),function(err,exist){
    if(err){
        let response = new index.FailResponse(err);
        response.setVersion(config.MIGRATION, req.version);
        res.send(JSON.stringify(response));
    }else if(!exist){ //지급된 캐쉬는 환불이 불가능합니다.
        let response = new index.FailResponse("no deposit");
        response.setVersion(config.MIGRATION, req.version);
        res.send(JSON.stringify(response));
    }else{
    async.waterfall([function (callback) {
      lock.acquire(req.body.cashId.toUpperCase(), function (done) {
        mariaDB.getCashInfo(req.body.cashId.toUpperCase(), function(err,result){
            if(err) done(err);
            cashInfo = result;
            console.log("cashInfo:" + cashInfo);
            console.log("req.body:" + JSON.stringify(req.body));
            if (cashInfo.refundCount >= 4 && req.body.bankCode === NHCode) {
                console.log("환불 4회 초과 입니다. NH");
                cashList.fee = 150;
            } else if (cashInfo.refundCount >= 4 && req.body.bankCode !== NHCode) {
                console.log("환불 4회 초과 입니다. other")
                cashList.fee = 400;
            }
            console.log("fee:" + cashList.fee);
            if (parseInt(cashInfo.balance) >= parseInt(req.body.withdrawalAmount) + cashList.fee) { //환불받으려는 금액보다 잔액이 많아야 환불 가능
                if (req.body.bankCode === NHCode) { //농협계좌로 환불할 때
                    router.ReceivedTransferAccountNumber(req.body.account, req.body.withdrawalAmount, 
                     function(err,result){ 
                        if(err) done(err); 
                            mariaDB.updateRefundCashInfo(req.body.cashId.toUpperCase(), -parseInt(req.body.withdrawalAmount) - cashList.fee, cashInfo.balance, 
                               function(err,result){
                                    done(err,result);
                               });
                        });
                } else {
                    router.ReceivedTransferOtherBank(req.body.bankCode, req.body.account, req.body.withdrawalAmount, 
                     function(err,result){
                        if(err) done(err);
                            mariaDB.updateRefundCashInfo(req.body.cashId.toUpperCase(), -parseInt(req.body.withdrawalAmount) - cashList.fee, cashInfo.balance,
                               function(err,result){ 
                                    done(err,result);
                               });
                     });
                }
            } else {
                done("check your balance");
            }
         });
       },function (err, result) {
               callback(err,result);
        });
    }, function (result, callback) {
            mariaDB.updateRefundCashInfo(req.body.cashId.toUpperCase(), -parseInt(req.body.withdrawalAmount) - cashList.fee, cashInfo.balance, function(err,next){
                if(err) callback(err); 
                cashList.cashId = req.body.cashId.toUpperCase();
                cashList.transactionType = "refund";
                cashList.amount = req.body.withdrawalAmount;
                cashList.transactionTime = new Date().toISOString();
                cashList.bankName = req.body.bankName;
                cashList.account = req.body.account;
                cashList.nowBalance = parseInt(cashInfo.balance) - parseInt(req.body.withdrawalAmount) - cashList.fee;
                result.confirm = 1;

                mariaDB.insertCashList(cashList, callback);
            })
    }], function (err, result) {
        if (err) {
            console.log(err);
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
            console.log("success:" + JSON.stringify(result));
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        }
    });
    }
  });
}


////////// 환불 API end.


///////// shop -cash API ///////////

router.checkWithdrawalCountShop = function (req, res) {
    console.log("checkShopWithdrawalCount start!!!");

    mariaDB.getShopInfo(req.body.takitId, function (err, result) {
        if (err) {
            console.log("err");
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
            console.log("result");

            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION, req.version);
            if (result.withdrawalCount >= 4 && req.body.bankCode === NHCode && result.balance >= 150) {
                console.log("인출 4회 초과 입니다. NH")
                response.fee = "150";
                res.send(JSON.stringify(response));
            } else if (result.withdrawalCount >= 4 && req.body.bankCode !== NHCode && result.balance >= 400) {
                console.log("인출 4회 초과 입니다. other")
                response.fee = "400";
                res.send(JSON.stringify(response));
            } else if (result.withdrawalCount < 4) {
                console.log("인출 4회 이하 입니다.")
                response.fee = "0";
                res.send(JSON.stringify(response));
            } else {
                response = new index.FailResponse("check your balance");
                response.setVersion(config.MIGRATION, req.version);
                res.send(JSON.stringify(response));
            }
        }
    });
}


//shop - cash인출 API
//인출가능 금액,
router.withdrawCashShop = function (req, res) {
    //takitId, amount
    //1. shopInfo에서 해당shop 계좌 가져옴
    //2. 계좌에 금액만큼 넣어줌.
    let shopInfo = {};
    let fee = 0;
    async.waterfall([function (callback) {
        mariaDB.getShopInfoWithAccount(req.body.takitId, callback);
    }, function (result, callback) {
        shopInfo = result;
        console.log("shopInfo:" + JSON.stringify(shopInfo));
        console.log("req.body:" + JSON.stringify(req.body));
        if (shopInfo.withdrawalCount >= 4 && req.body.bankCode === NHCode) {
            console.log("인출 4회 초과 입니다. NH");
            fee = 150;
        } else if (shopInfo.withdrawalCount >= 4 && req.body.bankCode !== NHCode) {
            console.log("인출 4회 초과 입니다. other")
            fee = 400;
        }

        console.log("fee:" + fee);
        if (parseInt(shopInfo.balance) >= parseInt(req.body.withdrawalAmount) + fee) { //환불받으려는 금액보다 잔액이 많아야 환불 가능
            if (req.body.bankCode === NHCode) { //농협계좌로 환불할 때
                router.ReceivedTransferAccountNumber(shopInfo.account, req.body.withdrawalAmount, callback);
            } else {
                router.ReceivedTransferOtherBank(req.body.bankCode, shopInfo.account, req.body.withdrawalAmount, callback);
            }
        } else {
            callback("check your balance");
        }
    }, function (result, callback) {
        mariaDB.updateWithdrawalShop(req.body.takitId, -parseInt(req.body.withdrawalAmount) - fee, shopInfo.balance, callback);
    }, function (result, callback) {
        mariaDB.insertWithdrawalList(req.body.takitId, req.body.withdrawalAmount, fee, parseInt(shopInfo.balance) - parseInt(req.body.withdrawalAmount) - fee, callback);
    }], function (err, result) {
        if (err) {
            console.log(err);
            let response = new index.FailResponse("failure", err);
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
            console.log(result);
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        }
    });
}


router.getBalnaceShop = function (req, res) {
    mariaDB.getBalnaceShop(req.body.takitId, function (err, result) {
        if (err) {
            console.log(err);
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
            console.log(result);
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION, req.version);
            response.sales = result.sales;
            response.balance = result.balance;
            res.send(JSON.stringify(response));
        }
    })
}



router.getWithdrawalListShop = function (req, res) {
    console.log("getWithdrawalList comes");
    mariaDB.getWithdrawalList(req.body.takitId, req.body.lastWithdNO, req.body.limit, function (err, result) {
        if (err) {
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION, req.version);
            response.withdrawalList = result;
            res.send(JSON.stringify(response));
        }
    })
}


router.branchNameAutoComplete = function (req, res) {
    console.log("bankCodeAutoComplete comes(req:" + JSON.stringify(req.body) + ")");
    mariaDB.findBranchName(req.body.branchName, req.body.bankName, function (err, bankInfo) {
        if (err) {
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION, req.version);
            response.bankInfo = bankInfo;
            res.send(JSON.stringify(response));
        }
    });
};

router.getBalanceCash = function (req, res) {
    console.log("getBalanceCash comes(req:" + JSON.stringify(req.body) + ")");

    mariaDB.getBalanceCash(req.body.cashId.toUpperCase(), function (err, balance) {
        if (err) {
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION, req.version);
            response.balance = balance;
            res.send(JSON.stringify(response));
        }
    });
}

// 캐쉬 사용내역 조회
router.getCashList = function (req, res) {
     console.log("getCashList:"+JSON.stringify(req.body));
    if(req.body.hasOwnProperty('startGMTTime') && req.body.hasOwnProperty('endGMTTime')){
      mariaDB.getCashListWithPeriod(req.body.cashId.toUpperCase(), req.body.lastTuno,req.body.startGMTTime,req.body.endGMTTime,req.body.limit, function (err, cashList) {
        if (err) {
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION, req.version);
            response.cashList = cashList;
            res.send(JSON.stringify(response));
        }
      });
    }else{
      mariaDB.getCashList(req.body.cashId.toUpperCase(), req.body.lastTuno, req.body.limit, function (err, cashList) {
        if (err) {
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION, req.version);
            response.cashList = cashList;
            res.send(JSON.stringify(response));
        }
      });
    }
};


router.branchNameAutoComplete = function (req, res) {
    console.log("bankCodeAutoComplete comes(req:" + JSON.stringify(req.body) + ")");
    mariaDB.findBranchName(req.body.branchName, req.body.bankName, function (err, bankInfo) {
        if (err) {
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION, req.version);
            res.send(JSON.stringify(response));
        } else {
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION, req.version);
            response.bankInfo = bankInfo;
            res.send(JSON.stringify(response));

        }
    });
};


router.resetCashConfirmCount = function (req,res){
    console.log("resetCashConfirmCount:"+JSON.stringify(req.body));
    mariaDB.updateConfirmCount(req.body.cashId,0,function(err,result){
        if(err){
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }else{
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }
    });
}

router.updateCashWithCoupon=function(cashId,couponName,amount,next){
    lock.acquire(cashId.toUpperCase(), function(callback) {
        //addCash    
        mariaDB.updateBalanceCashWithCoupon(cashId.toUpperCase(), amount,function(err,result){
            console.log("result:!!!!"+result); 
            let balance=result;
            if(err){
                console.log("error give promotion for "+ cashId.toUpperCase());
                callback(err); 
            }else{
                    let cashList = {};

                    cashList.cashId = cashId.toUpperCase();
                    cashList.transactionType = "coupon";
                    cashList.amount = amount;
                    cashList.couponName=couponName;
                    cashList.nowBalance= balance;
                    cashList.transactionTime = new Date().toISOString();
                    console.log("!!!!insert cashList "+JSON.stringify(cashList));
                    mariaDB.insertCashList(cashList, function(err,result){
                        callback(err);
                    });
            }
        });
   }, function(err, ret) {
        if(err){
            console.log(JSON.stringify(err)) // output: error
            next(err);
        }else{
            console.log("updateCashWithCoupon success");
            next(null);
        }
   });
};

module.exports = router;


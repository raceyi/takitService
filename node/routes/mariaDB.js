var express = require('express');
var router = express.Router();
var Client = require('mariasql'); //https://github.com/mscdex/node-mariasql
var crypto = require('crypto')
var timezoneJS = require('timezone-js');
var config=require('../config');
var moment=require('moment');


var mariaDBConfig={
  host: config.mariaDB.host,
  user: config.mariaDB.user,     //
  password: config.mariaDB.password,      // Please input your password
  multiStatements: true,
  pingInactive:300, //in seconds 
  pingWaitRes:60 //in seconds. time for waiting ping response 
}


var c = new Client(mariaDBConfig);

c.query('set names utf8;');
c.query("use takit;");
c.on('close',function(){
    console.log("DB close c.connected:"+c.connected);
	console.log("DB close c.connecting:"+c.connecting);
}).on('error', function(err) {
   console.log('Client error: ' + err);
}).on('connect', function() {
   console.log('Client connected');
});

router.setDir=function(__dirname){
	timezoneJS.timezone.zoneFileBasePath = __dirname+'/tz';
	timezoneJS.timezone.init({ async: false });
}

var flag;
function performQuery(command,handler){
    console.log("performQuery with command="+command+ " connected:"+c.connected+" connecting:"+c.connecting+" threadId"+c.threadId);
    if(!c.connected){                         // Anyother way? It could be dangerous. any mutex? 
        c.connect(mariaDBConfig);
        c.on("ready",function(){
	    console.log("mariadb ready");
            c.query('set names utf8;');
            c.query("use takit;");
            c.query(command,handler);
	});
    }else{
        c.query(command,handler);
    }
}

function performQueryWithParam(command,value,handler){
    console.log("performQuery with command="+command+ " connected:"+c.connected+" connecting:"+c.connecting+" threadId"+c.threadId);
    if(!c.connected){                         // Anyother way? It could be dangerous. any mutex?
        c.connect(mariaDBConfig);
        c.on("ready",function(){
            console.log("mariadb ready");
            c.query('set names utf8;');
            c.query("use takit;");
            c.query(command,value,handler);
        });
    }else{
        console.log("call c.query with value "+JSON.stringify(value));
    	function defaultHandler(){
           console.log("c.query returns");
           flag=true;
           handler();
        }
        console.log("call c.query");
        c.query(command,value,handler);
	}
}


//encrypt data

function encryption(data,pwd){
	var cipher = crypto.createCipher('aes256',pwd);
	var secretData = cipher.update(data,'utf8','hex');
	secretData += cipher.final('hex');
	
	return secretData;
} 

//decrypt decrepted data

function decryption(secretData, pwd){
	var decipher = crypto.createDecipher('aes256',pwd);
	var data=decipher.update(secretData,'hex','utf8');
	data += decipher.final('utf8');
	
	return data;
}

//decrpt userInfo,shopInfo ...etc
function decryptObj(obj){
	if(obj.hasOwnProperty('referenceId') && obj.referenceId !==null ){
   		obj.referenceId=decryption(obj.referenceId, config.rPwd);
	}	

	if(obj.hasOwnProperty('email')){
		obj.email=decryption(obj.email, config.ePwd);	
	}

	if(obj.hasOwnProperty('phone')){
		obj.phone=decryption(obj.phone, config.pPwd);
	}
		
	if(obj.hasOwnProperty('userPhone') && obj.userPhone !== null){
		obj.userPhone=decryption(obj.userPhone,config.pPwd);
	}
	
}


router.existUserEmail=function(email,next){
	var secretEmail = encryption(email,config.ePwd);
	
	var command="select *from userInfo where email=?";
	var values=[secretEmail];
        console.log("existUserEmail is called. command:"+command);

	performQueryWithParam(command,values,function(err, result) {
        console.log("c.query success");
		if (err){
			next(err);
		}else{
			console.dir("[existUser]:"+result.info.numRows);
			if(result.info.numRows==="0"){
				next("invaildId");
			}else{
				decryptObj(result[0]);
				next(null,result[0]);
			}
		}
	});
};

router.existEmailAndPassword=function(email, password,next){
	var secretEmail = encryption(email,config.ePwd);

    var command="select *from userInfo where email=?";
    var values=[secretEmail];

	performQueryWithParam(command,values, function(err,result){
    	if(err){
    		console.log(err);
    		next(err);
   		}
    	else{
      		//console.log("[existUser]:"+result.info.numRows);
      		if(result.info.numRows==="0"){
        		next("invalidId");
    		}else{
        		var userInfo = result[0];
        		var secretPassword = crypto.createHash('sha256').update(password+userInfo.salt).digest('hex');
       
        		if (secretPassword === userInfo.password){
        			console.log("password success!!");
        			decryptObj(userInfo);
					next(null,userInfo);
        		}else{
        			next("passwordFail");
        		}
			}
		}
	});
};

router.existUser=function(referenceId,next){
	var secretReferenceId = encryption(referenceId,config.rPwd);
	var command="select * from userInfo where referenceId=\""+secretReferenceId+"\";";
	performQuery(command,function(err, result) {
		if (err){
			console.log("query error:"+JSON.stringify(err));
			next(err);
		}else{
			console.dir("[existUser function numRows]:"+result.info.numRows);
			if(result.info.numRows==="0"){
				next("invalidId");
		  	}else{
				decryptObj(result[0]);
				next(null,result[0]);
		  }
		}
	});
};

router.getUserPaymentInfo=function(id,successCallback,errorCallback){
	var command="select name,email,phone from userInfo where id=\""+id+"\";";
	console.log("command:"+command);
	performQuery(command,function(err, result) {
		  if (err){
			  console.log(JSON.stringify(err));
			  errorCallback(err);
		  }
		  console.dir("[getUserPaymentInfo]:"+result.info.numRows);
		  if(result.info.numRows==="0"){
			  errorCallback("invalid DB status");
		  }else{
			  console.log("result[0]:"+JSON.stringify(result[0]));
			  successCallback(result[0]);
		  }
	});
};


router.insertUser=function(referenceId,password,name,email,countryCode,phone,phoneValidity,next){
	console.log("referenceId:"+referenceId+" password:"+password+" name:"+name+" country:"+countryCode+" phone:"+phone+" phoneValidity:"+phoneValidity);
	
	// referenceId encrypt
	var secretReferenceId = encryption(referenceId, config.rPwd);	

	var salt;
	var secretPassword='';
	
	//1. password encrypt	
	if(password === null || password === ''){
		salt = null;
		secretPassword = null;
	}else{
		salt = crypto.randomBytes(16).toString('hex');
		secretPassword = crypto.createHash('sha256').update(password+salt).digest('hex');
	}
	
	//2. email encrypt
	var secretEmail = encryption(email,config.ePwd);	
	
	//3. phone encrypt
	var secretPhone = encryption(phone,config.pPwd);

	console.log("secretReferenceId :"+secretReferenceId+" secretEmail : "+secretEmail+" secretPhone:"+secretPhone);

	var command='INSERT IGNORE INTO userInfo (referenceId,password,salt,name,email,countryCode,phone,phoneValidity,lastLoginTime) VALUES (?,?,?,?,?,?,?,?,?)';
	var values=[secretReferenceId,secretPassword,salt,name,secretEmail,countryCode,secretPhone,phoneValidity,new Date().toISOString()];
    	
	performQueryWithParam(command,values, function(err, result) {
		if (err){
			console.log(JSON.stringify(err));
			next(err);
		}else{
			console.log("insertUser func result"+JSON.stringify(result));
			if(result.info.affectedRows === '0'){
						
				next(null,"duplication")
			}else{
				//console.log(JSON.stringify(result));
				next(null,result.info.insertId);
			} 
		}
	});
};

router.getUserInfo=function(userId,next){
	var command="SELECT *FROM userInfo WHERE userId=?";
	var values = [userId];
	performQueryWithParam(command,values,function(err,result) {
		  if (err){
			console.error("getUserInfo func Unable to query. Error:", JSON.stringify(err, null, 2));
			  next(err);
		  }else{
			  console.dir("[Get userInfo]:"+result.info.numRows);
			  if(result.info.numRows==0){
				  next(null,{});
			  }else{
				console.log("Query succeeded. "+JSON.stringify(result[0]));
				decryptObj(result[0]);	
				next(null,result[0]);
			  }
		  }
	});
}

router.deleteUserInfo=function(userId,next){
    console.log("userId:"+userId);

    var command="DELETE FROM userInfo where userId=?"; //userInfo에 shopList 넣기
    var values = [userId];

    performQueryWithParam(command,values,function(err,result){
        if(err){
                console.log("deleteUserInfo function err:"+err);
                next(err);
        }else{
                console.log("deleteUserInfo function Query succeeded"+JSON.stringify(result));
                next(null);
        }
    });
}

//shop user 정보 가져옴.

router.existShopUser=function(referenceId,next){
  var secretReferenceId = encryption(referenceId,config.rPwd);
  var command="select * from shopUserInfo where referenceId=?";
  var values=[secretReferenceId];

  performQueryWithParam(command,values,function(err, result) {
    if(err){
      console.log("existShopUser function query error:"+JSON.stringify(err));
        next(err);
      }else{
        console.dir("[existShopUser function numRows]:"+result.info.numRows);

        if(result.info.numRows==="0"){
          next("no shopUser");
        }else{
          //shop이 여러개일 경우에 여러개 리턴
          let shopUserInfos=[];
          result.forEach(function(shopUser){
            decryptObj(shopUser);
            shopUserInfos.push(shopUser);
          });
          console.log("shopUserInfos:"+JSON.stringify(shopUserInfos));
          next(null,shopUserInfos);
        }
      }
    });
}

router.exShopUserEmail=function(referenceId, password, next){
  router.existShopUser(referenceId,function(err,shopUserInfos){
    if(err){
        console.log(err);
        next(err);
    }else{
      //한 이메일에 샵마다 다른 패스워드를 사용할 수도 있다는 가정
      let secretPwd =[];
      shopUserInfos.forEach(function(shopUser){
        secretPwd.push = crypto.createHash('sha256').update(password+shopUser.salt).digest('hex');
      });

      let resultShopUser=[];
      for(let i=0; i<shopUserInfos.length; i++){
        if(result.password === secretPwd[i]){
          resultShopUser.push(shopUserInfos[i]);
        }
      }
      console.log("resultShopUser:"+JSON.stringify(resultShopUser));
      next(resultShopUser);

    }
  });
}

///////////////여러개 샵 가지고 있으면 여러 레코드 검색됨
router.getShopUserInfo=function(userId,next){
	let command="select * from shopUserInfo where userId=?";
	let values=[userId];

	performQueryWithParam(command,values,function(err, result) {
		if(err){
		   console.log("shopUserInfo function query error:"+JSON.stringify(err));
			next(err);
		}else{
			console.dir("[shopUserInfo function numRows]:"+result.info.numRows);			
			if(result.info.numRows==="0"){				  
      		next("invalidId");
			}else{
				console.log("shopUserInfo success");
				let shopUserInfos=[];
				result.forEach(function(shopUserInfo){
					decryptObj(shopUserInfo);
					shopUserInfos.push(shopUserInfo);
				});
				
			   next(null,shopUserInfos);
			}
		}													
	});
}

//userId+takitId 로 한명의 shopUser만 검색



router.insertShopUser=function(referenceId,email,password,next){

	router.existUserEmail(email,function(err,userInfo){	
		if(err){
			console.log(err);
			next("invalidId");
		}else{
			router.getShopUserInfo(userInfo.userId,function(err,shopUserInfos){
				if(err){
					next("invalidId");
				}else{
					let secretPassword = crypto.createHash('sha256').update(password+shopUserInfos[0].salt).digest('hex');

               if (secretPassword === shopUserInfos[0].password){
               	console.log("password success!!");

						let secretReferenceId = encryption(referenceId, config.rPwd);

						for(let i=0; i<shopUserInfos.length; i++){
							shopUserInfos[i].referenceId = secretReferenceId;
						}

                  let command="update shopUserInfo set referenceId=? where userId=?";
                  let values=[secretReferenceId,userInfo.userId];
											
                  performQueryWithParam(command,values,function(err, result) {
                     if(err){
                     	console.log("insertShopUser function query error:"+JSON.stringify(err));
                        next(err);
                     }else{
                        console.dir("[insertShopUser function numRows]:"+result.info.affectedRows);
							
								next(null,shopUserInfos);
							}		
            		});
        			}
    			}
			});		
		}
	});
	
}

router.updateUserInfo=function(userInfo,next){
	
	let secretEmail = encryption(userInfo.email,config.ePwd);
	
	let salt = crypto.randomBytes(16).toString('hex');
	let secretPassword = crypto.createHash('sha256').update(userInfo.password+salt).digest('hex');

	let command = "UPDATE userInfo set password=:password, salt=:salt where email=:email";
	const values = {
		password : secretPassword,
		salt : salt,
		email : secretEmail
	};
	
	performQueryWithParam(command,values,function(err,result){
		if(err){
			console.error("updateUserInfo func Unable to query. Error:", JSON.stringify(err, null, 2));
			next(err);
		}else{
			console.log("Query succeeded. "+JSON.stringify(result));
			next(null);
		}
	});
}


router.findTakitId=function(req,next){
	console.log("mariaDB.findTakitId "+ req.body.hasOwnProperty("servicename")+" "+req.body.hasOwnProperty("shopname"));
	var command;
	if(req.body.hasOwnProperty("servicename") && req.body.hasOwnProperty("shopname")){
		command="SELECT serviceName,shopName from takit where serviceName LIKE _utf8\'"+req.body.servicename+"%\' and shopName LIKE _utf8\'"+req.body.shopname+"%\';";
	}else if(req.body.hasOwnProperty("servicename")){
		command="SELECT serviceName,shopName from takit where serviceName LIKE _utf8\'"+req.body.servicename+"%\';";
	}else if(req.body.hasOwnProperty("shopname")){
		command="SELECT serviceName,shopName from takit where shopName LIKE _utf8\'"+req.body.shopname+"%\';";
	}else{
		console.log("no param");
		next([]);
		return;
	}
	console.log("command:"+command);
	performQuery(command,function(err, result) {
		  if (err){
			  console.log("findTakitId Error:"+JSON.stringify(err));
			  next(JSON.stringify(err));
		  }else{
		      console.log("result:"+JSON.stringify(result));
                      if(result==undefined){
			next([]);
                      }else{  
		          console.dir("result:"+result.info.numRows);
		          var shoplist=[];
		          var idx;
		          for(idx=0;idx<result.info.numRows;idx++){
			      shoplist.push(result[idx].serviceName+"@"+result[idx].shopName);
		          }
			  console.log("shoplist:"+JSON.stringify(shoplist));
		          next(shoplist);
                      }
                  }
	});
}


function queryCafeHomeCategory(cafeHomeResponse,req, res){
	var url_strs=req.url.split("takitId=");
	var takitId=decodeURI(url_strs[1]);
	console.log("takitId:"+takitId);

	
	var command="SELECT *FROM categories WHERE takitId=?";
	var values = [takitId];
	performQueryWithParam(command,values,function(err,result) {
		  if (err){
			  console.error("queryCafeHomeCategory function Unable to query. Error:", JSON.stringify(err, null, 2));
		  }else{
			  if(result.info.numRows==0){
				  console.log("[queryCafeHomeCategory categories]:"+result.info.numRows);
			  }else{
			    console.log("queryCafeHomeCategory func Query succeeded. "+JSON.stringify(result));
			    	
			    var categories=[];
		        result.forEach(function(item) {
		            console.log(JSON.stringify(item));
		            categories.push(item);
		        });
		        
		        cafeHomeResponse.categories=categories;
		        console.log("cafeHomeResponse:"+(JSON.stringify(cafeHomeResponse)));
			console.log("send res");
		        res.end(JSON.stringify(cafeHomeResponse));

			  }
		  }
	});
}


function queryCafeHomeMenu(cafeHomeResponse,req, res){
	console.log("req url:"+req.url);	
	
	var url_strs=req.url.split("takitId=");
	var takitId=decodeURI(url_strs[1]);
	console.log(":takitId"+takitId);

	var menus=[];
	
	var command="SELECT *FROM menus WHERE menuNO LIKE '"+takitId+"%'";
	console.log("queryCafeHomeMenu command:"+command);
	performQuery(command,function(err,result) {
		  if (err){
			  console.error("queryCafeHomeMenu func Unable to query. Error:", JSON.stringify(err, null, 2));
		  }else{
			  console.dir("[Get cafeHomeMenu]:"+result.info.numRows);
			  if(result.info.numRows==0){
				  
			  }else{
				  console.log("queryCafeHomeMenu Query succeeded. "+JSON.stringify(result[0]));
				  
				  var menus=[];
				  result.forEach(function(item) {
			        	 console.log(JSON.stringify(item));
			        	 menus.push(item);
			        });
				  
				  cafeHomeResponse.menus=menus;
		          queryCafeHomeCategory(cafeHomeResponse,req, res);
				  
			  }
		  }
	});
}


router.queryCafeHome=function(req, res){
	console.log("queryCafeHome:"+JSON.stringify(req.url));
	var url_strs=req.url.split("takitId=");
	var takitId=decodeURI(url_strs[1]);
	console.log("takitId:"+takitId);
	var cafeHomeReponse={};

	var command="select *from cafeInfo where takitId=?";
	var values = [takitId];
	performQueryWithParam(command,values,function(err,result) {
		  if (err){
			  console.log(err);
		  }else{
			  console.dir("[queryCafeHome function's cafeInfo]:"+result);
			  if(result.info.numRows==="0"){
				  console.log("queryCafeHome function's query failure");
			  }else{
				  result.forEach(function(item) {
			            console.log(JSON.stringify(item));
			            cafeHomeReponse.shopInfo=item;
			            queryCafeHomeMenu(cafeHomeReponse,req, res);
				  });
			  }
		  }
	});
};

//shopList string으로 저장..
router.updateShopList=function(userId,shopList,next){

        console.log("updateUserInfoShopList - userId:"+userId);

        var command="UPDATE userInfo SET shopList=? where userId=?"; //userInfo에 shopList 넣기
        var values = [shopList,userId];

        performQueryWithParam(command,values,function(err,result) {
                  if (err){
                          console.error("updateUserInfoShopList function Unable to query. Error:", JSON.stringify(err, null, 2));
              		  next(err);
		    }else{
                          console.log("updateUserInfoShopList func Query succeeded. "+JSON.stringify(result[0]));
			  next(null);
                  }
        });
};


//pushId
router.updatePushId=function(userId,token,next)
{
	var command="UPDATE userInfo SET pushId=? WHERE userId=?";
	var values = [token,userId];
	performQueryWithParam(command,values,function(err,result) {
		if (err){
				console.error("updatePushId func Unable to query. Error:", JSON.stringify(err, null, 2));
				next(err);
			}else{
				console.log("updatePushId func Query succeeded. "+JSON.stringify(result));
				next(null,"success");
			}
		});
};

router.getPushId=function(userId,next)
{
    let command="select pushId from userInfo WHERE userId=?";
    let values = [userId];
    performQueryWithParam(command,values,function(err,result) {
        if (err){
                console.error("getPushId func Unable to query. Error:", JSON.stringify(err, null, 2));
                next(err);
            }else{
				if(result.info.numRows==0){
					next("not exsit pushId");
				}else{
                	console.log("getPushId func Query succeeded. "+JSON.stringify(result[0]));
                	let pushId = [result[0].pushId];
					next(null,pushId);
            	}
			}
        });
};




router.updateShopPushId=function(userId,takitId,shopToken,next)
{
    var command="UPDATE shopUserInfo SET shopPushId=? WHERE userId=? AND takitId=?";
    var values = [shopToken,userId,takitId];
    performQueryWithParam(command,values,function(err,result) {
        if (err){
                console.error("updateShopPushId func Unable to query. Error:", JSON.stringify(err, null, 2));
                next(err);
            }else{
                console.log("updateShopPushId func Query succeeded. "+JSON.stringify(result));
                next(null,"success");
            }
        });
};


router.getShopPushId=function(takitId,next){

    var command = "SELECT shopPushId from shopUserInfo WHERE takitId=?";
    var values = [takitId];

    performQueryWithParam(command,values,function(err,result) {
        if (err){
            console.error("getShopPushid func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        }else{
            console.log("[getShopPushid func Get cafeInfo]:"+JSON.stringify(result));
            if(result.info.numRows==='0'){
                next("not exist shopUser");
            }else{
				var shopPushIds=[];
				
				result.forEach(function(data){
					shopPushIds.push(data.shopPushId);
				});
		
                next(null, shopPushIds);
            }
          }
    });
}

	

router.getCafeInfo=function(takitId,next){  // cafeInfo 조회해서 next로 넘겨줌.
	
	console.log("enter getCafeInfo function");
	var command="SELECT *FROM cafeInfo WHERE takitId =?";
	var values=[takitId];
	performQueryWithParam(command,values,function(err,result) {
		if (err){
			console.error("getCafeInfo func Unable to query. Error:", JSON.stringify(err, null, 2));		
			next(err);
		}else{
			console.dir("[exist cafeInfo]:"+result.info.numRows);
			if(result.info.numRows==="0"){
				next(null,result.info.numRows);
			}else{
				next(null,result[0]);
			}
		}
	});
}



function getTimezoneLocalTime(timezone,timeInMilliSec){ // return current local time in timezone area
	console.log("timeInMilliSec:"+timeInMilliSec);
         
	var offset=(new timezoneJS.Date(Date(), timezone)).getTimezoneOffset(); // offset in minutes
	var newtime =  timeInMilliSec - (offset*60*1000);
	var currlocal= new Date(timeInMilliSec - (offset*60*1000));
	return currlocal.toISOString();
}

//increaseOrderNumber function orderNumberCounter 수 증가 시키고, 마지막 주문 시간 재 설정.
function increaseOrderNumber(takitId,next){

	var command="UPDATE cafeInfo SET orderNumberCounter=orderNumberCounter+1,orderNumberCounterTime=? WHERE takitId=? and orderNumberCounter=orderNumberCounter";
    var values = [new Date().toISOString(),takitId];

        performQueryWithParam(command, values, function(err,result) {
        	if(err){
                         console.error("increaseOrderNumber func Unable to query. Error:", JSON.stringify(err, null, 2));
                }else{

                        console.log("increaseOrderNumber func Query succeeded. "+JSON.stringify(result));
                	next();
		}
         });
}  //increaseOrderNumber function end.



router.getOrderNumber=function(takitId,next){
	var command="SELECT *FROM cafeInfo WHERE takitId=?"
	var values = [takitId];
	
	// 1. cafeInfo 찾기 
	
	router.getCafeInfo(takitId,function(err,cafeInfo){
		//orderNumberCounter = 오늘 주문수 계속 카운트.
		//orderNumberCounterTime = 가장 마지막으로 주문받은 시간 저장. => 오늘의 가장 첫 주문 확인 시에 필요.
		
		console.log("cafeInfo in getOrderNumber:"+cafeInfo);				  
		console.log("current orderNumberCounter:"+cafeInfo.orderNumberCounter);
		console.log("current orderNuberTime:"+cafeInfo.orderNumberCounterTime);	
				  
		//매일 카운트 수 리셋. orderNO도 리셋 하기 위한 작업.
			
		var timezone=cafeInfo.timezone;   // 각 shop의 timezone
		var utcTime=new Date();
		var localTime; // 현재 localTime
		var counterLocalTime; //counterTime의 localTime
		var oldCounterTime="0"; //이전 counterTime

		if(cafeInfo.orderNumberCounterTime !== null){
			var counterTime=new Date(Date.parse(cafeInfo.orderNumberCounterTime)); 
			localTime=getTimezoneLocalTime(timezone,utcTime.getTime()); //현재 시간의 localTime 계산
			counterLocalTime=getTimezoneLocalTime(timezone,counterTime.getTime()); //이전의 orderNumberCounterTime(UTC로 저장되어 있음)의 로컬시간 계산.
			oldCounterTime=cafeInfo.orderNumberCounterTime; //저장돼 있던 정보 이전 시간으로 저장.
			console.log("localTime:"+localTime.substring(0,10));
			console.log("counterLocalTime:"+counterLocalTime.substring(0,10));
		}
		if(cafeInfo.orderNumberCounterTime===null|| cafeInfo.orderNumberCounterTime === undefined ||    //맨 처음 주문이거나
				      localTime.substring(0,10)!==counterLocalTime.substring(0,10)){ //counterLocaltime이 어제 주문한 시간이라 localTime과 맞지 않으면(다음날이 된 경우) reset
				       
			// set orderNumberCounter as zero and then increment it
			console.log("reset orderNumberCounter");
			
			//shop에orderNumberCounterTime 없거나, orderNumberCounterTime이 어제 시간이랑 같으면(?)
			if(cafeInfo.orderNumberCounterTime===null || cafeInfo.orderNumberCounterTime === oldCounterTime){
				var command="UPDATE cafeInfo SET orderNumberCounter=?, orderNumberCounterTime=? WHERE takitId=?";
				var values = [0,utcTime.toISOString(),takitId];
				//orderNumberCounter를 하루의 시작 0으로 리셋
				    			
				performQueryWithParam(command, values, function(err,result) {
					if(err){
						console.log("getOrderNumber func set orderNumberCounter with condition "+err);
//						if(err.code=="ConditionalCheckFailedException"){ // some one else alreay reset it 
//							increaseOrderNumber();
//						} // mariadb is what's error 
					    				  
					    	console.error("getOrderNumber func Unable to query. Error:", JSON.stringify(err, null, 2));
					    	next(err);
					}else{
						console.dir("[getOrderNumber func update orderNumberCounter]:"+result.info.numRows);
					    	
						if(result.info.affectedRows==='0'){
					    		next(null,result.info.affectedRows);
					    	}else{
					    		console.log("getOrderNumber func Query succeeded. "+JSON.stringify(result));
					    		increaseOrderNumber(takitId,function(){
								router.getCafeInfo(takitId,function(err,cafeInfo){
									console.log("orderNumberCounter:"+cafeInfo.orderNumberCounter);
									next(null,cafeInfo.orderNumberCounter);
								});	
							});
					    	}
					}
				});// end update orderNumberCounterTime


			}
  	
		}else{ //같은 날의 주문일 경우
			increaseOrderNumber(takitId,function(){
                router.getCafeInfo(takitId,function(err,cafeInfo){
				console.log("orderNumberCounter:"+cafeInfo.orderNumberCounter);
                    next(null,cafeInfo.orderNumberCounter);
                        	});     
                        });     
		}
	
	        
	        //////////////////////////////////////////////////////////////////////
	});
};


router.saveOrder=function(order,next){
	console.log("[order:"+JSON.stringify(order)+"]");
	console.log("order's takeout:"+order.takeout);
	//1. user 검색
	router.getUserInfo(order.userId,function(err,userInfo){
		//2. order insert
		
		//3. encrypt phone
		var secretPhone = encryption(userInfo.phone,config.pPwd);	
		var command="INSERT INTO orders(takitId,orderName,payMethod,amount,takeout,orderNO,userId,userName,userPhone,orderStatus,orderList,orderedTime,localOrderedTime,localOrderedDay,localOrderedHour,localOrderedDate) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
		
        var values = [order.takitId,order.orderName,order.paymethod,order.amount,order.takeout,order.orderNO,userInfo.userId,userInfo.name,secretPhone,order.orderStatus,order.orderList,order.orderedTime,order.localOrderedTime,order.localOrderedDay,order.localOrderedHour,order.localOrderedDate];
        performQueryWithParam(command, values, function(err,orderResult) {
            if (err){
            	console.error("saveOrder func inser orders Unable to query. Error:", JSON.stringify(err, null, 2));
            	next(err);
            }else{
                //console.dir("[Add orders]:"+result);
                if(orderResult.info.affectedRows==='0'){
					next("invalid orders");
                }else{
					console.log("saveOrder func Query succeeded. "+JSON.stringify(orderResult));
					// 3.orderList insert				
					
					var command = "INSERT INTO orderList(orderId,menuNO,menuName,quantity,options,amount) values(?,?,?,?,?,?)";

					var orderList=JSON.parse(order.orderList);
        			
					orderList.menus.forEach(function(menu){
        				var values = [orderResult.info.insertId,menu.menuNO,menu.menuName,menu.quantity,JSON.stringify(menu.options),menu.amount];
						
						performQueryWithParam(command, values, function(err,orderListResult) {
                          	if(err){
                                console.error("saveOrder func insert orderList Unable to query. Error:", JSON.stringify(err, null, 2));
                                next(err);
                          	}else{
								console.log("saveOrder func insert orderList Query Succeeded");
								next(null,orderResult.info.insertId);
							}
						});
					});
                }
            }
        });
	});
	
};


//orderId로 order 검색할때
router.getOrder=function(orderId, next){

    var command="SELECT *FROM orders WHERE orderId=?";
    var values = [orderId];

    performQueryWithParam(command, values, function(err,result) {
        if (err){
            console.error("getOrder func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        }else{
            console.dir("[getOrder func Get MenuInfo]:"+result.info.numRows);
            if(result.info.numRows==0){
                next("not exist order");
            }else{
                console.log("getOrder func Query succeeded. "+JSON.stringify(result.info));
				decryptObj(result[0]);
                next(null,result[0]);
            }
        }
    });

}



//user가 주문내역 검색할 때,
router.getOrdersUser=function(userId,takitId,lastOrderId,limit,next){
	console.log("takitId:"+takitId);	
	var command;
	var values;

	if(lastOrderId == -1){
		command="SELECT *FROM orders WHERE userId=? AND takitId=? AND orderId > ?  ORDER BY orderId DESC LIMIT "+limit;

	}else{
		command="SELECT *FROM orders WHERE userId=? AND takitId=? AND orderId < ?  ORDER BY orderId DESC LIMIT "+limit;
	}

	values = [userId,takitId,lastOrderId];
 
		//해당 user와 shop에 맞는 orders 검색	
	performQueryWithParam(command, values, function(err,result) {
        if (err){
			console.error("getOrdersUser func Unable to query. Error:", JSON.stringify(err, null, 2));
            next(err);
        }else{
			console.dir("[getOrdersUser func Get MenuInfo]:"+result.info.numRows);
			if(result.info.numRows==0){
				next(null,result.info.numRows);
			}else{
				console.log("getOrdersUser func Query succeeded. "+JSON.stringify(result.info));
				
				var orders=[];
				
				result.forEach(function(order){
					decryptObj(order);
					orders.push(order);
				});
				
				next(null,orders);
			}
		}
	})

}

//shop에서 주문내역 검색할 때
router.getOrdersShop=function(takitId,option,lastOrderId,limit,next){
	console.log("takitId:"+takitId);	
	
	function queryOrders(startTime){	
		if(lastOrderId == -1){
		
			var command="SELECT *FROM orders WHERE takitId=? AND orderedTime > ? AND orderId > ?  ORDER BY orderId DESC LIMIT "+limit;
		}else{
			var command="SELECT *FROM orders WHERE takitId=? AND orderedTime > ? AND orderId < ?  ORDER BY orderId DESC LIMIT "+limit;
		}
		var values = [takitId,startTime,lastOrderId];
		performQueryWithParam(command, values, function(err,result) {
			  if (err){
				  console.error("queryOrders func Unable to query. Error:", JSON.stringify(err, null, 2));
				  next(err);
			  }else{
				  console.dir("[queryOrders func Get MenuInfo]:"+result.info.numRows);
				  if(result.info.numRows==0){
					  next("not exist orders");
				  }else{
					  console.log("queryOrders func Query succeeded. "+JSON.stringify(result.info));
					
					var orders=[];
					result.forEach(function(order){
						decryptObj(order);
						orders.push(order);
					});		
						
					  next(null,orders);
				  }
			  }
		});
	} //end queryOrders
	
	
	var command="SELECT *FROM cafeInfo WHERE takitId=?";
	var values = [takitId];
	performQueryWithParam(command, values, function(err,result) {
		  if (err){
			  console.error("getOrdersShop func Unable to query. Error:", JSON.stringify(err, null, 2));
			  next(err);
		  }else{
			  console.dir("[getOrdersShop func Get shopInfo]:"+result.info.numRows);
			  if(result.info.numRows==0){
				  next("not exist shop");
			  }else{
				console.log("getOrdersShop func Query succeeded. "+JSON.stringify(result));
				console.log("timezone:"+result[0].timezone);
				
				var startTime = getTimezoneLocalTime(result[0].timezone, (new Date).getTime()).substring(0,11)+"00:00:00.000Z";
				var localStartTime=new Date(Date.parse(startTime));
				var offset=(new timezoneJS.Date(new Date(), result[0].timezone)).getTimezoneOffset(); // offset in minutes
				var queryStartTime;			
	
				if(option==="today"){
					var todayStartTime=new Date(localStartTime.getTime()+(offset *60*1000));
					console.log("todayStartTime in gmt:"+todayStartTime.toISOString());
					queryStartTime=todayStartTime.toISOString();
				}else if(option==="week"){
					var weekStartTime=new Date(localStartTime.getTime()-24*60*60*6*1000+(offset *60*1000));
					console.log("weekStartTime in gmt:"+weekStartTime.toISOString());
					queryStartTime=weekStartTime.toISOString();	
				}else if(option==="month"){
					var tomorrow= new Date(localStartTime.getTime()+(offset *60*1000));	        		
					var monthAgo=moment(tomorrow).subtract(1,'M').toDate();
					queryStartTime=monthAgo.toISOString();
				}else{
					return;
				}
				console.log("queryStartTime:"+queryStartTime);
				queryOrders(queryStartTime); 
			  }
		  }
	});
};


router.getPeriodOrdersShop=function(takitId,startTime,endTime,lastOrderId,limit,next){
	console.log("takitId:"+takitId+" startTime:"+startTime+" end:"+endTime);	
	
	if(lastOrderId == -1){	
		var command="SELECT *FROM orders WHERE takitId=? AND orderedTime BETWEEN ? AND ? AND orderId > ?  ORDER BY orderId DESC LIMIT "+limit;
	}else{
		var command="SELECT *FROM orders WHERE takitId=? AND orderedTime BETWEEN ? AND ? AND orderId < ?  ORDER BY orderId DESC LIMIT "+limit;
	}
	var values = [takitId,startTime,endTime,lastOrderId];
	
	performQueryWithParam(command, values, function(err,result) {
		if (err){
			console.error("getPeriodOrders func Unable to query. Error:", JSON.stringify(err, null, 2));
			next(err);
		}else{
			console.dir("[getPeriodOrders func Get MenuInfo]:"+result.info.numRows);
			
			if(result.info.numRows==0){
				next("not exist orders");
			}else{
				console.log("getPeriodOrders func Query succeeded. "+JSON.stringify(result.info));
				 var orders=[];
                    result.forEach(function(order){
						decryptObj(order);
                        orders.push(order);
                    });

                next(null,orders);
			}
		}
	});

		
};



///redis에 orders저장 
router.setRedisOrders=function(takitId,option,num,today,next){
	
	console.log("takitId:"+takitId);	
	console.log(option);
	function queryOrders(startTime){	
//		var params = {
//			    TableName: "orders",
//			    IndexName: "takitId-orderedTime-index",
//			    Limit: num,
//			    KeyConditionExpression: "#takitId=:takitId AND orderedTime > :start",
//			    ExpressionAttributeNames: {
//			        "#takitId": "takitId",
//			    },
//			    ExpressionAttributeValues: {
//			    	":takitId": takitId,
//			        ":start": startTime
//			    },
//			    ScanIndexForward:false
//		};		
//		if(ExclusiveStartKey!='0'){
//			console.log("add ExclusiveStartKey");
//			params.ExclusiveStartKey=ExclusiveStartKey;
//		}
//		console.log("param:"+JSON.stringify(params));
		
		docClient.query(params, function(err, data) {
			console.log(data);
			if (err) {
		        console.error("setRedisOrders func Unable to scan the table. Error JSON:", JSON.stringify(err, null, 2));
		        //next(err);
		    } else {
		        // print all the movies
		        console.log("Scan succeeded.");
		        
		        //orders redis에 저장 
		        var q=d3.queue();
		        var id;
		        
		        for(var i=0; i<data.Items.length; i++){
		        	id = data.Items[i].user_id;
		        	redisLib.setRedisAll(today+"_"+id,data.Items[i],function(err,result){
		        		if(err){
		        			console.log(err);
		        		}
		        	});
		        	router.getPushId(id,function(err,pushid){ //pushid redis에 저장 
		        		if(err){
		        			console.log(err);
		        			throw err;
		        		}else{
		        			console.log("set pushid");
		        			redisLib.setRedisOne(today+"_"+id,"pushid",pushid,function(err,result){
		        				if(err){
		        					console.log(err);
		        				}else{
		        					console.log("sucess pushid set!!!!");
		        				}
		        			});
		        		}
		        	});
		        }
		        
		        if(typeof data.LastEvaluatedKey !== "undefined"){
		        	console.log("Scanning for more..."); // 남은 주문정보 다시 스캔 
		            router.setRedisOrders(takitId,option,num,data.LastEvaluatedKey,today,function(err,orders){
		            			 if(err){
		            				 console.log(err);
		            				 throw err;
		            			 }else{
		            				 console.log(orders);
		            			 }
		            		  });
		        }else{
		        	console.log("scanning end");
		        	next(null,data);
		        }
		        
		    }
		});	
		
		var command="SELECT *FROM orders WHERE takitId=? AND orderedTime > ?";
		var values = [takitId,startTime,num];
		c.query(command, values, function(err,result) {
			  if (err){
				  console.error("setRedisOrders func Unable to query. Error:", JSON.stringify(err, null, 2));
				  next(err);
			  }else{
				  console.dir("[setRedisOrders func Get MenuInfo]:"+result.info.numRows);
				  if(result.info.numRows==0){
					  next(null,result.info.numRows);
				  }else{
					  console.log("setRedisOrders func Query succeeded. "+JSON.stringify(result[0]));
					  
					  var q=d3.queue();
				        var id;
				        
				        for(var i=0; i<data.Items.length; i++){
				        	id = result[i].userId;
				        	redisLib.setRedisAll(today+"_"+id,result[i],function(err,result){
				        		if(err){
				        			console.log(err);
				        		}
				        	});
				        	router.getPushid(id,function(err,pushid){ //pushid redis에 저장 
				        		if(err){
				        			console.log(err);
				        			throw err;
				        		}else{
				        			console.log("set pushid");
				        			redisLib.setRedisOne(today+"_"+id,"pushid",pushid,function(err,result){
				        				if(err){
				        					console.log(err);
				        				}else{
				        					console.log("sucess pushid set!!!!");
				        				}
				        			});
				        		}
				        	});
				        }
					  next(null,result[0]);
				  }
			  }
		});
	}
	
	
	
//	var cafe_params = {
//		    TableName : "cafeInfo",
//		    
//		    KeyConditionExpression: "#takitId = :takitId",
//		    ExpressionAttributeNames:{
//		        "#takitId": "takitId"
//		    },
//		    ExpressionAttributeValues: {
//		        ":takitId": takitId
//		    }
//	};
//	
//	docClient.query(cafe_params, function(err, data) {
//	    if (err) {
//	        console.error("setRedisOrders query Unable to query. Error:", JSON.stringify(err, null, 2));
//	        next(err);
//	    } else {
//	        console.log("setRedisOrders Query succeeded."+JSON.stringify(data));
//	        console.log("timezone:"+data.Items[0].timezone);
//	        var timezone = data.Items[0].timezone;
//	        var queryStartTime;
//        	var offset=(new timezoneJS.Date(new Date(), timezone)).getTimezoneOffset(); // offset in minutes
//    		var currlocal=new Date((new Date).getTime() - (offset *60*1000));
//    		console.log("currlocal:"+currlocal.toISOString()); // save it in DB
//    		console.log("local date:"+currlocal.toISOString().substring(0,10));
//
//    		var startTime=currlocal.toISOString().substring(0,11)+"00:00:00.000Z";
//    		var localStartTime=new Date(Date.parse(startTime));
//
//	        if(option==="today"){
//	    		var todayStartTime=new Date(localStartTime.getTime()+(offset *60*1000));
//	    		console.log("todayStartTime in gmt:"+todayStartTime.toISOString());
//	    		queryStartTime=todayStartTime.toISOString();
//	        }else if(option==="week"){
//	        	var weekStartTime=new Date(localStartTime.getTime()-24*60*60*6*1000+(offset *60*1000));
//	        	console.log("weekStartTime in gmt:"+weekStartTime.toISOString());
//	    		queryStartTime=weekStartTime.toISOString();	
//	        }else if(option==="month"){
//	        	var tomorrow= new Date(localStartTime.getTime()+(offset *60*1000));	        		
//	        	var monthAgo=moment(tomorrow).subtract(1,'M').toDate();
//	        	queryStartTime=monthAgo.toISOString();
//	        }else{
//	        	return;
//	        }
//	        console.log("queryStartTime:"+queryStartTime);
//	        queryOrders(queryStartTime);
//	    }
//	});
	
	var command="SELECT *FROM cafeInfo WHERE takitId=?";
	var values = [takitId];
	c.query(command, values, function(err,result) {
		  if (err){
			  console.error("getOrders func Unable to query. Error:", JSON.stringify(err, null, 2));
			  next(err);
		  }else{
			  console.dir("[getOrders func Get MenuInfo]:"+result.info.numRows);
			  if(result.info.numRows==0){
				  next(null,result.info.numRows);
			  }else{
				console.log("getOrders func Query succeeded. "+JSON.stringify(result[0]));
				console.log("timezone:"+result[0].timezone);
				var timezone = result[0].timezone;
				var queryStartTime;
				var offset=(new timezoneJS.Date(new Date(), timezone)).getTimezoneOffset(); // offset in minutes
				var currlocal=new Date((new Date).getTime() - (offset *60*1000));
				console.log("currlocal:"+currlocal.toISOString()); // save it in DB
				console.log("local date:"+currlocal.toISOString().substring(0,10));
				
				var startTime=currlocal.toISOString().substring(0,11)+"00:00:00.000Z";
				var localStartTime=new Date(Date.parse(startTime));
				
				if(option==="Today"){
					var todayStartTime=new Date(localStartTime.getTime()+(offset *60*1000));
					console.log("todayStartTime in gmt:"+todayStartTime.toISOString());
					queryStartTime=todayStartTime.toISOString();
				}else if(option==="Week"){
					var weekStartTime=new Date(localStartTime.getTime()-24*60*60*6*1000+(offset *60*1000));
					console.log("weekStartTime in gmt:"+weekStartTime.toISOString());
					queryStartTime=weekStartTime.toISOString();	
				}else if(option==="Month"){
					var tomorrow= new Date(localStartTime.getTime()+(offset *60*1000));	        		
					var monthAgo=moment(tomorrow).subtract(1,'M').toDate();
					queryStartTime=monthAgo.toISOString();
				}else{
					return;
				}
				console.log("queryStartTime:"+queryStartTime);
				queryOrders(queryStartTime);
				  
				next(null,result[0]);
			  }
		  }
	});
};

router.setRedisPeriodOrders=function(takitId,num,startDate,endDate,next){
	console.log("takitId:"+takitId+" startDate:"+startDate+" endDate:"+endDate);	
//		var params = {
//			    TableName: "orders",
//			    IndexName: "takitId-orderedTime-index",
//			    Limit: num,
//			    KeyConditionExpression: "#takitId=:takitId AND orderedTime BETWEEN :startDate AND :endDate",
//			    ExpressionAttributeNames: {
//			        "#takitId": "takitId",
//			    },
//			    ExpressionAttributeValues: {
//			    	":takitId": takitId,
//			        ":startDate": startDate,
//			        ":endDate": endDate
//			    },
//			    ScanIndexForward:false
//		};
//		
//		if(ExclusiveStartKey!=0)
//			params.ExclusiveStartKey=JSON.parse(ExclusiveStartKey);
//		
//		docClient.query(params, function(err, data) {
//			if (err) {
//		        console.error("Unable to scan the table. Error JSON:", JSON.stringify(err, null, 2));
//		        next(err);
//		    } else {
//		    	
//		    	var q=d3.queue();
//		        var id;
//		        
//		        for(var i=0; i<data.Items.length; i++){
//		        	id = data.Items[i].user_id;
//		        	redisLib.setRedisAll(today+"_"+id,data.Items[i],function(err,result){
//		        		if(err){
//		        			console.log(err);
//		        		}
//		        	});
//		        	router.getPushid(id,function(err,pushid){ //pushid redis에 저장 
//		        		if(err){
//		        			console.log(err);
//		        			throw err;
//		        		}else{
//		        			console.log("set pushid");
//		        			redisLib.setRedisOne(today+"_"+id,"pushid",pushid,function(err,result){
//		        				if(err){
//		        					console.log(err);
//		        				}else{
//		        					console.log("success pushid set!!!!");
//		        				}
//		        			});
//		        		}
//		        	});
//		        }
//		    	
//		        // print all the movies
//		        if (typeof data.LastEvaluatedKey !== "undefined") {
//		            console.log("Querying for more...");
//		            //params.ExclusiveStartKey = data.LastEvaluatedKey;
//		            //docClient.scan(params, onScan);
//		            router.setRedisPeriodOrders(takitId,num,startDate,endDate,data.LastEvaluateKey,function(err,orders){
//		            	if(err){
//		            		console.log(err);
//		            		throw err;
//		            	}else{
//		            		console.log(orders);
//		            	}
//		            });
//		        }
//		        else{
//		        	console.log("scanning end");
//		        	next(null,data);
//		        }
//		    }
//		});	
		
		
		var command="SELECT *FROM orders WHERE takitId=? AND orderedTime BETWEEN ? AND ?";
		var values = [takitId,startDate,endDate];
		c.query(command, values, function(err,result) {
			  if (err){
				  console.error("getPeriodOrders func Unable to query. Error:", JSON.stringify(err, null, 2));
				  next(err);
			  }else{
				  console.dir("[getPeriodOrders func Get MenuInfo]:"+result.info.numRows);
				  if(result.info.numRows==0){
					  next(null,result.info.numRows);
				  }else{
					  console.log("getPeriodOrders func Query succeeded. "+JSON.stringify(result[0]));
					  
					  
					  //after set redis 부분 
					 
					  var q=d3.queue();
				      var id;
				        
				        for(var i=0; i<data.Items.length; i++){
				        	id = data.Items[i].user_id;
				        	redisLib.setRedisAll(today+"_"+id,data.Items[i],function(err,result){
				        		if(err){
				        			console.log(err);
				        		}
				        	});
				        	router.getPushid(id,function(err,pushid){ //pushid redis에 저장 
				        		if(err){
				        			console.log(err);
				        			throw err;
				        		}else{
				        			console.log("set pushid");
				        			redisLib.setRedisOne(today+"_"+id,"pushid",pushid,function(err,result){
				        				if(err){
				        					console.log(err);
				        				}else{
				        					console.log("success pushid set!!!!");
				        					next(null,result[0]);
				        					
				        					//after next의 위치 ? 
				        				}
				        			});
				        		}
				        	});
				        }
					  
					  
				  }
			  }
		});
};


router.updateOrderStatus=function(orderId,oldStatus, nextStatus,timeName,timeValue,cancelReason,next){
	console.log("oldStatus:"+oldStatus+" nextStatus:"+nextStatus);
                //현재 db에 저장된 주문상태,   새로 update할 주문상태
				//timeName is checkedTime, completeTime, canceledTime ...

	var command="SELECT orderStatus FROM orders WHERE orderId=?";  //orderStatus와 oldStatus 같은지 비교하기 위해 조회함. 
	var values = [orderId];

	performQueryWithParam(command, values, function(err,result) {
		if (err){
			console.error("updateOrderStatus func  Unable to query. Error:", JSON.stringify(err, null, 2));
			ext(err);
		}else{
			console.dir("[updateOrderStatus func]:"+result.info.numRows);
			if(result.info.numRows==0){
				next("not exist order");
			}else{
				console.log("updateOrderStatus func Query succeeded. "+JSON.stringify(result));
				
				values={};
				  
				//orderStatus === oldStatus 이면 update 실행. 다르면 실행x
				if(result[0].orderStatus === oldStatus){
					command = "UPDATE orders SET orderStatus=:nextStatus,"+timeName+"=:timeValue, cancelReason=:cancelReason WHERE orderId=:orderId";
					values.nextStatus=nextStatus,
					values.timeValue=timeValue,
					values.orderId=orderId,
					values.cancelReason=null;
					
					//cancelled 상태면 이유 넣음. 아니면 그대로 null
					if(nextStatus==='cancelled' && cancelReason !== undefined && cancelReason !== null){

                    	values.cancelReason=cancelReason;
                	}
				}else{
					if(oldStatus === '' || oldStatus ===null){
                	    command = "UPDATE orders SET orderStatus=:nextStatus,"+timeName+"=:timeValue, cancelReason=:cancelReason WHERE orderId=:orderId";
                    	values.nextStatus=nextStatus,
                    	values.timeValue=timeValue,
                    	values.orderId=orderId,
                    	values.cancelReason=cancelReason;
					}
				}
				
						
				performQueryWithParam(command, values, function(err,result) {
					if (err){
						console.error("updateOrderStatus func Unable to query. Error:", JSON.stringify(err, null, 2));
						next(err);
					}else{
						console.dir("[updateOrderStatus func Get MenuInfo]:"+result.info.affectedRows);
						if(result.info.affectedRows==0){
							next("can't update orders");
						}else{
							console.log("updateOrderStatus func Query succeeded. "+JSON.stringify(result[0]));
							next(null,"success");
						}
					}
				});
			}

		}	

	});			

};





module.exports = router;

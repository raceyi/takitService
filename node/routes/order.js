let express = require('express');
let router = express.Router();
let request = require('request');
let mariaDB = require('./mariaDB');
let noti = require('./notification');
let gcm = require('node-gcm');
let timezoneJS = require('timezone-js');
let config = require('../config');
let async = require('async');
let Scheduler = require('redis-scheduler');
let scheduler = new Scheduler();
let	redis = require('redis');
let redisCli = redis.createClient(); 

function sendOrderMSG(API_KEY,order,phone,pushId,platform,userId,next){
	console.log("[[response order]]:"+JSON.stringify(order));
	delete order.userId;
	delete order.userName;

	let title;

	switch (order.orderStatus){
      case 'paid' :
         title='주문 '+order.orderName; break;
      case 'checked' :
         title='주문접수 '+order.orderName; break;
      case 'completed' :
         title='주문준비완료 '+order.orderName; break;
      case 'cancelled' :
         title='주문취소 '+order.orderName; break;
      default :
         title = 'Takit';
   }


	let content="주문번호"+order.orderNO+" 주문내역:"+order.orderName ;

	if(order.hasOwnProperty('cancelReason') && order.cancelReason!==null && order.cancelReason !== ""){
		content += '취소사유:'+JSON.stringify(order.cancelReason);
	}

	let GCMType = "order";

	redisCli.incr("gcm_order",function(err,result){
	
		console.log("gcm message NO : " +result);
		let messageId = result;
		scheduler.schedule({ key: userId+"_gcm_"+messageId, expire: 60000, handler: function(){
         	console.log("start SMS event"+content);
				console.log("phone : "+phone); 
         	noti.sendSMS(title+" "+content,[phone]);
         }}, function(err){
            if (err){
               console.error(err);
					next(err);
            }else{
					console.log('scheduled successfully!');
					noti.sendGCM(API_KEY,title, content, JSON.stringify(order), GCMType, messageId, pushId, platform, function(err,result){
         			if(err){
            			console.log(err);
            			next(err);
         			}else{
							console.log("gcm successfully!!!!!");
                  	const response={}
                  	response.order = order;
                  	response.messageId = messageId;
                  	next(null,response);
						}
      			});
            }
      });

	});
}

router.successGCM=function(req,res){
	console.log("messageId : "+req.body.messageId);
	redisCli.del(req.session.uid+"_gcm_"+req.body.messageId,function(err,result){
		if(err){
			res.send(JSON.stringify({"result":"failure"}));
		}else{
			console.log("!!!!!!!!!!!success gcm 성공!!!!!!" +result);
			res.send(JSON.stringify({"result":"success"}));
		}
	})
}

router.sleepMode=function(req,res){
	console.log("sleepMode comes!!!!");
	redisCli.keys(req.session.uid+"_gcm_*",function(err,result){
		if(err){
			console.log(err);
			res.send(JSON.stringify({"result":"failure"}));
		}else{
			console.log(result);
			for(let i=0; i<result.length; i++){
	         console.log(result[i]);
	         redisCli.del(result[i],function(err,reply){
					if(err){
						console.log(err);
						res.send(JSON.stringify({"result":"failure"}));
					}else{
						console.log(reply);
					}
				});

				if(i === result.length-1){
					res.send(JSON.stringify({"result":"success"}));
				}
	      }

			if(result[0] === null || result[0] === undefined){
				res.send(JSON.stringify({"result":"success"}));
			}
		}
	});
}



function getTimezoneLocalTime(timezone,timeInMilliSec,next){ // return current local time in timezone area
	var offset=(new timezoneJS.Date(Date(), timezone)).getTimezoneOffset(); // offset in minutes
	var currlocal=new Date(timeInMilliSec - (offset*60*1000));
	
	var localOrderedTime = {};
	localOrderedTime.time = currlocal.toISOString();
	localOrderedTime.day = currlocal.getUTCDay();
	localOrderedTime.hour= currlocal.getUTCHours();	

	next(null,localOrderedTime);
}

//주문정보 저장
router.saveOrder=function(req, res){
	let order=req.body;
	console.log("req.body:"+JSON.stringify(req.body));
	console.log("userId:"+req.session.uid);
	order.userId=req.session.uid;
	order.orderStatus="paid";
	order.orderedTime = new Date().toISOString();

	let cafeInfo;

	async.waterfall([function(callback){
		mariaDB.getCafeInfo(req.body.takitId,callback);
	},function(result,callback){
		cafeInfo = result;
		console.log("cafeInfo:"+JSON.stringify(cafeInfo));
		let orderedTime=order.orderedTime;
		console.log("timezone:"+cafeInfo.timezone);
		console.log("orderTime:"+orderedTime);

		let UTCOrderTime=new Date(orderedTime);
    ////////////////////////////////////////
    let currTime=new Date();
    console.log("getTime:"+currTime.getTime()+" inputTime:"+UTCOrderTime.getTime());
    console.log("UTCOrderTime in ISO:"+ UTCOrderTime.toISOString());
    /////////////////////////////////////
    getTimezoneLocalTime(cafeInfo.timezone,UTCOrderTime.getTime(),callback);
	}],function(err,localOrderedTime){
		if(err){
			console.log(err);
		}else{
			order.localOrderedTime=localOrderedTime.time;
			order.localOrderedHour=localOrderedTime.hour;
			order.localOrderedDay = localOrderedTime.day;
			order.localOrderedDate=localOrderedTime.time.substring(0,10);
			
			async.waterfall([function(callback){
      	mariaDB.getOrderNumber(req.body.takitId,callback);
   		},function(orderNO,callback){
      		order.orderNO=orderNO;
      		console.log("orderNO:"+orderNO);
      		mariaDB.saveOrder(order,cafeInfo,callback);
   		},function(orderId,callback){

      		console.log(orderId);
      		async.parallel([function(callback){
         		mariaDB.getOrder(orderId,callback);
      		},function(callback){
         		mariaDB.getShopPushId(req.body.takitId,callback);
      		}],callback);

   		},function(result,callback){
      		console.log("getShopPushId result:"+JSON.stringify(result));
            console.log(result[0]);
				console.log(result[1]);
				console.log(result[1].shopPushId);
				console.log(result[1].platform);
				console.log(result[1].userId);
				console.log("managerPhone number :"+result[0].managerPhone);
				sendOrderMSG(config.SHOP_SERVER_API_KEY,result[0],result[0].managerPhone,[result[1].shopPushId],result[1].platform,result[1].userId,callback); //result[0]:order, result[1] shopPushId's result
   		}],function(err,response){
      		if(err){
         		res.end(JSON.stringify({"result":"failure"}));
      		}else{
         		console.log("save order result:"+JSON.stringify(response));
         		response.result="success";
         		res.end(JSON.stringify(response));
     			 }
   		});
		}
	});
};

router.getOrdersUser=function(req,res){
	//1. period설정인지 아닌지 확인
	//2. userId에 해당하는 order검색
	
	mariaDB.getOrdersUser(req.session.uid,req.body.takitId,req.body.lastOrderId,req.body.limit,function(err,orders){
		
		if(err){
			res.end(JSON.stringify({"result" : "failure"}));
		}else{

			var body={};
			body.result="success";
			body.orders=orders;
			res.end(JSON.stringify(body));
		}
		    
	});

}

router.getOrdersShop=function(req,res){
	console.log("getOrders:"+JSON.stringify(req.body));
	
	if(req.body.option === "period"){
		mariaDB.getPeriodOrdersShop(req.body.takitId,req.body.startTime,req.body.endTime,req.body.lastOrderId,req.body.limit,function(err,orders){
			if(err){
				console.log(err);
				res.end(JSON.stringify({"result":"failure"}));
			}else{
				var body={};
            	body.result="success";
            	body.orders=orders;
            	res.end(JSON.stringify(body));
			}
		});
	}else{			
		mariaDB.getOrdersShop(req.body.takitId,req.body.option,req.body.lastOrderId,req.body.limit,function(err,orders){
			if(err){
				console.log(err);
				res.end(JSON.stringify({"result":"failure"}));
			}else{
				var body={};
            	body.result="success";
            	body.orders=orders;
            	res.end(JSON.stringify(body));
			}	
		});
		
	}
};

router.checkOrder=function(req,res){ // previous status must be "paid".
	//1. order정보 가져옴
	//2. shopUser인지 확인
	//3. orderStatus update
	//4. send a massege	

	//check shop member
	console.log("req.body.orderId:"+JSON.stringify(req.body.orderId));
	
	/*
	function sendShopUser(order,next){
        mariaDB.getShopPushId(order.takitId,"all",function(err,shopPushId){
            console.log("pushId:"+shopPushId);
            sendOrderMSG(config.SHOP_SERVER_API_KEY,order,shopPushId,function(err,result){
                next(null,"success");
            });
        });

    };
	*/

	function sendUser(order,next){
		mariaDB.getPushId(order.userId,function(err,result){
			console.log("pushId:"+result.pushId);
			console.log("result:"+result.platform);
			console.log("phone number:"+order.userPhone);
			sendOrderMSG(config.SERVER_API_KEY,order,order.userPhone,[result.pushId],result.platform,order.userId,function(err,result){	
				next(null,"success");
			});
		});
		
	};

	
    // Please check if req.session.uid is a member or manager of shop
	mariaDB.getShopUserInfo(req.session.uid,function(err,shopUserInfo){
		if(err){ 
			res.end(JSON.stringify({"result":"failure", "err":err}));
		}else{
			//주문상태 update
			mariaDB.updateOrderStatus(req.body.orderId,'paid','checked','checkedTime',new Date().toISOString(),JSON.stringify(req.body.cancelReason),function(err,result){
				if(err){
					res.end(JSON.stringify({"result":"failure", "err":err}));
				}else{
							//update된 상태user, shopUser에게  msg보내줌
						mariaDB.getOrder(req.body.orderId,function(err,order){
							sendUser(order,function(err,result){
								if(!err){
									//sendShopUser(order,function(err,result){ //shopUser가 여러명일 경우에 보내질 수 있도록
                             //           if(!err){
                                            res.end(JSON.stringify({"result":"success"}));
                               //         }
                                 //   });
								}
							});
						})
				}
			});		
		}
	});
};

router.completeOrder=function(req,res){//previous status must be "checked".
    //1. order정보 가져옴
    //2. shopUser인지 확인
    //3. orderStatus update
    //4. send a massege 

    //check shop member
    console.log("req.body.orderId:"+JSON.stringify(req.body.orderId));
	
	/*
	function sendShopUser(order,next){
        mariaDB.getShopPushId(order.takitId,"all",function(err,shopPushId){
            console.log("pushId:"+shopPushId);
            sendOrderMSG(config.SHOP_SERVER_API_KEY,order,shopPushId,function(err,result){
                next(null,"success");
            });
        });

    };
	*/

    function sendUser(order,next){
        mariaDB.getPushId(order.userId,function(err,result){
            console.log("pushId:"+result.pushId);
            sendOrderMSG(config.SERVER_API_KEY,order,order.userPhone,[result.pushId],result.platform,order.userId,function(err,result){
                next(null,"success");
            });
        });

    };


    // Please check if req.session.uid is a member or manager of shop
    mariaDB.getShopUserInfo(req.session.uid,function(err,shopUserInfo){
        if(err){
            res.end(JSON.stringify({"result":"failure", "err":err}));
        }else{
            //주문상태 update
            mariaDB.updateOrderStatus(req.body.orderId,'checked','completed','completedTime',new Date().toISOString(),req.body.cancelReason,function(err,result){
                if(err){
                    res.end(JSON.stringify({"result":"failure", "err":err}));
                }else{
                            //update된 상태user, shopUser에게  msg보내줌
                        mariaDB.getOrder(req.body.orderId,function(err,order){
                            sendUser(order,function(err,result){
                                if(!err){
												//sendShopUser(order,function(err,result){
                                       // if(!err){
                                            res.end(JSON.stringify({"result":"success"}));
                                       // }
                                    //});
                                }
                            });
                        })
                }
            });


        }
    });



};


//user가 취소할때
router.cancelOrderUser=function(req,res){

    //1. shopUser인지 확인
	//2. order정보 가져와서 'paid' 상태에서만 취소가능
    //3. orderStatus update
    //4. send a massege 

    //check shop member
    console.log("req.body.orderId:"+JSON.stringify(req.body.orderId));

	/*if("manager"){
	
		}else if("all"){
		
		}  manager만 보낼 수 있게..  all은 모든 멤버들이 다 받을 수 있게*/


    function sendShopUser(order,next){
        mariaDB.getShopPushId(order.takitId,function(err,shopUserInfo){
            console.log("get shop pushId result:"+shopUserInfo);
            sendOrderMSG(config.SHOP_SERVER_API_KEY,order,order.managerPhone,[shopUserInfo.shopPushId],shopUserInfo.platform,shopUserInfo.userId,function(err,result){
               next(null,"success");
            });
				
        });

    };
	
    	// Please check if req.session.uid is a member or manager of shop
	mariaDB.getOrder(req.body.orderId,function(err,order){
        if(err){
			res.end(JSON.stringify({"result":"failure", "err":err}));
		}else{
			console.log("success getOrder");
			if(order.orderStatus === 'paid'){
				//주문상태 update
            	mariaDB.updateOrderStatus(req.body.orderId,'paid','cancelled','cancelledTime',new Date().toISOString(),req.body.cancelReason,function(err,result){
                	if(err){
                    	res.end(JSON.stringify({"result":"failure", "err":err}));
                		}else{
                            //update된 상태user, shopUser에게  msg보내줌
                        	mariaDB.getOrder(req.body.orderId,function(err,order){
                                sendShopUser(order,function(err,result){
									if(!err){
                                    	res.end(JSON.stringify({"result":"success"}));
                                    }
                                });	
							});
                		}
            		});
			}else{
				res.end(JSON.stringify({"result":"failure"}))
			}
		}
	});
	
	
	///cancel 후 환불

	
};

//shop에서 취소할때,
router.shopCancelOrder=function(req,res){
	    //1. order정보 가져옴
    //2. shopUser인지 확인
    //3. orderStatus update
    //4. send a massege 

    //check shop member
    console.log("req.body.orderId:"+JSON.stringify(req.body.orderId));
	
	/*
	function sendShopUser(order,next){
        mariaDB.getShopPushId(order.takitId,"all",function(err,shopPushId){
            console.log("pushId:"+shopPushId);
            sendOrderMSG(config.SHOP_SERVER_API_KEY,order,shopPushId,function(err,result){
                next(null,"success");
            });
        });

    };*/

    function sendUser(order,next){
        mariaDB.getPushId(order.userId,function(err,result){
            console.log("pushId:"+result.pushId);
				console.log("platform:"+result.platform);
            sendOrderMSG(config.SERVER_API_KEY,order,order.userPhone,[result.pushId],result.platform,order.userId,function(err,result){
                next(null,"success");
            });
        });

    };


    // Please check if req.session.uid is a member or manager of shop
    mariaDB.getShopUserInfo(req.session.uid,function(err,shopUserInfo){
        if(err){
            res.end(JSON.stringify({"result":"failure", "err":err}));
        }else{
            //주문상태 update
            mariaDB.updateOrderStatus(req.body.orderId,'','cancelled','cancelledTime',new Date().toISOString(),req.body.cancelReason,function(err,result){
                if(err){
                    res.end(JSON.stringify({"result":"failure", "err":err}));
                }else{
                            //update된 상태user, shopUser에게  msg보내줌
                        mariaDB.getOrder(req.body.orderId,function(err,order){
                            sendUser(order,function(err,result){
                                if(!err){
											//sendShopUser(order,function(err,result){
                                	//	if(!err){
											res.end(JSON.stringify({"result":"success"}));
                                	//	}
									//});
								}
                            });
                        })
                }
            });
        }
    });	
};

	
module.exports = router;


var express = require('express');


//HTTPS-begin
var forceSSL = require('express-force-ssl');
var fs = require('fs');
var debug = require('debug')('https')
  , http = require('http')
  , https = require('https')
  , name = 'My App';
//HTTPS-end
var request = require('request');
var multer = require('multer');
var gcm = require('node-gcm');

///////////////////////////////////
// for commercial, please use below ssl_options
var ssl_options = {
		ca: fs.readFileSync('cert/RootChain/chain-bundle.pem'),
		key: fs.readFileSync('cert/takit.biz_20161019FF28.key.pem'),
		cert: fs.readFileSync('cert/takit.biz_20161019FF28.crt.pem')
};
////////////////////////////////////
var path = require('path');
var favicon = require('serve-favicon');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
let index = require('./routes/index');
let users = require('./routes/users');
let mariaDB=require('./routes/mariaDB');
let s3= require('./routes/s3');

let order=require('./routes/order');
let shopUsers= require('./routes/shopUsers');
let cash = require('./routes/cash');
let config=require('./config');
let tomcatServer=require("./routes/tomcatServer");
let op = require('./routes/op')

var app = express();

var morgan = require('morgan');
var session = require('express-session');
var redis = require('redis');
var redisStore = require('connect-redis')(session);
var client = redis.createClient();

//view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

debug('booting %s', name);
//debug(req.method + ' ' + req.url);

//HTTPS-begin
var server = http.createServer(app);
var secureServer = https.createServer(ssl_options, app);
app.use(forceSSL); //-> please uncomment this code for https
//HTTPS-end

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));




app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')))


//session-begin
//session store - redis

app.use(session({
	  name: 'server-session-store',
	  secret: 'takitSecret2',
	  saveUninitialized: false, //proxy server 사용하려면 false
	  resave: false,  //proxy server 사용하려면 false 
	  cookie:{
	    maxAge: 24*60*60*1000,
	  },
	  store: new redisStore({ host: '127.0.0.1', port: 6379, client: client, logErrors : true})
	}));

app.use(function (req, res, next) {
  if (!req.session) {
    return next(new Error('oh no')) // handle error
  }
  next() // otherwise continue
})

//session-end


//logger(morgan) begin
/*
morgan.token('id', function getId(req){
    if(req.hasOwnProperty("session") && req.session.hasOwnProperty("uid")){
            return req.session.uid; 
    }else{
            return null;
    }
});

morgan.token('params', function getParams(req){
     
     if(req.hasOwnProperty("body")){
    	 if(req.body.hasOwnProperty("password")){
    		 req.body.password="*****";
    	 }
    	 return JSON.stringify(req.body);
     }else{
           return null;
     }
});


app.use(morgan('[:date[clf]] :id :params :remote-addr :remote-user \":method :url HTTP/:http-version\" :status :res[content-length] \":referrer\" \":user-agent\"'));
//logger end.

*/

//express gracefully exit
var createGracefulShutdownMiddleware = require('express-graceful-shutdown');

app.use(createGracefulShutdownMiddleware(secureServer, {forceTimeout:30000}));



app.all('*',function(req,res,next){
	console.log(req.cookies)
	console.log("req.url:"+req.url);
	var url=req.url.toString();
	/*if(req.body.version===config.OLD_VERSION || (url.startsWith("/cafe/shopHome") && req.method==="GET") ){
		const baseUrl = 'http://127.0.0.1:3000';
    	console.log("req.method:"+req.method);
    	console.log("req.headers:"+JSON.stringify(req.headers));
    	if(req.method=="GET"){
        	request({url: baseUrl+req.url,headers: req.headers,method:req.method}).pipe(res);
    	}else if(req.method=="POST" ){
        	request({url: baseUrl+req.url,headers: req.headers,body: JSON.stringify(req.body),method:req.method}).pipe(res);
    	}
	}else{
	*/
	if(req.hasOwnProperty('session')){
   	console.log("valid session");
      console.log("req.session:"+JSON.stringify(req.session));
		if(req.session.hasOwnProperty("uid")){
      	console.log("req.session.uid:"+req.session.uid);
			if(req.session.uid === config.tourModeId){
				console.log("tourMode Id");
				if(req.url !== "/saveOrder" && req.url !== "/shopEnter"){
					next();
				}else{
					res.statusCode=401;
            	res.end(JSON.stringify({"result":"failure"}));
				}
			}else{
            	next();
			}
      }else{
		console.log("invalid req.session.uid");
         var url=req.url.toString();
		 if((req.url==="/signup" || req.url==="/kakaoLogin" || req.url==="/emailLogin" || req.url === "/facebooklogin" ||
            req.url==="/shop/kakaoLogin" || req.url==="/shop/facebooklogin" || req.url==="/shop/secretLogin" || req.url==="/shop/emailLogin" || 
				req.url ==="/SMSCertification" || req.url === "/checkSMSCode" || req.url === "/passwordReset" || req.url==="/getUserInfo" ||
			 	req.url ==="/shop/insertTakitId" || req.url ==="/shop/insertCategory" || req.url ==="/shop/insertMenu" ||
				req.url ==="/shop/insertShopInfo" || req.url ==="/shop/updateCategory" || req.url ==="/shop/updateMenu") 
				&& req.method === "POST"){
            next();
         }else if(url.startsWith("/oauth") && req.method==="GET"){ // just for kakaotalk login
			console.log("GET comes");
            next();
         }else{
            res.statusCode=401;
            res.end(JSON.stringify({"result":"failure"}));
         }
	   }
   }else{
	   console.log("invalid session");
      var url=req.url.toString();
      if((req.url==="/signup" || req.url==="/kakaoLogin" || req.url==="/emailLogin" || req.url === "/facebooklogin" ||
			req.url==="/shop/kakaoLogin" || req.url==="/shop/facebooklogin" || req.url==="/shop/secretLogin" || req.url==="/shop/emailLogin" ||
			req.url==="/SMSCertification" || req.url === "/checkSMSCode" || req.url === "/passwordReset" || req.url==="/getUserInfo" ||
			req.url ==="/shop/insertTakitId" || req.url ==="/shop/insertCategory" || req.url ==="/shop/insertMenu" ||
                req.url ==="/shop/insertShopInfo" || req.url ==="/shop/updateCategory" || req.url ==="/shop/updateMenu") 
			&& req.method === "POST"){
         next();  
      }else if(url.startsWith("/oauth") && req.method==="GET"){ // just for kakaotalk login
         next(); 
      }else{
         res.statusCode=401;
         res.end(JSON.stringify({"result":"failure"}));
   	}
   //}
}
});

app.use('/', index);
app.post('/shopEnter',users.shopEnter);
//app.use('/users', users);
app.post('/getMenu',users.getMenu);

app.get('/oauthSuccess',tomcatServer.oauthSuccess);
app.get('/oauthFailure',tomcatServer.oauthFailure);

app.post('/facebooklogin',users.facebookLogin);
app.post('/kakaoLogin',users.kakaoLogin);
app.post('/emailLogin', users.emailLogin);
app.post('/preventMultiLogin',users.preventMultiLogin);
app.post('/signup',users.signup);
app.post('/logout', users.logout)
//app.post('/userPaymentInfo',users.getUserPaymentInfo);
app.post('/unregister',users.unregister);
app.post('/sleepMode', users.sleepMode);
app.post('/wakeMode',users.wakeMode);
app.post('/orderNotiMode',users.orderNotiMode);
app.post('/validUserInfo',tomcatServer.validUserInfo);
app.post('/getUserInfo',tomcatServer.getUserInfo);
app.post('/validCashId',cash.validCashId);

app.post('/getDiscountRate',users.getDiscountRate);
app.post('/SMSCertification',users.SMSCertification);
app.post('/checkSMSCode',users.checkSMSCode);
app.post('/passwordReset',users.passwordReset);
app.post('/successGCM',users.successGCM);
app.post('/modifyUserInfo',users.modifyUserInfo);
app.post('/getKeywordShops',users.getKeywordShops);
app.post('/getKeywordShopInfos',users.getKeywordShopInfos);
app.post('/getFavoriteShops',users.getFavoriteShops);
app.post('/getEvents',users.getEvents);

app.post('/getOrders',order.getOrdersUser);
app.post('/saveOrder',order.saveOrder);
app.post('/cancelOrder',order.cancelOrderUser);
app.post('/getOldOrders',order.getOldOrders);

app.post('/getCoupons',users.getCoupons);
app.post('/downloadCoupon',users.downloadCoupon);

app.post('/shop/getOrders',order.getOrdersShop);
app.post('/shop/checkOrder',order.checkOrder);
app.post('/shop/completeOrder',order.completeOrder);
app.post('/shop/cancelOrder',order.shopCancelOrder);

app.post('/shop/secretLogin', shopUsers.secretLogin);
app.post('/shop/facebooklogin', shopUsers.facebookLogin);
app.post('/shop/emailLogin', shopUsers.emailLogin);
app.post('/shop/kakaoLogin',shopUsers.kakaoLogin);
app.post('/shop/getShopInfo',shopUsers.getShopInfo);
app.post('/shop/openShop',shopUsers.openShop);
app.post('/shop/closeShop',shopUsers.closeShop);
app.post('/shop/changeNotiMember',shopUsers.changeNotiMember);
app.post('/shop/successGCM',shopUsers.successGCM);
app.post('/shop/sleepMode',shopUsers.sleepMode);
app.post('/shop/refreshInfo',shopUsers.refreshInfo);
app.post('/shop/getSalesAndSatas',shopUsers.getSalesAndSatas);
//app.post('/shop/couponSend', shopUsers.couponSend);
//app.post('/shop/customerSearch', shopUsers.customerSearch);

app.post('/createCashId',cash.createCashId);
app.post('/modifyCashPwd',cash.modifyCashPwd);
app.post('/checkCashInfo',cash.checkCashInfo);
app.post('/registRefundAccount',cash.registRefundAccount);
app.post('/branchNameAutoComplete', cash.branchNameAutoComplete);
app.post('/checkRefundCount', cash.checkRefundCount);
app.post('/refundCash',cash.refundCash);
app.post('/checkCashInstantly',cash.checkCashInstantly); //입금바로 확인
app.post('/checkCashUserself',cash.checkCashUserself); //입금 수동 확인
app.post('/addCash',cash.addCash);  //입금한 cash 전환
app.post('/payCash',cash.payCash); //지불
app.post('/getBalanceCash',cash.getBalanceCash); 
app.post('/getCashList',cash.getCashList);
app.post('/removeWrongCashList',cash.removeWrongCashList);
app.post('/shop/checkWithdrawalCount',cash.checkWithdrawalCountShop);
app.post('/shop/withdrawCash',cash.withdrawCashShop);
app.post('/shop/getBalance',cash.getBalnaceShop);
app.post('/shop/getWithdrawalList',cash.getWithdrawalListShop);
app.post('/shop/getAccount',shopUsers.getAccount);
app.post('/cafe/shopHome',mariaDB.queryCafeHomePost);

app.post('/shop/addTakitId', shopUsers.addTakitId);
app.post('/shop/addShopInfo',shopUsers.addShopInfo);
app.post('/shop/addCategory',shopUsers.addCategory);
app.post('/shop/modifyCategory',shopUsers.modifyCategory);
app.post('/shop/removeCategory',shopUsers.removeCategory);
app.post('/shop/addMenu', shopUsers.addMenu);
app.post('/shop/modifyMenu', shopUsers.modifyMenu);
app.post('/shop/removeMenu',shopUsers.removeMenu);
app.post('/shop/uploadMenuImage', shopUsers.uploadMenuImage);

app.post('/enterMenuDetail',users.enterMenuDetail);
app.get('/cafe/shopHome',mariaDB.queryCafeHome);

app.post('/searchTakitId',users.searchTakitId);

// catch 404 and forward to error handler
app.post('/takitIdAutocomplete',function(req,res,next){
	console.log("takitIdAutocomplete comes(req:"+JSON.stringify(req.body)+")");
	mariaDB.findTakitId(req,function(shoplist){
		let response = new index.Response();
		response.setVersion(config.MIGRATION,req.version); 
		response.shoplist = shoplist;
	
		console.log(JSON.stringify(response));	
		res.end(JSON.stringify(response)); //hum... Why shoplist doesn't work? 
	});
});

app.get('/oauth',function(req,res,next){ // kakaotalk oauth 
     console.log("/oauth comes req.url:"+req.url);
    var body=new index.SuccResponse();
    var url=String(req.url);
    console.log("url:"+url);
    if(url.indexOf("code=")>0){
        var authorize_code=req.url.substr(req.url.indexOf("code=")+5);
        console.log("authorize_code:"+authorize_code);
    }
    res.end(JSON.stringify(body));
});

var storage =   multer.diskStorage({
	  destination: function (req, file, callback) {
	    callback(null, './uploads');
	  },
	  filename: function (req, file, callback) {
	    callback(null, file.fieldname + '-' + Date.now());
	  }
});

var upload = multer({
	  dest: __dirname + '/uploads',
	  limits: {fileSize: 10000000, files:1},
	}).single('file');


app.post('/ocrFileSubmit',function(req,res){
    upload(req,res,function(err) {
        console.log(req.file);
        if(err) {
        	console.log("Error uploading file. "+ JSON.stringify(err));
            return res.end("Error uploading file.");
        }
        index.ocr_submit(req,res); //OCR enabled
       /* 
        var body={};
        body.result="takitIdFound";
        body.takitId="ORDER@GAROSU";	
        res.end(JSON.stringify(body));
        */
    });
});

/*
app.post('/saveCafeInfoWithFile',function(req,res){
	upload(req,res,function(err) {
        console.log(req.file);
        if(err) {
        	console.log("Error uploading file. "+ JSON.stringify(err));
            return res.end("Error uploading file.");
        }
        shopUsers.saveCafeInfoWithFile(req,res); 
	});
});*/

//app.post('/saveCafeInfo',shopUsers.saveCafeInfo);

//app.post('/addCategory',shopUsers.addCategory);
//app.post('/deleteCategory',shopUsers.removeCategory);
//app.post('/modifyCategory',shopUsers.modifyCategory);

//app.post('/removeMenu',shopUsers.removeMenu);
//app.post('/modifyMenu',shopUsers.modifyMenu);
app.post('/modifyMenuWithFile',function(req,res){
	upload(req,res,function(err) {
	    console.log(req.file);
	    if(err) {
	    	console.log("Error uploading file. "+ JSON.stringify(err));
	        return res.end("Error uploading file.");
	    }
		shopUsers.modifyMenuWithFile(req,res);
	});
});

app.post('/registerMenuWithFile',function(req,res){
	upload(req,res,function(err) {
	    console.log(req.file);
	    if(err) {
	    	console.log("Error uploading file. "+ JSON.stringify(err));
	        return res.end("Error uploading file.");
	    }
		shopUsers.registerMenuWithFile(req,res);
	});
});

app.post('/registrationId',function(req,res){
	console.log("req:"+JSON.stringify(req.body));
	console.log("registrationId:"+req.body.registrationId);
	console.log("session.id:"+req.session.uid);
	
	mariaDB.updatePushId(req.session.uid,req.body.registrationId,req.body.platform,function(err,result){
		if(err){
			let response = new index.FailResponse(err);
			response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
		}else{
			console.log("registraionId added into DB successfully.Do I need this procedure every login process?");
         console.log("Just do it when app is installed in new device.!!! Please check it!!!");
			let response = new index.SuccResponse();
			response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
		}
	});
});
				

			

app.post('/shop/registrationId',function(req,res){
		console.log("req:"+JSON.stringify(req.body));
		console.log("registrationId:"+req.body.registrationId);
		console.log("session.id:"+req.session.uid);
		console.log("session.takitId"+req.session.takitId);
		mariaDB.updateShopPushId(req.session.uid,req.body.takitId,req.body.registrationId,req.body.platform,function(err,result){
			if(err){
				let response = new index.FailResponse(err);
				response.setVersion(config.MIGRATION,req.version);
         	res.send(JSON.stringify(response));
			}else{
				console.log("registraionId added into DB successfully.Do I need this procedure every login process?");
            console.log("Just do it when app is installed in new device.!!! Please check it!!!");
				let response = new index.SuccResponse();
				response.setVersion(config.MIGRATION,req.version);
         	res.send(JSON.stringify(response));
			}
		});	
});

app.use(function(req, res, next) {
	  var err = new Error('Not Found');
	  err.status = 404;
	  next(err);
});

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

app.configure=function(){
	console.log("[DATE:"+new Date()+"]"+"__dirname"+__dirname);
	//user facebook app info
	users.setAppId(config.FACEBOOK_APP_ID); //facebook app Id
	users.setAppSecret(config.FACEBOOK_APP_SECRET); //facebook app secret
	users.getAppToken();
	// shop facebook app info
	shopUsers.setAppIdShop(config.FACEBOOK_SHOP_APP_ID); //facebook app Id
	shopUsers.setAppSecretShop(config.FACEBOOK_SHOP_APP_SECRET); //facebook app secret
	shopUsers.getShopAppToken();
	
	// [HAVE-TO]Put aws config files in a directory other than this project.
	s3.setConfigFile('./s3.config.json');	
	
	//console.log("__dirname:"+__dirname);
	op.setDir(__dirname+"/routes");
};

app.configure();

//HTTPS-begin
secureServer.listen(443);
//server.listen(80);
//HTTPS-end

let t = new Date();
let d = new Date('2017-04-02 02:55:33'); //2017-04-03T18:34:19.580Z 
console.log(d);
console.log(t.toISOString());
console.log(op.getTimezoneLocalTime('Asia/Seoul',t).toISOString());
console.log(op.getTimezoneLocalTime('Asia/Seoul',d).toISOString());

module.exports = app;

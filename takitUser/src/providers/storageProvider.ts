import {Injectable,EventEmitter} from '@angular/core';
import {Platform,Tabs,NavController} from 'ionic-angular';
import {SQLite} from 'ionic-native';
import {ConfigProvider} from './ConfigProvider';
import {Http,Headers} from '@angular/http';

import 'rxjs/add/operator/map';
import 'rxjs/add/operator/timeout';

declare var CryptoJS:any;

@Injectable()
export class StorageProvider{
    public db;
    public shoplist=[];
    public takitId:string; //current selected takitId;
    public shopInfo:any;   // current shopInfo. shopname:shopInfo.shopName
    public shoplistCandidate=[];
    public errorReason:string;
    public cart:any;
    public id:string;
    public messageEmitter= new EventEmitter();
    public tabMessageEmitter = new EventEmitter();
    public shopTabRef:Tabs;
    public login:boolean=false;
    public navController:NavController;
    public email:string="";
    public name:string="";
    public phone:string="";
    public shopResponse:any;
    public run_in_background=false;
    public order_in_progress_24hours=false;
    public tourMode=false;
    public isAndroid;
    public cashId;

    public refundBank:string="";
    public refundAccount:string="";

    /* 농협 계좌 이체가능 은행 */
    banklist=[  {name:"국민",value:"004"},
                {name:"기업",value:"003"},
                {name:"농협",value:"010"},
                {name:"신한(조흥)",value:"088"},
                {name:"우리",value:"020"},
                {name:"KEB하나",value:"081"},
                {name:"SC(제일)",value:"023"},
                {name:"경남",value:"039"},
                {name:"광주",value:"034"},
                {name:"대구",value:"031"},
                {name:"부산",value:"032"},
                {name:"산업",value:"002"},
                {name:"상호저축",value:"050"},
                {name:"새마을금고",value:"045"},
                {name:"수협",value:"007"},
                {name:"신협",value:"048"},
                {name:"우체국",value:"071"},
                {name:"전북",value:"037"},
                {name:"제주",value:"035"},
                {name:"한국씨티(한미)",value:"027"},
                {name:"산림조합",value:"064"},
                {name:"BOA",value:"060"},
                {name:"도이치",value:"055"},
                {name:"HSBC",value:"054"},
                {name:"제이피모간체이스",value:"057"},
                {name:"중국공상",value:"062"},
                {name:"비엔피파리바",value:"061"}];

//"이외 금융기관 => 직접 입력(숫자)"  
//"지점 코드=>직접 입력(숫자)" http://www.kftc.or.kr/kftc/data/EgovBankList.do 금융회사명으로 조회하기 

    constructor(private platform:Platform,private http:Http){
        console.log("StorageProvider constructor"); 
        this.isAndroid = this.platform.is('android'); 
    }

    open(){
        return new Promise((resolve,reject)=>{
            var options={
                    name: "takit.db",
                    location:'default'
            };
            this.db=new SQLite();
            this.db.openDatabase(options).then(()=>{
                this.db.executeSql("create table if not exists carts(takitId VARCHAR(100) primary key, cart VARCHAR(1024))").then(
                (error)=>{
                    console.log("fail to create cart table "+JSON.stringify(error));
                    reject();
                },()=>{
                    console.log("success to create cart table");
                    resolve();
                },);
            },(error)=>{
                console.log("fail to open database");
                reject();
            });
        });
    }

    //delete an existing db and then open new one. Please check if it works or not. Hum.. it doesn't work 
    reopen(){
        return new Promise((resolve,reject)=>{
             console.log("reopen()");
             this.db.deleteDatabase({name: 'takit.db', location: 'default'}).then(()=>{
                 console.log("deleteDatabase successfully");
                 this.open().then(()=>{
                     console.log("db open successfully");
                     resolve();
                 },()=>{
                     console.log("db open failure");
                     reject();
                 });
             },(err)=>{
                 console.log("deleteDatabase failure");
                 reject();
             });
        });
    }

    getCartInfo(takitId){
        console.log("getCartInfo-enter");
        return new Promise((resolve,reject)=>{
                var queryString='SELECT * FROM carts where takitId=?';
                console.log("call queryString:"+queryString);
                this.db.executeSql(queryString,[takitId]).then((resp)=>{ // What is the type of resp? 
                    console.log("query result:"+JSON.stringify(resp));
                    var output=[];
                    if(resp.rows.length==1){
                        console.log("item(0)"+JSON.stringify(resp.rows.item(0)));
                        output.push(resp.rows.item(0)); 
                    }else if(resp.rows.length==0){
                        console.log(takitId+": no cart info");
                    }else{
                        console.log("DB error happens");
                        reject("invalid DB status");
                    }
                    resolve(output);
                },(error)=>{
                     reject("DB error");
                });
         });
    }

    saveCartInfo(takitId,cart){ // insert and update
      return new Promise((resolve,reject)=>{  
          console.log("saveCartInfo");
         this.getCartInfo(takitId).then((resp:any)=>{
             var queryString:string;
             if(resp.length==0){ // insert
                 queryString="INSERT INTO carts (cart,takitId) VALUES (?,?)";
             }else{ // update
                 queryString="UPDATE carts SET cart=? WHERE takitId=?";;
             }
             console.log("query:"+queryString);
            this.db.executeSql(queryString,[cart,takitId]).then((resp)=>{
                console.log("[saveCartInfo]resp:"+JSON.stringify(resp));
                this.cart=JSON.parse(cart);
                console.log("[saveCartInfo]cart:"+JSON.stringify(this.cart));
                console.log("[saveCartInfo]cart.menus:"+JSON.stringify(this.cart.menus));
                resolve();
            },(error)=>{
                console.log("saveCartInfo insert error:"+JSON.stringify(error));
                reject("DB error");
            },);
         },()=>{

         });
      });
    }

   dropCartInfo(){
       return new Promise((resolve,reject)=>{
           this.db.executeSql("drop table if exists carts").timeout(1000/* 1 second */).then(
                (error)=>{
                    console.log("fail to drop cart table "+JSON.stringify(error));
                    reject();
                },()=>{
                    console.log("success to drop cart table");
                    resolve();
           });
       });
   }

    loadCart(takitId){
        this.getCartInfo(takitId).then((result:any)=>{
          if(result.length==1){
              console.log("existing cart:"+JSON.stringify(result[0]));
              var cartStr=result[0].cart;
              this.cart=JSON.parse(cartStr);
              console.log("cart:"+JSON.stringify(this.cart));
              console.log("cart.menus:"+JSON.stringify(this.cart.menus));

          }else{
              console.log(" getCartInfo:none");
              // 장바구니가 비었습니다. 
              this.cart={menus:[],total:0};
          }
        },(err)=>{
            console.log("loadCart error");
        });
    }

    decryptValue(identifier,value){
        var key=value.substring(0, 16);
        var encrypt=value.substring(16, value.length);
        console.log("value:"+value+" key:"+key+" encrypt:"+encrypt);
        var decrypted=CryptoJS.AES.decrypt(encrypt,key);
        if(identifier=="id"){ // not good idea to save id here. Please make a function like getId
            this.id=decrypted.toString(CryptoJS.enc.Utf8);
        }
        return decrypted.toString(CryptoJS.enc.Utf8);
    }

    encryptValue(identifier,value){
        var buffer="";
        for (var i = 0; i < 16; i++) {
            buffer+= Math.floor((Math.random() * 10));
        }
        console.log("buffer"+buffer);
        var encrypted = CryptoJS.AES.encrypt(value, buffer);
        console.log("value:"+buffer+encrypted);
        
        if(identifier=="id") // not good idea to save id here. Please make a function like saveId
            this.id=value;
        return (buffer+encrypted);    
    }

    shoplistSet(shoplistValue){
        if(shoplistValue==null)
            this.shoplist=[];
        else
            this.shoplist=shoplistValue;
    }

    shoplistUpdate(shop){
        var update=[];
        for(var i=0;i<this.shoplist.length;i++){
            if(this.shoplist[i].takitId!=shop.takitId){
                update.push(this.shoplist[i]);
            }
        }
        console.log("shoplist:"+JSON.stringify(update));
        update.unshift(shop);
        this.shoplist=update;
        console.log("after shoplist update:"+JSON.stringify(this.shoplist));        
    }

    shoplistCandidateUpdate(shop){
        var update=[];
        if(this.shoplistCandidate)
        for(var i=0;i<this.shoplistCandidate.length;i++){
            if(this.shoplistCandidate[i].takitId!=shop.takitId){
                update.push(this.shoplistCandidate[i]);
            }
        }
        console.log("shoplistCandidate:"+JSON.stringify(update));
        update.unshift(shop);
        this.shoplistCandidate=update;
        console.log("after shoplist update:"+JSON.stringify(this.shoplistCandidate));        
    }

    errorReasonSet(reason:string){
        this.errorReason=reason;
    }

    shopInfoSet(shopInfo:any){
        console.log("shopInfoSet:"+JSON.stringify(shopInfo));
        this.shopInfo=shopInfo;
        this.shopInfo.discountRate=parseFloat(shopInfo.discountRate) / 100.0;
        console.log("discountRate:"+this.shopInfo.discountRate);
    } 

    currentShopname(){
        return this.shopInfo.shopName;
    }

    userInfoSet(email,name,phone){
        this.email=email;
        this.name=name;
        this.phone=phone;
        this.tourMode=false;
    }

    userInfoSetFromServer(userInfo:any){
        this.email=userInfo.email;
        this.name=userInfo.name;
        this.phone=userInfo.phone;
        if(!userInfo.hasOwnProperty("cashId") || userInfo.cashId==null || userInfo.cashId==undefined){
            this.cashId="";
        }else{
            this.cashId=userInfo.cashId;
        }
        console.log("[userInfoSetFromServer]cashId:"+this.cashId);
        this.tourMode=false;
    }
}



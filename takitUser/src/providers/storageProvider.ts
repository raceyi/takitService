import {Injectable,EventEmitter} from '@angular/core';
import {Platform,Tabs,NavController} from 'ionic-angular';
import {SQLite} from 'ionic-native';
import {ConfigProvider} from './ConfigProvider';
import {Http,Headers} from '@angular/http';
import 'rxjs/add/operator/map';

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

    constructor(private platform:Platform,private http:Http){
        console.log("StorageProvider constructor"); 
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
           this.db.executeSql("drop table if exists carts").then(
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
    } 

    currentShopname(){
        return this.shopInfo.shopName;
    }

    userInfoSet(email,name,phone){
        this.email=email;
        this.name=name;
        this.phone=phone;
    }

    getShopInfo(takitId){
        return new Promise((resolve,reject)=>{
            let headers = new Headers();
            headers.append('Content-Type', 'application/json');
            console.log("takitId:"+takitId);
            console.log("!!!server:"+ ConfigProvider.serverAddress+"/cafe/shopHome?takitId="+takitId);
             this.http.get(encodeURI(ConfigProvider.serverAddress+"/cafe/shopHome?takitId="+takitId),{headers: headers}).subscribe((res)=>{
                  console.log("res:"+JSON.stringify(res));
                  this.shopResponse=res.json();
                  resolve();
             },(err)=>{
                reject("http error");  
             });
        });   
    }
}



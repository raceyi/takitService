import {Injectable} from '@angular/core';
import {Platform} from 'ionic-angular';
import {Http,Headers} from '@angular/http';
import {Storage} from '@ionic/storage';

import {FbProvider} from './LoginProvider/fb-provider';
import {KakaoProvider} from './LoginProvider/kakao-provider';
import {EmailProvider} from './LoginProvider/email-provider';

import {StorageProvider} from './storageProvider';

import 'rxjs/add/operator/map';

@Injectable()
export class ServerProvider{
  constructor(private platform:Platform,private http:Http
            ,private storage:Storage
            ,private fbProvider:FbProvider,private kakaoProvider:KakaoProvider
            ,private emailProvider:EmailProvider
            ,private storageProvider:StorageProvider) {
      console.log("ServerProvider constructor");
  }

  post(request,body){
       return new Promise((resolve,reject)=>{
            let headers = new Headers();
            headers.append('Content-Type', 'application/json');

            this.http.post(request,body,{headers: headers}).timeout(this.storageProvider.timeout).map(res=>res.json()).subscribe((res)=>{
                resolve(res);                    
            },(err)=>{
                if(err.hasOwnProperty("status") && err.status==401){
                    //login again with id
                    this.loginAgain().then(()=>{
                        //call http post again
                         this.http.post(request,body,{headers: headers}).timeout(this.storageProvider.timeout).map(res=>res.json()).subscribe((res)=>{
                            resolve(res);  
                         },(err)=>{
                             reject("NetworkFailure");
                         });
                    },(err)=>{
                        reject(err);
                    });
                }else{
                    reject("NetworkFailure");
                }
            });
       });
  }
  
  loginAgain(){
      return new Promise((resolve,reject)=>{
        console.log("[loginAgain] id:"+this.storageProvider.id);
                if(this.storageProvider.id=="facebook"){
                    this.fbProvider.login().then((res:any)=>{
                                if(res.result=="success"){
                                    resolve();
                                }else
                                    reject("HttpFailure");
                            },login_err =>{
                                reject("NetworkFailure");
                    });
                }else if(this.storageProvider.id=="kakao"){ //kakao login
                        console.log("kakao login is not implemented yet");
                        this.kakaoProvider.login().then((res:any)=>{
                                console.log("MyApp:"+JSON.stringify(res));
                                if(res.result=="success"){
                                    //save shoplist
                                    resolve();
                                }else
                                    reject("HttpFailure");
                            },login_err =>{
                                    reject("NetworkFailure");
                    });
                }else{ // email login 
                    this.storage.get("password").then((value:string)=>{
                        var password=this.storageProvider.decryptValue("password",decodeURI(value));
                        this.emailProvider.EmailServerLogin(this.storageProvider.id,password).then((res:any)=>{
                                console.log("MyApp:"+JSON.stringify(res));
                                if(res.result=="success"){
                                    resolve();
                                }else
                                    reject("HttpFailure");
                            },login_err =>{
                                    reject("NetworkFailure");
                        });
                    });
                }
        });
  }

  orderNoti(){
      return new Promise((resolve,reject)=>{
            let headers = new Headers();
            headers.append('Content-Type', 'application/json');
            let body = JSON.stringify({});
            this.post(encodeURI(this.storageProvider.serverAddress+"/orderNotiMode"),body).then((res:any)=>{
                  console.log("res:"+JSON.stringify(res));
                  console.log("orderNotiMode-res.result:"+res.result);
                  if(res.result=="success"){
                    resolve(res.orders);
                  }else{
                    reject("HttpFailure");
                  }
            },(err)=>{
                reject(err);  
            });
      });
  }

  saveOrder(body){
      return new Promise((resolve,reject)=>{
            let headers = new Headers();
            headers.append('Content-Type', 'application/json');
            console.log("saveOrder:"+body);
            this.post(encodeURI(this.storageProvider.serverAddress+"/saveOrder"),body).then((res:any)=>{
                  console.log("res:"+JSON.stringify(res));
                  console.log("saveOrder-res.result:"+res.result);
                  if(res.result=="success"){
                    //resolve(res.orders);
                    resolve(res);
                  }else{
                    reject(res.error);
                  }
            },(err)=>{
                reject(err);  
            });
      });
  }

  get(request){
       return new Promise((resolve,reject)=>{
        let headers = new Headers();
        headers.append('Content-Type', 'application/json');
        this.http.get(request,{headers: headers}).timeout(this.storageProvider.timeout).subscribe((res)=>{
            resolve(res.json());
        },(err)=>{
                if(err.hasOwnProperty("status") && err.status==401){
                    //login again with id
                    this.loginAgain().then(()=>{
                        //call http post again
                         this.http.get(request,{headers: headers}).timeout(this.storageProvider.timeout).subscribe((res)=>{
                            resolve(res.json());  
                         },(err)=>{
                             reject("NetworkFailure");
                         });
                    },(err)=>{
                        reject(err);
                    });
                }else{
                    reject("NetworkFailure");
                }
        });
       });
  }

    getShopInfo(takitId){
        return new Promise((resolve,reject)=>{
            let headers = new Headers();
            headers.append('Content-Type', 'application/json');
            console.log("takitId:"+takitId);
            console.log("!!!server:"+ this.storageProvider.serverAddress+"/cafe/shopHome?takitId="+takitId);
            this.get(encodeURI(this.storageProvider.serverAddress+"/cafe/shopHome?takitId="+takitId)).then((res)=>{
                    console.log("res:"+JSON.stringify(res));
                    //this.shopResponse=res.json();
                    resolve(res);
                },(err)=>{
                reject("http error");  
                });
        });   
    }

    updateCashAvailable(){
        return new Promise((resolve,reject)=>{
                        let body = JSON.stringify({cashId:this.storageProvider.cashId});
                        console.log("getBalanceCash "+body);
                        this.post(this.storageProvider.serverAddress+"/getBalanceCash",body).then((res:any)=>{
                            console.log("getBalanceCash res:"+JSON.stringify(res));
                            if(res.result=="success"){
                                this.storageProvider.cashAmount=res.balance;
                                resolve();
                            }else{
                                reject(res.error);
                            }
                        },(err)=>{
                                 reject(err);                                  
                        });
        });
    }
}





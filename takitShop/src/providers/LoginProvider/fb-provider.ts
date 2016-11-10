import {Injectable} from '@angular/core';
import {Http,Headers} from '@angular/http';
import {Facebook} from 'ionic-native';
import {Platform} from 'ionic-angular';
import {ConfigProvider} from '../ConfigProvider';
import 'rxjs/add/operator/map';

@Injectable()
export class FbProvider {
  email:string;
  phone:string;
  country:string;
  name:string;

  constructor(private platform:Platform,private http:Http) {
      console.log("FbProvider");
  }

  login(){
      return new Promise((resolve,reject)=>{
          this.fblogin(this.facebookServerLogin,this).then((res:any)=>{
              resolve(res);
          }, (err)=>{
              reject(err);
          });
      });
  }

  fblogin(handler,fbProvider){    
      return new Promise((resolve,reject)=>{
               if(this.platform.is('cordova')) {
                    Facebook.getLoginStatus().then((status_response) => { 
                    console.log(JSON.stringify(status_response));
                    if(status_response.status=='connected'){
                       console.log("conneted status");
                       //console.log(status_response.userId); //please save facebook id 
                       Facebook.api("me/?fields=id,email,last_name,first_name", ["public_profile","email"]).then((api_response) =>{
                            console.log(JSON.stringify(api_response));
                            console.log("call server facebook login!!! referenceId:"+api_response.id);
                            handler(api_response.id,fbProvider,status_response.authResponse.accessToken)
                                  .then(
                                      (result:any)=>{
                                                   console.log("result comes:"+JSON.stringify(result)); 
                                                   var param=result;
                                                   param.id="facebook_"+api_response.id;
                                                   if(api_response.hasOwnProperty("email")){
                                                          param.email=api_response.email;
                                                   }
                                                   if(api_response.hasOwnProperty("last_name") &&
                                                          api_response.hasOwnProperty("first_name")){
                                                          param.name=api_response.last_name+api_response.first_name;   
                                                   }
                                                   resolve(param);
                                      },serverlogin_err=>{
                                                   console.log("error comes:"+serverlogin_err);
                                                   let reason={stage:"serverlogin_err",msg:serverlogin_err};
                                                   reject(reason);
                                      });
                        },(api_err)=>{
                            console.log("facebook.api error:"+JSON.stringify(api_err));
                            let reason={stage:"api_err",msg:api_err}; 
                            reject(reason);
                        }); 
                    }else{ // try login
                       console.log("Not connected status");
                       Facebook.login(["public_profile","email"]).then((login_response:any) => {
                            console.log(JSON.stringify(login_response));
                            //console.log(login_response.userId);
                            Facebook.api("me/?fields=id,email,last_name,first_name", ["public_profile","email"]).then((api_response) =>{
                                console.log(JSON.stringify(api_response));
                                Facebook.getAccessToken().then(accessToken=>{ 
                                       console.log("accessToken:"+accessToken);
                                       console.log("call server facebook login!!!");
                                       handler(api_response.id,fbProvider,accessToken)
                                       .then(
                                          (result:any)=>{
                                                      console.log("result comes:"+result); 
                                                      var param=result;
                                                      param.id="facebook_"+api_response.id;
                                                      if(api_response.hasOwnProperty("email")){
                                                          param.email=api_response.email;
                                                      }
                                                      if(api_response.hasOwnProperty("last_name") &&
                                                          api_response.hasOwnProperty("first_name")){
                                                          param.name=api_response.last_name+api_response.first_name;   
                                                      }
                                                      resolve(param);
                                          },serverlogin_err=>{ 
                                                      console.log(serverlogin_err);
                                                      let reason={stage:"serverlogin_err",msg:serverlogin_err};
                                                      reject(reason);
                                          });
                                  },token_err=>{
                                       console.log("access token error:"+JSON.stringify(token_err));
                                       let reason={stage:"token_err",msg:token_err};
                                       reject(reason);
                                  });
                              },(api_err)=>{
                                  console.log(JSON.stringify(api_err));
                                  let reason={stage:"api_err",msg:api_err};
                                  reject(reason);
                              }); 
                        },(login_err)=>{
                            console.log(JSON.stringify(login_err));
                            let reason={stage:"login_err",msg:login_err};
                            reject(reason);
                        }); 
                    }
                },(status_err) =>{
                    console.log(JSON.stringify(status_err)); 
                    let reason={stage:"status_err",msg:status_err};
                    reject(reason);
                });
        }else{
                console.log("Please run me on a device");
                let reason={stage:"cordova_err",msg:"run me on device"};
                reject(reason);
        }
     });
 }
 
  facebookServerLogin(facebookid,fbProvider:FbProvider,token){
      return new Promise((resolve, reject)=>{
              console.log("facebookServerLogin facebookid"+facebookid);

              let body = JSON.stringify({referenceId:"facebook_"+facebookid,token:token});

              let headers = new Headers();
              headers.append('Content-Type', 'application/json');
              console.log("server:"+ ConfigProvider.serverAddress);

             fbProvider.http.post(ConfigProvider.serverAddress+"/shop/facebooklogin",body,{headers: headers}).map(res=>res.json()).subscribe((res)=>{
                 console.log("facebook login res:"+JSON.stringify(res));
                 resolve(res); // 'success'(move into home page) or 'invalidId'(move into signup page)
             },(err)=>{
                 console.log("facebooklogin no response");
                 reject("facebooklogin no response");
             });
         });
  }

  logout(){
      return new Promise((resolve,reject)=>{
            Facebook.logout().then((result)=>{
                console.log("facebook logout success");
                    console.log("logout");
                    let headers = new Headers();
                    headers.append('Content-Type', 'application/json');
                    console.log("server: "+ ConfigProvider.serverAddress);

                    this.http.post(ConfigProvider.serverAddress+"/shop/logout",{headers: headers}).map(res=>res.json()).subscribe((res)=>{
                        resolve(res); // 'success'(move into home page) or 'invalidId'(move into signup page)
                    },(err)=>{
                        console.log("logout no response "+JSON.stringify(err));
                        reject("logout no response");
                    });
            },(err)=>{
                console.log("facebook logout failure");
                reject("facebook logout failure");
            });
      });
  }
}


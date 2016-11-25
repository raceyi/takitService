import {Injectable} from '@angular/core';
import {Http,Headers} from '@angular/http';
import {AppAvailability,InAppBrowserEvent,InAppBrowser} from 'ionic-native';
import {Platform} from 'ionic-angular';
import {ConfigProvider} from '../ConfigProvider';
import 'rxjs/add/operator/map';
declare var KakaoTalk:any;

@Injectable()
export class KakaoProvider {
  browserRef:InAppBrowser;
  email:string;
  phone:string;
  country:string;
  name:string;

  constructor(private platform:Platform,private http:Http) {
      console.log("KakaoProvider");
  }

  login(){
    return new Promise((resolve,reject)=>{
          this.kakaologin(this.kakaoServerLogin,this).then((res:any)=>{
              resolve(res);
          }, (err)=>{
              reject(err);
          });
      });
  }

  kakaologin(handler,kakaoProvider){
      return new Promise((resolve,reject)=>{

      var scheme;
      if(this.platform.is('android')){
          scheme='com.kakao.talk';         
      }else if(this.platform.is('ios')){
          scheme='kakaotalk://';
      }else{
          console.log("unknown platform");
      }
      
      AppAvailability.check(scheme).then(
          ()=> {  // Success callback
              console.log(scheme + ' is available. call KakaoTalk.login ');
              KakaoTalk.login(
                    (userProfile)=>{
                        console.log("userProfile:"+JSON.stringify(userProfile));
                        var id;
                        if(typeof userProfile === "string"){
                                id=userProfile;
                        }else{ // humm... userProfile data type changes. Why?
                                id=userProfile.id;
                        }
                        console.log('Successful kakaotalk login with'+id);
                        handler(id,kakaoProvider).then(
                        (result:any)=>{
                                    console.log("result comes:"+JSON.stringify(result)); 
                                    result.id="kakao_"+id;
                                    resolve(result);
                        },serverlogin_err=>{
                                    console.log("error comes:"+serverlogin_err);
                                    let reason={stage:"serverlogin_err",msg:serverlogin_err};
                                    reject(reason);
                        });
                    },
                    (err)=> {
                        console.log('Error logging in');
                        console.log(JSON.stringify(err));
                        let reason={stage:"login_err",msg:err}; 
                        reject(reason);
                    }
              ); 
          },
          ()=>{  // Error callback
              console.log(scheme + ' is not available');
              this.browserRef=new InAppBrowser("https://kauth.kakao.com/oauth/authorize?client_id="+ConfigProvider.kakaoTakitUser+"&redirect_uri="+ConfigProvider.kakaoOauthUrl+"&response_type=code","_blank");
              this.browserRef.on("exit").subscribe((event)=>{
                  console.log("InAppBrowserEvent(exit):"+JSON.stringify(event)); 
                  this.browserRef.close();
              });
              this.browserRef.on("loadstart").subscribe((event:InAppBrowserEvent)=>{
                  console.log("InAppBrowserEvent(loadstart):"+String(event.url)); 
                  var url=String(event.url);
                  if(url.startsWith(ConfigProvider.kakaoOauthUrl+"?code=")){
                      console.log("success to get code");
                      this.browserRef.close();
                      let authorize_code=event.url.substr(event.url.indexOf("code=")+5);
                      console.log("authorize_code:"+authorize_code);
                      // get token and then get user profile info
                      // request server login with authorize_code.                      
                      this.getKakaoToken( ConfigProvider.kakaoTakitUser,ConfigProvider.kakaoOauthUrl,authorize_code).then(
                          (token:any)=>{ 
                              console.log("access_token:"+token.access_token); 
                              this.getKakaoMe(token.access_token).then((profile:any)=>{
                                    console.log("getKakaoMe profile:"+JSON.stringify(profile)); 
                                    console.log('Successful kakaotalk login with'+profile.id);
                                    handler(profile.id,kakaoProvider).then(
                                        (result:any)=>{
                                                    console.log("result comes:"+result);
                                                    result.id="kakao_"+profile.id; 
                                                    resolve(result);
                                        },serverlogin_err=>{
                                                    console.log("error comes:"+serverlogin_err);
                                                    let reason={stage:"serverlogin_err",msg:serverlogin_err};
                                                    reject(reason);
                                        });
                              },(err)=>{
                                 console.log("getKakaoMe err"+JSON.stringify(err)); 
                                 let reason={stage:"getKakaoMe_err",msg:err}; 
                                 reject(reason);
                              });
                          },
                          (err)=>{
                              console.log("getKakaoToken err "+JSON.stringify(err));
                          });
                  }
                  // Please add code for login failure here!
              });    
          });     
      });
  }

  getKakaoMe(access_token){
      return new Promise((resolve, reject)=>{
              console.log("getKakaoMe token:"+access_token);
              let headers = new Headers();
              headers.append('Authorization', 'Bearer '+access_token);
              headers.append('Content-Type', 'application/x-www-form-urlencoded;charset=utf-8');
             this.http.get("https://kapi.kakao.com/v1/user/me",{headers: headers}).subscribe((res)=>{
                 var profile=res.json();
                 resolve(profile); 
             },(err)=>{
              console.log("err:"+JSON.stringify(err));
                 reject(err);
             });
         });
  }

  getKakaoToken(app_key,redirect_uri,authorize_code){
      return new Promise((resolve, reject)=>{
              console.log("getKakaoToken authorize_code:"+authorize_code);

              let body = 'grant_type=authorization_code'+
                         '&client_id='+app_key+
                         '&redirect_uri='+redirect_uri+
                         '&code='+authorize_code;
              let headers = new Headers();
              headers.append('Content-Type', 'application/x-www-form-urlencoded');
             console.log("body:"+body); 
             this.http.post("https://kauth.kakao.com/oauth/token",body,{headers: headers}).map(res=>res.json()).subscribe((res)=>{
                 console.log("getKakaoToken success:"+JSON.stringify(res));
                 resolve(res); 
             },(err)=>{
              console.log("err:"+JSON.stringify(err));
                 reject(err);
             });
         });
  }

  kakaoServerLogin(kakaoid,kakaoProvider:KakaoProvider){
      return new Promise((resolve, reject)=>{
              console.log("kakaoServerLogin");
              let body = JSON.stringify({referenceId:"kakao_"+kakaoid});
              let headers = new Headers();
              headers.append('Content-Type', 'application/json');
              console.log("server:"+ ConfigProvider.serverAddress);

             kakaoProvider.http.post(ConfigProvider.serverAddress+"/kakaoLogin",body,{headers: headers}).map(res=>res.json()).subscribe((res)=>{
                 resolve(res); // 'success'(move into home page) or 'invalidId'(move into signup page)
             },(err)=>{
                 console.log("kakaologin no response");
                 reject("kakaologin no response");
             });
         });
  }


  kakaoServerSignup(kakaoid:string,country:string,phone:string,email:string,name:string){
      return new Promise((resolve, reject)=>{
              console.log("kakaoServerSignup");
              let body = JSON.stringify({referenceId:kakaoid,name:name,email:email,country:country,phone:phone});
              let headers = new Headers();
              headers.append('Content-Type', 'application/json');
              console.log("server:"+ ConfigProvider.serverAddress);

             this.http.post(ConfigProvider.serverAddress+"/signup",body,{headers: headers}).map(res=>res.json()).subscribe((res)=>{
                 resolve(res); // 'success'(move into home page) or 'invalidId'(move into signup page)
             },(err)=>{
                 console.log("signup no response");
                 reject("signup no response");
             });
         });
  }
  
  logout(){
    return new Promise((resolve,reject)=>{ 
      console.log("kakao-provider.logout");    
       var scheme;
      if(this.platform.is('android')){
          scheme='com.kakao.talk';         
      }else if(this.platform.is('ios')){
          scheme='kakaotalk://';
      }else{
          console.log("unknown platform");
          reject("unknown platform");
          reject();
      }

       AppAvailability.check(scheme).then(
          ()=> {  // Success callback
              console.log("call KakaoTalk.logout");
              KakaoTalk.logout(()=>{
                    console.log("logout");
                    let headers = new Headers();
                    headers.append('Content-Type', 'application/json');
                    console.log("server: "+ ConfigProvider.serverAddress);

                    this.http.post(ConfigProvider.serverAddress+"/logout",{headers: headers}).map(res=>res.json()).subscribe((res)=>{
                        console.log("logout response"+JSON.stringify(res));
                        resolve(res);
                    },(err)=>{
                        //console.log("logout no response "+JSON.stringify(err));
                        reject("logout no response");
                    });
                },
                (err)=>{ // KakaoTalk.logout failure
                      reject("KakaoTalk.logout failure");
                });
          },(error)=>{  // Error callback
              console.log("KakaoTalk doesn't exist");
              reject("KakaoTalk doesn't exist");
          });
    });
  }

  unregister(){
       return new Promise((resolve,reject)=>{   
       var scheme;
      if(this.platform.is('android')){
          scheme='com.kakao.talk';         
      }else if(this.platform.is('ios')){
          scheme='kakaotalk://';
      }else{
          console.log("unknown platform");
          reject("unknown platform");
          return;
      }
        console.log("unregister");
        let headers = new Headers();
        headers.append('Content-Type', 'application/json');
        console.log("server: "+ ConfigProvider.serverAddress);

        this.http.post(ConfigProvider.serverAddress+"/unregister",{headers: headers}).map(res=>res.json()).subscribe((res)=>{
            AppAvailability.check(scheme).then(
                ()=> {  // Success callback
                    KakaoTalk.logout();
                });
            resolve(res); // 'success'(move into home page) or 'invalidId'(move into signup page)
        },(err)=>{
            console.log("unregister no response "+JSON.stringify(err));
            reject("unregister no response");
        });
  });
}

}



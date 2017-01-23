import {Injectable} from '@angular/core';

import {Http,Headers} from '@angular/http';
import {Platform} from 'ionic-angular';
import {StorageProvider} from '../storageProvider';

import 'rxjs/add/operator/map';

@Injectable()
export class EmailProvider{
    constructor(private platform:Platform,private http:Http,private storageProvider:StorageProvider){
        this.platform=platform; 
        this.http=http;
    }

  EmailServerLogin(email:string,password:string){
      console.log("email:"+email+"password:"+password);
      return new Promise((resolve, reject)=>{
              console.log("EmailServerLogin");
              let body = JSON.stringify({email:email,password:password});
              let headers = new Headers();
              headers.append('Content-Type', 'application/json');

            this.http.post(this.storageProvider.serverAddress+"/emailLogin",body,{headers: headers}).map(res=>res.json()).subscribe((res)=>{
                //console.log("res:"+JSON.stringify(res));
                //let result={result:res.result,userInfo:res.userInfo};
                console.log("result:"+JSON.stringify(res));
                resolve(res); // 'success'(move into home page) or 'invalidId'(move into signup page)
            },(err)=>{
                 console.log("emailLogin no response");
                 reject("emailLogin no response");
             });
         });
  }

  emailServerSignup(password,name,email,country,phone){
      return new Promise((resolve, reject)=>{
              console.log("emailServerSignup "+phone);
              let body = JSON.stringify({referenceId:"email_"+email,password:password,name:name,email:email,country:country,phone:phone});
              let headers = new Headers();
              headers.append('Content-Type', 'application/json');
              console.log("server:"+ this.storageProvider.serverAddress+" body:"+JSON.stringify(body));

             this.http.post(this.storageProvider.serverAddress+"/signup",body,{headers: headers}).map(res=>res.json()).subscribe((res)=>{
                 var result:string=res.result;
                    resolve(res); // 'success'(move into home page) or 'invalidId'(move into signup page)
             },(err)=>{
                 console.log("signup no response");
                 reject("signup no response");
             });
         });
  }

/*
  logout(){
          return new Promise((resolve, reject)=>{
              console.log("logout");
              let headers = new Headers();
              headers.append('Content-Type', 'application/json');
              console.log("server: "+ this.storageProvider.serverAddress);

             this.http.post(this.storageProvider.serverAddress+"/logout",{headers: headers}).map(res=>res.json()).subscribe((res)=>{
                 var result:string=res.result;
                 if(result==="success"){
                    resolve(res); // 'success'(move into home page) or 'invalidId'(move into signup page)
                 }else{
                     console.log("logout failure. Why?");
                 }
             },(err)=>{
                 //console.log("logout no response "+JSON.stringify(err));
                 reject("logout no response");
             });
         });
  }
  */

  logout(){
          return new Promise((resolve, reject)=>{
              console.log("logout");
              let headers = new Headers();
              headers.append('Content-Type', 'application/json');
              console.log("server: "+ this.storageProvider.serverAddress);

             this.http.post(this.storageProvider.serverAddress+"/logout",{headers: headers}).map(res=>res.json()).subscribe((res)=>{
                 var result:string=res.result;
                 if(result==="success"){
                    resolve(res); // 'success'(move into home page) or 'invalidId'(move into signup page)
                 }else{
                     reject(res.error);
                 }
             },(err)=>{
                 reject(err);
             });
         });
  }
  
  unregister(){
          return new Promise((resolve, reject)=>{
              console.log("unregister");
              let headers = new Headers();
              headers.append('Content-Type', 'application/json');
              console.log("server: "+ this.storageProvider.serverAddress);

             this.http.post(this.storageProvider.serverAddress+"/unregister",{headers: headers}).map(res=>res.json()).subscribe((res)=>{
                 console.log("res:"+JSON.stringify(res));
                 var result:string=res.result;
                 if(result==="success"){
                    resolve(res); // 'success'(move into home page) or 'invalidId'(move into signup page)
                 }else{
                     console.log("unregister failure. Why?");
                 }
             },(err)=>{
                 console.log("unregister no response "+JSON.stringify(err));
                 reject("unregister no response");
             });
         });
  }
}

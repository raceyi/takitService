import {Component,EventEmitter,ViewChild} from "@angular/core";
import {Platform,AlertController,NavController} from 'ionic-angular';
import {Http,Headers} from '@angular/http';
import {StorageProvider} from '../../providers/storageProvider';

import 'rxjs/add/operator/map';

@Component({
  selector:'page-password',
  templateUrl: 'password.html',
})

export class PasswordPage {
    email:string="";
    phone:string="";

    focusEmail = new EventEmitter();;
    focusPhone =new EventEmitter();

    constructor(private platform:Platform,private navController:NavController,
    private alertController:AlertController,private http:Http,
    private storageProvider:StorageProvider){
        console.log("PasswordPage construtor");
    }

    resetPassword(){        
      console.log("resetPassword");
      console.log('emailLogin comes email:'+this.email+" phone:"+this.phone);    
      //Please check the validity of email and phone.
      if(this.email.length==0){
          if(this.platform.is('android'))
            this.focusEmail.emit(true);
          else if(this.platform.is('ios')){ // show alert message
              let alert = this.alertController.create({
                        title: '이메일을 입력해주시기 바랍니다.',
                        buttons: ['OK']
                    });
                    alert.present();
          }
          return;
      }
      if(this.phone.length==0){
            if(this.platform.is('android'))
                this.focusPhone.emit(true);
            else if(this.platform.is('ios')){
                let alert = this.alertController.create({
                        title: '등록폰번호를 입력해주시기 바랍니다.',
                        buttons: ['OK']
                    });
                    alert.present();
            }
            return;
      }  
      this.callServerResetPassword(this.email,this.phone).then(()=>{
          // 'success'(move into login page)
           let alert = this.alertController.create({
                        title: '이메일로 새로운 비밀번호가 전달되었습니다.',
                        buttons: ['OK']
                    });
                    alert.present().then(()=>{
                         this.navController.pop();
                    });
      },(err)=>{
            let alert = this.alertController.create({
                        title: '일치하는 가입자 정보가 존재하지 않습니다.',
                        buttons: ['OK']
                    });
                    alert.present().then(()=>{

                    });
      });
    }

    callServerResetPassword(email,phone){
      return new Promise((resolve, reject)=>{
              console.log("callServerResetPassword");
              let body = JSON.stringify({email:email,phone:phone});
              let headers = new Headers();
              headers.append('Content-Type', 'application/json');
              console.log("server:"+ this.storageProvider.serverAddress);

             this.http.post(this.storageProvider.serverAddress+"/passwordReset",body,{headers: headers}).map(res=>res.json()).subscribe((res)=>{
                var result:string=res.result;
                console.log("res:"+JSON.stringify(res));
                if(result==="success")
                    resolve(res); 
                else{
                    reject("failure");
                }    
             },(err)=>{
                 console.log("signup no response");
                 reject("signup no response");
             });
         });
    }
}




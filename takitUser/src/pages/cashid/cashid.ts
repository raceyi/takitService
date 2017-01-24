import {Component,EventEmitter,ViewChild,NgZone} from "@angular/core";
import {Platform,AlertController,NavController,App} from 'ionic-angular';
import {StorageProvider} from '../../providers/storageProvider';
import {Http,Headers} from '@angular/http';
import 'rxjs/add/operator/map';
import {ServerProvider} from '../../providers/serverProvider';

declare var window:any;

@Component({
  selector:'page-cashid',
  templateUrl: 'cashid.html',
})

export class CashIdPage {

    cashId:string="";
    password:string="";
    passwordConfirm:string="";

    cashIdComment=true;
    passwordComment=true;
    passwordMismatch=true;

    constructor(private app:App,private platform:Platform,private navController:NavController,
        private alertController:AlertController,private serverProvider:ServerProvider
        ,public ngZone:NgZone, public storageProvider:StorageProvider){
        console.log("CashIdPage construtor");
        if(storageProvider.cashId.length>0){
            this.cashId=storageProvider.cashId;
        }
    }

    checkValidity(){
        this.cashIdComment=true;
        this.passwordComment=true;
        this.passwordMismatch=true;
        console.log("checkValidity");

        var valid=/[0-9a-zA-Z]{5,7}/.test(this.cashId.trim());

        if(this.cashId.trim().length<5 || this.cashId.trim().length>7 || valid==false){
            console.log("cashId is invalid");
            this.ngZone.run(()=>{
                this.cashIdComment=false;
            });
            return false;
        } 
        valid=/[0-9]{6}/.test(this.password);
        if(this.password.length!=6 || valid==false){
            this.ngZone.run(()=>{
                this.passwordComment=false;
            });
            return false;
        }
        if(this.password!=this.passwordConfirm){
            this.ngZone.run(()=>{
                this.passwordMismatch=false;
            });
            return false;
        }
        return true;
    }

    configureCashId(){
        if(this.storageProvider.cashId.length==0){ // create cashId
            if(this.checkValidity()){
             let body = JSON.stringify({cashId:this.cashId.trim().toUpperCase(),password:this.password});
                console.log("[configureCashId]body:"+body);
                this.serverProvider.post(this.storageProvider.serverAddress+"/createCashId",body).then((res:any)=>{
                    console.log("configureCashId:"+JSON.stringify(res));
                    if(res.result=="success"){
                        this.storageProvider.cashId=this.cashId.trim().toUpperCase();
                        this.app.getRootNav().pop();
                    }else{ 
                        if(res.hasOwnProperty("error") && res.error=="duplicationCashId"){
                            let alert = this.alertController.create({
                                title: this.cashId.trim().toUpperCase()+"(이)가 이미 존재합니다. 캐쉬아이디를 변경해주시기바랍니다.",
                                buttons: ['OK']
                            });
                            alert.present();
                        }else{
                            let alert = this.alertController.create({
                                title: "캐쉬아이디 설정에 실패했습니다. 잠시후 다시 시도해 주시기 바랍니다.",
                                buttons: ['OK']
                            });
                            alert.present();
                        }
                    }
                },(err)=>{
                    if(err=="NetworkFailure"){
                        let alert = this.alertController.create({
                            title: "서버와 통신에 문제가 있습니다.",
                            buttons: ['OK']
                        });
                        alert.present();
                    }else{
                            let alert = this.alertController.create({
                                title: "캐쉬아이디 설정에 실패했습니다. 잠시후 다시 시도해 주시기 바랍니다.",
                                buttons: ['OK']
                            });
                            alert.present();
                    }
                });
            }            
        }else{ // change password only... Please check if password changes or not by calling server call.
            this.checkExistingCashPassword().then((res)=>{
                // password is the same as previous one. Just skip it.
                console.log("password doesn't change");
                this.app.getRootNav().pop();
            },(err)=>{
                if(err=="passwordMismatch"){
                    if(this.checkValidity()){
                    let body = JSON.stringify({cashId:this.storageProvider.cashId,password:this.password});
                        console.log("modifyCashPwd");
                        this.serverProvider.post(this.storageProvider.serverAddress+"/modifyCashPwd",body).then((res:any)=>{
                            if(res.result=="success"){
                                //this.storage
                                this.app.getRootNav().pop();
                            }else{
                                let alert = this.alertController.create({
                                    title: "캐쉬 비밀번호 설정에 실패했습니다.",
                                    buttons: ['OK']
                                });
                                alert.present();
                            }
                        },(err)=>{
                            if(err=="NetworkFailure"){
                                let alert = this.alertController.create({
                                    title: "서버와 통신에 문제가 있습니다.",
                                    buttons: ['OK']
                                });
                                alert.present();
                            }else{
                                console.log("createCashId error "+err);
                                let alert = this.alertController.create({
                                    title: "캐쉬 비밀번호 설정에 실패했습니다.",
                                    buttons: ['OK']
                                });
                                alert.present();
                            }
                        });            
                    }
                }
            });
        }
    }

    checkExistingCashPassword(){
         return new Promise((resolve, reject) => {
                let body = JSON.stringify({cashId:this.storageProvider.cashId,password:this.password});
                this.serverProvider.post(this.storageProvider.serverAddress+"/checkCashInfo",body).then((res:any)=>{
                    if(res.result=="success"){
                        resolve(res);
                    }else{
                        reject("passwordMismatch");
                    }
                },(err)=>{
                    if(err=="NetworkFailure"){
                        let alert = this.alertController.create({
                            title: "서버와 통신에 문제가 있습니다.",
                            buttons: ['OK']
                        });
                        alert.present();
                    }else{
                        console.log("createCashId error "+err);
                    }
                    reject(err);
                });     
         });
    }
}







import {Component,EventEmitter,ViewChild,NgZone} from "@angular/core";
import {Platform,AlertController,NavController,App} from 'ionic-angular';
import {StorageProvider} from '../../providers/storageProvider';
import {Http,Headers} from '@angular/http';
import 'rxjs/add/operator/map';
import {ConfigProvider} from '../../providers/ConfigProvider';
import {ServerProvider} from '../../providers/serverProvider';

declare var window:any;

@Component({
  selector:'page-cashid',
  templateUrl: 'cashid.html',
})

export class CashIdPage {

    cashId:string;
    password:string;
    passwordConfirm:string;

    cashIdComment=true;
    passwordComment=true;
    passwordMismatch=true;

    constructor(private app:App,private platform:Platform,private navController:NavController,
        private alertController:AlertController,private serverProvider:ServerProvider
        ,public ngZone:NgZone, public storageProvider:StorageProvider){
        console.log("CashIdPage construtor");
    }

    checkValidity(){
        this.cashIdComment=true;
        this.passwordComment=true;
        this.passwordMismatch=true;
        console.log("checkValidity");

        var valid=/[0-9a-zA-Z]{5,7}/.test(this.cashId.trim());

        if(valid==false){
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
        if(this.checkValidity()){
             let body = JSON.stringify({cashId:this.cashId.trim(),password:this.password});
            this.serverProvider.post(ConfigProvider.serverAddress+"/createCashId",body).then((res:any)=>{
                if(res.result=="success"){
                    //this.storage

                     this.app.getRootNav().pop();
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
            });            
        }
    }
}







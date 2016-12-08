import {Component,EventEmitter,ViewChild} from "@angular/core";
import {Platform,AlertController,NavController} from 'ionic-angular';
import {Http,Headers} from '@angular/http';
import 'rxjs/add/operator/map';
import {ConfigProvider} from '../../providers/ConfigProvider';

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

    constructor(private platform:Platform,private navController:NavController,private alertController:AlertController,private http:Http){
        console.log("CashIdPage construtor");
    }

    checkValidity(){
        var valid=/[0-9a-zA-Z]{5,7}/.test(this.cashId.trim());
        if(this.cashId.trim().length!=7 || valid==false){
            console.log("cashId is invalid");
            return false;
        } 
        valid=/[0-9]{6}/.test(this.password);
        if(this.password.length!=6 || valid==false){
            return false;
        }
        if(this.password!=this.passwordConfirm){
            return false;
        }
        return true;
    }

    configureCashId(){

    }
}







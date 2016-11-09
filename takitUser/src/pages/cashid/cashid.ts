import {Component,EventEmitter,ViewChild} from "@angular/core";
import {Platform,AlertController,NavController} from 'ionic-angular';
import {Http,Headers} from '@angular/http';
import 'rxjs/add/operator/map';
import {ConfigProvider} from '../../providers/ConfigProvider';


@Component({
  selector:'page-cashid',
  templateUrl: 'cashid.html',
})

export class CashIdPage {


    constructor(private platform:Platform,private navController:NavController,private alertController:AlertController,private http:Http){
        console.log("PasswordPage construtor");
        //this.app.getRootNav().pop(); Please use pop method
    }

    configureCashId(){
        
    }
}







import {Component} from "@angular/core";
import {Platform} from 'ionic-angular';
import {NavController,NavParams} from 'ionic-angular';
import {StorageProvider} from '../../providers/storageProvider';

@Component({
  selector: 'page-error',
  templateUrl: 'error.html',
})

export class ErrorPage{
     public reason:string="";
     android_platform:boolean;

     constructor(private _navController: NavController, private _navParams: NavParams,private platform:Platform,private storageProvider:StorageProvider){
         console.log("ErrorPage constructor");
         this.android_platform=this.platform.is('android');
         this.reason=this.storageProvider.errorReason;
     }

    ionViewDidEnter(){

    }
     terminate(event){
        console.log("terminate");
        this.platform.exitApp();
     }
}

import {Component} from "@angular/core";
import {NavController,NavParams} from 'ionic-angular';
import {App} from 'ionic-angular';

@Component({
  templateUrl: 'shopexit.html',
})

export class ShopExitPage{

     constructor(private app: App,private navController: NavController, private navParams: NavParams){
	      console.log("ShopExitPage constructor");
     }

     ionViewWillUnload(){
       console.log("ionViewWillUnload-ShopExitPage");
     }
}

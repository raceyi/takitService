import {Component} from "@angular/core";
import {NavController,NavParams} from 'ionic-angular';
import {App} from 'ionic-angular';
import {ConfigProvider} from '../../providers/ConfigProvider';

@Component({
  selector:'page-serviceinfo',
  templateUrl: 'serviceinfo.html'
})

export class ServiceInfoPage{
     version:string;
     
     constructor(private app: App,private navController: NavController, private navParams: NavParams){
	      console.log("ServiceInfoPage constructor");
        this.version=ConfigProvider.version;
     }

     ionViewWillUnload(){
        console.log("ionViewWillUnload-ServiceInfoPage");
     }

}



import {Component} from "@angular/core";
import {NavController,NavParams} from 'ionic-angular';
import {App} from 'ionic-angular';
import {StorageProvider} from '../../providers/storageProvider';

@Component({
  selector:'page-serviceinfo',
  templateUrl: 'serviceinfo.html'
})

export class ServiceInfoPage{
      userAgreementHidden:boolean=true;
      personalInfoHidden:boolean=true;
      pictureInfoHidden:boolean=true;
      version:string;
     constructor(private app: App,private navController: NavController, 
     private navParams: NavParams,private storageProvider:StorageProvider){
	      console.log("ServiceInfoPage constructor");
        this.version=this.storageProvider.version;
     }

     ionViewWillUnload(){
        console.log("ionViewWillUnload-ServiceInfoPage");
     }

     expand(sectionNum){
        console.log("expand:"+sectionNum);
        if(sectionNum==0){
           this.userAgreementHidden=false;
        }else if(sectionNum==1){
           this.personalInfoHidden=false;
        }else if(sectionNum==2){
           this.pictureInfoHidden=false;
        }else{
          console.log("invalid sectionNum:"+sectionNum);
        }

     }

     collapse(sectionNum){
        console.log("collapse:"+sectionNum);
        if(sectionNum==0){
           this.userAgreementHidden=true;
        }else if(sectionNum==1){
           this.personalInfoHidden=true;
        }else if(sectionNum==2){
           this.pictureInfoHidden=true;
        }else{
          console.log("invalid sectionNum:"+sectionNum);
        }
     }
}



import {Component,NgZone,EventEmitter,ViewChild,ElementRef} from '@angular/core';
import {NavController,NavParams,TextInput,Content,ActionSheetCmp} from 'ionic-angular';
import {Platform,App,AlertController} from 'ionic-angular';
import {ServerProvider} from '../../providers/serverProvider';
import {StorageProvider} from '../../providers/storageProvider';

declare var cordova:any;

@Component({
  selector:'page-bankbranch',  
  templateUrl: 'bankbranch.html',
})

export class BankBranchPage {
    bank="";
    depositBranch="";
    bankCode;
    branchShown=[];
    branches=[];

    constructor(private app:App,private navController: NavController,
                private serverProvider:ServerProvider,private navParams: NavParams,
                public storageProvider:StorageProvider,private alertController:AlertController){
        this.bankCode=navParams.get("bankCode");
        this.bank=navParams.get("bankName");
        this.storageProvider.depositBranch=undefined;
        console.log("bankBranchPage "+this.bank);
    }

    getBranch(event){
        console.log("getBranch"+this.depositBranch.trim());
        if(this.depositBranch.trim().length<=0){
            this.branchShown=[];
            return;
        }

        if(this.depositBranch.trim().length>=1){     
            console.log("request branchNameAutoComplete with "+ this.depositBranch.trim());
            let body = JSON.stringify({bankName:this.bank, branchName:this.depositBranch.trim()});
            this.serverProvider.post(this.storageProvider.serverAddress+"/branchNameAutoComplete",body).then((res:any)=>{    
                console.log("res:"+JSON.stringify(res));
                if(res.result=="success"){
                        this.branches=res.bankInfo;
                        this.branchShown=res.bankInfo;
                        console.log("this.branches:"+JSON.stringify(this.branches));
                }else{
                        
                }
            },(err)=>{
                    if(err=="NetworkFailure"){
                                let alert = this.alertController.create({
                                    title: '서버와 통신에 문제가 있습니다',
                                    subTitle: '네트웍상태를 확인해 주시기바랍니다',
                                    buttons: ['OK']
                                });
                                alert.present();
                    }else{

                    }
            });
        }
    }

    branchClear(event){
        console.log("branchClear");
        this.branchShown=[];
    }

    selectBranch(item){
        console.log("selectBranch-item:"+JSON.stringify(item));
        if(typeof item === 'string'){ //직접입력 
            console.log("codeInput");
            this.storageProvider.depositBranch='codeInput';
        }else{
            this.storageProvider.depositBranch=item.branchCode;
            this.storageProvider.depositBranchInput=item.branchName;
            console.log("branchName:"+this.storageProvider.depositBranchInput);
        }
        this.app.getRootNav().pop();
    }

    selectInput(){
        console.log("selectInput");
        this.storageProvider.depositBranch="codeInput";
        this.app.getRootNav().pop();
    }
}



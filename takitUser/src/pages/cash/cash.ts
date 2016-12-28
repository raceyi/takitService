import {Component} from '@angular/core';
import {App,NavController,NavParams,Tabs,AlertController,TextInput} from 'ionic-angular';
import {Platform,Content} from 'ionic-angular';
import {Http,Headers} from '@angular/http';
import 'rxjs/add/operator/map';
import {ConfigProvider} from '../../providers/ConfigProvider';
import {ViewChild} from '@angular/core';
import {Device,InAppBrowserEvent,InAppBrowser} from 'ionic-native';
import {CashIdPage} from '../cashid/cashid';
import {StorageProvider} from '../../providers/storageProvider';
import {ServerProvider} from '../../providers/serverProvider';
import {Storage} from '@ionic/storage';

@Component({
  selector: 'page-cash',
  templateUrl: 'cash.html'
})
export class CashPage {
  cashMenu: string = "cashIn";
  available: string ="15000";
  transactions=[];
  browserRef:InAppBrowser;
  infiniteScroll=false;

  refundBank:string="";
  refundAccount:string="";

  verifiedBank:string="";
  verifiedAccount:string="";

  refundEditable=true;
  transferDate;
  contentLength;
  inputHeight;

 /////////////////////////////////////
  // 캐쉬정보 수동입력 
  depositBank="";
  depositBankInput="";
  depositBranch="";
  depositBranchInput="";
  branchShown=[];

  refundAmount:number=undefined;

  @ViewChild("cashContent") contentRef: Content;
  @ViewChild("depositCashAmount") textInputRef:TextInput;

  constructor(private app:App,private platform:Platform, private navController: NavController
        ,private navParams: NavParams,public http:Http ,private alertController:AlertController
        ,public storageProvider:StorageProvider,private serverProvider:ServerProvider
        ,public storage:Storage) {

    var d = new Date();
    var mm = d.getMonth() < 9 ? "0" + (d.getMonth() + 1) : (d.getMonth() + 1); // getMonth() is zero-based
    var dd  = d.getDate() < 10 ? "0" + d.getDate() : d.getDate();
    var dString=d.getFullYear()+'-'+(mm)+'-'+dd;
    this.transferDate=dString;

    console.log(" param: "+this.navParams.get('param'));
    
    this.transactions.push({date:"2016-01-03" ,type:"입금", amount:"20,000",balance:"20,000"});
    this.transactions.push({date:"2016-01-03" ,type:"사용", amount:"-5,000",balance:"15,000"});
    this.transactions.push({date:"2016-01-15" ,type:"사용", amount:"-2,000",balance:"13,000"});
    this.transactions.push({date:"2016-01-29" ,type:"이자", amount:"+2",balance:"13,002"});
    this.transactions.push({date:"2016-01-29" ,type:"확인", amount:"+5,000",balance:"13,002"});

    //read cash info from local storage
    // bank name and account saved in encrypted format.
    console.log("read refundBank");
     this.storage.get("refundBank").then((value:string)=>{
         console.log("refundBank is "+value);
         if(value!=null){
            this.refundBank=this.storageProvider.decryptValue("refundBank",decodeURI(value));
            this.storage.get("refundAccount").then((valueAccount:string)=>{
                if(value!=null){
                    this.refundAccount=this.storageProvider.decryptValue("refundAccount",decodeURI(valueAccount));
                    this.verifiedBank=this.refundBank;
                    this.verifiedAccount=this.refundAccount;
                    this.refundEditable=false;
                }
            },(err)=>{
                console.log("fail to read refundAccount");
            });
        }
     },(err)=>{
        console.log("refundBank doesn't exist");
     });
  }

    createTimeout(timeout) {
        return new Promise((resolve, reject) => {
            setTimeout(() => resolve(null),timeout)
        })
    }

  cashInCheck(confirm){
      console.log("cashInCheck comes(confirm)");
      this.createTimeout(15000)
                .then(() => {
                    console.log(`done after 300ms delay`);
                    this.contentRef.scrollToTop(); 
                    let body = JSON.stringify({});
                    //let headers = new Headers();
                    //headers.append('Content-Type', 'application/json');
                    console.log("server:"+ ConfigProvider.serverAddress);
                    //this.http.post(ConfigProvider.serverAddress+"/triggerCashCheck",body,{headers: headers}).map(res=>res.json()).subscribe((res)=>{
                    this.serverProvider.post(ConfigProvider.serverAddress+"/triggerCashCheck",body).then((res:any)=>{    
                        var result:string=res.result;
                        if(result=="success"){
                            console.log("triggerCashCheck sent successfully");
                        }
                    },(err)=>{
                            console.log("triggerCashCheck err "+err);
                            if(err=="NetworkFailure"){
                                let alert = this.alertController.create({
                                    title: '서버와 통신에 문제가 있습니다',
                                    subTitle: '네트웍상태를 확인해 주시기바랍니다',
                                    buttons: ['OK']
                                });
                                alert.present();
                            }
                    });
                });
  }

  ionViewDidEnter(){
        this.contentLength=this.contentRef.getContentDimensions().contentHeight;
        this.inputHeight=this.textInputRef._elementRef.nativeElement.getBoundingClientRect().height;
  }

  cashInComplete(){
      console.log("cashInComplete");
      this.available="20000";
      //this.content.scrollToTop();
  }
  
  configureCashId(){
   // this.app.getRootNav().push(CashIdPage);
   if(this.storageProvider.isAndroid){
        let confirm = this.alertController.create({
        title: '회원정보와 휴대폰 본인인증 정보가 동일해야만 합니다.',
        message: '다를 경우 회원정보 수정후 진행해주시기바랍니다.',
        buttons: [
            {
            text: '아니오',
            handler: () => {
                console.log('Disagree clicked');
                return;
            }
            },
            {
            text: '네',
            handler: () => {
                console.log('Agree clicked');
                this.app.getRootNav().push(CashIdPage);
                /*
                this.mobileAuth().then(()=>{ // success
                    this.app.getRootNav().push(CashIdPage);
                },(err)=>{ //failure
                    if(err=="invalidUserInfo"){
                        console.log("invalidUserInfo");
                        let alert = this.alertController.create({
                                title: '사용자 정보가 일치하지 않습니다.',
                                subTitle: '회원정보를 수정해주시기 바랍니다',
                                buttons: ['OK']
                            });
                            alert.present();
                    }
                });
                */
            }
            }
        ]
        });
        confirm.present();    
    }else{
          this.app.getRootNav().push(CashIdPage);
        /*
                this.mobileAuth().then(()=>{ // success
                    this.app.getRootNav().push(CashIdPage);
                },(err)=>{ //failure
                    if(err=="invalidUserInfo"){
                        console.log("invalidUserInfo");
                        let alert = this.alertController.create({
                                title: '사용자 정보가 일치하지 않습니다.',
                                subTitle: '회원정보를 수정해주시기 바랍니다',
                                buttons: ['OK']
                            });
                            alert.present();
                    }
                });
         */       
    }
  }

  mobileAuth(){
    return new Promise((resolve,reject)=>{
      // move into CertPage and then 
      if(this.storageProvider.isAndroid){
            this.browserRef=new InAppBrowser("https://takit.biz:8443/NHPintech/kcpcert_start.jsp","_blank" ,'toolbar=no');
      }else{ // ios
            this.browserRef=new InAppBrowser("https://takit.biz:8443/NHPintech/kcpcert_start.jsp","_blank" ,'location=no,closebuttoncaption=종료');
      }
              this.browserRef.on("exit").subscribe((event)=>{
                  console.log("InAppBrowserEvent(exit):"+JSON.stringify(event)); 
                  this.browserRef.close();
              });
              this.browserRef.on("loadstart").subscribe((event:InAppBrowserEvent)=>{
                  console.log("InAppBrowserEvent(loadstart):"+String(event.url));
                  if(event.url.startsWith("https://takit.biz/oauthSuccess")){ // Just testing. Please add success and failure into server 
                        console.log("cert success");
                        var strs=event.url.split("userPhone=");    
                        if(strs.length>=2){
                            var nameStrs=strs[1].split("userName=");
                            if(nameStrs.length>=2){
                                var userPhone=nameStrs[0];
                                var userName=nameStrs[1];
                                console.log("userPhone:"+userPhone+" userName:"+userName);
                                let body = JSON.stringify({userPhone:userPhone,userName:userName});
                                this.serverProvider.post(ConfigProvider.serverAddress+"/validUserInfo",body).then((res:any)=>{
                                    if(res.result=="success"){
                                        // forward into cash id page
                                        resolve();
                                    }else{
                                        // change user info
                                        //    
                                        reject("invalidUserInfo");
                                    }
                                },(err)=>{
                                    if(err=="NetworkFailure"){
                                        let alert = this.alertController.create({
                                            title: '서버와 통신에 문제가 있습니다',
                                            subTitle: '네트웍상태를 확인해 주시기바랍니다',
                                            buttons: ['OK']
                                        });
                                        alert.present();
                                    }
                                    reject(err);
                                });
                            }
                        }
                        this.browserRef.close();
                        return;
                  }else if(event.url.startsWith("https://takit.biz/oauthFailure")){
                        console.log("cert failure");
                        this.browserRef.close();
                         reject();
                        return;
                  }
              });
    });
  }

  doInfinite(infiniteScroll){
    console.log("doInfinite");
    this.transactions.push({date:"2016-01-29" ,type:"확인", amount:"+5,000",balance:"13,002"});
    infiniteScroll.complete();
  }

   disableInfiniteScroll(){
    console.log("disableInfiniteScroll");
    this.infiniteScroll=false;
  }

  enableInfiniteScroll(){
    console.log("enableInfiniteScroll");
    this.infiniteScroll=true;
  }

  focusInput(input:string) { // Anyotherway?
    if(this.storageProvider.isAndroid){
        console.log("focusInput:"+input);
        //console.log("scrollTo "+this.contentLength*7/10+this.inputHeight);
       if(input=='depositCashAmount'){
            this.contentRef.scrollTo(0, this.contentLength*7/10+this.inputHeight);
       }else if(input=='depositBank'){
            this.contentRef.scrollTo(0, this.contentLength*7/10+2*this.inputHeight);
       }else if(input=='depositBranch'){
            this.contentRef.scrollTo(0, this.contentLength*7/10+3*this.inputHeight);
       }else if(input=='depositCashId'){
           this.contentRef.scrollTo(0, this.contentLength);
       }else if(input=='inputRefundAccount'){
           this.contentRef.scrollTo(0, this.contentLength*1/5);
       }else if(input=='inputRefundAmount'){
           this.contentRef.scrollTo(0, this.contentLength*3/5);
       }
    }
  }  

  depositBankType(depositBank){
      console.log("depositBank is"+depositBank);
  }

  depositBranchType(depositBranch){
    console.log("depositBranch is"+depositBranch);
  }

  toggleSelectInput(type){
    if(type=='depositBankTypeSelect'){
        this.depositBank="";
    }else if(type=='depositBranchTypeSelect'){
        console.log("depositBankType become true");
        this.depositBranch="";
        this.branchShown=[];
    }
  }

  getFocusBranch(event){
    if(this.depositBank.length==0 || this.depositBank=='0'/* can it happen? */){
      console.log("Please select bank");
      let alert = this.alertController.create({
                        title: '은행을 선택해 주시기비랍니다.',
                        buttons: ['OK']
                    });
                    alert.present();
    }
  }

  getBranch(event){
    console.log("getBranch"+this.depositBranch.trim());
    //ask server branch name starting with refundBranch input.
    //...AAGUID.max는 다섯개 
    //this.branchShown=[];
  }

  selectBranch(branch){
    if(branch=='직접입력'){
      this.depositBranch='직접입력';
      this.branchShown=[];
    }else{
      this.depositBranch=branch;
      this.branchShown=[];
    }
  }

  branchClear(event){
      this.branchShown=[];
      this.depositBranch="";
  }

  checkWithrawAccount(){
      console.log("checkWithrawAccount");

      console.log("refundBank:"+this.refundBank);
      if(this.storageProvider.cashId.length==0){
            let alert = this.alertController.create({
                title: '캐쉬아이디를 등록해 주시기 바랍니다.',
                buttons: ['OK']
            });
            alert.present();
          return;
      }
      if(this.refundBank.length==0){
            let alert = this.alertController.create({
                title: '은행을 선택해 주시기 바랍니다.',
                buttons: ['OK']
            });
            alert.present();
          return;
      }

      if(this.refundAccount.trim().length==0 ){
            let alert = this.alertController.create({
                title: '계좌번호를 입력해 주시기 바랍니다.',
                buttons: ['OK']
            });
            alert.present();
          return;
      }

      let body = JSON.stringify({depositorName:this.storageProvider.name,
                                bankCode:this.refundBank ,account:this.refundAccount.trim()});
      this.serverProvider.post(ConfigProvider.serverAddress+"/registRefundAccount",body).then((res:any)=>{
          console.log("registRefundAccount res:"+JSON.stringify(res));
          if(res.result=="success"){
              // store info into local storage and convert button from registration into modification
              var encryptedBank:string=this.storageProvider.encryptValue('refundBank',this.refundBank);
              this.storage.set('refundBank',encodeURI(encryptedBank));
              var encrypted:string=this.storageProvider.encryptValue('refundAccount',this.refundAccount.trim());
              this.storage.set('refundAccount',encodeURI(encrypted));
              this.verifiedBank=this.refundBank;
              this.verifiedAccount=this.refundAccount.trim();
              this.refundEditable=false;
              return;
          }
          if(res.result=="failure"){
                let alert = this.alertController.create({
                    title: '환불계좌 등록에 실패하였습니다.',
                    subTitle: res.error,
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
                     console.log("Hum...checkDepositor-HttpError");
                 } 

      });
  }

  enableRefundEditable(){
      this.refundEditable=true;
      this.refundBank="";
      this.refundAccount="";
  }

  cancelRefundEditable(){
      this.refundEditable=false;
      this.refundBank=this.verifiedBank;
      this.refundAccount=this.verifiedAccount;
  }

  refundCash(){
        if(this.refundAmount==undefined || this.refundAmount<=0){
            let alert = this.alertController.create({
                title: '환불 금액은 0보다 커야 합니다.',
                buttons: ['OK']
            });
            alert.present();
          return;
      }

      let body = JSON.stringify({depositorName:this.storageProvider.name,
                                bankCode:this.refundBank ,account:this.refundAccount.trim(),
                                cashId:this.storageProvider.cashId,
                                withdrawalAmount:this.refundAmount});

      this.serverProvider.post(ConfigProvider.serverAddress+"/refundCash",body).then((res:any)=>{
          console.log("refundCash res:"+JSON.stringify(res));
          if(res.result=="success"){
              console.log("cashAmount:"+res.cashAmount);
              return;
          }
          if(res.result=="failure" && res.error=='check your balance'){
                let alert = this.alertController.create({
                    title: '잔액이 부족합니다.',
                    buttons: ['OK']
                });
                alert.present();
              return;
          }
          if(res.result=="failure"){
                let alert = this.alertController.create({
                    title: '환불에 실패하였습니다.',
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
                     console.log("Hum...checkDepositor-HttpError");
                 } 

      });
  }
}

import {Component,NgZone} from '@angular/core';
import {App,NavController,NavParams,Tabs,TextInput} from 'ionic-angular';
import {Platform,Content,ModalController,AlertController,InfiniteScroll} from 'ionic-angular';
import {Http,Headers} from '@angular/http';
import 'rxjs/add/operator/map';
import {ViewChild} from '@angular/core';
import {Device,InAppBrowserEvent,InAppBrowser} from 'ionic-native';
import {CashIdPage} from '../cashid/cashid';
import {StorageProvider} from '../../providers/storageProvider';
import {ServerProvider} from '../../providers/serverProvider';
import {Storage} from '@ionic/storage';
import {BankBranchPage} from '../bankbranch/bankbranch';
import {CashConfirmPage} from '../cashconfirm/cashconfirm';
import {IOSAlertPage} from '../ios-alert/ios-alert';

declare var cordova:any;
declare var moment:any;

@Component({
  selector: 'page-cash',
  templateUrl: 'cash.html'
})
export class CashPage {
 //@ViewChild('infiniteScroll') infiniteScrollRef: InfiniteScroll;
  public infiniteScrollRef:any;
 // public cashMenu: string = "cashIn"; move into storageProvider
  public transactions=[];
  public browserRef:InAppBrowser;
  public infiniteScroll=false;

  public refundBank:string="";
  public refundAccount:string="";
  public refundAccountMask:string="";
  public verifiedBank:string="";
  public verifiedAccount:string="";

  public refundEditable=true;
  public transferDate;

  public depositAmount:number=undefined;
  public depositBankInput;
  public depositMemo:string;

  public refundAmount:number=undefined;
  public refundFee:number=undefined;

  public lastTuno:number=-1;

  messageEmitterSubscription;

  constructor(private app:App,private platform:Platform, private navController: NavController
        ,private navParams: NavParams,public http:Http ,private alertController:AlertController
        ,public storageProvider:StorageProvider,private serverProvider:ServerProvider
        ,public storage:Storage,public modalCtrl: ModalController,private ngZone:NgZone
        ,public alertCtrl:AlertController) {

    var d = new Date();
    var mm = d.getMonth() < 9 ? "0" + (d.getMonth() + 1) : (d.getMonth() + 1); // getMonth() is zero-based
    var dd  = d.getDate() < 10 ? "0" + d.getDate() : d.getDate();
    var dString=d.getFullYear()+'-'+(mm)+'-'+dd;
    this.transferDate=dString;

    this.depositMemo=this.storageProvider.name;
    //read cash info from local storage
    // bank name and account saved in encrypted format.
    if(this.storageProvider.tourMode){
        this.storageProvider.name="타킷 주식회사";
        this.refundBank="011";
        this.refundAccountMask="301*****63621";
        this.refundEditable=false;
        return;
    }
        
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
                    //console.log("refundEditable:"+this.refundEditable);
                    //console.log("refundAccountMask:"+this.refundAccountMask);
                    this.refundAccountMask=this.maskAccount(this.refundAccount); /* mask except 3 digits at front and 5 digits at end */
                    this.refundEditable=false;
                    //console.log("..refundEditable:"+this.refundEditable);
                    //console.log("..refundAccountMask:"+this.refundAccountMask);
                }
            },(err)=>{
                console.log("fail to read refundAccount");
            });
        }
     },(err)=>{
        console.log("refundBank doesn't exist");
     });

        this.messageEmitterSubscription= this.storageProvider.cashInfoUpdateEmitter.subscribe((option)=> {
            console.log("!!!update cashInfo comes!!!-"+this.storageProvider.cashMenu);
            if(this.storageProvider.cashMenu=='cashHistory'){
                this.getTransactions(-1,true).then((res:any)=>{
                    this.ngZone.run(()=>{
                            //console.log("res:"+JSON.stringify(res));
                            if(res.cashList=="0"){
                                console.log("res:"+JSON.stringify(res));
                                this.infiniteScroll=false;
                                if(this.infiniteScrollRef!=undefined){
                                    this.infiniteScrollRef.enable(false);
                                }
                            }else{
                                console.log("update cashlist");
                                this.transactions=[];
                                this.updateTransaction(res.cashList);
                                this.checkDepositInLatestCashlist(res.cashList);
                                if(this.infiniteScrollRef!=undefined){
                                    console.log("call complete");
                                    this.infiniteScrollRef.enable(true);
                                    this.infiniteScrollRef.complete();
                                }
                            }
                    });
                },(err)=>{
                    
                });
            }
            if(option!="listOnly"){
                    this.serverProvider.updateCashAvailable().then((res)=>{

                    },(err)=>{
                        /*  alert may block whole UI in ios 
                        if(err=="NetworkFailure"){
                                        let alert = this.alertController.create({
                                            title: "서버와 통신에 문제가 있습니다.",
                                            buttons: ['OK']
                                        });
                                        alert.present();
                            }else{
                            let alert = this.alertController.create({
                                    title: "캐쉬정보를 가져오지 못했습니다.",
                                    buttons: ['OK']
                                });
                                    alert.present();
                            }
                        */ 
                    });
            }
        });
  }

  maskAccount(account:string){
      if(account==undefined || account.length<9){
          return undefined;
      }
      var mask:string='*'.repeat(account.length-this.storageProvider.accountMaskExceptFront-this.storageProvider.accountMaskExceptEnd);  
      var front:string=account.substr(0,this.storageProvider.accountMaskExceptFront);
      var end:string=account.substr(account.length-this.storageProvider.accountMaskExceptEnd,this.storageProvider.accountMaskExceptEnd);
      front.concat(mask, end);
      //console.log("front:"+front+"mask:"+mask+"end"+end);
      //console.log("account:"+ (front+mask+end));
      return (front+mask+end);       
  }

  cashInCheck(confirm){
      console.log("cashInCheck comes(confirm)");
      let body = JSON.stringify({});
      this.serverProvider.post(this.storageProvider.serverAddress+"/checkCashInstantly",body).then((res:any)=>{
          console.log("checkCashInstantly res:"+JSON.stringify(res));
          if(res.result=="success"){
                  let iOSAlertPage = this.modalCtrl.create(IOSAlertPage);
                  iOSAlertPage.present();
          }else if(res.result=="failure" && res.error=="gcm:400"){
                let alert = this.alertController.create({
                    title: '전체내역에서 확인버튼을 눌러 입금을 확인해주세요.',
                    buttons: ['OK']
                });
                alert.present();
          }else{
              
                let alert = this.alertController.create({
                    title: '요청에 실패했습니다. 잠시후 다시 요청바랍니다.',
                    buttons: ['OK']
                });
                alert.present();
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
                let alert = this.alertController.create({
                    title: '요청에 실패했습니다. 잠시후 다시 요청바랍니다.',
                    buttons: ['OK']
                });
                alert.present();
          }
      });
  }

  cashInComplete(){
      console.log("cashInComplete");
      if(this.depositAmount==undefined){
            let alert = this.alertController.create({
                title: '입금액을 입력해주시기바랍니다.',
                buttons: ['OK']
            });
            alert.present();
          return;
      }

      if(this.storageProvider.depositBank==undefined){
           let alert = this.alertController.create({
                title: '입금 은행을 입력해주시기바랍니다.',
                buttons: ['OK']
            });
            alert.present();
            return;
      }

      if(this.storageProvider.depositBank!="0" && this.storageProvider.depositBranch!="codeInput" && this.storageProvider.depositBank==undefined){
            let alert = this.alertController.create({
                title: '거래 지점을 선택해주시기바랍니다.',
                buttons: ['OK']
            });
            alert.present();
            return;
      }

      /*
      if(this.storageProvider.depositBank=="0" && 
            (this.depositBankInput==undefined ||  this.depositBankInput.trim().length!=3)){
            let alert = this.alertController.create({
                title: '입금 은행코드를 정확히 입력해주시기바랍니다.',
                buttons: ['OK']
            });
            alert.present();
            return;
      }
      */

      if((this.storageProvider.depositBank=="0"|| this.storageProvider.depositBranch=="codeInput" ) && 
        (this.storageProvider.depositBranchInput==undefined || this.storageProvider.depositBranchInput.trim().length!=7)){
            let alert = this.alertController.create({
                title: '입금 지점을 코드를 정확히 입력해주시기바랍니다.',
                buttons: ['OK']
            });
            alert.present();
            return;
      }
      
      if(this.depositMemo==undefined || this.depositMemo.length==0){
          this.depositMemo=this.storageProvider.name;
      }
      var transferDate=new Date(this.transferDate);

//      var depositBank= this.storageProvider.depositBank=='0'?this.depositBankInput:this.storageProvider.depositBank;
      var depositBranch= this.storageProvider.depositBranch=='codeInput'? this.storageProvider.depositBranchInput:this.storageProvider.depositBranch;

      let body;
      if(this.storageProvider.depositBank=='0' || this.storageProvider.depositBranch=="codeInput"){
            body = JSON.stringify({depositDate:transferDate.toISOString(),
                                        amount: this.depositAmount,
                                        bankCode: this.depositBankInput,
                                        branchCode:depositBranch,
                                        depositMemo:this.depositMemo,
                                        cashId:this.storageProvider.cashId
                                 });
      }else{
           // look for name of depositBank
          var i;
          for(i=0;i<this.storageProvider.banklist.length;i++){
                if(this.storageProvider.banklist[i].value==this.storageProvider.depositBank){
                    break;
                }
          }
          console.log("bank name:"+this.storageProvider.banklist[i].name);
            body = JSON.stringify({depositDate:transferDate.toISOString(),
                                        amount: this.depositAmount,
                                        bankName: this.storageProvider.banklist[i].name,
                                        branchCode:depositBranch,
                                        depositMemo:this.depositMemo,
                                        cashId:this.storageProvider.cashId
                                 });
      }
                                 
     console.log("body:"+JSON.stringify(body));                           

      this.serverProvider.post(this.storageProvider.serverAddress+"/checkCashUserself",body).then((res:any)=>{
          console.log("res:"+JSON.stringify(res));
          if(res.result=="success"){
                  let iOSAlertPage = this.modalCtrl.create(IOSAlertPage);
                  iOSAlertPage.present();
          }else if(res.result=="failure" && res.error=="gcm:400"){
                let alert = this.alertController.create({
                    title: '전체내역에서 확인버튼을 눌러 입금을 확인해주세요.',
                    buttons: ['OK']
                });
                alert.present();
          }else{
              let alert;

              if(res.error=="count excess"){
                    alert = this.alertController.create({
                        title: '3회 연속 오류로 수동확인이 불가능합니다.',
                        subTitle: '고객센터(help@takit.biz,0505-170-3636)에 연락하여 주시기바랍니다.',
                        buttons: ['OK']
                    });
              }else{
                    alert = this.alertController.create({
                        title: '입금 확인 요청에 실패했습니다.',
                        subTitle: '잠시후 다시 요청해주시기 바랍니다.',
                        buttons: ['OK']
                    });
              }
              alert.present();
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
                    let alert = this.alertController.create({
                        title: '입금 확인 요청에 실패했습니다.',
                        subTitle: '잠시후 다시 요청해주시기 바랍니다.',
                        buttons: ['OK']
                    });
                    alert.present();
                }
      });     
  }
  
  configureCashId(){
   // this.app.getRootNav().push(CashIdPage);
   console.log("configureCashId");
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
                
            }
            }
        ]
        });
        confirm.present();    
    }else{
 /*        
          this.app.getRootNav().push(CashIdPage);
 */         
          console.log("ios....call mobileAuth");
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
    }
  }

  mobileAuth(){
      console.log("mobileAuth");
    return new Promise((resolve,reject)=>{
      // move into CertPage and then 
      if(this.storageProvider.isAndroid){
            this.browserRef=new InAppBrowser(this.storageProvider.certUrl,"_blank" ,'toolbar=no');
      }else{ // ios
            console.log("ios");
            this.browserRef=new InAppBrowser(this.storageProvider.certUrl,"_blank" ,'location=no,closebuttoncaption=종료');
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
                                this.serverProvider.post(this.storageProvider.serverAddress+"/validUserInfo",body).then((res:any)=>{
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

  convertType(type){
      if(type=='deposit'){
          return '입금';
      }else if(type=='payment'){
          return '구매';
      }else if(type=='refund'){
          return '환불';
      }else if(type=='interest'){
          return '이자';
      }else if(type=='cancel'){
          return '취소';
      }else{
          console.log("convertType invalid type:"+type);
          return '알수 없음';
      }
  }
  
  addCash(transaction){
      let custom:any={};

      custom.amount=transaction.amount.toString();
      custom.cashId=transaction.cashId;
      custom.transactionTime=transaction.transactionTime;
      custom.cashTuno=transaction.cashTuno;
      custom.bankName=transaction.bankName;
      if(transaction.branchName!=undefined)
          custom.branchName=transaction.branchName;
      else
          custom.branchCode=transaction.branchCode;
      console.log("addCash:"+JSON.stringify(transaction));
        let cashConfirmModal= this.modalCtrl.create(CashConfirmPage, { custom: custom });
        cashConfirmModal.present();
  }

  updateTransaction(cashList){
            cashList.forEach((transaction)=>{
                var tr:any={};
                tr=transaction;
                tr.type=this.convertType(tr.transactionType);
                if(tr.transactionType=='refund'){
                    tr.accountMask=this.maskAccount(tr.account);
                }
                if(tr.confirm==1){
                    // convert GMT time into local time
                    var trTime:Date=moment.utc(tr.transactionTime).toDate();
                    var mm = trTime.getMonth() < 9 ? "0" + (trTime.getMonth() + 1) : (trTime.getMonth() + 1); // getMonth() is zero-based
                    var dd  = trTime.getDate() < 10 ? "0" + trTime.getDate() : trTime.getDate();
                    var dString=trTime.getFullYear()+'-'+(mm)+'-'+dd;
                    tr.date=dString;
                }else{
                    tr.date=tr.transactionTime.substr(0,10);
                }
                tr.hide=true; //default value 
                //console.log("tr:"+JSON.stringify(tr));
                this.transactions.push(tr);
            });
            
            // sort last transactions with transactionTime
            
            var len,startIdx;
            if(this.storageProvider.TransactionsInPage*2<this.transactions.length){
                len=this.transactions.length*2 ;
                startIdx=this.transactions.length-len;
            }else{
                len=this.transactions.length;
                startIdx=0; 
            }
            //console.log("startIdx:"+startIdx+" len:"+len);
            var subtransactions=this.transactions.slice(startIdx,len);
            this.sortByKey(subtransactions); 
            if(startIdx>0)
                this.transactions=this.transactions.slice(0,startIdx);
            else
                this.transactions=[];
            this.transactions=this.transactions.concat(subtransactions);
  }

   sortByKey(array) {
    return array.sort(function(a, b) {
        var x = moment.utc(a.transactionTime).toDate().getTime(); 
        var y = moment.utc(b.transactionTime).toDate().getTime();
        return ((x > y) ? -1 : ((x < y) ? 1 : 0));
    });
   }

  doInfinite(infiniteScroll){
    console.log("doInfinite");
    this.getTransactions(this.lastTuno,true).then((res:any)=>{
        //console.log("res:"+JSON.stringify(res));
        if(res.cashList=="0"){
            console.log("res:"+JSON.stringify(res));
            infiniteScroll.enable(false);
            this.infiniteScroll=false;
        }else{
            this.updateTransaction(res.cashList);
            console.log("call complete");
            infiniteScroll.complete();
            this.infiniteScrollRef=infiniteScroll;
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
                    let alert = this.alertController.create({
                        title: '캐쉬 내역을 가져오지 못했습니다.',
                        buttons: ['OK']
                    });
                    alert.present();
                }
    });
    //this.transactions.push({date:"2016-01-29" ,type:"확인", amount:"+5,000",balance:"13,002"});
    //infiniteScroll.complete();
  }

   disableInfiniteScroll(){
    console.log("disableInfiniteScroll");
    this.infiniteScroll=false;
    if(this.infiniteScrollRef!=undefined){
        this.infiniteScrollRef.enable(false);
    }
  }

    getTransactions(lastTuno,lastTunoUpdate){
        return new Promise((resolve, reject)=>{
            let body = JSON.stringify({cashId:this.storageProvider.cashId,
                                lastTuno: lastTuno,
                                limit: this.storageProvider.TransactionsInPage});
            console.log("getCashList:"+body+"lastTunoUpdate:"+lastTunoUpdate);                    
            this.serverProvider.post( this.storageProvider.serverAddress+"/getCashList",body).then((res:any)=>{
                if(res.result=="success"){
                    console.log("res:"+JSON.stringify(res));
                    if(lastTunoUpdate==true)
                        this.lastTuno=res.cashList[res.cashList.length-1].cashTuno;
                     resolve(res);
                }else{
                     reject("serverFailure");
                }
            },(err)=>{
                    reject(err);
            });
        });
    }

checkDepositInLatestCashlist(cashList){
    for(var i=0;i<cashList.length;i++){
        //console.log("cash item:"+JSON.stringify(cashList[i]));
        if(cashList[i].transactionType=="deposit" && cashList[i].confirm==0){
            break;
        }
    }
    //console.log("checkDepositInLatestCashlist i:"+i +"length:"+cashList.length);
    if(i==cashList.length){
        this.storageProvider.deposit_in_latest_cashlist=false;
    }else{    
        this.storageProvider.deposit_in_latest_cashlist=true;
    }
}

  enableInfiniteScroll(){
    console.log("enableInfiniteScroll");
    this.infiniteScroll=true;
    if(this.infiniteScrollRef!=undefined){
        console.log("infiniteScrollRef.enable(true)");
        this.infiniteScrollRef.enable(true);
    }
          if(this.transactions.length==0){ 
            this.getTransactions(-1,true).then((res:any)=>{
                this.ngZone.run(()=>{
                        //console.log("res:"+JSON.stringify(res));
                        if(res.cashList=="0"){
                            console.log("res:"+JSON.stringify(res));
                            this.infiniteScroll=false;
                            if(this.infiniteScrollRef!=undefined){
                                this.infiniteScrollRef.enable(false);
                            }
                        }else{
                            this.transactions=[];
                            this.updateTransaction(res.cashList);
                            this.checkDepositInLatestCashlist(res.cashList);
                            if(this.infiniteScrollRef!=undefined){
                                console.log("call complete()");
                                this.infiniteScrollRef.complete();
                            }else{
                                console.log("What can I do here... humm?");
                            } 
                        }
                });
            },(err)=>{
                if(err=="NetworkFailure"){
                    let alert = this.alertController.create({
                        title: '서버와 통신에 문제가 있습니다',
                        subTitle: '네트웍상태를 확인해 주시기바랍니다',
                        buttons: ['OK']
                    });
                    alert.present();
                }else{
                    let alert = this.alertController.create({
                        title: '캐쉬 내역을 가져오지 못했습니다.',
                        buttons: ['OK']
                    });
                    alert.present();
                }
            });
      }else{
       this.getTransactions(-1,false).then((res:any)=>{
                this.ngZone.run(()=>{
                        //console.log("res:"+JSON.stringify(res));
                        if(res.cashList=="0"){
                            console.log("res:"+JSON.stringify(res));
                            this.infiniteScroll=false;
                            if(this.infiniteScrollRef!=undefined){
                                this.infiniteScrollRef.enable(false);
                            }
                        }else{
                              //check if transactions is updated or not
                                var transactions=this.sortByKey(res.cashList); 
                                console.log("res-transactions:"+ JSON.stringify(transactions));
                                console.log("this.transactions:"+JSON.stringify(this.transactions));

                                for(var i=0;i<transactions.length && i<this.transactions.length ;i++){
                                    if(transactions[i].cashTuno!=this.transactions[i].cashTuno){
                                        console.log("update whole transactions");
                                        this.transactions=[];
                                        this.lastTuno=res.cashList[res.cashList.length-1].cashTuno;
                                        this.updateTransaction(res.cashList);
                                        this.checkDepositInLatestCashlist(res.cashList);
                                        if(this.infiniteScroll ==true && this.infiniteScrollRef!=undefined){
                                            console.log("call complete()");
                                            //this.infiniteScrollRef.enable(true);
                                            this.infiniteScrollRef.complete();
                                        }else{
                                            console.log("What can I do here... humm?");
                                        } 
                                        return;
                                    }else{ //update information if necessary
                                            //console.log("update transactions status");
                                            var tr:any={};
                                            tr=transactions[i];
                                            tr.type=this.convertType(tr.transactionType);
                                            if(tr.transactionType=='refund'){
                                                tr.accountMask=this.maskAccount(tr.account);
                                            }
                                            if(tr.confirm==1){
                                                // convert GMT time into local time
                                                var trTime:Date=moment.utc(tr.transactionTime).toDate();
                                                var mm = trTime.getMonth() < 9 ? "0" + (trTime.getMonth() + 1) : (trTime.getMonth() + 1); // getMonth() is zero-based
                                                var dd  = trTime.getDate() < 10 ? "0" + trTime.getDate() : trTime.getDate();
                                                var dString=trTime.getFullYear()+'-'+(mm)+'-'+dd;
                                                tr.date=dString;
                                            }else{
                                                tr.date=tr.transactionTime.substr(0,10);
                                            }
                                            tr.hide=true; //default value 
                                            //console.log("tr:"+JSON.stringify(tr));
                                            this.transactions[i]=tr;
                                    }
                                }
                        }
                });
            },(err)=>{
                if(err=="NetworkFailure"){
                    let alert = this.alertController.create({
                        title: '서버와 통신에 문제가 있습니다',
                        subTitle: '네트웍상태를 확인해 주시기바랍니다',
                        buttons: ['OK']
                    });
                    alert.present();
                }else{
                    let alert = this.alertController.create({
                        title: '캐쉬 내역을 가져오지 못했습니다.',
                        buttons: ['OK']
                    });
                    alert.present();
                }
            });
       }
    /*
    this.getTransactions(-1).then((res:any)=>{
                this.ngZone.run(()=>{
                        //console.log("res:"+JSON.stringify(res));
                        if(res.cashList=="0"){
                            console.log("res:"+JSON.stringify(res));
                            this.infiniteScroll=false;
                            if(this.infiniteScrollRef!=undefined){
                                this.infiniteScrollRef.enable(false);
                            }
                        }else{
                            this.transactions=[];
                            this.updateTransaction(res.cashList);
                            this.checkDepositInLatestCashlist(res.cashList);
                            if(this.infiniteScrollRef!=undefined){
                                console.log("call complete()");
                                this.infiniteScrollRef.complete();
                            }else{
                                console.log("What can I do here... humm?");
                            } 
                        }
                });
            },(err)=>{
                if(err=="NetworkFailure"){
                    let alert = this.alertController.create({
                        title: '서버와 통신에 문제가 있습니다',
                        subTitle: '네트웍상태를 확인해 주시기바랍니다',
                        buttons: ['OK']
                    });
                    alert.present();
                }else{
                    let alert = this.alertController.create({
                        title: '캐쉬 내역을 가져오지 못했습니다.',
                        buttons: ['OK']
                    });
                    alert.present();
                }
            });
  */          
  }

  depositBankType(depositBank){
      console.log("depositBank is "+JSON.stringify(depositBank));
      if(depositBank!="0"){
          var i;
          for(i=0;i<this.storageProvider.banklist.length;i++){
                if(this.storageProvider.banklist[i].value==depositBank){
                    break;
                }
          }
          console.log("bank name:"+this.storageProvider.banklist[i].name);
          this.storageProvider.depositBranch=undefined;
          this.storageProvider.depositBranchInput=undefined;
          this.app.getRootNav().push(BankBranchPage,{bankName:this.storageProvider.banklist[i].name,
                                                     bankCode:this.storageProvider.banklist[i].value});
      }else{
          console.log("depositBranch is codeInput");
          this.storageProvider.depositBranch='codeInput';
          this.storageProvider.depositBranchInput=undefined;
      }
  }

  depositBranchType(depositBranch){
    console.log("depositBranch is"+depositBranch);
  }

  toggleSelectInput(type){
        if(type=='depositBankTypeSelect'){
            this.storageProvider.depositBank=undefined;
            this.storageProvider.depositBranch=undefined;
        }else if(type=='depositBranchTypeSelect'){
            if(this.storageProvider.depositBank!='0' && this.storageProvider.depositBank.length>0){
                var i;
                for(i=0;i<this.storageProvider.banklist.length;i++){
                        if(this.storageProvider.banklist[i].value==this.storageProvider.depositBank){
                            break;
                        }
                }
                this.app.getRootNav().push(BankBranchPage,{bankName:this.storageProvider.banklist[i].name,
                                                            bankCode:this.storageProvider.banklist[i].value});
            }else{
                    let alert = this.alertController.create({
                        title: '은행을 선택해주시기 바랍니다.',
                        buttons: ['OK']
                    });
                    alert.present();
            }
        }
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
      this.serverProvider.post(this.storageProvider.serverAddress+"/registRefundAccount",body).then((res:any)=>{
          console.log("registRefundAccount res:"+JSON.stringify(res));
          if(res.result=="success"){
              // store info into local storage and convert button from registration into modification
              var encryptedBank:string=this.storageProvider.encryptValue('refundBank',this.refundBank);
              this.storage.set('refundBank',encodeURI(encryptedBank));
              var encrypted:string=this.storageProvider.encryptValue('refundAccount',this.refundAccount.trim());
              this.storage.set('refundAccount',encodeURI(encrypted));
              this.verifiedBank=this.refundBank;
              this.verifiedAccount=this.refundAccount.trim();
              this.refundAccountMask=this.maskAccount(this.refundAccount); 
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
      this.refundAccountMask=this.maskAccount(this.refundAccount); 
  }

  checkWithrawFee(){
        return new Promise((resolve,reject)=>{

      let body = JSON.stringify({bankCode:this.refundBank,
                                cashId:this.storageProvider.cashId});
            this.serverProvider.post(this.storageProvider.serverAddress+"/checkRefundCount",body).then((res:any)=>{
                console.log("checkRefundCount res: "+JSON.stringify(res));
                if(res.result=="success")
                    resolve(res.fee);
                else if(res.result=="failure")
                    reject(res.error);
            },(err)=>{
                reject(err);
            });
        });
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

      this.checkWithrawFee().then((res:number)=>{
          console.log("checkWithdrawFee:"+res);
          if(res==0){
              this.refundFee=0;
              this.doWithraw();
          }else{
               let confirm = this.alertCtrl.create({
                    title: res+'원의 수수료가 차감됩니다.',
                    message: '환불을 진행하시겠습니까?',
                    buttons: [
                        {
                            text: '아니오',
                            handler: () => {
                                console.log('Disagree clicked');
                                this.refundFee=undefined;
                                return;
                            }
                        },
                        {
                            text: '네',
                            handler: () => {
                                this.refundFee=res;
                                this.doWithraw();
                            }
                        }]
                    });
               confirm.present();
          }
      },(err)=>{
          if(err=="NetworkFailure"){
                        let alert = this.alertController.create({
                            title: "서버와 통신에 문제가 있습니다.",
                            buttons: ['OK']
                        });
                        alert.present();
            }else if(err="checkWithrawFee"){
                let alert = this.alertController.create({
                        title: "환불이 불가능합니다.",
                        subTitle: "환불금액이 수수료보다 적습니다.",
                        buttons: ['OK']
                    });
                        alert.present();
            }else{
                let alert = this.alertController.create({
                        title: "환불에 실패했습니다.",
                        subTitle: "잠시후 다시 시도 바랍니다.",
                        buttons: ['OK']
                    });
                        alert.present();
            }
      }); 
  }

  doWithraw(){
        //look for refund bankName. hum... I am so lazy.
        var refundBankName;
        for(var i=0;i<this.storageProvider.banklist.length;i++){
            if(this.storageProvider.banklist[i].value==this.refundBank){
                refundBankName=this.storageProvider.banklist[i].name;
            }
        }
        let body = JSON.stringify({depositorName:this.storageProvider.name,
                                bankCode:this.refundBank ,
                                bankName:refundBankName,
                                account:this.refundAccount.trim(),
                                cashId:this.storageProvider.cashId,
                                withdrawalAmount:this.refundAmount,
                                fee:this.refundFee});
      console.log("refundCash:"+body);                          
      this.serverProvider.post(this.storageProvider.serverAddress+"/refundCash",body).then((res:any)=>{
          console.log("refundCash res:"+JSON.stringify(res));
          if(res.result=="success"){
              //console.log("cashAmount:"+res.cashAmount);
              this.serverProvider.updateCashAvailable().then((res)=>{
                  //do nothing;
                  this.storageProvider.cashInfoUpdateEmitter.emit("all");
               },(err)=>{
                    if(err=="NetworkFailure"){
                                    let alert = this.alertController.create({
                                        title: "서버와 통신에 문제가 있습니다.",
                                        buttons: ['OK']
                                    });
                                    alert.present();
                        }else{
                        let alert = this.alertController.create({
                                title: "캐쉬정보를 가져오지 못했습니다.",
                                buttons: ['OK']
                            });
                                alert.present();
                        }
              });
               let alert = this.alertController.create({
                    title: '환불요청에 성공했습니다.',
                    buttons: ['OK']
                });
                alert.present();
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
                     let alert = this.alertController.create({
                            title: '서버응답에 문제가 있습니다.',
                            buttons: ['OK']
                        });
                        alert.present();
                 } 
      });
  }

  copyAccountInfo(){
    var account = "3012424363621";

    cordova.plugins.clipboard.copy(account);
    let alert = this.alertController.create({
        title: "클립보드로 계좌번호가 복사되었습니다.",
        buttons: ['OK']
    });
    alert.present();

  }

  toggleTransaction(tr){
      tr.hide=!tr.hide;
  }
}

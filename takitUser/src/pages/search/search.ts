import {Component,ViewChild} from '@angular/core';
import {NavController,Platform,Tabs,AlertController,Content} from 'ionic-angular';
//import {Camera} from 'ionic-native';
import {Transfer,Splashscreen} from 'ionic-native';
import {Http,Headers} from '@angular/http';
import 'rxjs/add/operator/map';
import {ConfigProvider} from '../../providers/ConfigProvider';
import {ShopTabsPage} from '../shoptabs/shoptabs';
import {App} from 'ionic-angular';
import {Device} from 'ionic-native';
import {StorageProvider} from '../../providers/storageProvider';
import {ServerProvider} from '../../providers/serverProvider';

//reference=> https://github.com/dtaalbers/ionic-2-examples/tree/master/file-transfer-upload 
//Please refer to http://www.codingandclimbing.co.uk/blog/ionic-2-filter-an-array-by-a-property-value-21

//import {ElementRef, ViewChild} from '@angular/core';

@Component({
  selector:'page-search',
  templateUrl: 'search.html'
})
export class SearchPage {

  private loading:any;
  inputType:string='keypad';
  serviceQuery: string = '';
  servicesShown=[];
  services=[];

  brandQuery: string='';
  brandsShown=[];
  brands=[];

  takitIds=[];

  minVersion:boolean=(this.platform.is('android') && parseInt(Device.device.version[0])<=4);

  constructor(private app:App, public storageProvider:StorageProvider, private navController: NavController,
    private platform:Platform,private http:Http ,private alertController:AlertController,private serverProvider:ServerProvider) {
      console.log("SearchPage constructor");
      console.log("this.platform.is('android'):"+this.platform.is('android'));
  }

  ionViewDidEnter(){
    console.log("SearchPage did enter");
    Splashscreen.hide();
  }

  keypad(){
     console.log("keypad");  
     /* move focus into input to show keypad up */
  }

  camera(){
      this.inputType="keypad";
      let alert = this.alertController.create({
                    title: '현재 문자인식은 지원되지 않습니다. 곧 지원될 예정입니다.',
                    buttons: ['OK']
                    });
                    alert.present();
/*      
      console.log("camera");
      
      let options={ 
                    quality: 100,
                    destinationType: Camera.DestinationType.FILE_URI,
                    sourceType: Camera.PictureSourceType.CAMERA,
                    allowEdit: false, //What is it? 
                    encodingType: Camera.EncodingType.JPEG,
                    //targetWidth: 300,
                    //targetHeight: 300,
                    //popoverOptions: CameraPopoverOptions,
                    saveToPhotoAlbum: false
                  };
 
       Camera.getPicture(options).then((imageURI) => {
          console.log("imageURI:"+imageURI);
          this.fileTransfer(imageURI);
       }, (err) => {
           console.log("err:"+JSON.stringify(err));
       });
  */     
  }

  onProgress(progressEvent: ProgressEvent){
      let progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
      console.log("progress:"+progress);
      if(progress==100){
          
      }
  }

  gallery(){
      this.inputType="keypad";
      let alert = this.alertController.create({
                    title: '현재 문자인식은 지원되지 않습니다. 곧 지원될 예정입니다.',
                    buttons: ['OK']
                    });
                    alert.present();
/*      
      console.log("gallery");
      console.log("this.platform.is('android'):"+this.platform.is('android'));

      let options = {
          destinationType   : Camera.DestinationType.FILE_URI,
          sourceType        : Camera.PictureSourceType.PHOTOLIBRARY
      };
      Camera.getPicture(options).then((imageURI) => {
          console.log("imageURI:"+imageURI); 
          this.fileTransfer(imageURI);
       }, (err) => {
           console.log("err:"+JSON.stringify(err)); 
       });        
*/        
  }

  fileTransfer(imageURI){
      let ft = new Transfer();
          var filename= imageURI.substr(imageURI.lastIndexOf('/') + 1); 
          if(!filename.endsWith('.jpg')){
		    filename=filename+".jpg";
	      } 
          console.log("filename:"+filename);
          let options = {
            fileKey: 'file',
            fileName: filename,
            mimeType: 'image/jpeg',
            params: {
                fileName: filename
            }
          }; 

          ft.onProgress(this.onProgress);
          /////////////////////////////////
          this.loading=this.alertController.create({
                title:"사진을 업로드하고 있습니다"//,
                //duration: 100000, // max 100 seconds => Please call timeout!!! 
                //dismissOnPageChange: true
              });
          this.loading.present();
          
          /////////////////////////////////
          ft.upload(imageURI, ConfigProvider.serverAddress+"/ocrFileSubmit", options, false)
          .then((response: any) => {
            console.log("upload:"+JSON.stringify(response));
            var result=JSON.parse(response.response);
            console.log("result.result:"+result.result);
            if(result.result=="takitIdFound"){
                console.log('takitId:'+result.takitId);
                let splits=result.takitId.split("@");
                this.serviceQuery= splits[0];
                this.brandQuery=splits[1];
                // Add filename,s3key,takitId into DB
            }
            this.loading.dismiss();
          }).catch((error: any) => {
            console.log("upload fail");
            this.loading.dismiss();
          }); 
  }

    getTakitIds(){
        console.log("getTakitIds");
        return new Promise((resolve,reject)=>{
            console.log("call Promise");
            var body;
            if(this.brandQuery.length==0 && this.serviceQuery.length>0 && this.serviceQuery.trim()!=''){
                 body={servicename:this.serviceQuery.trim().toUpperCase()};
            }
            else if(this.serviceQuery.length==0 && this.brandQuery.length>0 && this.brandQuery.trim()!=''){
                 body={shopname:this.brandQuery.trim().toUpperCase()};
            }else{
                 body={servicename:this.serviceQuery.trim().toUpperCase(),shopname:this.brandQuery.trim().toUpperCase()};
            }
            console.log("body:"+JSON.stringify(body));
            let headers = new Headers();
            headers.append('Content-Type', 'application/json');
            //this.http.post(ConfigProvider.serverAddress+"/takitIdAutocomplete",JSON.stringify(body),{headers: headers}).map(response=>response.json()).subscribe((res)=>{
            this.serverProvider.post(ConfigProvider.serverAddress+"/takitIdAutocomplete",JSON.stringify(body)).then((res:any)=>{
                console.log("res:"+JSON.stringify(res));
                    this.takitIds=res;
                    this.services=[];
                    this.brands=[];
                    this.takitIds.forEach((takitId)=>{ 
                        console.log("takitId:"+takitId);
                        let splits=takitId.split("@");
                        let service=splits[0];
                        let brand=splits[1];

                        if(this.services.indexOf(service)<0){
                            this.services.push(service);
                        }
                        if(this.brands.indexOf(brand)<0){
                            this.brands.push(brand);
                        }
                    });
                    resolve();
            },(err)=>{
              console.log("takitIdAutocomplete err "+err);
              if(err=="NetworkFailure"){
                let alert = this.alertController.create({
                    title: '서버와 통신에 문제가 있습니다',
                    subTitle: '네트웍상태를 확인해 주시기바랍니다',
                    buttons: ['OK']
                    });
                    alert.present();
              }
              reject(err);
            })
        });
    }

      showBrand(){
                if(this.serviceQuery.trim()!=''){
                    this.brandsShown=[]; 
                    let takitIds=[];
                    takitIds=this.takitIds.filter((v)=>{
                        if (v.toUpperCase().startsWith(this.serviceQuery.toUpperCase()+"@")) {
                            return true;
                        }
                        return false;
                    });

                    takitIds.forEach((takitId)=>{ 
                        let splits=takitId.split("@");
                        if(this.brandsShown.indexOf(splits[1])<0){
                            this.brandsShown.push(splits[1]);
                        }
                    });
                }else{ // this.brandQuery is ""
                    this.brandsShown = this.brands;
                }
                if(this.brands.length>0){
                    this.brandsShown = this.brands.filter((v) => {
                        if (v.toUpperCase().startsWith(this.brandQuery.toUpperCase())) {
                            return true;
                        }
                        return false;
                    });
                }else{
                    this.brandsShown = [];
                }
      }

      getBrands(event) {
            console.log("brandQuery:"+this.brandQuery+"("+event.target.value+") event.type:"+event.type+ " takitIds.length:"+this.takitIds.length);

            /*if(event.target.value!=this.brandQuery){
                this.brandQuery=event.target.value;
                console.log("fix this.brandQuery");
                return;
            }*/

            if (this.brandQuery.trim().length == 0 && this.serviceQuery.trim().length==0) {
                this.takitIds=[];
                this.services=[];
                this.brands=[];
                this.servicesShown=[];
                this.brandsShown=[];
                return;
            }else if(this.brandQuery.trim().length==0 && this.serviceQuery.trim().length>0){ // Cancel may comes
                this.takitIds=[];
                this.getTakitIds().then(
                    ()=>{
                        console.log("TakitIds:"+JSON.stringify(this.takitIds));
                        console.log("services:"+JSON.stringify(this.services));
                        console.log("brands:"+JSON.stringify(this.brands));
                        this.showBrand();
                    },err=>{
                        console.log("getTakitIds error");
                    });
            } else if(this.takitIds.length==0 && (this.brandQuery.trim().length==1)){
                this.getTakitIds().then(
                    ()=>{
                        console.log("TakitIds:"+JSON.stringify(this.takitIds));
                        console.log("services:"+JSON.stringify(this.services));
                        console.log("brands:"+JSON.stringify(this.brands));
                        this.showBrand();
                    },err=>{
                        console.log("getTakitIds error");
                    });
            }else{
                //how to remove duplicated event?
                this.showBrand();
            }
      }

      showService(){
                if(this.brandQuery.trim()!=''){
                    this.servicesShown=[]; 
                    let takitIds=[];
                    takitIds=this.takitIds.filter((v)=>{
                        if (v.toUpperCase().endsWith("@"+this.brandQuery.toUpperCase())) {
                            return true;
                        }
                        return false;
                    });

                    takitIds.forEach((takitId)=>{ 
                        let splits=takitId.split("@");
                        if(this.servicesShown.indexOf(splits[0])<0){
                            this.servicesShown.push(splits[0]);
                        }
                    });
                }else{ // this.brandQuery is ""
                    this.servicesShown = this.services;
                }
                if(this.services.length>0){
                    this.servicesShown = this.services.filter((v) => {
                        console.log(v+"start with "+this.serviceQuery);
                        if (v.toUpperCase().startsWith(this.serviceQuery.toUpperCase())) {
                            return true;
                        }
                        return false;
                    });
                }else{
                    this.servicesShown=[];                    
                }
                console.log("serviceShown:"+JSON.stringify(this.servicesShown));
      }

      getServices(event) {
            console.log("serviceQuery:"+this.serviceQuery+"("+event.target.value+") event.type:"+event.type);
            /*
            if(this.serviceQuery!=event.target.value){
                this.serviceQuery=event.target.value;
                console.log("fix this.serviceQuery");
                return;
            }*/
            if (this.brandQuery.trim().length == 0 && this.serviceQuery.trim().length==0) {
                this.takitIds=[];
                this.services=[];
                this.brands=[];
                this.servicesShown=[];
                this.brandsShown=[];
                return;
            }else if(this.serviceQuery.trim().length==0 && this.brandQuery.trim().length>0){ // Cancel may comes
                this.takitIds=[];
                this.getTakitIds().then(
                    ()=>{
                        console.log("TakitIds:"+JSON.stringify(this.takitIds));
                        console.log("services:"+JSON.stringify(this.services));
                        console.log("brands:"+JSON.stringify(this.brands));
                        this.showService();
                    },err=>{
                        console.log("getTakitIds error");
                    });
            }else if(this.takitIds.length==0 && (this.serviceQuery.trim().length==1 )){
                this.getTakitIds().then(
                    ()=>{
                        console.log("TakitIds:"+JSON.stringify(this.takitIds));
                        console.log("services:"+JSON.stringify(this.services));
                        console.log("brands:"+JSON.stringify(this.brands));
                        this.showService();
                    },err=>{
                        console.log("getTakitIds error");
                    });
            }else{
                this.showService();
            }
      }

      selectTakitService(service){
          console.log(service+" service selected");
          this.serviceQuery=service;
          this.servicesShown=[];
          // configure this.brandQuery and this.brandsShown
          this.brandsShown=[];
          this.takitIds.forEach((takitId)=>{ 
                        let splits=takitId.split("@");
                        if(takitId.startsWith(service+"@")){
                            this.brandsShown.push(splits[1]);
                        }
          });
          if(this.brandsShown.length==1){
              this.brandQuery=this.brandsShown[0];
              this.brandsShown=[];
          }
      }

      selectTakitBrand(brand){
          console.log(brand+" brand selected");
          this.brandQuery=brand;
          this.brandsShown=[];
          // configure this.serviceQuery and this.servicesShown
          this.servicesShown=[];
          this.takitIds.forEach((takitId)=>{ 
                        let splits=takitId.split("@");
                        if(takitId.endsWith("@"+brand)){
                            this.servicesShown.push(splits[0]);
                        }
          });
          if(this.servicesShown.length==1){
              this.serviceQuery=this.servicesShown[0];
              this.servicesShown=[];
          }
      }

      goToShop(){
          console.log("[goToShop]  "+this.serviceQuery.trim()+"@"+this.brandQuery.trim());
          if(this.serviceQuery.trim().length>0 &&this.brandQuery.trim().length>0){
                console.log("call getShopInfo");
                this.serverProvider.getShopInfo(this.serviceQuery.trim()+"@"+this.brandQuery.trim()).then((res)=>{
                    console.log("getShopInfo success");
                    this.storageProvider.shopResponse=res;
                    this.app.getRootNav().push(ShopTabsPage,{takitId:this.serviceQuery.trim()+"@"+this.brandQuery.trim()}); 
                },(err)=>{

                });
          }
      }

      brandClear(event){
          console.log("brandClear");
      }

      serviceClear(event){
          console.log("serviceClear");
      }

      getFocusServices(event){
          console.log("getFocusServices");
      }
      getFocusBrands(event){
          console.log("getFocusBrandss");
      }

      swipeSearch(event){
        //DIRECTION_LEFT = 2
        //DIRECTION_RIGHT = 4
        console.log("event.direction:"+event.direction);
        if(event.direction==2){
            var t: Tabs = this.navController.parent;
            t.select(2);
        }else if(event.direction==4){
            var t: Tabs = this.navController.parent;
            t.select(0);
        }
    }
}



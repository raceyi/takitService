import {Component,ViewChild} from "@angular/core";
import {App, MenuController,Platform,NavController,NavParams,Tabs,Content} from 'ionic-angular';
import {Splashscreen,Transfer,File} from 'ionic-native';

import {StorageProvider} from '../../providers/storageProvider';
import {ServerProvider} from '../../providers/serverProvider';

import {Http} from '@angular/http';
import 'rxjs/add/operator/map';

//import {Gesture} from 'ionic-angular/gestures/gesture'; //available gestures: "doubletap","tap","rotate",???

import {ShopTabsPage} from '../shoptabs/shoptabs';
import {Device} from 'ionic-native';

declare var moment:any;
declare var cordova:any;
declare var ImageResizer:any;

@Component({
   selector: 'page-home',  
  templateUrl: 'home.html',
})

export class HomePage{
   // @ViewChild("homeContent") contentRef: Content;

     filename: string = '';

     constructor(private platform:Platform,private navController: NavController, private navParams: NavParams,
        private app: App, menu:MenuController,public storageProvider:StorageProvider,
        private http:Http,private serverProvider:ServerProvider){
         console.log("homePage constructor screen:"+ window.screen.availWidth+" "+window.screen.width+" "+window.screen.availHeight+ " "+window.screen.height);
         console.log("cordova.file.dataDirectory:"+cordova.file.dataDirectory);
     }

     ionViewDidEnter(){
        console.log("HomePage did enter");
        Splashscreen.hide();
       /*
            let dimensions=this.contentRef.getContentDimensions();
            let height=this.contentRef.getNativeElement().parentElement.offsetHeight-dimensions.contentTop;
            console.log("pageHeight:"+this.contentRef.getNativeElement().parentElement.offsetHeight+"top:"+dimensions.contentTop+"menusHeight:"+height);
            this.contentRef.getScrollElement().setAttribute("style","height:"+height+"px;margin-top:0px;");
        */    
    }

     ionViewWillEnter(){
         console.log("homePage-ionViewWillEnter");
         console.log("home-shoplist:"+JSON.stringify(this.storageProvider.shoplist));
         /*
         if(this.storageProvider.shoplist==null || this.storageProvider.shoplist.length==0){
             //move into search page
             console.log("move into search page");
             var t: Tabs = this.navController.parent;
             t.select(1);
         }
         */
     }

     loadShopInfo(takitId){
         return new Promise((resolve,reject)=>{
                var queryString='SELECT * FROM shoplist where takitId=?';
                console.log("queryString:"+queryString);
                this.storageProvider.db.executeSql(queryString,[takitId]).then((resp)=>{ // What is the type of resp? 
                    console.log("query result:"+JSON.stringify(resp));
                    var param=resp;
                    if(resp.res.rows.length==1){ 
                        param.item=resp.res.rows.item(0);
                    }
                    resolve(JSON.stringify(param));
                },(error)=>{
                    console.log("loadShopInfo query err");
                    //console.log(JSON.stringify(error));
                    reject();
                });
         });
     }

    insertShop(takitId,s3key,filenamefullpath){
         var filename=filenamefullpath.substr(cordova.file.dataDirectory.length);
         var queryString="INSERT INTO shoplist (takitId, s3key,filename) VALUES (?,?,?)";
         console.log("queryString:"+queryString);
         this.storageProvider.db.executeSql.query(queryString,[takitId,s3key,filename]).then((resp)=>{
             console.log("resp:"+JSON.stringify(resp));
         },(error)=>{
             console.log("shop insert error");
             //console.log(JSON.stringify(error));
         });
    }

    updateShop(takitId,s3key,filenamefullpath){
        var filename=filenamefullpath.substr(cordova.file.dataDirectory.length);
         return new Promise((resolve,reject)=>{
            var queryString="UPDATE shoplist SET filename=?, s3key=? WHERE takitId=?";
            console.log("queryString:"+queryString);
            this.storageProvider.db.executeSql.query(queryString,[filename,s3key,takitId]).then((resp)=>{
                console.log("resp:"+JSON.stringify(resp));
                resolve(resp);
            },(error)=>{
                console.log("shop update error");
                //console.log(JSON.stringify(error));
                reject(error);
            });
         });
    }

    fileDownload(takitId,s3uri,foldername,filename){
        return new Promise((resolve,reject)=>{
            var ft = new Transfer();
            var uri = encodeURI(s3uri);

            console.log("call Transfer.download s3uri:"+s3uri+" filename:"+filename);

            ft.download(
                uri,
                foldername+filename,
                false).then((result:any)=>{
                   console.log("result:"+JSON.stringify(result));
                   var dirname=moment().format("YYYY-MM-DD-HH-mm-ss-SSS")+'/';
                   var options ={
                    uri: foldername+filename,
                    folderName:foldername+dirname,
                    quality: this.storageProvider.homeJpegQuality,
                    width:480,
                    height:160};
                    //width:window.innerWidth,// 200,
                    //height:window.innerHeight/5};

                   ImageResizer.resize(options, // Any other plugins? or please change plugin.
                     function(image){
                            console.log("resize: success "+image);
                            console.log("length:"+ cordova.file.dataDirectory.length); 
                            console.log("result:"+JSON.stringify(result));

                            var idx=image.lastIndexOf('/');
                            var reduceddirname=image.substring(0,idx);
                            var reducedfilename=image.substr(idx+1);
                            console.log("reduceddirname:"+reduceddirname +" reducedfilename:"+reducedfilename);

                            File.removeFile(cordova.file.dataDirectory,filename) // Humm... how about iphone? Please check platform and directory
                                .then(result=>{
                                            console.log("removeFile("+filename+") success reducedfilename:"+reducedfilename);
                                            console.log("prevdir:"+foldername+dirname+"prevfile:"+reducedfilename+" nextdir:"+foldername+"next filename:"+filename);
                                            File.moveFile(reduceddirname/*foldername+dirname*/,reducedfilename,foldername,filename) // Humm... how about iphone? Please check platform and directory 
                                                .then(result=>{
                                                        console.log("moveFile success:"+filename);
                                                        resolve(foldername+filename);
                                                        File.removeDir(foldername, dirname)
                                                        .then(result=>{
                                                            console.log("remove "+dirname);
                                                        },err=>{
                                                            console.log("removeDir error:"+JSON.stringify(err));
                                                        });
                                                    },err=>{
                                                        console.log("moveFile err:"+JSON.stringify(err)+" "+filename);
                                                        reject({reason:"moveFile",error:err});
                                                    });
                                            
                                        },err=>{
                                            console.log("removeFile err:"+JSON.stringify(err));
                                            reject({reason:"removeFile",error:err});
                                        }); 
                     },function(){
                         console.log("resize: false");
                         reject({reason:"resize"});
                     });
                }).catch((error:any)=>{
                    console.log("error:"+JSON.stringify(error));
                    reject({reason:"download",error:error}); 
                });
            });
    }

    removeSelected(takitId){
        console.log("removeSelected:"+takitId);
    }

    getSelected(takitId){
         console.log("getSelected:"+takitId);
         this.serverProvider.getShopInfo(takitId).then((res)=>{
              this.storageProvider.shopResponse=res;
              this.app.getRootNav().push(ShopTabsPage,{takitId:takitId}); 
         },(err)=>{

         });
    }    
}



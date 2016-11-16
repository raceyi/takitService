import {Component} from "@angular/core";
import {NavController,NavParams,AlertController} from 'ionic-angular';
import{ShopTablePage} from '../shoptable/shoptable';
import {Splashscreen} from 'ionic-native';

import {StorageProvider} from '../../providers/storageProvider';
declare var BTPrinter:any;

@Component({
  selector: 'page-printer',
  templateUrl: 'printer.html',
})

export class PrinterPage {
    printer:string;
    printerlist=[];
    printerStatus;

  constructor(private navController: NavController, private navParams: NavParams,
                private storageProvider:StorageProvider,private alertController:AlertController){
           console.log("PrinterPage construtor");
  }

   ionViewDidEnter(){
        console.log("SelectorPage did enter");
        Splashscreen.hide();
  }

  selectPrinter(printer){
      console.log("printer:"+printer);
  }
 
  scanPrinter(){
      console.log("scanPrinter");
      BTPrinter.list((data)=>{
        console.log("Success");
        console.log(data); //list of printer in data array
        this.printerlist=[];
        
        var printers=JSON.parse(data); 
        for(var i=0;i<printers.length;i++){
            console.log("printer("+i+") "+ printers[i]+"\n");
            this.printerlist.push(JSON.parse(printers[i]));
        }
        if(this.printerlist.length==1){
            this.printer=this.printerlist[0].name;
        }
    },(err)=>{
        console.log("Error");
        //console.log(err);
        let alert = this.alertController.create({
                    title: '프린터가 검색되지 않았습니다.',
                    subTitle: '네트워크->블루투스 설정에서 장치를 검색후 등록하여 주시기바랍니다',
                    buttons: ['OK']
                });
                alert.present();
    })
  }

  testPrinter(){
    if(this.printerStatus=="connected"){
                BTPrinter.printText((data)=>{
                    console.log("print Success");
                    console.log(data)
                },(err)=>{
                    console.log("Error");
                    console.log(err)
                }, "Hello\n\n\n\n\n\n\n");
      }
  }

  connectPrinter(){
      if(this.printerStatus!="connected"){
            BTPrinter.connect((data)=>{
                console.log("Connect Status:"+data);
                this.printerStatus=data;
                if(data=="lost"){
                    let alert = this.alertController.create({
                        title: '프린터에 연결할수 없습니다.',
                        subTitle: '네트워크->블루투스 설정에서 등록된 장치를 삭제후 다시 검색하여 등록해 주시기바랍니다',
                        buttons: ['OK']
                    });
                    alert.present();

                }else if(data=="unable"){
                    let alert = this.alertController.create({
                        title: '프린터에 연결할수 없습니다.',
                        subTitle: '프린터를 상태를 확인해 주시기바랍니다',
                        buttons: ['OK']
                    });
                    alert.present();
                }else{

                }
            },(err)=>{
                console.log("fail to connect");
                    let alert = this.alertController.create({
                        title: '프린터에 연결할수 없습니다.',
                        subTitle: '프린터를 상태를 확인해 주시기바랍니다',
                        buttons: ['OK']
                    });
                    alert.present();
            },this.printer);
      }
  }

  disconnectPrinter(){
      if(this.printerStatus=="connected"){
            BTPrinter.disconnect((data)=>{
                console.log("disconnect Success");
                console.log(data);
                let alert = this.alertController.create({
                    title: '프린터 연결을 해제했습니다.',
                    buttons: ['OK']
                });
                alert.present();
            },(err)=>{
                console.log("Error:"+err);
                let alert = this.alertController.create({
                    title: '프린터 연결 해제에 실패했습니다.',
                    buttons: ['OK']
                });
                alert.present();

            })
      }
  }
}

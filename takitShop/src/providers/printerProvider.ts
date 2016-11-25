import {Injectable,EventEmitter} from '@angular/core';
import {Platform} from 'ionic-angular';
declare var BTPrinter:any;

@Injectable()
export class PrinterProvider{
    printer:string;
    printerStatus;  
    public messageEmitter= new EventEmitter();

    constructor(){
        console.log("printerProvider constructor"); 
    }

    scanPrinter(){
        return new Promise((resolve,reject)=>{
            console.log("scanPrinter");
            BTPrinter.list((data)=>{
                console.log("Success");
                console.log(data); //list of printer in data array
                var printerlist=[];
                
                var printers=JSON.parse(data); 
                for(var i=0;i<printers.length;i++){
                    console.log("printer("+i+") "+ printers[i]+"\n");
                    var printer=JSON.parse(printers[i]);
                    printerlist.push(printer.name);
                }
                if(printerlist.length==1){
                    this.printer=printerlist[0];
                }
                console.log("printerlist:"+JSON.stringify(printerlist));
                resolve(printerlist);
            },(err)=>{
                console.log("Error");
                this.printer=undefined;
                this.printerStatus=undefined;
                reject(err);
                //console.log(err);
            });
        });
    }


    connectPrinter(){
         return new Promise((resolve,reject)=>{
            if(this.printerStatus!="connected"){
                    BTPrinter.connect((data)=>{
                        console.log("Connect Status:"+data);
                        this.printerStatus=data;
                        this.messageEmitter.emit(this.printerStatus);
                        resolve(this.printerStatus);
                    },(err)=>{
                        console.log("fail to connect");
                        this.printerStatus=undefined;
                        reject(err);
                    },this.printer);
            }
         });
  }

  disconnectPrinter(){
         return new Promise((resolve,reject)=>{
            if(this.printerStatus=="connected"){
                    BTPrinter.disconnect((data)=>{
                        console.log("disconnect Success");
                        console.log(data);
                        this.printerStatus=data;
                        resolve(this.printerStatus);
                    },(err)=>{
                        console.log("Error:"+err);
                        this.printerStatus=undefined;
                        reject(err);
                    })
            }
         });
  }

    print(title,message){
         return new Promise((resolve,reject)=>{
            if(this.printerStatus=="connected"){
                BTPrinter.printText((data)=>{
                    console.log("print Success");
                    console.log(data);
                    resolve();
                },(err)=>{
                    console.log("Error");
                    //console.log(err);
                    reject(err);
                }, title+','+message+"\n\n\n\n ************"); // format: title, message
            }
         });
  }

}



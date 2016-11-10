import {Directive, Input, Renderer, EventEmitter,ElementRef} from '@angular/core';
import {Platform} from 'ionic-angular';
declare var cordova:any;
/*
  Generated class for the Focuser directive.

  See https://angular.io/docs/ts/latest/api/core/index/DirectiveMetadata-class.html
  for more info on Angular 2 Directives.
*/
@Directive({
  selector: '[focuser]' // Attribute selector
})

export class Focuser {
   private focusEmitterSubscription; 
  constructor(private platform:Platform, private renderer:Renderer,private elementRef:ElementRef) {
    console.log('Hello Focuser Directive');
  }

 @Input('focuser')
    set focuser(focusEmitter: EventEmitter<boolean>) {
        console.log("set focuser");
        if(this.focusEmitterSubscription) {
            console.log("unsubscribe");
            this.focusEmitterSubscription.unsubscribe();
        }
        console.log("subscribe");
        this.focusEmitterSubscription = focusEmitter.subscribe(
            ((value)=> {
            console.log("event comes "+value); 
            const element = this.elementRef.nativeElement.querySelector('input');
            // we need to delay our call in order to work with ionic ...
            // should I give more delay rather than 0?
              if(!this.platform.is("cordova")){
                  element.focus();
              }else if(this.platform.is('android')){
                  console.log("call cordova.plugins.Focus.focus ");
                  setTimeout(() => {
                    cordova.plugins.Focus.focus(element);
                  }, 300); // 300 maybe... Is it enough? please check it.
              }else if(this.platform.is('ios')){ //Please check why keyboard is not shown in ios. Do not use it in ios
                   console.log("ios focus");
                  setTimeout(() => {
                   element.focus();
                  },300);
              }
          }).bind(this))
 }    
}

let express = require('express');
let timezoneJS = require('timezone-js');

let router = express.Router();

router.setDir = function (__dirname) {
    timezoneJS.timezone.zoneFileBasePath = __dirname + '/tz';
    timezoneJS.timezone.init({ async: false });
}

router.getTimezoneLocalTime=function(timezone,time){ // return current local time in timezone area
	console.log("timeInMilliSec:"+time);

	let offset=(new timezoneJS.Date(Date(), timezone)).getTimezoneOffset(); // offset in minutes
	let currlocal= new Date(time.getTime() - (offset*60*1000));
	console.log(currlocal);
    return currlocal;
}

router.computeBusinessTime=function(businessTime,day){
    let tmp={};

    tmp.openHour=parseInt(businessTime[day].substring(0,2));
    tmp.openMin = parseInt(businessTime[day].substring(3,5));
    tmp.closeHour = parseInt(businessTime[day].substring(6,8));
    tmp.closeMin = parseInt(businessTime[day].substring(9,11));

    return tmp;
}

router.setIsTuno=function() {

    let d = new Date();

    //yyyyMMddHHmmssSSS
    let IsTuno = d.getUTCFullYear().toString() +
        pad(d.getUTCMonth() + 1, 2) +
        pad(d.getUTCDate(), 2) +
        pad(d.getUTCHours(), 2) +
        pad(d.getUTCMinutes(), 2) +
        pad(d.getUTCSeconds(), 2) +
        pad(d.getUTCMilliseconds(), 3);

    console.log("IsTuno:" + IsTuno);
    return IsTuno;
}




module.exports = router;

let express = require('express');
let http = require('http').Server(express);
let io = require('socket.io')(http);

let sockets=[];

var AsyncLock = require('async-lock');
var lock = new AsyncLock();

let router = express.Router();

router.notifySocket=function(order){
    //look for index of socket Id.
    //ciritical section-begin
    lock.acquire("sockets", function(){
        printSockets(); 
        for(let i=0;i<sockets.length;i++){
            //console.log("look for socket ("+sockets[i].takitId+") ("+order.takitId+")");
            //console.log(sockets[i].takitId==order.takitId);
            if(sockets[i].takitId==order.takitId){
                sockets[i].emit('order', {order:order}); 
                console.log("!!!!send order info!!!!!!");
            }
        }
    //critical section-end
    });
}

printSockets=function(){
    sockets.forEach(socket=>{
        console.log("takitId:"+socket.takitId);
    });
}

io.on('connection', (socket) => {
  socket.on('disconnect', function(){ //takitId 목록에서 삭제한다.
      //critical section-begin
    lock.acquire("sockets", function(){
      if(socket.takitId && socket.registrationId){
          console.log("disconnect:"+socket.takitId + "registrationId:"+socket.registrationId);
          //remove it in sockets
          let index=sockets.findIndex(function(element){
              return (element.takitId==socket.takitId && element.registrationId==socket.registrationId);
          });
          sockets.splice(index,1);
      }
      //critical section-end
    });
  });

  socket.on('takitId', (data) => {
    console.log("takitId:"+JSON.stringify(data));
    console.log("takitId comes "+data.takitId+" registrationId:"+data.registrationId);
    socket.takitId = data.takitId;
    socket.registrationId=data.registrationId;
    lock.acquire("sockets", function(){
      //critical section-begin
      let index=sockets.findIndex(function(element){
        return (element.takitId==data.takitId && element.registrationId==data.registrationId);
      });
      if(index>=0){
        sockets.splice(index,1);
      }
      sockets.push(socket);
    //critical section-end
    });
  });

});

module.exports = router;

var port = process.env.PORT || 8500;

http.listen(port, function(){
   console.log('listening in http://localhost:' + port);
});


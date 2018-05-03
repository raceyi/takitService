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
        let index=sockets.findIndex(function(element){
            return (element.takitId==order.takitId);
        });
        console.log("index is ...."+index);
        if(index>=0)
            sockets[index].emit('order', {order:order});
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
      if(socket.takitId){
          console.log("disconnect:"+socket.takitId);
          //remove it in sockets
          let index=sockets.findIndex(function(element){
              return (element.takitId==socket.takitId);
          });
          sockets.splice(index,1);
      }
      //critical section-end
    });
  });

  socket.on('takitId', (takitId) => {
    console.log("takitId comes "+takitId);
    socket.takitId = takitId;
    lock.acquire("sockets", function(){
      //critical section-begin
      let index=sockets.findIndex(function(element){
        return (element.takitId==takitId);
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


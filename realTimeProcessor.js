var db = require('./db') ; 
var subFunction = require('./controllers/subFunction') ; 
var md5 = require('md5');
//var cookieParser = require('cookie-parser') ; 
/*const io = require('socket.io')(3000);
const redis = require('socket.io-redis');
io.adapter(redis({ host: 'localhost', port: 6379 }));*/

module.exports = function(io){
    let mapList = [] ; 
    io.on('connection',function(socket){
        socket.on('online',function(userId){
            mapList.push({
                socketId : socket.id,
                customId : userId 
            }) ; 
            console.log(`${userId} connect`, socket.id) ;
            socket.emit('connector',socket.id);
            //socket.emit('errorLogin') ; 
        });
        socket.on('disconnect',function() {
            console.log(`${socket.id} disconnect`) ; 
            for (let i = 0 ; i < mapList.length ; i++){
                if (socket.id === mapList[i].socketId){
                    mapList.splice(i,1) ; 
                }
            }
        });
        // Join item room
        socket.on('joinItemRoom',function(idItemClient){
            socket.join(`${idItemClient}`);
            console.log(socket.id, 'join room' ,idItemClient) ;
        });

        socket.on('checkOut',function(data,idItem,clientId){ 

            let temp = db.get('items').find({idItem}).value() ; 

            var client = mapList.find(function(element){
                return element.customId === client ;
            });
            //check Fill date
            if (!data.dateReceive && clientId) {
                io.to(`${socket.id}`).emit('plsFillDate') ; // Can use socket.emit
                return ; 
            } ;  
            //check amount 0
            if (data.amount === '0' && clientId){
                io.to(`${socket.id}`).emit('amount0') ; 
                return ; 
            }
            //check amount
            if ((data.amount > temp.amount)  && clientId) {
                io.to(`${socket.id}`).emit('soldOut') ; // Can use socket.emit
                return ; 
            } ;  
            //check date 
            let dateR = subFunction.convert(data.dateReceive).getTime() ; 
            let dateI = subFunction.convert(temp.dateItem).getTime() ; 
            if (dateR > dateI){
                socket.emit('errorDate') ; 
                return ; 
            }
            temp.amount -= data.amount
            db.get('items')
                .find({id : idItem})
                .assign({amount : temp.amount})
                .write() ; 
            
            io.in(`${temp.idItem}`).emit('updateNewAmount',temp.idItem,temp.amount);
            let queue = db.get('users').find({id : temp.owner}).value().queue ; 
            data.idItem = idItem ; 
            data.nameItem = temp.nameItem ; 
            data.cost = temp.priceItem * data.amount  ;
            data.status = 'Đang giao' ; 
            queue.push(data) ; 
            db.get('users')
                .find({id : temp.owner})
                .assign({queue})
                .write() ; 
            let seller = mapList.find(function(element){
                return element.customId === temp.owner ;
            });
            io.to(`${socket.id}`).emit('buySucc') ; 
            if (seller){
                io.to(`${seller.socketId}`).emit('customerSendData',data) ; 
            }
        });
        socket.on('userRemoveRequest',function(){
            setTimeout(function(){
                let waitingAccept = db.get('items').filter({status : 'Waiting accept'}).value() ;          

                var admin = mapList.find(function(element){
                    return element.customId === 'admin' ;
                });
                io.to(`${admin.socketId}`).emit('displayNewRequest',waitingAccept) ; 
            },2000) ; 
        });
        socket.on('checkLogin',function(data){
            var cmp = db.get('users').find(
                {
                    id : data.id, pass : md5(md5(data.pass))
                }
            ).value();
            if (cmp){
                socket.emit('loginSuccess') ; 
            } else socket.emit('errorLogin') ; 
        }); 
        socket.on('checkReg',function(data){
            var cmp = db.get('users').find(
                {
                    id : data.id
                }
            ).value();
            if (cmp){
                socket.emit('errorReg') ; 
            } else socket.emit('regSuccess') ; 
        }); 
        socket.on('profile',function(data){
            var cmp = db.get('users').find(
                {
                    id : data.id, pass : md5(md5(data.pass))
                }
            ).value();
            if (cmp){
                socket.emit('changeSuccess') ; 
            } else socket.emit('wrongPass') ; 
        });
        socket.on('requestAdmin',function(data){
            var cmp = db.get('users').find(
                {
                    id : data.id, pass : md5(md5(data.pass))
                }
            ).value();
            if (cmp){
                socket.emit('requestSuccess') ; 
            } else socket.emit('wrongPass') ; 
        });
    }) ; 
}

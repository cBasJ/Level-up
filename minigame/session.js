const P=require('./platform');
const authority=require('./authority');
const E=authority.E;
const clone=x=>JSON.parse(JSON.stringify(x));
class Session{
 constructor(change,error){this.change=change;this.error=error;this.online=false;this.active=true;this.pending=new Map();this.offset=0;this.sequence=0;this.botAt=0;this.timer=setInterval(()=>this.update(),60);}
 solo(settings,profile,testDeal){this.disconnect();this.online=false;this.local={code:'单机练习',revision:0,members:['你','西山','北风','东篱'].map((name,i)=>({id:String(i),name:i===0?profile.name:name,avatar:i===0?profile.avatar:i,ready:false})),settings,levels:[settings.startLevel,settings.startLevel],dealer:0,round:1,game:null,updatedAt:Date.now()};this.testDeal=testDeal;this.startSolo();}
 startSolo(){authority.start(this.local,Date.now());if(this.testDeal){const g=this.local.game,deck=[...g.deck,...g.bottom],s='S',ranks=Array.from({length:13},(_,i)=>i+2).filter(r=>r!==g.level),wanted=deck.filter(c=>c.s===s&&ranks.slice(0,2).includes(c.r)).concat(deck.find(c=>c.s==='J'&&c.r===16));let remaining=deck.filter(c=>!wanted.some(w=>w.id===c.id)),j=0,k=0;for(let i=0;i<100;i++){const p=(g.dealer+3*i)%4;g.deck[i]=p===0&&j<wanted.length?wanted[j++]:remaining[k++];}g.bottom=remaining.slice(k);}
 this.publish();}
 publish(){const next=authority.view(this.local,'0',new Set(['0','1','2','3']));this.receive(clone(next));}
 receive(next){const old=this.room;this.room=next;this.change(next,old);}
 update(){if(!this.active)return;this.updateAuto();if(this.online||!this.local)return;const g=this.local.game,now=Date.now();if(['dealing','bidding'].includes(g.phase)&&now>this.botAt){this.botAt=now+1800;for(const p of [3,2,1]){if(g.passed?.[p])continue;const options=E.bidOptions(g.hands[p],g.level,g.currentBid,p);if(options.length&&Math.random()<.45){authority.act(this.local,p,'bid',{choice:options[0].choice},now);this.publish();break;}}}
 if(g.phase==='playing'&&g.turn!==0&&g.deadline-now>800)g.deadline=now+800;
 if(g.phase==='bury'&&g.turn!==0&&g.deadline-now>900)g.deadline=now+900;
 if(this.replayUntil&&now<this.replayUntil){g.deadline+=60;return;}
 if(g.phase==='playing'&&g.turn===0)return;
 if(authority.tick(this.local,now))this.publish();}
 updateAuto(){const r=this.room,g=r?.game,lastCard=g?.phase==='playing'&&g.turn===r.seat&&g.hand.length===1&&!E.legal(g.hand,g.hand,g.plays[0]?.cards,g);if((!this.auto&&!lastCard)||!g||!['bidding','bury','playing'].includes(g.phase))return;const mine=g.phase==='bidding'?!g.passed?.[r.seat]:g.turn===r.seat;if(!mine){this.autoKey=null;return;}const key=[g.id,g.phase,g.trick,g.turn,g.hand.map(c=>c.id).join(','),g.plays.map(p=>p.player+':'+p.cards.map(c=>c.id).join(',')).join('|')].join(':');if(this.autoKey!==key){this.autoKey=key;this.autoAt=Date.now()+350;this.autoSent=false;return;}if(this.autoSent||Date.now()<this.autoAt||(this.replayUntil&&Date.now()<this.replayUntil))return;if(this.online&&!this.authenticated)return;this.autoSent=true;if(g.phase==='bidding')this.command('pass');else{const cards=g.phase==='bury'?[...g.hand].sort((a,b)=>E.points([a])-E.points([b])||E.rank(a,g)-E.rank(b,g)).slice(0,8):E.choose(g.hand,g.plays,g,r.seat);this.command(g.phase==='bury'?'bury':'play',{cards:cards.map(c=>c.id)});}}
 command(type,data={}){if(!this.online){try{if(type==='ready'){this.startSolo();return;}authority.act(this.local,0,type,data,Date.now());this.publish();}catch(e){this.error(e.message);}return;}
 if(!this.authenticated){this.error('正在恢复连接，请稍后再试');return;}const message={type,id:Date.now().toString(36)+'-'+(++this.sequence).toString(36),revision:this.room?.revision,...data};this.pending.set(message.id,message);this.socket.send({data:JSON.stringify(message)});}
 async connect(base,profile,action){this.disconnect();this.online=true;this.base=base.replace(/\/$/,'');this.action=action;this.stopped=false;let identities=P.read('identities',{});this.identity=identities[this.base];if(!this.identity){this.identity=await P.request(this.base,'/api/session','POST',{name:profile.name});identities[this.base]=this.identity;P.write('identities',identities);}this.open();}
 open(){if(this.stopped)return;const socket=this.socket=wx.connectSocket({url:this.base.replace(/^http/,'ws')+'/ws'});socket.onOpen(()=>socket.send({data:JSON.stringify({type:'auth',token:this.identity.token})}));socket.onMessage(({data})=>{let m;try{m=JSON.parse(data);}catch{return;}if(m.type==='authenticated'){this.authenticated=true;for(const value of this.pending.values())socket.send({data:JSON.stringify(value)});if(!m.roomCode&&this.action){const action=this.action;this.action=null;this.command(action.type,action.data);}}
 if(m.type==='snapshot'){this.offset=m.serverTime-Date.now();this.receive(m.room);}if(m.type==='ack')this.pending.delete(m.id);if(m.type==='left'){this.room=null;this.change(null,null);}if(m.type==='error'){this.pending.delete(m.id);this.error(m.message);if(!this.authenticated){this.stopped=true;const all=P.read('identities',{});delete all[this.base];P.write('identities',all);socket.close();}}});socket.onError(()=>this.error('连接失败，请检查服务器地址和开发工具域名设置'));socket.onClose(e=>{this.authenticated=false;if(this.stopped)return;if(e.code===4001){this.stopped=true;this.error('当前账号已在其他页面连接');return;}this.retry=setTimeout(()=>this.open(),1500);});}
 disconnect(){this.auto=false;this.autoKey=null;this.stopped=true;clearTimeout(this.retry);this.socket?.close();this.socket=null;this.authenticated=false;this.pending.clear();this.room=null;this.local=null;}
 pause(){this.active=false;this.pausedAt=Date.now();}
 resume(){if(this.local?.game)this.local.game.deadline+=Date.now()-(this.pausedAt||Date.now());this.active=true;}
 destroy(){this.disconnect();clearInterval(this.timer);}
}
module.exports={Session,E};

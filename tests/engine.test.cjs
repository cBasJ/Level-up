const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../engine.js');
const ctx={level:2,trump:'H'};
let seq=0;const c=(s,r)=>({s,r,id:String(seq++)}),pair=(s,r)=>[c(s,r),c(s,r)];
test('108 unique cards and 200 scoring points',()=>{const d=E.deck();assert.equal(d.length,108);assert.equal(new Set(d.map(c=>c.id)).size,108);assert.equal(E.points(d),200);});
test('trump ordering and level removal from side-suit sequence',()=>{const x={level:7,trump:'H'};assert.equal(E.category(c('S',7),x),'T');assert.equal(E.category(c('S',8),x),'S');const ordered=[c('H',14),c('S',7),c('H',7),c('J',15),c('J',16)];for(let i=1;i<ordered.length;i++)assert.equal(E.rank(ordered[i],x),E.rank(ordered[i-1],x)+1);assert.equal(E.pattern([...pair('S',6),...pair('S',8)],x).type,'tractor');assert.equal(E.pattern([...pair('H',14),...pair('S',7)],x).type,'tractor');assert.equal(E.pattern([...pair('S',7),...pair('C',7)],x),null);});
test('follow suit, follow pair and reject duplicate card ids',()=>{const p=pair('S',5),other=c('H',8),single=c('S',9),hand=[...p,other,single];assert.match(E.legal(hand,[other],[c('S',6)],ctx),/花色/);assert.match(E.legal(hand,[p[0],single],pair('S',6),ctx),/对子/);assert.equal(E.legal(hand,p,pair('S',6),ctx),'');assert.ok(E.legal(hand,[p[0],p[0]],null,ctx));});
test('tractors require available runs before disconnected pairs',()=>{const run=[...pair('S',4),...pair('S',5)],gap=pair('S',9),hand=[...run,...gap];const lead=[...pair('S',10),...pair('S',11)];assert.equal(E.legal(hand,run,lead,ctx),'');assert.ok(E.legal(hand,[...run.slice(0,2),...gap],lead,ctx));const short=[...pair('S',4),c('S',9),c('C',8)];assert.equal(E.legal(short,short,lead,ctx),'');});
test('void trump must match shape to win; first wins equal rank',()=>{const lead=pair('S',14),mixed=[c('H',8),c('H',9)],trump=pair('H',3);assert.equal(E.winner([{player:0,cards:lead},{player:1,cards:mixed}],ctx),0);assert.equal(E.winner([{player:0,cards:lead},{player:1,cards:trump}],ctx),1);assert.equal(E.winner([{player:0,cards:[c('S',2)]},{player:1,cards:[c('C',2)]}],ctx),0);});
test('scoring thresholds',()=>{for(const [score,defend,steps] of [[0,true,3],[35,true,2],[40,true,1],[75,true,1],[80,false,0],[115,false,0],[120,false,1],[160,false,2]])assert.deepEqual(E.settle(score),{defend,steps});});
test('auction strength ladder, card ownership, and equal-rank rejection',()=>{
 const s=pair('S',2),h=pair('H',2),sj=pair('J',15),bj=pair('J',16);
 let current={...E.declaration(s,'S1',2),player:0};
 assert.equal(E.bidError(h,'H1',2,current,1),'反主必须高于当前档位，同档不能互反。');
 assert.equal(E.bidError(h,'H2',2,current,1),'');current={...E.declaration(h,'H2',2),player:1};
 assert.ok(E.bidError(s,'S2',2,current,0));assert.equal(E.bidError(sj,'SJ',2,current,3),'');
 current={...E.declaration(sj,'SJ',2),player:3};assert.equal(current.trump,'NT');
 assert.equal(E.bidError(bj,'BJ',2,current,0),'');current={...E.declaration(bj,'BJ',2),player:0};
 assert.equal(E.bidOptions([...h,...sj],2,current,1).length,0);
 assert.ok(E.bidError([sj[0]],'SJ',2,null,0));assert.ok(E.bidError([...s], 'H2',2,null,0));
 assert.ok(E.bidError([s[0],s[0]],'S2',2,null,0));assert.equal(E.declaration(h,'unknown',2),null);
 assert.equal(s.length,2);assert.equal(bj.length,2);
});
test('same-suit reinforcement allowed, changing own trump forbidden, re-counter after an opponent allowed',()=>{
 const s=pair('S',7),h=pair('H',7),bj=pair('J',16),hand=[...s,...h,...bj];
 const current={...E.declaration(s,'S1',7),player:0};
 assert.equal(E.bidError(hand,'S2',7,current,0),'');assert.ok(E.bidError(hand,'H2',7,current,0));assert.ok(E.bidError(hand,'BJ',7,current,0));
 const opponent={...E.declaration(h,'H2',7),player:1};assert.equal(E.bidError(hand,'BJ',7,opponent,0),'');
});
test('no-trump levels are equal; small joker adjoins level; ordinary suits stay separate',()=>{
 const nt={level:7,trump:'NT'};
 for(const suit of E.SUITS){assert.equal(E.category(c(suit,7),nt),'T');assert.equal(E.category(c(suit,14),nt),suit);assert.equal(E.rank(c(suit,7),nt),12);}
 assert.equal(E.rank(c('J',15),nt),13);assert.equal(E.rank(c('J',16),nt),14);
 assert.equal(E.pattern([...pair('H',7),...pair('J',15)],nt).type,'tractor');
 assert.equal(E.pattern([...pair('C',7),...pair('J',15),...pair('J',16)],nt).type,'tractor');
 assert.equal(E.pattern([...pair('C',7),...pair('H',7)],nt),null);
 assert.equal(E.pattern([c('C',7),c('H',7)],nt),null);
 assert.equal(E.winner([{player:0,cards:pair('H',7)},{player:1,cards:pair('C',7)}],nt),0);
 assert.equal(E.winner([{player:0,cards:[c('H',14)]},{player:1,cards:[c('S',14)]}],nt),0);
 assert.equal(E.winner([{player:0,cards:[c('H',14)]},{player:1,cards:[c('S',7)]}],nt),1);
});
test('100 seeded full games finish, every AI action legal, all cards conserved',()=>{let seed=73421;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};let tractors=0;for(let game=0;game<100;game++){const ctx={level:2+game%13,trump:[...E.SUITS,'NT'][game%5]},d=E.deck(random),hands=[0,1,2,3].map(i=>d.slice(i*25,i*25+25));let turn=game%4,rounds=0,seen=[];while(hands[0].length){const plays=[];for(let i=0;i<4;i++){const cards=E.choose(hands[turn],plays,ctx,turn);assert.ok(cards?.length);assert.equal(E.legal(hands[turn],cards,plays[0]?.cards,ctx),'',`game ${game}, player ${turn}`);if(!i&&E.shape(cards,ctx).type==='tractor')tractors++;const ids=new Set(cards.map(c=>c.id));hands[turn]=hands[turn].filter(c=>!ids.has(c.id));plays.push({player:turn,cards});seen.push(...cards);turn=(turn+1)%4;}turn=E.winner(plays,ctx);assert.ok(++rounds<=25);}assert.ok(hands.every(h=>h.length===0));assert.equal(seen.length,100);assert.equal(new Set(seen.map(c=>c.id)).size,100);assert.equal(E.points(seen)+E.points(d.slice(100)),200);}assert.ok(tractors>0);});

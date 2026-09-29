const {test}=require('node:test'),assert=require('node:assert/strict'),E=require('../engine.js');
const ctx={level:2,trump:'H'};
test('emptying a side suit never reorders the remaining suit groups',()=>{
 for(const trump of [...E.SUITS,'NT']){
  const ctx={level:2,trump},hand=E.deck().filter(c=>c.r===9),original=E.sort(hand,ctx);
  for(const removed of E.SUITS){const remaining=hand.filter(c=>c.s!==removed);assert.deepEqual(E.sort(remaining,ctx).map(c=>c.id),original.filter(c=>c.s!==removed).map(c=>c.id));}
 }
});
test('side suit groups alternate colors whenever both colors are available',()=>{
 for(const trump of [...E.SUITS,'NT']){
  const d=E.deck().filter(c=>c.r===9),sorted=E.sort(d,{level:2,trump});
  const groups=[...new Set(sorted.map(c=>E.category(c,{level:2,trump})))].filter(s=>s!=='T');
  for(let i=1;i<groups.length;i++)assert.notEqual('SC'.includes(groups[i]),'SC'.includes(groups[i-1]));
  assert.equal(sorted.length,d.length);
 }
});
test('forced cards are the intersection of legal follows, including pairs and partial suits',()=>{
 const d=E.deck(),take=(s,r,n=1)=>d.filter(c=>c.s===s&&c.r===r).slice(0,n);
 const lead=take('S',8,2),pair=take('S',9,2),single=take('S',10),off=take('D',9);
 assert.deepEqual(E.forcedCards([...pair,...single,...off],lead,ctx),pair);
 assert.equal(E.forcedCards([...pair,...take('S',11,2),...off],lead,ctx).length,0);
 assert.deepEqual(E.forcedCards([...single,...off,...take('D',10)],lead,ctx),single);
 assert.deepEqual(E.forcedCards([...single,...off],take('S',8),ctx),single);
});
function take(deck,s,r,n=1){return deck.filter(c=>c.s===s&&c.r===r).slice(0,n);}
test('public throw hints require unseen stronger cards to be exhausted and work in every category',()=>{
 const deck=E.deck();
 for(const s of E.SUITS){
  const hand=[...take(deck,s,14),...take(deck,s,13)],seen=deck.filter(c=>E.category(c,ctx)===E.category(hand[0],ctx)&&E.rank(c,ctx)>E.rank(hand[1],ctx)&&!hand.some(h=>h.id===c.id));
  assert.equal(E.publicThrowIds(hand,[],ctx).size,0);
  assert.equal(E.publicThrowIds(hand,seen,ctx).size,2);
 }
 const hand=[...take(deck,'S',14,2),...take(deck,'S',13)];
 assert.equal(E.publicThrowIds(hand,[],ctx).size,3,'own top pair proves no unseen ace can beat king');
 assert.equal(E.publicThrowIds(take(deck,'S',14,2),[],ctx).size,0,'a lone pair is not a throw');
});
test('void inference distinguishes all trumps from side suits, including partial follow',()=>{
 const d=E.deck();
 assert.equal(E.revealedVoid(take(d,'S',14,2),[...take(d,'S',9),...take(d,'D',9)],ctx),'S');
 assert.equal(E.revealedVoid(take(d,'H',14),take(d,'C',2),ctx),null);
 assert.equal(E.revealedVoid(take(d,'C',2),take(d,'S',9),ctx),'T');
 assert.equal(E.revealedVoid(take(d,'S',14),take(d,'S',9),ctx),null);
});
test('every hinted combination is safe even if all unseen cards belong to one opponent',()=>{
 for(let i=0;i<250;i++){
  const deck=E.deck(),hand=deck.slice(0,25),played=deck.slice(25,70+i%30),unknown=deck.slice(70+i%30),ctx={level:2+i%13,trump:[...E.SUITS,'NT'][i%5]};
  const ids=E.publicThrowIds(hand,played,ctx);
  for(const cat of ['T',...E.SUITS]){
   const cards=hand.filter(c=>ids.has(c.id)&&E.category(c,ctx)===cat);if(!cards.length)continue;
   assert.equal(E.shape(cards,ctx).type,'throw');assert.equal(E.checkThrow(cards,[hand,unknown],0,ctx).ok,true);
  }
 }
});

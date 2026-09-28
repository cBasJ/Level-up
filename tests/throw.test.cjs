const {test}=require('node:test');const assert=require('node:assert/strict');const E=require('../engine.js');
let i=0;const c=(s,r)=>({s,r,id:'t'+i++}),p=(s,r)=>[c(s,r),c(s,r)],ctx={level:2,trump:'H'};
test('main-level tractor pairs stay adjacent despite intervening side-level singles',()=>{
 const main=p('H',2),side=p('S',2),small=p('J',15),single=c('C',2);
 const hand=[single,...side,...main,...small,c('H',14)];
 const sorted=E.sort(hand,ctx),ids=new Set([...main,...side,...small].map(c=>c.id));
 const indices=sorted.flatMap((c,i)=>ids.has(c.id)?[i]:[]);
 assert.equal(indices.at(-1)-indices[0],5);assert.equal(new Set(sorted.map(c=>c.id)).size,hand.length);
 assert.deepEqual(E.sort(sorted,ctx),sorted);
});
test('stars distinguish jokers, main level, side level and ordinary trump',()=>{
 assert.equal(E.stars(c('J',15),ctx),2);assert.equal(E.stars(c('J',16),ctx),2);assert.equal(E.stars(c('H',2),ctx),2);
 assert.equal(E.stars(c('S',2),ctx),1);assert.equal(E.stars(c('H',14),ctx),1);assert.equal(E.stars(c('S',14),ctx),0);
 assert.equal(E.stars(c('S',2),{...ctx,trump:'NT'}),1);
});
test('mixed same-category throw decomposes to tractors, pairs and singles',()=>{
 const cards=[...p('S',12),...p('S',13),...p('S',9),c('S',14)];
 const s=E.shape(cards,ctx);assert.equal(s.type,'throw');assert.deepEqual(s.parts.map(p=>p.n),[4,2,1]);
 assert.equal(E.shape([c('S',5),c('C',5)],ctx),null);
 const top=[c('S',14),...p('S',13)];assert.ok(E.checkThrow(top,[top,[c('S',12)],[...p('C',14)],[]],0,ctx).ok);
 assert.equal(E.bottomMultiplier(cards,ctx),8);assert.equal(E.bottomMultiplier([c('S',14),c('S',13)],ctx),2);
});
test('failed throw forces only the smallest beatable component and checks partners too',()=>{
 const a=c('S',14),low=c('S',9),topPair=p('S',13),cards=[a,...topPair,low];
 const failed=E.checkThrow(cards,[cards,[],[c('S',10)],[]],0,ctx);assert.equal(failed.ok,false);assert.deepEqual(failed.cards,[low]);
 const pair=p('S',8),mix=[a,...pair];const result=E.checkThrow(mix,[mix,p('S',9),[],[]],0,ctx);
 assert.equal(result.ok,false);assert.deepEqual(result.cards,pair);
 assert.ok(E.checkThrow([a,...topPair],[[a,...topPair],[c('S',14)],[],[]],0,ctx).ok,'equal single does not defeat A; one A cannot defeat pair K');
});
test('follow a throw: preserve required pairs and tractors without inventing extra obligations',()=>{
 const lead=[c('S',14),...p('S',12)],pair=p('S',6),singles=[c('S',4),c('S',8),c('S',9)],hand=[...pair,...singles];
 assert.ok(E.legal(hand,singles,lead,ctx));assert.equal(E.legal(hand,[...pair,singles[0]],lead,ctx),'');
 const allSingles=[c('S',14),c('S',13)];assert.equal(E.legal(hand,singles.slice(0,2),allSingles,ctx),'');
 const longLead=[...p('S',10),...p('S',11),...p('S',6),c('S',14)],run=[...p('S',3),...p('S',4)],other=[...p('S',7),...p('S',9)],h=[...run,...other,c('S',5)];
 assert.equal(E.legal(h,[...run,...other.slice(0,2),h.at(-1)],longLead,ctx),'');
 assert.ok(E.legal(h,[...run.slice(0,2),...other,h.at(-1)],longLead,ctx));
});
test('throw cuts need matching full structure, higher trumps can overcut',()=>{
 const lead=[c('S',14),...p('S',13)],partial=[c('S',4),...p('H',7)],bad=[c('H',6),c('H',8),c('H',9)],cut=[...p('H',3),c('H',6)],over=[...p('H',4),c('H',5)];
 const base={player:0,cards:lead};
 assert.equal(E.winner([base,{player:1,cards:partial},{player:2,cards:bad}],ctx),0);
 assert.equal(E.winner([base,{player:1,cards:cut}],ctx),1);
 assert.equal(E.winner([base,{player:1,cards:cut},{player:2,cards:over}],ctx),2);
 const singles=[c('S',14),c('S',13)];assert.equal(E.winner([{player:0,cards:singles},{player:1,cards:p('H',3)}],ctx),1,'a pair can supply two single trump cards');
});
test('AI follows mixed throws legally and can cut a full long tractor',()=>{
 const lead=[...p('S',10),...p('S',11),c('S',14)],hand=[...p('S',3),...p('S',4),c('S',8),c('H',14)];
 const answer=E.choose(hand,[{player:0,cards:lead}],ctx,1);assert.equal(E.legal(hand,answer,lead,ctx),'');
 const voidHand=[...p('H',3),...p('H',4),c('H',8),c('C',4)];const cut=E.choose(voidHand,[{player:0,cards:lead}],ctx,1);
 assert.equal(E.legal(voidHand,cut,lead,ctx),'');assert.equal(E.winner([{player:0,cards:lead},{player:1,cards:cut}],ctx),1);
});
test('tractor marks identify adjacent exact pairs across skipped level and no-trump levels',()=>{
 const context={level:7,trump:'H'},run=[...p('S',6),...p('S',8)],notRun=[...p('S',10),c('S',11)];
 assert.deepEqual([...E.tractorIds([...run,...notRun],context)].sort(),run.map(c=>c.id).sort());
 const ntRun=[...p('C',7),...p('J',15)];assert.equal(E.tractorIds(ntRun,{level:7,trump:'NT'}).size,4);
});
test('mixed-throw rounds conserve cards and score in 80 seeded games',()=>{
 let seed=73;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};let throws=0;
 for(let g=0;g<80;g++){
  const ctx={level:2+g%13,trump:[...E.SUITS,'NT'][g%5]},deck=E.deck(random),hands=[0,1,2,3].map(i=>deck.slice(i*25,i*25+25));let turn=g%4,rounds=0,seen=[];
  while(hands[0].length){
   const plays=[];
   for(let i=0;i<4;i++){
    let cards;
    if(i===0){const cat=E.category(hands[turn][0],ctx),candidate=hands[turn].filter(c=>E.category(c,ctx)===cat);cards=E.checkThrow(candidate,hands,turn,ctx).cards;if(E.shape(cards,ctx).type==='throw')throws++;}
    else cards=E.choose(hands[turn],plays,ctx,turn);
    assert.equal(E.legal(hands[turn],cards,plays[0]?.cards,ctx),'');
    const ids=new Set(cards.map(c=>c.id));hands[turn]=hands[turn].filter(c=>!ids.has(c.id));plays.push({player:turn,cards});seen.push(...cards);turn=(turn+1)%4;
   }
   turn=E.winner(plays,ctx);assert.ok(++rounds<=25);
  }
  assert.ok(hands.every(h=>h.length===0));assert.equal(new Set(seen.map(c=>c.id)).size,100);assert.equal(E.points(seen)+E.points(deck.slice(100)),200);
 }
 assert.ok(throws>0);
});

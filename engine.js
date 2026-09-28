(function (root) {
  'use strict';
  const SUITS = ['S', 'H', 'C', 'D'];
  const symbol = { S: '♠', H: '♥', C: '♣', D: '♦', J: '★' };
  const label = r => ({11:'J',12:'Q',13:'K',14:'A',15:'小王',16:'大王'})[r] || String(r);
  const key = c => c.s + c.r;
  const points = cards => cards.reduce((n,c) => n + (c.r === 5 ? 5 : c.r === 10 || c.r === 13 ? 10 : 0), 0);
  function deck(random = Math.random) {
    const cards = [];
    for (let d=0;d<2;d++) { for (const s of SUITS) for (let r=2;r<=14;r++) cards.push({id:`${d}-${s}-${r}`,s,r}); for(let r=15;r<=16;r++) cards.push({id:`${d}-J-${r}`,s:'J',r}); }
    for(let i=cards.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [cards[i],cards[j]]=[cards[j],cards[i]]; }
    return cards;
  }
  const category = (c,ctx) => c.s === 'J' || c.r === ctx.level || c.s === ctx.trump ? 'T' : c.s;
  const stars = (c,ctx) => c.s==='J'||(c.r===ctx.level&&c.s===ctx.trump)?2:category(c,ctx)==='T'?1:0;
  function rank(c,ctx) {
    if(ctx.trump==='NT') {
      if(c.s==='J') return c.r===16?14:13;
      if(c.r===ctx.level) return 12;
    }
    if(c.s === 'J') return c.r === 16 ? 15 : 14;
    if(c.r === ctx.level) return c.s === ctx.trump ? 13 : 12;
    return c.r - 2 - (c.r > ctx.level ? 1 : 0);
  }
  function sort(cards,ctx) {
    const available=SUITS.filter(s=>cards.some(c=>category(c,ctx)===s));
    const black=available.filter(s=>s==='S'||s==='C'),red=available.filter(s=>s==='H'||s==='D');
    let nextBlack=black.length===red.length?['H','D','NT',null,undefined].includes(ctx.trump):black.length>red.length;
    const order=['T'];while(black.length||red.length){const preferred=nextBlack?black:red,other=nextBlack?red:black;order.push((preferred.length?preferred:other).shift());nextBlack=!nextBlack;}
    const ordered=[...cards].sort((a,b) => order.indexOf(category(a,ctx))-order.indexOf(category(b,ctx)) || rank(b,ctx)-rank(a,ctx) || a.s.localeCompare(b.s) || a.id.localeCompare(b.id));
    const pp=pairs(ordered.filter(c=>category(c,ctx)==='T'),ctx);
    const main=pp.find(p=>p[0].s===ctx.trump&&p[0].r===ctx.level);
    if(!main)return ordered;
    const chain=[main],base=rank(main[0],ctx);
    for(const direction of [-1,1])for(let r=base+direction;;r+=direction){
      const pair=pp.find(p=>rank(p[0],ctx)===r);if(!pair)break;chain.push(pair);
    }
    if(chain.length===1)return ordered;
    const ids=new Set(chain.flat().map(c=>c.id)),start=ordered.findIndex(c=>ids.has(c.id));
    const block=ordered.filter(c=>ids.has(c.id)),rest=ordered.filter(c=>!ids.has(c.id));
    rest.splice(start,0,...block);return rest;
  }
  // Declarations reveal cards but never remove them from the hand.
  function declaration(hand,choice,level) {
    let suit,rankValue,count,strength,trump;
    if(choice==='SJ'||choice==='BJ') {suit='J';rankValue=choice==='SJ'?15:16;count=2;strength=choice==='SJ'?3:4;trump='NT';}
    else if(/^[SHCD][12]$/.test(choice)) {suit=choice[0];rankValue=level;count=Number(choice[1]);strength=count;trump=suit;}
    else return null;
    const cards=hand.filter(c=>c.s===suit&&c.r===rankValue).slice(0,count);
    if(cards.length!==count || new Set(cards.map(c=>c.id)).size!==count)return null;
    return {choice,trump,strength,cards};
  }
  function bidError(hand,choice,level,current,player) {
    const bid=declaration(hand,choice,level);
    if(!bid)return '手中尚无足够的亮主牌。';
    if(!current)return '';
    if(bid.strength<=current.strength)return '反主必须高于当前档位，同档不能互反。';
    if(current.player===player && !(current.strength===1&&bid.strength===2&&bid.trump===current.trump))return '不能换花色反自己，只能补同花色对子自保。';
    return '';
  }
  function bidOptions(hand,level,current,player) {
    return [...SUITS.flatMap(s=>[s+'1',s+'2']),'SJ','BJ'].filter(choice=>!bidError(hand,choice,level,current,player)).map(choice=>declaration(hand,choice,level));
  }
  function pairs(cards,ctx) {
    const map = new Map(); for(const c of cards) { const k=key(c); if(!map.has(k)) map.set(k,[]); map.get(k).push(c); }
    return [...map.values()].filter(a=>a.length===2).sort((a,b)=>rank(a[0],ctx)-rank(b[0],ctx));
  }
  function pattern(cards,ctx) {
    if(!cards.length) return null;
    const cat=category(cards[0],ctx); if(cards.some(c=>category(c,ctx)!==cat)) return null;
    if(cards.length===1) return {type:'single',cat,n:1,high:rank(cards[0],ctx)};
    const pp=pairs(cards,ctx); if(pp.length*2!==cards.length) return null;
    if(pp.length===1) return {type:'pair',cat,n:2,high:rank(pp[0][0],ctx)};
    for(let i=1;i<pp.length;i++) if(rank(pp[i][0],ctx)!==rank(pp[i-1][0],ctx)+1) return null;
    return {type:'tractor',cat,n:cards.length,high:rank(pp.at(-1)[0],ctx)};
  }
  function combinations(arr,n,fn,start=0,chosen=[]) {
    if(!n) { fn(chosen); return; }
    for(let i=start;i<=arr.length-n;i++) combinations(arr,n-1,fn,i+1,[...chosen,arr[i]]);
  }
  function components(cards,ctx) {
    const pp=pairs(cards,ctx),parts=[],used=new Set();
    let remaining=[...pp];
    while(remaining.length){
      const byRank=new Map();for(const p of remaining){const r=rank(p[0],ctx);if(!byRank.has(r))byRank.set(r,p);}
      let best=[],run=[];
      for(const r of [...byRank.keys()].sort((a,b)=>a-b)){
        if(run.length&&r!==rank(run.at(-1)[0],ctx)+1)run=[];
        run.push(byRank.get(r));if(run.length>best.length)best=[...run];
      }
      const group=best.flat();group.forEach(c=>used.add(c.id));
      parts.push({...pattern(group,ctx),cards:group});remaining=remaining.filter(p=>!used.has(p[0].id));
    }
    for(const c of cards)if(!used.has(c.id))parts.push({...pattern([c],ctx),cards:[c]});
    return parts.sort((a,b)=>b.n-a.n||b.high-a.high);
  }
  function shape(cards,ctx) {
    if(!cards.length||cards.some(c=>category(c,ctx)!==category(cards[0],ctx)))return null;
    const simple=pattern(cards,ctx),parts=components(cards,ctx);
    return {...(simple||{type:'throw',cat:category(cards[0],ctx),n:cards.length,high:Math.max(...cards.map(c=>rank(c,ctx)))}),parts};
  }
  function groupsOfSize(cards,n,ctx) {
    if(n===1)return cards.map(c=>[c]);
    const result=[];combinations(pairs(cards,ctx),n/2,set=>{const group=set.flat();if(pattern(group,ctx))result.push(group);});
    return result;
  }
  function checkThrow(cards,hands,player,ctx) {
    const lead=shape(cards,ctx);
    if(!lead)return {ok:false,cards:[],error:'甩牌必须属于同一花色，或全部为主牌。'};
    if(lead.type!=='throw')return {ok:true,cards};
    const blocked=lead.parts.filter(part=>hands.some((hand,i)=>i!==player&&groupsOfSize(hand.filter(c=>category(c,ctx)===lead.cat),part.n,ctx).some(group=>pattern(group,ctx).high>part.high)));
    if(!blocked.length)return {ok:true,cards};
    blocked.sort((a,b)=>a.n-b.n||a.high-b.high);
    return {ok:false,cards:blocked[0].cards,error:'甩牌失败，自动改出被压制的最小组合。'};
  }
  // Conservative hints use only our hand and committed, publicly played cards.
  function publicThrowIds(hand,played,ctx){
    const known=new Map();for(const c of [...hand,...played])known.set(key(c),(known.get(key(c))||0)+1);
    const unseen=[];
    for(const s of [...SUITS,'J'])for(let r=s==='J'?15:2;r<=(s==='J'?16:14);r++){
      for(let n=known.get(s+r)||0;n<2;n++)unseen.push({id:'unseen-'+s+r+'-'+n,s,r});
    }
    const marked=new Set();
    for(const cat of ['T',...SUITS]){
      const own=hand.filter(c=>category(c,ctx)===cat);if(own.length<2)continue;
      const unknown=unseen.filter(c=>category(c,ctx)===cat),pairRanks=[...new Set(pairs(unknown,ctx).map(p=>rank(p[0],ctx)))].sort((a,b)=>a-b);
      const candidates=[...components(own,ctx),...own.map(c=>({...pattern([c],ctx),cards:[c]})),...pairs(own,ctx).map(p=>({...pattern(p,ctx),cards:p}))];
      const safe=new Map();
      for(const part of candidates){
        let beaten;
        if(part.n===1)beaten=unknown.some(c=>rank(c,ctx)>part.high);
        else{
          const length=part.n/2;
          beaten=pairRanks.some((high,i)=>high>part.high&&i>=length-1&&high-pairRanks[i-length+1]===length-1);
        }
        if(!beaten)for(const c of part.cards)safe.set(c.id,c);
      }
      const cards=[...safe.values()];
      if(shape(cards,ctx)?.type==='throw')for(const c of cards)marked.add(c.id);
    }
    return marked;
  }
  function revealedVoid(lead,cards,ctx){
    if(!lead?.length)return null;
    const cat=category(lead[0],ctx);
    return cards.some(c=>category(c,ctx)!==cat)?cat:null;
  }
  // A response can split a longer tractor or a pair to match the lead's components.
  function matchingSignature(cards,lead,ctx) {
    if(cards.length!==lead.n||!cards.length||cards.some(c=>category(c,ctx)!==category(cards[0],ctx)))return null;
    const demands=lead.parts.filter(p=>p.n>1).map(p=>p.n),memo=new Map();
    function solve(rest,index){
      if(index===demands.length)return rest.map(c=>rank(c,ctx)).sort((a,b)=>b-a);
      const key=index+':'+rest.map(c=>c.id).sort().join(',');if(memo.has(key))return memo.get(key);
      let best=null;
      for(const group of groupsOfSize(rest,demands[index],ctx)){
        const ids=new Set(group.map(c=>c.id)),tail=solve(rest.filter(c=>!ids.has(c.id)),index+1);
        if(tail){const signature=[pattern(group,ctx).high,...tail];if(!best||compare(signature,best)>0)best=signature;}
      }
      memo.set(key,best);return best;
    }
    return solve(cards,0);
  }
  function bottomMultiplier(lead,ctx){const largest=shape(lead,ctx).parts[0].n;return largest===1?2:2**(largest/2+1);}
  function tractorIds(hand,ctx){
    const ids=new Set();
    for(const cat of ['T',...SUITS]){
      const pp=pairs(hand.filter(c=>category(c,ctx)===cat),ctx),ranks=new Set(pp.map(p=>rank(p[0],ctx)));
      for(const p of pp){const r=rank(p[0],ctx);if(ranks.has(r-1)||ranks.has(r+1))p.forEach(c=>ids.add(c.id));}
    }
    return ids;
  }
  // A tractor response must preserve the longest available runs, then pairs.
  function profile(pp,ctx) {
    const counts=new Map(); for(const p of pp) {const r=rank(p[0],ctx); counts.set(r,(counts.get(r)||0)+1);}
    const runs=[];
    while(counts.size) {
      const rr=[...counts.keys()].sort((a,b)=>a-b); let best=[],run=[];
      for(const r of rr) { if(run.length && r!==run.at(-1)+1) run=[]; run.push(r); if(run.length>best.length) best=[...run]; }
      runs.push(best.length);
      for(const r of best) {const count=counts.get(r)-1; if(count) counts.set(r,count); else counts.delete(r);}
    }
    return runs.sort((a,b)=>b-a);
  }
  function compare(a,b) { for(let i=0;i<Math.max(a.length,b.length);i++) {const d=(a[i]||0)-(b[i]||0); if(d) return d;} return 0; }
  function followProfile(pp,lead,ctx) {
    const tractors=lead.parts.filter(p=>p.n>2).map(p=>p.n/2),pairCount=lead.parts.filter(p=>p.n===2).length,memo=new Map();
    function solve(rest,index){
      if(index===tractors.length)return [Math.min(pairCount,rest.length)];
      const key=index+':'+rest.map(p=>p[0].id).sort().join(',');if(memo.has(key))return memo.get(key);
      const n=tractors[index],count=Math.min(n,rest.length);let best=null;
      combinations(rest,count,chosen=>{
        const used=new Set(chosen.map(p=>p[0].id)),signature=profile(chosen,ctx);
        while(signature.length<n)signature.push(0);
        const candidate=[...signature,...solve(rest.filter(p=>!used.has(p[0].id)),index+1)];
        if(!best||compare(candidate,best)>0)best=candidate;
      });
      memo.set(key,best);return best;
    }
    return solve(pp,0);
  }
  function bestPairSets(cards,n,ctx,lead) {
    const pp=pairs(cards,ctx),needed=lead.parts.reduce((sum,p)=>sum+(p.n>1?p.n/2:0),0),count=Math.min(needed,pp.length); let best=[],sets=[];
    combinations(pp,count,set=> {const p=followProfile(set,lead,ctx),diff=compare(p,best); if(diff>0) {best=p;sets=[set];} else if(diff===0) sets.push(set);});
    return {best,sets};
  }
  function legal(hand,cards,lead,ctx) {
    if(!cards.length) return '请先选择要出的牌。';
    if(new Set(cards.map(c=>c.id)).size!==cards.length || cards.some(c=>!hand.some(h=>h.id===c.id))) return '所选牌不在手牌中。';
    if(!lead) return shape(cards,ctx) ? '' : '首出或甩牌必须同一花色，或全部为主牌。';
    if(cards.length!==lead.length) return `本轮需要跟 ${lead.length} 张牌。`;
    const p=shape(lead,ctx);if(!p)return '首出牌型无效。';
    const available=hand.filter(c=>category(c,ctx)===p.cat),chosen=cards.filter(c=>category(c,ctx)===p.cat);
    if(chosen.length!==Math.min(available.length,lead.length)) return p.cat==='T' ? '有主牌时必须先跟主牌。' : `必须先跟足 ${symbol[p.cat]} 花色。`;
    if(available.length>=lead.length && lead.length>1) {
      const best=bestPairSets(available,lead.length,ctx,p).best;
      if(compare(followProfile(pairs(chosen,ctx),p,ctx),best)!==0) return p.type==='pair' ? '有同花色对子时必须跟对子。' : '请按首出组合，优先跟拖拉机，再尽量跟足对子。';
    }
    return '';
  }
  function winner(plays,ctx) {
    if(!plays.length)return null;
    const lead=shape(plays[0].cards,ctx); let win=plays[0],bestCat=lead.cat,best=matchingSignature(plays[0].cards,lead,ctx);
    for(const play of plays.slice(1)) {const signature=matchingSignature(play.cards,lead,ctx),cat=category(play.cards[0],ctx);if(!signature||(cat!==lead.cat&&cat!=='T'))continue;
      if((cat==='T'&&bestCat!=='T')||(cat===bestCat&&compare(signature,best)>0)){win=play;bestCat=cat;best=signature;}
    }
    return win.player;
  }
  function forcedCards(hand,lead,ctx){
    if(!lead?.length||hand.length<lead.length)return [];
    const n=lead.length,cat=category(lead[0],ctx),same=hand.filter(c=>category(c,ctx)===cat);
    if(hand.length===n)return [...hand];
    if(same.length<=n)return same;
    const {sets}=bestPairSets(same,n,ctx,shape(lead,ctx));
    let intersection=null;
    for(const set of sets){
      const picked=set.flat(),ids=new Set(picked.map(c=>c.id)),rest=same.filter(c=>!ids.has(c.id));
      if(rest.length===n-picked.length)for(const c of rest)ids.add(c.id);
      intersection=intersection===null?ids:new Set([...intersection].filter(id=>ids.has(id)));
      if(!intersection.size)break;
    }
    return hand.filter(c=>intersection?.has(c.id));
  }
  function suggestions(hand,lead,ctx) {
    const cheap=(a,b)=>points([a])-points([b]) || rank(a,ctx)-rank(b,ctx);
    if(!lead) {
      const result=hand.map(c=>[c]);
      for(const cat of ['T',...SUITS]) {const pp=pairs(hand.filter(c=>category(c,ctx)===cat),ctx); result.push(...pp); combinations(pp,2,set=>{const cards=set.flat();if(pattern(cards,ctx))result.push(cards);});}
      // Conservative throws use only our own hand: every missing copy could be held by an opponent.
      const unknown=[];
      for(const s of [...SUITS,'J'])for(let r=s==='J'?15:2;r<=(s==='J'?16:14);r++){
        const held=hand.filter(c=>c.s===s&&c.r===r).length;
        for(let copy=held;copy<2;copy++)unknown.push({s,r,id:'unknown-'+s+'-'+r+'-'+copy});
      }
      for(const cat of ['T',...SUITS]){
        const cards=hand.filter(c=>category(c,ctx)===cat);
        if(cards.length>1&&shape(cards,ctx).type==='throw'&&checkThrow(cards,[hand,unknown],0,ctx).ok)result.push(cards);
      }
      return result;
    }
    const cat=category(lead[0],ctx),same=hand.filter(c=>category(c,ctx)===cat).sort(cheap),n=lead.length;
    if(same.length<n) {
      const off=hand.filter(c=>category(c,ctx)!==cat).sort((a,b)=>(category(a,ctx)==='T')-(category(b,ctx)==='T') || cheap(a,b));
      const result=[[...same,...off.slice(0,n-same.length)]];
      if(!same.length) for(const suit of ['T',...SUITS].filter(s=>s!==cat)){
        const suited=hand.filter(c=>category(c,ctx)===suit);
        if(suited.length>=n)result.push(...sameSuitResponses(suited,lead,ctx));
      }
      return result;
    }
    if(n===1) return same.map(c=>[c]);
    return sameSuitResponses(same,lead,ctx);
  }
  function sameSuitResponses(cards,lead,ctx){
    const n=lead.length,{sets}=bestPairSets(cards,n,ctx,shape(lead,ctx)),result=[];
    for(const set of sets){
      const picked=set.flat(),ids=new Set(picked.map(c=>c.id));
      const remaining=cards.filter(c=>!ids.has(c.id)).sort((a,b)=>points([a])-points([b])||rank(a,ctx)-rank(b,ctx));
      result.push([...picked,...remaining.slice(0,n-picked.length)]);
      if(n>picked.length)result.push([...picked,...remaining.slice().sort((a,b)=>rank(b,ctx)-rank(a,ctx)).slice(0,n-picked.length)]);
    }
    return result;
  }
  function choose(hand,plays,ctx,player) {
    const candidates=suggestions(hand,plays[0]?.cards,ctx);
    const score=cards=> {
      const strength=cards.reduce((n,c)=>n+rank(c,ctx)+(category(c,ctx)==='T'?20:0),0);
      if(!plays.length) return cards.length*12-strength*.7-points(cards)*.6;
      const before=winner(plays,ctx),after=winner([...plays,{player,cards}],ctx),team=player%2;
      if(before%2===team && after%2===team) return points(cards)*4-strength*.3;
      return (after===player?65+points(plays.flatMap(p=>p.cards))*2:0)-strength*.35-points(cards)*2;
    };
    return candidates.sort((a,b)=>score(b)-score(a))[0];
  }
  function settle(score) { return score===0 ? {defend:true,steps:3} : score<40 ? {defend:true,steps:2} : score<80 ? {defend:true,steps:1} : {defend:false,steps:Math.floor((score-80)/40)}; }
  const api={SUITS,symbol,label,key,points,deck,category,stars,rank,sort,declaration,bidError,bidOptions,pairs,pattern,shape,checkThrow,publicThrowIds,revealedVoid,bottomMultiplier,tractorIds,forcedCards,legal,winner,suggestions,choose,settle};
  if(typeof module!=='undefined') module.exports=api; else root.Tractor=api;
})(typeof globalThis!=='undefined'?globalThis:this);

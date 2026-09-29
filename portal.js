(()=>{
  'use strict';const $=id=>document.getElementById(id);let identity=null,avatar=0,destination='';
  try{identity=JSON.parse(localStorage.getItem('tractor-online-user')||'null');}catch{}
  const isProfile=document.body.dataset.page==='profile';let toastTimer;
  function toast(text){$('portalToast').textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('portalToast').textContent='',4000);}
  async function api(url,method='GET',body){const r=await fetch(url,{method,headers:{'Content-Type':'application/json',...(identity?{Authorization:'Bearer '+identity.token}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Object.assign(Error(data.error||'请求失败，请稍后重试'),{status:r.status});return data;}
  function saveIdentity(user){identity=user;localStorage.setItem('tractor-online-user',JSON.stringify(user));}
  function show(profile){
    if(identity)saveIdentity({...identity,name:profile.name,avatar:profile.avatar});
    $('profileName').textContent=profile.name;$('profileAvatar').className='portrait avatar-'+profile.avatar;
    if(!isProfile){$('profileSubtitle').textContent=profile.bio||'查看资料与战绩 →';return;}
    avatar=profile.avatar;$('editName').value=profile.name;$('editBio').value=profile.bio;$('playerId').textContent='玩家 ID · '+profile.id.slice(0,8);
    document.querySelectorAll('[data-avatar]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.avatar)===avatar)));
    $('gamesPlayed').textContent=profile.stats.games;$('gamesWon').textContent=profile.stats.wins;$('winRate').textContent=profile.stats.games?Math.round(profile.stats.wins/profile.stats.games*100)+'%':'—';
    if(profile.history.length){$('recentGames').replaceChildren();for(const game of profile.history){const row=document.createElement('div');row.className='record-row';const result=document.createElement('b');result.textContent=game.won?'获胜':'落败';const details=document.createElement('span');details.textContent='打 '+({11:'J',12:'Q',13:'K',14:'A'}[game.level]||game.level)+' · '+({S:'黑桃',H:'红桃',C:'梅花',D:'方片',NT:'无主'}[game.trump]||'无主');const date=document.createElement('small');date.textContent=new Date(Number(game.date)).toLocaleString('zh-CN');details.append(date);const points=document.createElement('span');points.textContent='闲家 '+game.score+' 分';row.append(result,details,points);$('recentGames').append(row);}}
  }
  async function load(){if(!identity)return;try{const profile=await api('/api/profile');saveIdentity({...identity,name:profile.name});show(profile);}catch(e){if(e.status===401){identity=null;localStorage.removeItem('tractor-online-user');}else toast('资料暂时未能加载，请检查服务连接');}}
  if(isProfile){
    document.querySelectorAll('[data-avatar]').forEach(button=>button.onclick=()=>{avatar=Number(button.dataset.avatar);$('profileAvatar').className='portrait avatar-'+avatar;document.querySelectorAll('[data-avatar]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));});
    $('profileForm').onsubmit=async event=>{event.preventDefault();$('saveProfile').disabled=true;try{const name=$('editName').value.trim();if(!identity)saveIdentity(await api('/api/session','POST',{name}));const profile=await api('/api/profile','PATCH',{name,avatar,bio:$('editBio').value});saveIdentity({...identity,name:profile.name});show(profile);toast('资料已保存');}catch(e){toast(e.message);}finally{$('saveProfile').disabled=false;}};
  }else{
    $('openRules').onclick=$('dockRules').onclick=()=>$('rulesDialog').showModal();$('closeRules').onclick=()=>$('rulesDialog').close();
    function enter(url){destination=url;if(identity)location.href=url;else $('identityDialog').showModal();}
    $('createRoom').onclick=()=>location.href='friends.html';$('joinRoom').onsubmit=e=>{e.preventDefault();enter('online.html?action=join&code='+encodeURIComponent($('inviteCode').value));};
    $('closeIdentity').onclick=()=>$('identityDialog').close();$('createIdentity').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('.gold-button');button.disabled=true;try{saveIdentity(await api('/api/session','POST',{name:$('guestName').value.trim()}));location.href=destination;}catch(error){toast(error.message);button.disabled=false;}};
  }
  load();
})();

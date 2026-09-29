(()=>{
 const $=id=>document.getElementById(id),form=$('roomSettings');
 for(let r=2;r<=14;r++){const o=document.createElement('option');o.value=r;o.textContent=({11:'J',12:'Q',13:'K',14:'A'})[r]||r;$('startLevel').append(o);}
 try{const saved=JSON.parse(localStorage.getItem('tractor-room-settings')||'null');if(saved)for(const key of ['rounds','level','seconds'])if(saved[key]!=null)form.elements[key].value=saved[key];}catch{}
 form.onsubmit=e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form));localStorage.setItem('tractor-room-settings',JSON.stringify(data));location.href='online.html?action=create&'+new URLSearchParams(data);};
 $('openJoin').onclick=()=>$('joinDialog').showModal();$('closeJoin').onclick=()=>$('joinDialog').close();$('joinFriends').onsubmit=e=>{e.preventDefault();location.href='online.html?action=join&code='+encodeURIComponent($('friendCode').value);};
})();

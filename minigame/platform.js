// All host APIs are isolated here; no DOM or browser globals in the game client.
const KEY='changwan-minigame';
function read(key,fallback){try{return wx.getStorageSync(KEY+':'+key)||fallback;}catch{return fallback;}}
function write(key,value){try{wx.setStorageSync(KEY+':'+key,value);}catch{}}
function request(base,path,method='GET',data,token){return new Promise((resolve,reject)=>wx.request({url:base.replace(/\/$/,'')+path,method,data,header:{'content-type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},success:r=>r.statusCode>=200&&r.statusCode<300?resolve(r.data):reject(Error(r.data?.error||'服务请求失败')),fail:e=>reject(Error(e.errMsg||'无法连接服务器'))}));}
function input(title,value=''){return new Promise(resolve=>wx.showModal({title,editable:true,placeholderText:value,content:value,success:r=>resolve(r.confirm?(r.content||'').trim():null),fail:()=>resolve(null)}));}
function confirm(title,content){return new Promise(resolve=>wx.showModal({title,content,success:r=>resolve(r.confirm),fail:()=>resolve(false)}));}
const toast=text=>wx.showToast({title:String(text),icon:'none',duration:2300});
module.exports={read,write,request,input,confirm,toast};

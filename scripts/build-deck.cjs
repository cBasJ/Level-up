// Original vector card faces, rasterized once for identical rendering in all clients.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('@playwright/test');
const out=path.resolve(__dirname,'../assets/cards');fs.mkdirSync(out,{recursive:true});
const suits={
 H:'M50 92C40 80 4 57 4 30C4 4 34 0 50 23C66 0 96 4 96 30C96 57 60 80 50 92Z',
 D:'M50 3L94 50L50 97L6 50Z',
 S:'M50 3C39 19 5 41 5 62C5 89 36 91 47 71L39 96H61L53 71C64 91 95 89 95 62C95 41 61 19 50 3Z',
 C:'M50 5C27 5 23 34 37 43C14 32 -1 52 7 70C14 89 36 85 47 69L39 96H61L53 69C64 85 86 89 93 70C101 52 86 32 63 43C77 34 73 5 50 5Z'
};
const pip=(s,x,y,size=46,rotate=false)=>`<g transform="translate(${x},${y}) ${rotate?'rotate(180)':''}"><path d="${suits[s]}" transform="translate(${-size/2},${-size/2}) scale(${size/100})"/></g>`;
function svg(s,r){
 const red=s==='H'||s==='D',ink=red?'#b93532':'#20352e',label=({11:'J',12:'Q',13:'K',14:'A'})[r]||r;
 const index=`<text x="18" y="87" fill="${ink}" font-family="Arial,sans-serif" font-size="86" font-weight="600" letter-spacing="-7">${label}</text><g fill="${ink}">${pip(s,48,132,65)}</g>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect x="1" y="1" width="298" height="448" rx="18" fill="#fffdf9" stroke="#b5a57b" stroke-width="2"/>${index}</svg>`;
}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{const page=await browser.newPage({viewport:{width:300,height:450},deviceScaleFactor:2});
 for(const s of ['S','H','C','D'])for(let r=2;r<=14;r++){
   const source=svg(s,r);fs.writeFileSync(path.join(out,`${s}${r}.svg`),source);
   await page.setContent(`<style>html,body{margin:0;width:300px;height:450px;background:transparent}svg{display:block}</style>${source}`);
   await page.screenshot({path:path.join(out,`${s}${r}.png`),omitBackground:true});
 }
 const back=`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><defs><pattern id="leaves" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M20 4Q38 20 20 36Q2 20 20 4Z" fill="none" stroke="#799570" stroke-width="1.5"/><path d="M20 7V33" stroke="#799570"/></pattern></defs><rect x="1" y="1" width="298" height="448" rx="18" fill="#fff9e9" stroke="#b5a57b" stroke-width="2"/><rect x="12" y="12" width="276" height="426" rx="12" fill="#244e3d"/><rect x="20" y="20" width="260" height="410" rx="8" fill="url(#leaves)" stroke="#d4bb7a" stroke-width="2"/><path d="M150 125L225 225L150 325L75 225Z" fill="#234b38" stroke="#dfc785" stroke-width="3"/><g fill="#ead59d">${pip('S',150,220,95)}</g><circle cx="150" cy="152" r="4" fill="#dfc785"/><circle cx="150" cy="298" r="4" fill="#dfc785"/></svg>`;
 fs.writeFileSync(path.join(out,'back.svg'),back);await page.setContent(`<style>html,body{margin:0;width:300px;height:450px;background:transparent}svg{display:block}</style>${back}`);await page.screenshot({path:path.join(out,'back.png'),omitBackground:true});
 console.log('52 exact vector faces and 600×900 PNG faces written to assets/cards');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

// Shared by the local game and the network client: one coordinate system and hand fan.
(()=>{
  function fit(element){
    const viewport=window.visualViewport,css=getComputedStyle(document.documentElement),inset=s=>parseFloat(css.getPropertyValue('--safe-'+s))||0;
    const left=inset('left'),top=inset('top'),vw=(viewport?.width||innerWidth)-left-inset('right'),vh=(viewport?.height||innerHeight)-top-inset('bottom'),portrait=vh>vw;
    const width=Math.max(1440,840*vw/vh),height=width*vh/vw,scale=vw/width;
    element.classList.toggle('compact',height<760);
    Object.assign(element.style,{width:width+'px',height:height+'px',left:((viewport?.offsetLeft||0)+left+vw/2)+'px',top:((viewport?.offsetTop||0)+top+vh/2)+'px',transform:`translate(-50%,-50%) scale(${scale})`});
  }
  function hand(element){
    const cards=[...element.children],width=cards[0]?.offsetWidth||88,step=Math.min(40,(element.clientWidth-width)/Math.max(1,cards.length-1));
    element.style.setProperty('--step',step+'px');element.style.setProperty('--hand-rank',Math.min(30,(step-7)/1.14)+'px');
    cards.forEach((c,i)=>{c.style.marginLeft=i?(step-width)+'px':'0';c.style.zIndex=String(i+1);});
  }
  function plays(element){
    const cards=[...element.querySelectorAll(':scope > .card')],width=cards[0]?.offsetWidth||66,step=Math.min(33,(element.clientWidth-width)/Math.max(1,cards.length-1));
    cards.forEach((c,i)=>c.style.marginLeft=i?(step-width)+'px':'0');
  }
  window.TableLayout={fit,hand,plays};
})();

(()=>{
  function apply(element,card){
    element.classList.add('image-card');
    const image=document.createElement('img');image.className='card-face';image.src=`assets/cards/${card.s}${card.r}.png`;image.alt='';image.draggable=false;
    element.prepend(image);
  }
  window.CardArt={apply};
})();

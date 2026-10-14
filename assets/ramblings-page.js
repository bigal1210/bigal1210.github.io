const params=new URL(location.href).searchParams;
if(params.has('object')||params.get('preview')==='baseball-writing'){
 const url=new URL('ramblings-content.html',location.href);
 url.search=location.search;
 location.replace(url.href);
}else{
 import('./stonehenge.js?v=ready-transition-1').catch(error=>{
  document.querySelector('#loading').hidden=true;
  document.querySelector('#fallback').hidden=false;
  document.querySelector('.hint').hidden=true;
  console.error('Ramblings could not load:',error);
 });
}

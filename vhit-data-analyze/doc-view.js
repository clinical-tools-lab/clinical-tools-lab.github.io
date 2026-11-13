document.addEventListener('click',event=>{
 const a=event.target.closest('a');if(!a)return;
 if(a.hasAttribute('data-vault-resource')){event.preventDefault();parent.postMessage({type:'atlas:resource',path:a.dataset.vaultResource},location.origin);}
 if(a.hasAttribute('data-vault-close')){event.preventDefault();parent.postMessage({type:'atlas:close',hash:a.dataset.vaultClose},location.origin);}
});

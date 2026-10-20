// Static, application-owned bootstrap: resolve before paint without server access to browser storage.
export const themeScript = `(function(){var p='system';try{var v=localStorage.getItem('commerce-admin-theme');if(v==='dark'||v==='light')p=v}catch(e){}document.documentElement.dataset.theme=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p})()`;
